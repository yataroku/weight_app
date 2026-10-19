// ==========================================
// 1. ページ読み込み時の初期処理
// ==========================================
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
// 2. 写真を圧縮してAIに送り、カロリーを自動計算させるメイン関数
// ==========================================
async function analyzePhotoWithAI() {
    const GEMINI_API_KEY = localStorage.getItem('my_gemini_api_key');
    
    if (!GEMINI_API_KEY) {
        alert("APIキーが設定されていません。ダッシュボード画面からAPIキーを設定してください。");
        return;
    }

    const fileInput = document.getElementById('foodPhoto');
    const statusText = document.getElementById('aiStatus');

    if (fileInput.files.length === 0) {
        alert("分析する料理の写真を選択してください。");
        return;
    }

    const file = fileInput.files[0];
    statusText.innerText = "🤖 画像を圧縮し、AIが分析中...";

    try {
        // 画像を自動圧縮（長辺800px、画質70%）
        const compressedBase64 = await compressImage(file, 800, 800, 0.7);
        const base64Data = compressedBase64.split(',')[1];

        // gemini-3.8-flash モデルを指定
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${GEMINI_API_KEY}`;

        const promptText = 'この料理の写真を見て、以下のJSONフォーマットのみで正確に答えてください。他の余計な文字やMarkdownの記号（```jsonなど）は一切含めないでください。{"name": "料理名（例: 豚骨ラーメン）", "calories": 推定カロリーの数値のみ}';

        const requestBody = {
            contents: [{
                parts: [
                    { text: promptText },
                    {
                        inline_data: {
                            mime_type: "image/jpeg",
                            data: base64Data
                        }
                    }
                ]
            }]
        };

        // ★ご要望通り、最大3回までの再試行（リトライ）処理を保持！
        let response;
        let data;
        for (let attempt = 1; attempt <= 3; attempt++) {
            response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            data = await response.json();

            // 成功したか、または「混雑(high demand)や429エラー以外」であればループを抜ける
            if (!data.error || (!data.error.message.includes('high demand') && !data.error.message.includes('429'))) {
                break;
            }
            if (attempt === 3) {
                throw new Error(data.error.message);
            }
            statusText.innerText = `🤖 サーバー混雑中のため再試行中... (${attempt}/3)`;
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        if (data.error) {
            throw new Error(data.error.message);
        }

        const aiResponseText = data.candidates[0].content.parts[0].text.trim();
        console.log("AI生出力:", aiResponseText);

        // ★万が一JSONの形式が少し崩れても止まらない安全な抽出処理
        let result;
        try {
            const cleanJsonText = aiResponseText.replace(/```json/g, '').replace(/```/g, '').trim();
            result = JSON.parse(cleanJsonText);
        } catch (parseError) {
            console.warn("JSONパース失敗、テキストから抽出し直します", parseError);
            const nameMatch = aiResponseText.match(/"name"\s*:\s*"([^"]+)"/);
            const calMatch = aiResponseText.match(/"calories"\s*:\s*([0-9]+)/);
            
            result = {
                name: nameMatch ? nameMatch[1] : "食事記録",
                calories: calMatch ? parseInt(calMatch[1], 10) : 500
            };
        }

        // 入力欄に自動セット
        document.getElementById('foodMemo').value = result.name;
        document.getElementById('foodIntake').value = result.calories;
        
        statusText.innerText = `✨ 分析成功！「${result.name}」約 ${result.calories} kcal と判定しました。`;

    } catch (error) {
      console.error(error);
      statusText.innerText = "❌ エラーが発生しました。";
      if (error.message.includes('quota') || error.message.includes('rate-limit') || error.message.includes('high demand') || error.message.includes('429')) {
          alert("AIの利用制限（429エラー）または混雑に達しました。しばらく時間をおいてから再度お試しください。");
      } else {
          alert("AIの分析に失敗しました: " + error.message);
      }
  }
}

// ==========================================
// 3. 食事データの保存・削除
// ==========================================
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
}

function deleteFoodRecord(id) {
    if (!confirm('この記録を削除しますか？')) return;

    let foodHistory = JSON.parse(localStorage.getItem('my_food_history')) || [];
    foodHistory = foodHistory.filter(item => item.id !== id);
    
    localStorage.setItem('my_food_history', JSON.stringify(foodHistory));
    loadDataForDate(document.getElementById('foodDate').value);
}

// ==========================================
// 4. 画像圧縮用のヘルパー関数（ファイルの一番下に追加）
// ==========================================
function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((height * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const compressedDataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedDataUrl);
      };
      img.onerror = (error) => reject(error);
    };
    reader.onerror = (error) => reject(error);
  });
}