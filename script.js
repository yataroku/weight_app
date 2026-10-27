let myWeightChart = null; // グラフのインスタンス保持用
let currentPeriod = 'all'; // 現在の表示期間 ('week', 'month', 'all')

// ==========================================
// 1. プロフィール関連の処理
// ==========================================
function toggleProfileAccordion() {
    const body = document.getElementById('profileBody');
    const icon = document.getElementById('accordionIcon');
    if (body.style.display === 'none' || body.style.display === '') {
        body.style.display = 'block';
        icon.innerText = '▲ 閉じる';
    } else {
        body.style.display = 'none';
        icon.innerText = '▼ 開く';
    }
}

function calculateFitnessStats() {
    const heightCm = parseFloat(document.getElementById('profileHeight').value);
    const age = parseInt(document.getElementById('profileAge').value);
    const gender = document.getElementById('profileGender').value;
    const activityRate = parseFloat(document.getElementById('profileActivity').value);

    const idealWeightEl = document.getElementById('displayIdealWeight');
    const bmrEl = document.getElementById('displayBMR');
    const tdeeEl = document.getElementById('displayTDEE');

    if (!isNaN(heightCm) && heightCm > 0) {
        const heightM = heightCm / 100;
        const idealWeight = (heightM * heightM * 22).toFixed(1);
        idealWeightEl.innerText = `${idealWeight} kg`;

        if (!isNaN(age)) {
            let bmr = 0;
            if (gender === 'male') {
                bmr = 13.397 * idealWeight + 4.799 * heightCm - 5.677 * age + 88.362;
            } else {
                bmr = 9.247 * idealWeight + 3.098 * heightCm - 4.330 * age + 447.593;
            }
            const roundedBmr = Math.round(bmr);
            bmrEl.innerText = `${roundedBmr} kcal/日`;

            const tdee = Math.round(roundedBmr * activityRate);
            tdeeEl.innerText = `${tdee} kcal/日`;
        } else {
            bmrEl.innerText = '年齢を入力してください';
            tdeeEl.innerText = '--- kcal';
        }
    } else {
        idealWeightEl.innerText = '--- kg';
        bmrEl.innerText = '--- kcal';
        tdeeEl.innerText = '--- kcal';
    }
}

function saveProfileData() {
    const height = parseFloat(document.getElementById('profileHeight').value);
    const age = parseInt(document.getElementById('profileAge').value);
    const gender = document.getElementById('profileGender').value;
    const activity = parseFloat(document.getElementById('profileActivity').value);
    const targetWeight = parseFloat(document.getElementById('profileTargetWeight').value);

    if (isNaN(height) || isNaN(age) || isNaN(targetWeight)) {
        alert('身長・年齢・目標体重を正しく入力してください。');
        return;
    }

    const profile = { height, age, gender, activity, targetWeight };
    localStorage.setItem('my_fitness_profile', JSON.stringify(profile));

    // ※アコーディオンは閉じず、アラート（保存しました通知）も出さないようにしています

    updateWeightChart();
    updateCalorieSummary();
    if (typeof renderCalorieCalendar === 'function') renderCalorieCalendar();
}

// ==========================================
// 2. 毎日の体重記録関連の処理
// ==========================================
function getTodayFormatted() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function onWeightDateChanged() {
    const selectedDate = document.getElementById('weightDate').value;
    loadWeightForDate(selectedDate);
    updateCalorieSummary();
}

function loadWeightForDate(dateStr) {
    let weightHistory = JSON.parse(localStorage.getItem('my_weight_history')) || [];
    const record = weightHistory.find(item => item.date === dateStr);

    if (record) {
        document.getElementById('currentWeightInput').value = record.weight;
    } else {
        document.getElementById('currentWeightInput').value = '';
    }
}

