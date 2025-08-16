// あなたのHTMLファイルに合わせて、id名を正しく指定します
const recordButton = document.getElementById('recordButton');
const statusP = document.getElementById('status');
const transcriptionResultTextarea = document.getElementById('transcriptionResult');
const translationResultTextarea = document.getElementById('translationResult');
// ダウンロードボタンなども必要に応じてここに追加します
// const downloadAudioButton = document.getElementById('downloadAudioButton');
// const downloadTextButton = document.getElementById('downloadTextButton');

let mediaRecorder;
let isRecording = false;
let fullTranscription = ""; // 全ての文字起こし結果を保持する変数

// マイクへのアクセス許可を取得する関数
async function getMicrophone() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        return new MediaRecorder(stream);
    } catch (error) {
        console.error("マイクへのアクセス中にエラー:", error);
        alert("マイクへのアクセスが拒否されました。ブラウザの権限設定を確認してください。");
        return null;
    }
}

// 録音ボタンのクリック処理
recordButton.addEventListener('click', async () => {
    // もし録音中でなければ、録音を開始する
    if (!isRecording) {
        mediaRecorder = await getMicrophone();
        if (!mediaRecorder) return;

        isRecording = true;
        fullTranscription = ""; // テキストをリセット
        recordButton.innerText = "録音停止"; // ボタンの文字を変更
        recordButton.classList.add("recording"); // ボタンのスタイルを変更するためのクラス
        statusP.innerText = "録音中...";
        transcriptionResultTextarea.value = "";
        translationResultTextarea.value = "";

        // 30秒ごと（30000ミリ秒）にデータを区切る設定で録音を開始
        mediaRecorder.start(30000);

        // 30秒ごとに音声チャンクが準備できると、このイベントが発火する
        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                console.log("30秒分の音声データをサーバーに送信します。");
                statusP.innerText = "文字起こし中...";
                
                // 音声チャンクをサーバー機能に送信して文字起こし
                const transcribedText = await transcribeChunk(event.data);
                
                // 文字起こし結果を全文保持し、テキストエリアに表示
                fullTranscription += transcribedText + " ";
                transcriptionResultTextarea.value = fullTranscription;
                statusP.innerText = "録音中..."; // ステータスを戻す
            }
        };

        // 録音が完全に停止した時の処理
        mediaRecorder.onstop = () => {
             statusP.innerText = "録音が完了しました。";
        };

    // もし録音中であれば、録音を停止する
    } else {
        if (mediaRecorder) {
            mediaRecorder.stop();
            isRecording = false;
            recordButton.innerText = "録音開始";
            recordButton.classList.remove("recording");
        }
    }
});


// 音声チャンクを１つ、バックエンドに送信する関数
async function transcribeChunk(audioBlob) {
    try {
        const response = await fetch('/.netlify/functions/transcribe', {
            method: 'POST',
            body: audioBlob,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`サーバーエラー: ${response.status} ${errorText}`);
        }
        const result = await response.json();
        return result.text || "";
    } catch (error) {
        console.error('チャンクの文字起こし中にエラー:', error);
        statusP.innerText = "エラーが発生しました。";
        return "[エラー]";
    }
}