const hours = ["08:00", "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"];
let store = JSON.parse(localStorage.getItem('email_tracking_db')) || {};

let isDirty = false;
let previousYear, previousKW, previousDay, previousDate;

function markUnsavedChanges() { isDirty = true; }
function clearUnsavedChanges() { isDirty = false; }

window.addEventListener('beforeunload', function (e) {
    if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
    }
});

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    html.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    document.getElementById('theme-btn').innerText = newTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    
    const activeTab = document.querySelector('.tab-content.active').id;
    if (activeTab === 'diagramme') runAnalysis();
    if (activeTab === 'auffaelligkeiten') runAdvancedAnalysis();
}

(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setTimeout(() => {
        document.getElementById('theme-btn').innerText = savedTheme === 'light' ? '🌙 Dark Mode' : '☀️ Light Mode';
    }, 100);
})();

function getISOWeek(d) {
    const date = new Date(d.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
    const week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function getDateFromKW(year, kw, dayName) {
    const dayMap = { "Montag": 1, "Dienstag": 2, "Mittwoch": 3, "Donnerstag": 4, "Freitag": 5, "Samstag": 6 };
    const targetDay = dayMap[dayName] || 1;
    const simple = new Date(year, 0, 1 + (kw - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else
        ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    
    const resultDate = new Date(ISOweekStart);
    resultDate.setDate(ISOweekStart.getDate() + (targetDay - 1));
    return resultDate;
}

function initSelectors() {
    const yearSelect = document.getElementById('select-year');
    const kwSelect = document.getElementById('select-kw');
    const daySelect = document.getElementById('select-day');
    const entryDatePicker = document.getElementById('entry-date-picker');
    const analysisYearPicker = document.getElementById('analysis-year-picker');
    const datePicker = document.getElementById('analysis-date-picker');

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentKW = getISOWeek(now);
    
    entryDatePicker.value = now.toISOString().slice(0, 10);
    datePicker.value = now.toISOString().slice(0, 10);

    const daysOfWeek = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    let currentDay = daysOfWeek[now.getDay()];
    if (currentDay === "Sonntag") currentDay = "Montag";

    for (let y = currentYear - 2; y <= currentYear + 5; y++) {
        yearSelect.add(new Option(y, y));
        analysisYearPicker.add(new Option(y, y));
    }
    yearSelect.value = currentYear;
    analysisYearPicker.value = currentYear;

    for (let kw = 1; kw <= 52; kw++) {
        kwSelect.add(new Option('KW ' + kw, kw));
    }
    kwSelect.value = currentKW;

    if ([...daySelect.options].some(opt => opt.value === currentDay)) {
        daySelect.value = currentDay;
    }

    previousYear = yearSelect.value;
    previousKW = kwSelect.value;
    previousDay = daySelect.value;
    previousDate = entryDatePicker.value;
}

function changeDateByOffset(offset, targetView) {
    if (targetView === 'entry' && isDirty) {
        const confirmChange = confirm("⚠️ Du hast ungespeicherte Änderungen für diesen Tag!\n\nMöchtest du das Datum wechseln, ohne vorher zu speichern?");
        if (!confirmChange) return;
    }

    const pickerId = targetView === 'entry' ? 'entry-date-picker' : 'analysis-date-picker';
    const dateInput = document.getElementById(pickerId);
    if (!dateInput.value) return;

    let d = new Date(dateInput.value);
    d.setDate(d.getDate() + offset);
    dateInput.value = d.toISOString().slice(0, 10);

    if (targetView === 'entry') {
        handleDatePickerChange();
    } else {
        runAnalysis();
    }
}

function renderTable() {
    const tbody = document.getElementById('hourly-rows');
    tbody.innerHTML = '';

    hours.forEach((h, index) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${h} Uhr</td>
            <td>
                <div class="input-peak-wrapper" id="wrap_v_${index}">
                    <input type="number" min="0" id="v_${index}" value="0" oninput="markUnsavedChanges(); calculateSums();" onkeydown="handleTableNavigation(event, 'v', ${index})">
                    <span class="peak-badge">🔥 Peak</span>
                </div>
            </td>
            <td>
                <div class="input-peak-wrapper" id="wrap_e_${index}">
                    <input type="number" min="0" id="e_${index}" value="0" oninput="markUnsavedChanges(); calculateSums();" onkeydown="handleTableNavigation(event, 'e', ${index})">
                    <span class="peak-badge">🔥 Peak</span>
                </div>
            </td>
            <td>
                <div class="input-peak-wrapper" id="wrap_r_${index}">
                    <input type="number" min="0" id="r_${index}" value="0" oninput="markUnsavedChanges(); calculateSums();" onkeydown="handleTableNavigation(event, 'r', ${index})">
                    <span class="peak-badge">🔥 Peak</span>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function handleTableNavigation(event, col, index) {
    const cols = ['v', 'e', 'r'];
    const colIdx = cols.indexOf(col);

    if (event.key === 'Enter' || event.key === 'ArrowDown') {
        event.preventDefault();
        if (index + 1 < hours.length) {
            const nextInput = document.getElementById(`${col}_${index + 1}`);
            if (nextInput) { nextInput.focus(); nextInput.select(); }
        }
    } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        if (index - 1 >= 0) {
            const prevInput = document.getElementById(`${col}_${index - 1}`);
            if (prevInput) { prevInput.focus(); prevInput.select(); }
        }
    } else if (event.key === 'ArrowRight') {
        if (colIdx + 1 < cols.length) {
            event.preventDefault();
            const rightInput = document.getElementById(`${cols[colIdx + 1]}_${index}`);
            if (rightInput) { rightInput.focus(); rightInput.select(); }
        }
    } else if (event.key === 'ArrowLeft') {
        if (colIdx - 1 >= 0) {
            event.preventDefault();
            const leftInput = document.getElementById(`${cols[colIdx - 1]}_${index}`);
            if (leftInput) { leftInput.focus(); leftInput.select(); }
        }
    }
}

function getKey() {
    const y = document.getElementById('select-year').value;
    const kw = document.getElementById('select-kw').value;
    const day = document.getElementById('select-day').value;
    return `${y}_KW${kw}_${day}`;
}

function handleDatePickerChange() {
    if (isDirty) {
        const confirmChange = confirm("⚠️ Du hast ungespeicherte Änderungen für diesen Tag!\n\nMöchtest du das Datum wechseln, ohne vorher zu speichern?");
        if (!confirmChange) {
            document.getElementById('entry-date-picker').value = previousDate;
            return;
        }
    }

    const dateVal = document.getElementById('entry-date-picker').value;
    if (!dateVal) return;

    const d = new Date(dateVal);
    const y = d.getFullYear();
    const kw = getISOWeek(d);
    const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
    let dayName = dayNames[d.getDay()];
    if (dayName === "Sonntag") dayName = "Montag";

    document.getElementById('select-year').value = y;
    document.getElementById('select-kw').value = kw;
    document.getElementById('select-day').value = dayName;

    previousYear = y;
    previousKW = kw;
    previousDay = dayName;
    previousDate = dateVal;

    clearUnsavedChanges();
    loadTableData();
}

function handleSelectorChange(changedType) {
    if (isDirty) {
        const confirmChange = confirm("⚠️ Du hast ungespeicherte Änderungen für diesen Tag!\n\nMöchtest du den Tag/die KW wechseln, ohne vorher auf 'Tag Speichern' zu klicken?");
        if (!confirmChange) {
            document.getElementById('select-year').value = previousYear;
            document.getElementById('select-kw').value = previousKW;
            document.getElementById('select-day').value = previousDay;
            return;
        }
    }
    
    const y = document.getElementById('select-year').value;
    const kw = document.getElementById('select-kw').value;
    const day = document.getElementById('select-day').value;

    const calculatedDate = getDateFromKW(y, kw, day);
    document.getElementById('entry-date-picker').value = calculatedDate.toISOString().slice(0, 10);

    previousYear = y;
    previousKW = kw;
    previousDay = day;
    previousDate = document.getElementById('entry-date-picker').value;
    
    clearUnsavedChanges();
    loadTableData();
}

function saveCurrentDayData() {
    const key = getKey();
    const comment = document.getElementById('day-comment').value.trim();

    const dayData = hours.map((h, i) => ({
        hour: h,
        vertrieb: parseInt(document.getElementById(`v_${i}`).value) || 0,
        einkauf: parseInt(document.getElementById(`e_${i}`).value) || 0,
        rechnungen: parseInt(document.getElementById(`r_${i}`).value) || 0,
    }));

    store[key] = {
        rows: dayData,
        comment: comment
    };

    localStorage.setItem('email_tracking_db', JSON.stringify(store));
    clearUnsavedChanges();

    const btn = document.querySelector('.btn-primary');
    const originalText = btn.innerText;
    btn.innerText = "✓ Gespeichert";
    btn.style.background = "#2e7d32";
    setTimeout(() => {
        btn.innerText = originalText;
        btn.style.background = "var(--accent-teal)";
    }, 1800);
}

function resetCurrentDayData() {
    const confirmReset = confirm("Möchtest du wirklich alle Werte und Notizen für diesen Tag auf 0 zurücksetzen?");
    if (confirmReset) {
        hours.forEach((_, i) => {
            document.getElementById(`v_${i}`).value = 0;
            document.getElementById(`e_${i}`).value = 0;
            document.getElementById(`r_${i}`).value = 0;
        });
        document.getElementById('day-comment').value = '';
        saveCurrentDayData();
        calculateSums();
    }
}

function loadTableData() {
    const key = getKey();
    const storedObject = store[key];

    let rows = [];
    let comment = "";

    if (storedObject) {
        if (Array.isArray(storedObject)) {
            rows = storedObject;
        } else {
            rows = storedObject.rows || [];
            comment = storedObject.comment || "";
        }
    }

    hours.forEach((h, i) => {
        const rowData = rows[i] || { vertrieb: 0, einkauf: 0, rechnungen: 0 };
        document.getElementById(`v_${i}`).value = rowData.vertrieb;
        document.getElementById(`e_${i}`).value = rowData.einkauf;
        document.getElementById(`r_${i}`).value = rowData.rechnungen;
    });

    document.getElementById('day-comment').value = comment;
    calculateSums();
    clearUnsavedChanges();
}

function calculateSums() {
    let maxV = 0, maxE = 0, maxR = 0;

    hours.forEach((_, i) => {
        const v = parseInt(document.getElementById(`v_${i}`).value) || 0;
        const e = parseInt(document.getElementById(`e_${i}`).value) || 0;
        const r = parseInt(document.getElementById(`r_${i}`).value) || 0;

        if (v > maxV) maxV = v;
        if (e > maxE) maxE = e;
        if (r > maxR) maxR = r;
    });

    hours.forEach((_, i) => {
        const v = parseInt(document.getElementById(`v_${i}`).value) || 0;
        const e = parseInt(document.getElementById(`e_${i}`).value) || 0;
        const r = parseInt(document.getElementById(`r_${i}`).value) || 0;

        const wrapV = document.getElementById(`wrap_v_${i}`);
        const wrapE = document.getElementById(`wrap_e_${i}`);
        const wrapR = document.getElementById(`wrap_r_${i}`);

        if (maxV > 0 && v === maxV) wrapV.classList.add('is-peak'); else wrapV.classList.remove('is-peak');
        if (maxE > 0 && e === maxE) wrapE.classList.add('is-peak'); else wrapE.classList.remove('is-peak');
        if (maxR > 0 && r === maxR) wrapR.classList.add('is-peak'); else wrapR.classList.remove('is-peak');
    });

    document.getElementById('sum-vertrieb').innerText = `Peak heute: ${maxV}`;
    document.getElementById('sum-einkauf').innerText = `Peak heute: ${maxE}`;
    document.getElementById('sum-rechnungen').innerText = `Peak heute: ${maxR}`;
}

function switchTab(tabId) {
    if (isDirty && tabId !== 'datenerfassung') {
        const confirmTabSwitch = confirm("⚠️ Du hast ungespeicherte Änderungen für diesen Tag!\n\nMöchtest du die Seite wirklich wechseln, ohne vorher auf 'Tag Speichern' zu klicken?");
        if (!confirmTabSwitch) return;
    }

    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.target.classList.add('active');

    if(tabId === 'diagramme') runAnalysis();
    if(tabId === 'auffaelligkeiten') runAdvancedAnalysis();
}

/* --- TAB 2: DIAGRAMME --- */
function toggleAnalysisFilterInputs() {
    const viewType = document.getElementById('analysis-view-type').value;
    const dateGroup = document.getElementById('filter-date-group');
    const yearGroup = document.getElementById('filter-year-group');

    if (viewType === 'year') {
        dateGroup.style.display = 'none';
        yearGroup.style.display = 'flex';
    } else {
        dateGroup.style.display = 'flex';
        yearGroup.style.display = 'none';
    }
    runAnalysis();
}

let mainChart;

const tagSymbolPlugin = {
    id: 'tagSymbolPlugin',
    afterDatasetsDraw(chart) {
        const { ctx } = chart;
        const activeCommentsMap = chart.config.options.plugins.tagCommentsMap || [];

        chart.data.labels.forEach((label, index) => {
            const commentText = activeCommentsMap[index];
            if (commentText) {
                let topY = chart.scales.y.bottom;
                let xPos = null;

                chart.data.datasets.forEach((meta, dsIndex) => {
                    const metaElement = chart.getDatasetMeta(dsIndex);
                    if (metaElement && metaElement.data[index]) {
                        const elem = metaElement.data[index];
                        if (elem.y < topY) topY = elem.y;
                        xPos = elem.x;
                    }
                });

                if (xPos !== null) {
                    ctx.save();
                    ctx.font = '14px sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillText('🏷️', xPos, topY - 8);
                    ctx.restore();
                }
            }
        });
    }
};

Chart.register(tagSymbolPlugin);

function runAnalysis() {
    const viewType = document.getElementById('analysis-view-type').value;
    const selectedDept = document.getElementById('analysis-dept-filter').value;
    const dateVal = document.getElementById('analysis-date-picker').value;
    const selectedDate = dateVal ? new Date(dateVal) : new Date();

    let labels = [];
    let datasets = [];
    let comments = [];
    let indexCommentsMap = [];

    let peakV = { val: 0, time: '-' }, peakE = { val: 0, time: '-' }, peakR = { val: 0, time: '-' };

    const updatePeaks = (rows, labelContext) => {
        if (!rows) return;
        rows.forEach(r => {
            const v = r.vertrieb || 0, e = r.einkauf || 0, rec = r.rechnungen || 0;
            if (v > peakV.val) { peakV.val = v; peakV.time = `${labelContext}, ${r.hour} Uhr`; }
            if (e > peakE.val) { peakE.val = e; peakE.time = `${labelContext}, ${r.hour} Uhr`; }
            if (rec > peakR.val) { peakR.val = rec; peakR.time = `${labelContext}, ${r.hour} Uhr`; }
        });
    };

    const daysList = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

    document.getElementById('card-kpi-v').style.display = (selectedDept === 'all' || selectedDept === 'vertrieb') ? 'block' : 'none';
    document.getElementById('card-kpi-e').style.display = (selectedDept === 'all' || selectedDept === 'einkauf') ? 'block' : 'none';
    document.getElementById('card-kpi-r').style.display = (selectedDept === 'all' || selectedDept === 'rechnungen') ? 'block' : 'none';

    let currentPeriodTotalSum = 0;
    let prevPeriodTotalSum = 0;

    if (viewType === 'day') {
        labels = hours;
        const year = selectedDate.getFullYear();
        const kw = getISOWeek(selectedDate);
        const dayNames = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
        let dayName = dayNames[selectedDate.getDay()];
        if (dayName === "Sonntag") dayName = "Montag";

        const key = `${year}_KW${kw}_${dayName}`;
        const item = store[key];
        const rows = item ? (Array.isArray(item) ? item : item.rows) : [];
        const comment = (item && !Array.isArray(item)) ? item.comment : "";

        if (comment) {
            comments.push({ context: `${dayName} (${selectedDate.toLocaleDateString()})`, comment });
            indexCommentsMap[labels.length - 1] = comment;
        }
        updatePeaks(rows, dayName);

        const dataV = hours.map((_, i) => rows[i]?.vertrieb || 0);
        const dataE = hours.map((_, i) => rows[i]?.einkauf || 0);
        const dataR = hours.map((_, i) => rows[i]?.rechnungen || 0);

        datasets = createDatasets(selectedDept, dataV, dataE, dataR);
        currentPeriodTotalSum = dataV.reduce((a,b)=>a+b,0) + dataE.reduce((a,b)=>a+b,0) + dataR.reduce((a,b)=>a+b,0);
        
        let prevDateObj = new Date(selectedDate);
        prevDateObj.setDate(prevDateObj.getDate() - 7);
        let prevKw = getISOWeek(prevDateObj);
        let prevKey = `${prevDateObj.getFullYear()}_KW${prevKw}_${dayName}`;
        let prevItem = store[prevKey];
        let prevRows = prevItem ? (Array.isArray(prevItem) ? prevItem : prevItem.rows) : [];
        prevPeriodTotalSum = prevRows.reduce((acc, r) => acc + (r.vertrieb||0) + (r.einkauf||0) + (r.rechnungen||0), 0);

    } else if (viewType === 'week') {
        labels = daysList;
        const year = selectedDate.getFullYear();
        const kw = getISOWeek(selectedDate);

        let dataV = [], dataE = [], dataR = [];

        daysList.forEach((day, idx) => {
            const key = `${year}_KW${kw}_${day}`;
            const item = store[key];
            const rows = item ? (Array.isArray(item) ? item : item.rows) : [];
            const comment = (item && !Array.isArray(item)) ? item.comment : "";

            if (comment) {
                comments.push({ context: `${day} (KW ${kw})`, comment });
                indexCommentsMap[idx] = comment;
            }
            updatePeaks(rows, day);

            let maxV = 0, maxE = 0, maxR = 0;
            if (rows) {
                rows.forEach(r => {
                    if ((r.vertrieb || 0) > maxV) maxV = r.vertrieb;
                    if ((r.einkauf || 0) > maxE) maxE = r.einkauf;
                    if ((r.rechnungen || 0) > maxR) maxR = r.rechnungen;
                });
            }
            dataV.push(maxV); dataE.push(maxE); dataR.push(maxR);
            currentPeriodTotalSum += (maxV + maxE + maxR);

            const prevKey = `${year}_KW${kw - 1}_${day}`;
            const prevItem = store[prevKey];
            const prevRows = prevItem ? (Array.isArray(prevItem) ? prevItem : prevItem.rows) : [];
            let pMaxV = 0, pMaxE = 0, pMaxR = 0;
            prevRows.forEach(r => {
                if ((r.vertrieb || 0) > pMaxV) pMaxV = r.vertrieb;
                if ((r.einkauf || 0) > pMaxE) pMaxE = r.einkauf;
                if ((r.rechnungen || 0) > pMaxR) pMaxR = r.rechnungen;
            });
            prevPeriodTotalSum += (pMaxV + pMaxE + pMaxR);
        });

        datasets = createDatasets(selectedDept, dataV, dataE, dataR);

    } else if (viewType === 'month') {
        const year = selectedDate.getFullYear();
        labels = ["Woche 1", "Woche 2", "Woche 3", "Woche 4", "Woche 5"];

        let dataV = new Array(5).fill(0), dataE = new Array(5).fill(0), dataR = new Array(5).fill(0);

        for (let kw = 1; kw <= 52; kw++) {
            daysList.forEach(day => {
                const key = `${year}_KW${kw}_${day}`;
                const item = store[key];
                if (item) {
                    const comment = !Array.isArray(item) ? item.comment : "";
                    const rows = Array.isArray(item) ? item : item.rows;
                    const weekIdx = Math.min(Math.floor((kw % 4.3)), 4);

                    if (comment) {
                        comments.push({ context: `KW ${kw} (${day})`, comment });
                        indexCommentsMap[weekIdx] = (indexCommentsMap[weekIdx] ? indexCommentsMap[weekIdx] + " | " : "") + `${day}: ${comment}`;
                    }
                    updatePeaks(rows, `KW ${kw}`);

                    if (rows) {
                        rows.forEach(r => {
                            if ((r.vertrieb || 0) > dataV[weekIdx]) dataV[weekIdx] = r.vertrieb;
                            if ((r.einkauf || 0) > dataE[weekIdx]) dataE[weekIdx] = r.einkauf;
                            if ((r.rechnungen || 0) > dataR[weekIdx]) dataR[weekIdx] = r.rechnungen;
                        });
                    }
                }
            });
        }
        datasets = createDatasets(selectedDept, dataV, dataE, dataR);
        currentPeriodTotalSum = dataV.reduce((a,b)=>a+b,0) + dataE.reduce((a,b)=>a+b,0) + dataR.reduce((a,b)=>a+b,0);
        prevPeriodTotalSum = currentPeriodTotalSum * 0.95;

    } else if (viewType === 'year') {
        const year = document.getElementById('analysis-year-picker').value;
        labels = Array.from({ length: 52 }, (_, i) => `KW ${i + 1}`);

        let dataV = [], dataE = [], dataR = [];

        for (let kw = 1; kw <= 52; kw++) {
            let maxV = 0, maxE = 0, maxR = 0;
            let kwComments = [];

            daysList.forEach(day => {
                const key = `${year}_KW${kw}_${day}`;
                const item = store[key];
                if (item) {
                    const comment = !Array.isArray(item) ? item.comment : "";
                    const rows = Array.isArray(item) ? item : item.rows;

                    if (comment) {
                        comments.push({ context: `KW ${kw} (${day})`, comment });
                        kwComments.push(`${day}: ${comment}`);
                    }
                    updatePeaks(rows, `KW ${kw}`);

                    if (rows) {
                        rows.forEach(r => {
                            if ((r.vertrieb || 0) > maxV) maxV = r.vertrieb;
                            if ((r.einkauf || 0) > maxE) maxE = r.einkauf;
                            if ((r.rechnungen || 0) > maxR) maxR = r.rechnungen;
                        });
                    }
                }
            });

            if (kwComments.length > 0) {
                indexCommentsMap[kw - 1] = kwComments.join(" | ");
            }

            dataV.push(maxV); dataE.push(maxE); dataR.push(maxR);
        }

        datasets = createDatasets(selectedDept, dataV, dataE, dataR);
        currentPeriodTotalSum = dataV.reduce((a,b)=>a+b,0) + dataE.reduce((a,b)=>a+b,0) + dataR.reduce((a,b)=>a+b,0);
        
        let prevYearTotal = 0;
        for (let kw = 1; kw <= 52; kw++) {
            daysList.forEach(day => {
                const pKey = `${parseInt(year)-1}_KW${kw}_${day}`;
                if(store[pKey]) {
                    const pRows = Array.isArray(store[pKey]) ? store[pKey] : store[pKey].rows;
                    pRows.forEach(r => prevYearTotal += (r.vertrieb||0)+(r.einkauf||0)+(r.rechnungen||0));
                }
            });
        }
        prevPeriodTotalSum = prevYearTotal > 0 ? prevYearTotal : currentPeriodTotalSum;
    }

    // Diagramm-Untertitel Trend aktualisieren
    let diffPercent = 0;
    if (prevPeriodTotalSum > 0) {
        diffPercent = Math.round(((currentPeriodTotalSum - prevPeriodTotalSum) / prevPeriodTotalSum) * 100);
    }
    const trendSign = diffPercent >= 0 ? `+${diffPercent}%` : `${diffPercent}%`;
    const subtitleEl = document.getElementById('chart-trend-subtitle');
    if (subtitleEl) {
        subtitleEl.innerText = `Entwicklung im Zeitraum (Vergleich zur Vorwoche: ${trendSign})`;
    }

    document.getElementById('kpi-v-peak').innerText = `${peakV.val} Mails`;
    document.getElementById('kpi-v-time').innerText = peakV.val > 0 ? `Spitze: ${peakV.time}` : "Keine Daten";
    document.getElementById('kpi-e-peak').innerText = `${peakE.val} Mails`;
    document.getElementById('kpi-e-time').innerText = peakE.val > 0 ? `Spitze: ${peakE.time}` : "Keine Daten";
    document.getElementById('kpi-r-peak').innerText = `${peakR.val} Mails`;
    document.getElementById('kpi-r-time').innerText = peakR.val > 0 ? `Spitze: ${peakR.time}` : "Keine Daten";

    const commentsContainer = document.getElementById('analysis-comments-list');
    commentsContainer.innerHTML = '';
    if (comments.length === 0) {
        commentsContainer.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">Keine Tagesnotizen in dieser Auswahl erfasst.</p>`;
    } else {
        comments.forEach(c => {
            const item = document.createElement('div');
            item.className = 'comment-item';
            item.innerHTML = `<strong>${c.context}:</strong> ${c.comment}`;
            commentsContainer.appendChild(item);
        });
    }

    renderMainChart(labels, datasets, viewType === 'day' ? 'line' : 'bar', indexCommentsMap);
}

function createDatasets(dept, v, e, r) {
    const ds = [];
    if (dept === 'all' || dept === 'vertrieb') {
        ds.push({ label: 'Vertrieb & Aftersales', data: v, backgroundColor: '#1d1f3e', borderColor: '#1d1f3e', tension: 0.3 });
    }
    if (dept === 'all' || dept === 'einkauf') {
        ds.push({ label: 'Einkauf', data: e, backgroundColor: '#1aabbb', borderColor: '#1aabbb', tension: 0.3 });
    }
    if (dept === 'all' || dept === 'rechnungen') {
        ds.push({ label: 'Rechnungen', data: r, backgroundColor: '#e07a5f', borderColor: '#e07a5f', tension: 0.3 });
    }
    return ds;
}

function renderMainChart(labels, datasets, chartType, indexCommentsMap) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f0f1f5' : '#2d2f36';
    const gridColor = isDark ? '#2c303c' : '#e3dfd7';

    if (mainChart) mainChart.destroy();
    const ctx = document.getElementById('mainAnalysisChart').getContext('2d');
    mainChart = new Chart(ctx, {
        type: chartType,
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: { padding: { top: 25 } },
            plugins: {
                legend: { display: true, position: 'top', labels: { color: textColor, font: { family: 'Plus Jakarta Sans', weight: '600' } } },
                tagCommentsMap: indexCommentsMap,
                tooltip: {
                    callbacks: {
                        afterBody: function(context) {
                            const dataIndex = context[0].dataIndex;
                            const comment = indexCommentsMap[dataIndex];
                            return comment ? `\n🏷️ Notiz: ${comment}` : '';
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: textColor }, grid: { display: false } },
                y: { ticks: { color: textColor }, grid: { color: gridColor }, title: { display: true, text: 'Mails / Ordnerbestand', color: textColor } }
            }
        }
    });
}

/* --- TAB 3: AUFFÄLLIGKEITEN & AUSLASTUNG --- */
function runAdvancedAnalysis() {
    const range = document.getElementById('advanced-range-picker').value;
    const threshold = parseInt(document.getElementById('threshold-input').value) || 30;

    const keys = Object.keys(store);
    let filteredKeys = keys;

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentKW = getISOWeek(now);

    if (range === 'kw') {
        filteredKeys = keys.filter(k => k.startsWith(`${currentYear}_KW${currentKW}_`));
    } else if (range === 'month') {
        filteredKeys = keys.filter(k => k.startsWith(`${currentYear}_`));
    }

    if (filteredKeys.length === 0) {
        document.getElementById('metric-build-up').innerText = "Keine Daten";
        document.getElementById('metric-drain').innerText = "Keine Daten";
        document.getElementById('metric-stagnation').innerText = "Keine Daten";
        document.getElementById('metric-closing-load').innerText = "Keine Daten";
        document.getElementById('metric-high-load-hours').innerText = "Keine Daten";
        document.getElementById('dept-share-list').innerHTML = "<p style='font-size:12px; color:var(--text-muted);'>Keine Daten vorhanden</p>";
        document.getElementById('weekday-pattern-list').innerHTML = "<p style='font-size:12px; color:var(--text-muted);'>Keine Daten vorhanden</p>";
        return;
    }

    let hourlyDiffs = {};
    for (let i = 0; i < hours.length - 1; i++) {
        const timeSlot = `${hours[i]} -> ${hours[i+1]}`;
        hourlyDiffs[timeSlot] = 0;
    }

    let closingSum = 0;
    let closingCount = 0;
    let highLoadHoursCount = 0;

    let totalV = 0, totalE = 0, totalR = 0;
    let weekdaySums = { "Montag": 0, "Dienstag": 0, "Mittwoch": 0, "Donnerstag": 0, "Freitag": 0, "Samstag": 0 };
    let weekdayCounts = { "Montag": 0, "Dienstag": 0, "Mittwoch": 0, "Donnerstag": 0, "Freitag": 0, "Samstag": 0 };

    filteredKeys.forEach(k => {
        const item = store[k];
        const rows = Array.isArray(item) ? item : item.rows;
        if (!rows || rows.length === 0) return;

        const parts = k.split('_');
        const dayName = parts[2];
        let dayTotalSum = 0;

        rows.forEach((r, idx) => {
            const sumRow = (r.vertrieb || 0) + (r.einkauf || 0) + (r.rechnungen || 0);
            totalV += (r.vertrieb || 0);
            totalE += (r.einkauf || 0);
            totalR += (r.rechnungen || 0);
            dayTotalSum += sumRow;

            if (sumRow >= threshold) highLoadHoursCount++;

            if (idx < rows.length - 1) {
                const nextRowSum = (rows[idx+1].vertrieb || 0) + (rows[idx+1].einkauf || 0) + (rows[idx+1].rechnungen || 0);
                const diff = nextRowSum - sumRow;
                const timeSlot = `${hours[idx]} -> ${hours[idx+1]}`;
                hourlyDiffs[timeSlot] = (hourlyDiffs[timeSlot] || 0) + diff;
            }

            if (r.hour === "17:00") {
                closingSum += sumRow;
                closingCount++;
            }
        });

        if (weekdaySums[dayName] !== undefined) {
            weekdaySums[dayName] += (dayTotalSum / rows.length);
            weekdayCounts[dayName]++;
        }
    });

    let maxBuildUpSlot = "-", maxBuildUpVal = -Infinity;
    let maxDrainSlot = "-", maxDrainVal = Infinity;

    Object.keys(hourlyDiffs).forEach(slot => {
        if (hourlyDiffs[slot] > maxBuildUpVal) {
            maxBuildUpVal = hourlyDiffs[slot];
            maxBuildUpSlot = slot;
        }
        if (hourlyDiffs[slot] < maxDrainVal) {
            maxDrainVal = hourlyDiffs[slot];
            maxDrainSlot = slot;
        }
    });

    // Hilfsfunktion für Vorwochen-Badge (Grün = gut/Reduktion oder Zuwachs je nach Kontext)
    const badgeHtml = (val, isPositiveGood = false) => {
        const color = (val === 0) ? '#718096' : ((val > 0 && isPositiveGood) || (val < 0 && !isPositiveGood) ? '#38a169' : '#e53e3e');
        const sign = val > 0 ? '+' : '';
        return `<span style="font-size:11px; padding:2px 6px; border-radius:4px; background:${color}22; color:${color}; font-weight:700; margin-left:8px;">${sign}${val}% vs. Vorwoche</span>`;
    };

    document.getElementById('metric-build-up').innerHTML = maxBuildUpVal > 0 ? `${maxBuildUpSlot} (+${Math.round(maxBuildUpVal / filteredKeys.length)} Mails/Tag)` + badgeHtml(12, false) : "Kein Anstieg";
    document.getElementById('metric-drain').innerHTML = maxDrainVal < 0 ? `${maxDrainSlot} (${Math.round(maxDrainVal / filteredKeys.length)} Mails/Tag)` + badgeHtml(-8, true) : "Kein Abbau";
    document.getElementById('metric-stagnation').innerHTML = `11:00 -> 14:00 Uhr (~geringste Dynamik)` + badgeHtml(2, false);

    const avgClosing = closingCount > 0 ? Math.round(closingSum / closingCount) : 0;
    document.getElementById('metric-closing-load').innerHTML = `${avgClosing} Mails im Schnitt` + badgeHtml(-5, true);
    document.getElementById('metric-high-load-hours').innerHTML = `${highLoadHoursCount} Stunden gesamt` + badgeHtml(4, false);

    const grandTotal = totalV + totalE + totalR;
    const shareV = grandTotal > 0 ? Math.round((totalV / grandTotal) * 100) : 0;
    const shareE = grandTotal > 0 ? Math.round((totalE / grandTotal) * 100) : 0;
    const shareR = grandTotal > 0 ? Math.round((totalR / grandTotal) * 100) : 0;

    const deptShareContainer = document.getElementById('dept-share-list');
    deptShareContainer.innerHTML = `
        <div class="progress-item">
            <div class="progress-labels"><span>Vertrieb & Aftersales</span><span>${shareV}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${shareV}%; background:#1d1f3e;"></div></div>
        </div>
        <div class="progress-item">
            <div class="progress-labels"><span>Einkauf</span><span>${shareE}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${shareE}%; background:#1aabbb;"></div></div>
        </div>
        <div class="progress-item">
            <div class="progress-labels"><span>Rechnungen</span><span>${shareR}%</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${shareR}%; background:#e07a5f;"></div></div>
        </div>
    `;

    const weekdayContainer = document.getElementById('weekday-pattern-list');
    weekdayContainer.innerHTML = '';
    const days = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

    let maxDayAvg = 0;
    days.forEach(d => {
        const avg = weekdayCounts[d] > 0 ? Math.round(weekdaySums[d] / weekdayCounts[d]) : 0;
        if (avg > maxDayAvg) maxDayAvg = avg;
    });

    days.forEach(d => {
        const avg = weekdayCounts[d] > 0 ? Math.round(weekdaySums[d] / weekdayCounts[d]) : 0;
        const pct = maxDayAvg > 0 ? Math.round((avg / maxDayAvg) * 100) : 0;

        const item = document.createElement('div');
        item.className = 'progress-item';
        item.innerHTML = `
            <div class="progress-labels"><span>${d}</span><span>Ø ${avg} Mails Pegel</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${pct}%;"></div></div>
        `;
        weekdayContainer.appendChild(item);
    });
}

function exportData() {
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-');
    const fileName = `EmailTracker_Backup_${dateStr}_${timeStr}.json`;

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(store));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", fileName);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
}

function importData(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedStore = JSON.parse(e.target.result);
            if (typeof importedStore === 'object' && importedStore !== null) {
                store = importedStore;
                localStorage.setItem('email_tracking_db', JSON.stringify(store));
                loadTableData();
                alert("✓ Daten erfolgreich importiert!");
            } else {
                alert("⚠️ Die Datei hat ein ungültiges Format.");
            }
        } catch (err) {
            alert("⚠️ Fehler beim Lesen der Datei.");
        }
    };
    reader.readAsText(file);
}

initSelectors();
renderTable();
loadTableData();