function saveWeightRecord() {
    const date = document.getElementById('weightDate').value;
    const weight = parseFloat(document.getElementById('currentWeightInput').value);

    if (!date || isNaN(weight)) {
        alert('日付と体重を正しく入力してください。');
        return;
    }

    let weightHistory = JSON.parse(localStorage.getItem('my_weight_history')) || [];

    const existingIndex = weightHistory.findIndex(item => item.date === date);
    if (existingIndex >= 0) {
        weightHistory[existingIndex].weight = weight;
    } else {
        weightHistory.push({ date, weight });
    }

    weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
    localStorage.setItem('my_weight_history', JSON.stringify(weightHistory));

    updateWeightChart();
    updateCalorieSummary();
    if (typeof renderCalorieCalendar === 'function') renderCalorieCalendar();
}

// ==========================================
// 3. グラフ描画・更新・期間切り替え処理
// ==========================================
function changeChartPeriod(period) {
    currentPeriod = period;

    const btnWeek = document.getElementById('btnWeek');
    const btnMonth = document.getElementById('btnMonth');
    const btnAll = document.getElementById('btnAll');

    if (btnWeek && btnMonth && btnAll) {
        btnWeek.style.background = '#fff'; btnWeek.style.color = '#1e293b';
        btnMonth.style.background = '#fff'; btnMonth.style.color = '#1e293b';
        btnAll.style.background = '#fff'; btnAll.style.color = '#1e293b';

        if (period === 'week') {
            btnWeek.style.background = '#2563eb'; btnWeek.style.color = '#fff';
        } else if (period === 'month') {
            btnMonth.style.background = '#2563eb'; btnMonth.style.color = '#fff';
        } else {
            btnAll.style.background = '#2563eb'; btnAll.style.color = '#fff';
        }
    }

    updateWeightChart();
}

function updateWeightChart() {
    const ctx = document.getElementById('weightChart');
    if (!ctx) return;

    let weightHistory = JSON.parse(localStorage.getItem('my_weight_history')) || [];
    const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || {};
    const targetWeight = profile.targetWeight || null;

    weightHistory.sort((a, b) => new Date(a.date) - new Date(b.date));

    let filteredHistory = weightHistory;
    if (weightHistory.length > 0) {
        const latestDate = new Date(weightHistory[weightHistory.length - 1].date);

        if (currentPeriod === 'week') {
            const cutoffDate = new Date(latestDate);
            cutoffDate.setDate(cutoffDate.getDate() - 7);
            filteredHistory = weightHistory.filter(item => new Date(item.date) >= cutoffDate);
        } else if (currentPeriod === 'month') {
            const cutoffDate = new Date(latestDate);
            cutoffDate.setDate(cutoffDate.getDate() - 30);
            filteredHistory = weightHistory.filter(item => new Date(item.date) >= cutoffDate);
        }
    }

    const labels = filteredHistory.map(item => item.date);
    const dataValues = filteredHistory.map(item => item.weight);
    const targetValues = labels.map(() => targetWeight);

    if (myWeightChart) {
        myWeightChart.destroy();
    }

    const datasets = [{
        label: '体重 (kg)',
        data: dataValues,
        borderColor: '#2563eb',
        backgroundColor: 'rgba(37, 99, 235, 0.1)',
        borderWidth: 2,
        tension: 0.1,
        fill: true
    }];

    if (targetWeight !== null && !isNaN(targetWeight)) {
        datasets.push({
            label: `目標体重 (${targetWeight}kg)`,
            data: targetValues,
            borderColor: '#ef4444',
            borderWidth: 2,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
        });
    }

    myWeightChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: false
                }
            }
        }
    });
}

