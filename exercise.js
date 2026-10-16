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
    document.getElementById('aiInputText').value = '';
}

// ==========================================
// ★運動内容をAIに送って消費カロリーを自動計算させる関数
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
        alert("行った運動の内容を入力してください。（例: 30分ウォーキング）");
        return;
    }

    statusText.innerText = "🤖 AIが消費カロリーを計算中...";

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

        const profile = JSON.parse(localStorage.getItem('my_fitness_profile')) || { weight: 60 };
        const userWeight = profile.weight || 60;

        const promptText = `体重${userWeight}kgの人が行った「${exerciseText}」という運動の推定消費カロリーを計算し、以下のJSONフォーマットのみで答えてください。他のテキストやMarkdown記号は不要です。{"name": "運動種目（例: 30分ジョギング）", "calories": 推定消費カロリーの数値のみ}`;

        const requestBody = {
            contents: [{
                parts: [{ text: promptText }]
            }]
        };

        // 混雑時に自動で最大3回まで再試行する処理
        let response;
        let data;
        for (let attempt = 1; attempt <= 3; attempt++) {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            data = await response.json();

            if (!data.error || !data.error.message.includes('high demand')) {
                break;
            }
            statusText.innerText = `🤖 サーバー混雑中のため再試行中... (${attempt}/3)`;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiResponseText = data.candidates[0].content.parts[0].text.trim();
        const cleanJsonText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJsonText);

        document.getElementById('exerciseMemo').value = result.name;
        document.getElementById('burnedCal').value = result.calories;

        statusText.innerText = `✨ 計算完了！「${result.name}」約 ${result.calories} kcal 消費！`;

    } catch (error) {
      console.error(error);
      statusText.innerText = "❌ エラーが発生しました。";
      if (error.message.includes('quota') || error.message.includes('rate-limit') || error.message.includes('high demand')) {
          alert("AIの利用制限または混雑に達しました。しばらく時間をおいてから再度お試しください。");
      } else {
          alert("AIの計算に失敗しました: " + error.message);
      }
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

    // ★ alert('運動を記録しました！'); を削除
}

// 記録の削除
function deleteExerciseRecord(id) {
    if (!confirm('この記録を削除しますか？')) return;

    let exerciseHistory = JSON.parse(localStorage.getItem('my_exercise_history')) || [];
    exerciseHistory = exerciseHistory.filter(item => item.id !== id);

    localStorage.setItem('my_exercise_history', JSON.stringify(exerciseHistory));
    loadDataForDate(document.getElementById('exerciseDate').value);
}
