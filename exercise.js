// ページを開いた時の初期処理
window.onload = function () {
    const today = getTodayFormatted();
    document.getElementById('exerciseDate').value = today;
    loadDataForDate(today);
};

// 「YYYY-MM-DD」形式の日付を取得するヘルパー関数
function getTodayFormatted() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 日付を変更したとき
function onDateChanged() {
    const selectedDate = document.getElementById('exerciseDate').value;
    loadDataForDate(selectedDate);
}

// 選択した日付のデータを読み込む
function loadDataForDate(dateStr) {
    document.getElementById('selectedDateTitle').innerText = (dateStr === getTodayFormatted()) ? '今日' : dateStr;

    let exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    const dayRecords = exerciseHistory.filter(item => item.date === dateStr);
    const listDiv = document.getElementById('dayRecordList');

    if (dayRecords.length === 0) {
        listDiv.innerHTML = '<p style="font-size: 14px; color: #7f8c8d;">この日の記録はまだありません。</p>';
    } else {
        let html = '';
        dayRecords.forEach(item => {
            html += `<div class="history-item" style="display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; font-size: 14px;">
                <div>
                    <span style="color: #666; font-weight: bold;">${item.memo}</span>
                </div>
                <div style="text-align: right;">
                    <span style="color: #2563eb; font-weight: bold;">-${item.burned} kcal</span>
                    <button onclick="deleteExerciseRecord(${item.id})" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 12px; padding-left: 10px;">削除</button>
                </div>
            </div>`;
        });
        listDiv.innerHTML = html;
    }

    document.getElementById('burnedCal').value = '';
    document.getElementById('exerciseMemo').value = '';
}

// ==========================================
// ⚡ その日の実際の体重を優先して使うデータベース計算関数
// ==========================================
function calculateFromDatabase() {
    const selectType = document.getElementById('dbExerciseSelect').value;
    const amountInput = document.getElementById('dbExerciseAmount').value;
    const amount = parseFloat(amountInput);
    const exerciseDate = document.getElementById('exerciseDate').value;

    if (isNaN(amount) || amount <= 0) {
        alert("有効な時間（分）または回数を入力してください。");
        return;
    }

    // ★ 1. まず「その日（選んだ日付）」の体重記録を探す
    let targetWeight = null;
    const weightHistory = JSON.parse(localStorage.getItem('my_weight_history')) || [];
    
    const exactRecord = weightHistory.find(item => item.date === exerciseDate);
    if (exactRecord && !isNaN(exactRecord.weight)) {
        targetWeight = exactRecord.weight;
    }

    // ★ 2. その日の体重がなければ、直近の体重記録を探す
    if (targetWeight === null && weightHistory.length > 0) {
        // 日付順にソート
        const sortedWeights = [...weightHistory].sort((a, b) => new Date(b.date) - new Date(a.date));
        // 選んだ日付より前で一番近いもの、または全体で一番近いものを使用
        targetWeight = sortedWeights[0].weight; 
    }

    // ★ 3. それでもなければプロフィールの目標体重、またはデフォルト60kgを使用
    if (targetWeight === null) {
        const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || {};
        targetWeight = profile.targetWeight || 60;
    }

    let calories = 0;
    let memoName = "";

    // 9つの項目ごとの計算ロジック（実際の体重を使用）
    switch (selectType) {
        case 'walking':
            calories = Math.round(0.07 * targetWeight * amount);
            memoName = `${amount}分 ウォーキング`;
            break;
        case 'running':
            calories = Math.round(0.12 * targetWeight * amount);
            memoName = `${amount}分 ジョギング`;
            break;
        case 'pushup':
            calories = Math.round(0.3 * (targetWeight / 60) * amount);
            memoName = `腕立て ${amount}回`;
            break;
        case 'situp':
            calories = Math.round(0.35 * (targetWeight / 60) * amount);
            memoName = `腹筋 ${amount}回`;
            break;
        case 'backextension':
            calories = Math.round(0.3 * (targetWeight / 60) * amount);
            memoName = `背筋 ${amount}回`;
            break;
        case 'squat':
            calories = Math.round(0.5 * (targetWeight / 60) * amount);
            memoName = `スクワット ${amount}回`;
            break;
        case 'cycling':
            calories = Math.round(0.10 * targetWeight * amount);
            memoName = `${amount}分 サイクリング`;
            break;
        case 'yoga':
            calories = Math.round(0.05 * targetWeight * amount);
            memoName = `${amount}分 ヨガ・ストレッチ`;
            break;
        case 'swimming':
            calories = Math.round(0.15 * targetWeight * amount);
            memoName = `${amount}分 水泳`;
            break;
        default:
            calories = Math.round(amount * 5);
            memoName = `運動 ${amount}`;
    }

    // 画面の入力欄に一瞬でセット
    document.getElementById('exerciseMemo').value = memoName;
    document.getElementById('burnedCal').value = calories;

    // 完了メッセージ（どの体重で計算したかもわかりやすく表示）
    const statusText = document.getElementById('aiStatus');
    statusText.innerText = `⚡ 計算完了！（体重 ${targetWeight}kg 換算） 約 ${calories} kcal`;
}