// ==========================================
// 4. 本日のカロリー収支集計処理
// ==========================================
function updateCalorieSummary() {
    const todayStr = getTodayFormatted();

    let foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    const todayFoods = foodHistory.filter(item => item.date === todayStr);
    const totalIntake = todayFoods.reduce((sum, item) => sum + (parseFloat(item.intake) || 0), 0);

    const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || {};
    let tdee = 2000;

    if (profile.height && profile.age && profile.activity) {
        let idealWeight = (profile.height / 100) * (profile.height / 100) * 22;
        let bmr = (profile.gender === 'female')
            ? (9.247 * idealWeight + 3.098 * profile.height - 4.330 * profile.age + 447.593)
            : (13.397 * idealWeight + 4.799 * profile.height - 5.677 * profile.age + 88.362);
        tdee = Math.round(bmr * profile.activity);
    }

    let exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    const todayExercises = exerciseHistory.filter(item => item.date === todayStr);
    const totalExerciseBurn = todayExercises.reduce((sum, item) => {
        const cal = item.burned || item.calories || item.burn || 0;
        return sum + (parseFloat(cal) || 0);
    }, 0);

    const totalBurn = tdee + totalExerciseBurn;

    const summaryIntakeEl = document.getElementById('summaryIntake');
    const summaryBurnEl = document.getElementById('summaryBurn');
    const balanceBox = document.getElementById('summaryBalanceBox');
    const balanceText = document.getElementById('summaryBalanceText');

    if (summaryIntakeEl) summaryIntakeEl.innerText = `${totalIntake} kcal`;
    if (summaryBurnEl) summaryBurnEl.innerText = `${totalBurn} kcal`;

    const popupTdee = document.getElementById('popupTdee');
    const popupExercise = document.getElementById('popupExercise');
    if (popupTdee) popupTdee.innerText = tdee;
    if (popupExercise) popupExercise.innerText = totalExerciseBurn;

    const balance = totalIntake - totalBurn;

    if (balanceBox && balanceText) {
        if (totalIntake === 0 && totalExerciseBurn === 0) {
            balanceBox.style.background = '#f8fafc';
            balanceText.style.color = '#64748b';
            balanceText.innerHTML = `📝 今日の食事や運動が記録されていません`;
        } else if (balance < 0) {
            balanceBox.style.background = '#f0fdf4';
            balanceText.style.color = '#166534';
            // ★ カッコの前で改行するように修正
            balanceText.innerHTML = `🎉 アンダーカロリー達成！<br>(${Math.abs(balance)} kcal のマイナス収支)`;
        } else if (balance > 0) {
            balanceBox.style.background = '#fef2f2';
            balanceText.style.color = '#991b1b';
            // ★ カッコの前で改行するように修正
            balanceText.innerHTML = `⚠️ オーバーカロリー<br>(+${balance} kcal 超過しています)`;
        } else {
            balanceBox.style.background = '#f8fafc';
            balanceText.style.color = '#1e293b';
            balanceText.innerHTML = `⚖️ 収支バランスゼロ<br>(±0 kcal)`;
        }
    }
}

// ==========================================
// 5. カレンダー機能の制御
// ==========================================
let currentCalendarDate = new Date();

function changeCalendarMonth(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    renderCalorieCalendar();
}

function renderCalorieCalendar() {
    const calendarEl = document.getElementById('calorieCalendar');
    const titleEl = document.getElementById('calendarMonthTitle');
    if (!calendarEl || !titleEl) return;

    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();

    // ★「上：年、下：月」のそれぞれの要素に文字をセットする
    const yearEl = document.getElementById('calendarYearTitle');
    if (yearEl) yearEl.innerText = `${year}年`;
    titleEl.innerText = `${month + 1}月`; // ← これだけでOK！

    const foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    const exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || {};

    let tdee = 2000;
    if (profile.height && profile.age && profile.activity) {
        let idealWeight = (profile.height / 100) * (profile.height / 100) * 22;
        let bmr = (profile.gender === 'female')
            ? (9.247 * idealWeight + 3.098 * profile.height - 4.330 * profile.age + 447.593)
            : (13.397 * idealWeight + 4.799 * profile.height - 5.677 * profile.age + 88.362);
        tdee = Math.round(bmr * profile.activity);
    }

    let html = '';
    const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
    weekdays.forEach(day => {
        html += `<div class="calendar-day-header">${day}</div>`;
    });

    const firstDayIndex = new Date(year, month, 1).getDay();
    const lastDayDate = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDayIndex; i++) {
        html += `<div class="calendar-cell empty"></div>`;
    }

    for (let day = 1; day <= lastDayDate; day++) {
        const monthStr = String(month + 1).padStart(2, '0');
        const dayStr = String(day).padStart(2, '0');
        const dateStr = `${year}-${monthStr}-${dayStr}`;

        const dayFoods = foodHistory.filter(item => item.date === dateStr);
        const intake = dayFoods.reduce((sum, item) => sum + (parseFloat(item.intake) || 0), 0);

        const dayExercises = exerciseHistory.filter(item => item.date === dateStr);
        const burn = dayExercises.reduce((sum, item) => {
            const cal = item.burned || item.calories || item.burn || 0;
            return sum + (parseFloat(cal) || 0);
        }, 0);

        const totalBurn = tdee + burn;
        const balance = intake - totalBurn;

        let statusClass = 'neutral';
        if (dayFoods.length > 0 || dayExercises.length > 0) {
            statusClass = balance <= 0 ? 'under' : 'over';
        }

        html += `<div class="calendar-cell ${statusClass}" onclick="showDayDetail('${dateStr}')">
            <span>${day}</span>
        </div>`;
    }

    calendarEl.innerHTML = html;
}

