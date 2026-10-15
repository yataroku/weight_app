// ==========================================
// ★ご自身のAPIキーをここに貼り付けてください
// ==========================================
async function analyzePhotoWithAI() {
    // 毎回ブラウザの保存領域からキーを取得する
    const GEMINI_API_KEY = localStorage.getItem('my_gemini_api_key');
    
    if (!GEMINI_API_KEY) {
        alert("APIキーが設定されていません。ダッシュボード画面からAPIキーを設定してください。");
        return;
    }
    
    // （以降のAI分析処理が続きます... urlに ${GEMINI_API_KEY} を組み込む）
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;
    // ...
}

// ページを開いた時の初期処理
window.onload = function() {
    const today = getTodayFormatted();
    document.getElementById('foodDate').value = today;
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
    const selectedDate = document.getElementById('foodDate').value;
    loadDataForDate(selectedDate);
}

// 選択した日付のデータを読み込む
function loadDataForDate(dateStr) {
    document.getElementById('selectedDateTitle').innerText = (dateStr === getTodayFormatted()) ? '今日' : dateStr;

    let foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    const dayRecords = foodHistory.filter(item => item.date === dateStr);
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
                    <span style="color: #e74c3c; font-weight: bold;">+${item.intake} kcal</span>
                    <button onclick="deleteFoodRecord(${item.id})" style="background: none; border: none; color: #e74c3c; cursor: pointer; font-size: 12px; padding-left: 10px;">削除</button>
                </div>
            </div>`;
        });
        listDiv.innerHTML = html;
    }

    document.getElementById('foodIntake').value = '';
    document.getElementById('foodMemo').value = '';
}

// ==========================================
// ★写真をAIに送ってカロリーを自動計算させる関数（最新モデル gemini-3.8-flash 対応）
// ==========================================
async function analyzePhotoWithAI() {
    if (GEMINI_API_KEY === "YOUR_API_KEY_HERE") {
        alert("APIキーが設定されていません。script.jsの「YOUR_API_KEY_HERE」をご自身のAPIキーに書き換えてください。");
        return;
    }

    const fileInput = document.getElementById('foodPhoto');
    const statusText = document.getElementById('aiStatus');

    if (fileInput.files.length === 0) {
        alert("分析する料理の写真を選択してください。");
        return;
    }

    const file = fileInput.files[0];
    statusText.innerText = "🤖 AIが写真を分析中...（数秒かかります）";

    try {
        const base64Data = await convertFileToBase64(file);

        // ★修正点：指示された最新のモデル名に変更
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

        const promptText = 'この料理の写真を見て、以下のJSONフォーマットのみで正確に答えてください。他の余計な文字やMarkdownの記号（```jsonなど）は一切含めないでください。{"name": "料理名（例: 豚骨ラーメン）", "calories": 推定カロリーの数値のみ}';

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: file.type,
                            data: base64Data
                        }
                    }
                ]
            }]
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

        const aiResponseText = data.candidates[0].content.parts[0].text.trim();
        const cleanJsonText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
        const result = JSON.parse(cleanJsonText);

        // 入力欄に自動セット
        document.getElementById('foodMemo').value = result.name;
        document.getElementById('foodIntake').value = result.calories;
        
        statusText.innerText = `✨ 分析成功！「${result.name}」約 ${result.calories} kcal と判定しました。`;

    } catch (error) {
        console.error(error);
        statusText.innerText = "❌ エラーが発生しました。写真を変えてもう一度お試しください。";
        alert("AIの分析に失敗しました: " + error.message);
    }
}

// ファイルをBase64に変換するヘルパー関数
function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64String = reader.result.split(',')[1];
            resolve(base64String);
        };
        reader.onerror = error => reject(error);
    });
}

// 食事データの保存
function saveFoodRecord() {
    const date = document.getElementById('foodDate').value;
    const intake = parseFloat(document.getElementById('foodIntake').value);
    const memo = document.getElementById('foodMemo').value || '食事記録';

    if (!date || isNaN(intake)) {
        alert('日付と摂取カロリーを正しく入力してください。');
        return;
    }

    let foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    const record = { id: Date.now(), date, intake, memo };
    foodHistory.push(record);

    localStorage.setItem('my_food_history', JSON.stringify(foodHistory));
    loadDataForDate(date);
    
    // ★ alert('食事を記録しました！'); を削除
}

// 記録の削除
function deleteFoodRecord(id) {
    if (!confirm('この記録を削除しますか？')) return;

    let foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    foodHistory = foodHistory.filter(item => item.id !== id);
    
    localStorage.setItem('my_food_history', JSON.stringify(foodHistory));
    loadDataForDate(document.getElementById('foodDate').value);
}