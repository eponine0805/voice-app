// HTML要素を取得
const recordButton = document.getElementById('recordButton');
const fileInput = document.getElementById('fileInput');
const statusP = document.getElementById('status');
const transcriptionResultTextarea = document.getElementById('transcriptionResult');
const summaryResultTextarea = document.getElementById('summaryResult');
const summarizeButton = document.getElementById('summarizeButton');
const downloadAudioButton = document.getElementById('downloadAudioButton');
const downloadTextButton = document.getElementById('downloadTextButton');
const downloadSummaryButton = document.getElementById('downloadSummaryButton');

// グローバル変数
let mediaRecorder;
let isRecording = false;
let audioChunks = [];
let finalAudioBlob = null;
let fullTranscription = "";
let audioContext;
let microphoneStream;

// --- イベントリスナー ---
recordButton.addEventListener('click', () => {
    if (!isRecording) startRecording();
    else stopRecording();
});
fileInput.addEventListener('change', handleFileUpload);
summarizeButton.addEventListener('click', createSummary);
downloadAudioButton.addEventListener('click', downloadAudio);
downloadTextButton.addEventListener('click', downloadText);
downloadSummaryButton.addEventListener('click', downloadSummary);

// --- 機能ごとの関数 ---
async function startRecording() {
    try {
        resetUI();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.audioWorklet.addModule('worklet-processor.js');

        microphoneStream = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 2.0; // 音量増幅
        microphoneStream.connect(gainNode);

        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        gainNode.connect(workletNode);
        workletNode.connect(mediaStreamDestination);

        mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);

        isRecording = true;
        recordButton.innerText = "録音停止";
        recordButton.classList.add("recording");
        statusP.innerText = "録音中...";

        // ★★★ リアルタイム処理の心臓部 ★★★
        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                // チャンクをサーバーに送信
                statusP.innerText = "文字起こし中...";
                const transcribedText = await transcribeChunk(event.data);

                // 全文に結果を追加して表示
                if (transcribedText !== "[エラー]") {
                    fullTranscription += transcribedText + " ";
                    transcriptionResultTextarea.value = fullTranscription;
                }
                // 録音が続いていればステータスを戻す
                if (isRecording) {
                    statusP.innerText = "録音中...";
                }
            }
        };

        // 録音が完全に停止した時の処理
        mediaRecorder.onstop = () => {
            statusP.innerText = "録音が完了しました。";
            finalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            downloadAudioButton.classList.remove('hidden');

            if (fullTranscription.trim().length > 0 && !fullTranscription.includes("[エラー]")) {
                downloadTextButton.classList.remove('hidden');
                summarizeButton.classList.remove('hidden');
            }
        };
        
        // 録音データを配列に保存し続ける（ダウンロード用）
        mediaRecorder.addEventListener('dataavailable', event => {
            if (event.data.size > 0) audioChunks.push(event.data);
        });
        
        // 15秒ごとに ondataavailable イベントを発生させる
        mediaRecorder.start(15000);

    } catch (error) {
        console.error("録音開始エラー:", error);
        alert("マイクへのアクセスまたは音声処理の初期化に失敗しました。");
        resetUI();
    }
}

// 他の関数（stopRecording, handleFileUpload, transcribeChunkなど）は変更不要なため省略
// あなたが前回までに完成させたものをそのままお使いください。
// ただし、もし不確かな場合は、これまでの会話から完成版のコードを再度貼り付けますのでお申し付けください。