function showDayDetail(dateStr) {
    const detailBox = document.getElementById('calendarDetailBox');
    if (!detailBox) return;

    const foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    const exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || {};

    let tdee = 2000;
    if (profile.height && profile.age && profile.activity) {
        let idealWeight = (profile.height / 100) * (profile.height / 100) * 22;
        let bmr = (profile.gender === 'female')
            ? (9.247 * idealWeight + 3.098 * profile.height - 4.330 * profile.age + 447.593)
            : (13.397 * idealWeight + 4.799 * profile.height - 5.677 * profile.age + 88.362);
        tdee = Math.round(bmr * profile.activity);
    }

    const dayFoods = foodHistory.filter(item => item.date === dateStr);
    const intake = dayFoods.reduce((sum, item) => sum + (parseFloat(item.intake) || 0), 0);

    const dayExercises = exerciseHistory.filter(item => item.date === dateStr);
    const burn = dayExercises.reduce((sum, item) => {
        const cal = item.burned || item.calories || item.burn || 0;
        return sum + (parseFloat(cal) || 0);
    }, 0);

    const totalBurn = tdee + burn;
    const balance = intake - totalBurn;

    let balanceText = '';
    let colorStyle = '#1e293b';
    if (dayFoods.length === 0 && dayExercises.length === 0) {
        balanceText = 'この日の記録はありません';
    } else if (balance <= 0) {
        // ★ カッコの前で改行するように修正
        balanceText = `🎉 アンダーカロリー<br>(${Math.abs(balance)} kcal マイナス)`;
        colorStyle = '#166534';
    } else {
        // ★ カッコの前で改行するように修正
        balanceText = `⚠️ オーバーカロリー<br>(+${balance} kcal 超過)`;
        colorStyle = '#991b1b';
    }

    let foodMemos = dayFoods.map(f => `・${f.memo || '食事'}: +${f.intake}kcal`).join('<br>');
    let exerciseMemos = dayExercises.map(e => `・${e.memo || '運動'}: -${e.burned || 0}kcal`).join('<br>');

    detailBox.innerHTML = `
        <p style="margin: 0 0 6px 0; font-weight: bold; color: #0f172a;">📅 ${dateStr} の詳細</p>
        <p style="margin: 2px 0; color: ${colorStyle}; font-weight: bold;">${balanceText}</p>
        <p style="margin: 4px 0 2px 0; font-size: 12px; color: #475569;">🍚 摂取: ${intake} kcal</p>
        ${foodMemos ? `<div style="font-size: 11px; margin-left: 10px; color: #64748b; margin-bottom: 4px;">${foodMemos}</div>` : ''}
        <p style="margin: 2px 0; font-size: 12px; color: #475569;">🏃 消費: ${totalBurn} kcal (基準 ${tdee} + 運動 ${burn})</p>
        ${exerciseMemos ? `<div style="font-size: 11px; margin-left: 10px; color: #64748b;">${exerciseMemos}</div>` : ''}
    `;
}

// ==========================================
// 6. APIキー管理・データ初期化・起動時処理
// ==========================================
function saveApiKey() {
    const key = document.getElementById('apiKeyInput').value.trim();
    if (!key) {
        alert('APIキーを入力してください。');
        return;
    }
    localStorage.setItem('my_gemini_api_key', key);
    document.getElementById('apiKeyStatus').innerText = "✅ APIキーを安全に保存しました！";
    document.getElementById('apiKeyInput').value = "";
}