// ==========================================
// 運動内容をAIに送る関数（従来のAI機能・おまけ）
// ==========================================
async function analyzeExerciseWithAI() {
    const GEMINI_API_KEY = localStorage.getItem('my_gemini_api_key');

    if (!GEMINI_API_KEY) {
        alert("APIキーが設定されていません。ダッシュボード画面からAPIキーを設定してください。");
        return;
    }

    const inputArea = document.getElementById('aiInputText');
    const statusText = document.getElementById('aiStatus');
    const exerciseText = inputArea.value.trim();

    if (!exerciseText) {
        alert("行った運動の内容を入力してください。");
        return;
    }

    statusText.innerText = "🤖 AIが計算中（混雑時は時間がかかります）...";

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
        const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || { weight: 60 };
        const userWeight = profile.weight || 60;

        const promptText = `体重${userWeight}kgの人が行った「${exerciseText}」の推定消費カロリーを計算し、以下のJSONフォーマットのみで答えてください。{"name": "運動種目", "calories": 数値のみ}`;

        const requestBody = {
            contents: [{ parts: [{ text: promptText }] }]
        };

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        const data = await response.json();

        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiResponseTest = data.candidates[0].content.parts[0].text.trim();
        let result;
        try {
            const cleanJsonText = aiResponseTest.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanJsonText);
        } catch (parseError) {
            const nameMatch = aiResponseTest.match(/"name"\s*:\s*"([^"]+)"/);
            const calMatch = aiResponseTest.match(/"calories"\s*:\s*([0-9]+)/);
            result = {
                name: nameMatch ? nameMatch[1] : exerciseText,
                calories: calMatch ? parseInt(calMatch[1], 10) : 150
            };
        }

        document.getElementById('exerciseMemo').value = result.name;
        document.getElementById('burnedCal').value = result.calories;
        statusText.innerText = `✨ 計算完了！`;

    } catch (error) {
      console.error(error);
      statusText.innerText = "❌ エラーが発生しました。";
      alert("AIの計算に失敗しました（混雑または制限）: " + error.message);
    }
}

// 運動データの保存
function saveExerciseRecord() {
    const date = document.getElementById('exerciseDate').value;
    const burned = parseFloat(document.getElementById('burnedCal').value);
    const memo = document.getElementById('exerciseMemo').value || '運動記録';

    if (!date || isNaN(burned)) {
        alert('日付と消費カロリーを正しく入力してください。');
        return;
    }

    let exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    const record = { id: Date.now(), date, burned, memo };
    exerciseHistory.push(record);

    localStorage.setItem('my_exercise_history', JSON.stringify(exerciseHistory));
    loadDataForDate(date);
}

// 記録の削除
function deleteExerciseRecord(id) {
    if (!confirm('この記録を削除しますか？')) return;

    let exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    exerciseHistory = exerciseHistory.filter(item => item.id !== id);

    localStorage.setItem('my_exercise_history', JSON.stringify(exerciseHistory));
    loadDataForDate(document.getElementById('exerciseDate').value);
}