function deleteApiKey() {
    if (!localStorage.getItem('my_gemini_api_key')) {
        alert('保存されているAPIキーはありません。');
        return;
    }

    if (confirm('保存されているAPIキーを削除しますか？（体重や食事の記録データは消えません）')) {
        localStorage.removeItem('my_gemini_api_key');
        document.getElementById('apiKeyStatus').innerText = "⚠️ APIキーを削除しました";
        document.getElementById('apiKeyInput').value = "";
        alert('APIキーを削除しました。');
    }
}

// ★追加：APIキーを残したまま他のデータだけ初期化する関数
function resetAppData() {
    if (confirm('プロフィール、体重、食事、運動の記録をすべて初期化しますか？\n（※保存されているAPIキーは保持されます）')) {
        const savedApiKey = localStorage.getItem('my_gemini_api_key');

        localStorage.removeItem('my_fitness_profile');
        localStorage.removeItem('my_weight_history');
        localStorage.removeItem('my_food_history');
        localStorage.removeItem('my_exercise_history');

        if (savedApiKey) {
            localStorage.setItem('my_gemini_api_key', savedApiKey);
        }

        // ★初期化後にアコーディオンを開いたままにするための目印を一時保存する
        localStorage.setItem('keep_profile_open', 'true');

        alert('記録データを初期化しました。（APIキーは保持されています）');
        location.reload();
    }
}

// ページ起動時の初期化処理
window.addEventListener('DOMContentLoaded', () => {
    // 1. APIキーの保存状態チェック
    if (localStorage.getItem('my_gemini_api_key')) {
        const statusEl = document.getElementById('apiKeyStatus');
        if (statusEl) statusEl.innerText = "✅ APIキーは安全に保管されています";
    }

    // ★追加：初期化直後などの場合にアコーディオンを開いたままにする処理
    if (localStorage.getItem('keep_profile_open') === 'true') {
        const body = document.getElementById('profileBody');
        const icon = document.getElementById('accordionIcon');
        if (body && icon) {
            body.style.display = 'block';
            icon.innerText = '▲ 閉じる';
        }
        localStorage.removeItem('keep_profile_open'); // 使い終わったら消す
    }

    // 2. プロフィールデータの読み込み
    const savedProfile = JSON.parse(localStorage.getItem('my_fitness_profile'));
    if (savedProfile) {
        if (document.getElementById('profileHeight')) document.getElementById('profileHeight').value = savedProfile.height || '';
        if (document.getElementById('profileAge')) document.getElementById('profileAge').value = savedProfile.age || '';
        if (document.getElementById('profileGender')) document.getElementById('profileGender').value = savedProfile.gender || 'male';
        if (document.getElementById('profileActivity')) document.getElementById('profileActivity').value = savedProfile.activity || '1.2';
        if (document.getElementById('profileTargetWeight')) document.getElementById('profileTargetWeight').value = savedProfile.targetWeight || '';

        calculateFitnessStats();
    }

    // 3. 日付とチャートの初期化
    const today = getTodayFormatted();
    const weightDateInput = document.getElementById('weightDate');
    if (weightDateInput) {
        weightDateInput.value = today;
        loadWeightForDate(today);
    }

    updateWeightChart();
    updateCalorieSummary();
    renderCalorieCalendar();
});

// ==========================================
// 総消費カロリーの計算式ポップアップ表示切り替え
// ==========================================
function toggleBurnDetail() {
    const popup = document.getElementById('burnDetailPopup');
    if (popup) {
        if (popup.style.display === 'none' || popup.style.display === '') {
            popup.style.display = 'block';
        } else {
            popup.style.display = 'none';
        }
    }
}

// 画面のほかの場所をタップしたときにポップアップを閉じる機能
document.addEventListener('click', function (event) {
    const summaryBurn = document.getElementById('summaryBurn');
    const popup = document.getElementById('burnDetailPopup');
    if (popup && summaryBurn) {
        if (!summaryBurn.contains(event.target) && !popup.contains(event.target)) {
            popup.style.display = 'none';
        }
    }
});