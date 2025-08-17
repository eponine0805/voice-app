import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.1';

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

// --- メインのイベントリスナー ---
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

// ブラウザ内で文字起こしを実行するメイン関数
async function transcribeAudio(audioData) {
    try {
        statusP.innerText = "AIモデルを準備中... (初回は時間がかかります)";
        
        const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
            progress_callback: (data) => {
                if (data.status === 'progress') {
                    const progress = (data.progress).toFixed(2);
                    statusP.innerText = `AIモデルを準備中... (${progress}%)`;
                } else {
                    statusP.innerText = `AIモデルを準備中... (${data.status})`;
                }
            }
        });

        statusP.innerText = "文字起こしを実行中...";

        // 音声データをArrayBufferに変換してライブラリに渡す
        const output = await transcriber(await audioData.arrayBuffer(), {
            chunk_length_s: 30,
            language: 'japanese',
            task: 'transcribe',
        });
        
        const transcribedText = output.text;
        await processTranscriptionResult(transcribedText);

    } catch (error) {
        console.error("文字起こし中にエラー:", error);
        statusP.innerText = "文字起こし中にエラーが発生しました。";
        await processTranscriptionResult("[エラー]");
    }
}

async function startRecording() {
    try {
        resetUI();
        // ★★★ 修正箇所：最もシンプルな方法でマイクにアクセス ★★★
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        
        isRecording = true;
        recordButton.innerText = "録音停止";
        recordButton.classList.add("recording");
        statusP.innerText = "録音中...";
        mediaRecorder.start();

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            statusP.innerText = "録音が完了しました。";
            finalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            downloadAudioButton.classList.remove('hidden');
            await transcribeAudio(finalAudioBlob); // ブラウザ内で文字起こし
        };
    } catch (error) {
        console.error("録音開始エラー:", error);
        alert("マイクへのアクセスに失敗しました。");
        resetUI();
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.innerText = "録音開始";
        recordButton.classList.remove("recording");
        // MediaRecorderに渡したストリームのトラックをすべて停止
        mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    resetUI();
    statusP.innerText = "ファイルを読み込みました。";
    finalAudioBlob = file;
    downloadAudioButton.classList.remove('hidden');
    await transcribeAudio(file); // ブラウザ内で文字起こし
    event.target.value = '';
}

async function processTranscriptionResult(transcribedText) {
    // ★★★ 修正箇所：結果が空でないこともチェックする ★★★
    if (transcribedText && transcribedText !== "[エラー]") {
        fullTranscription = transcribedText;
        transcriptionResultTextarea.value = fullTranscription;
        statusP.innerText = "文字起こしが完了しました。";
        downloadTextButton.classList.remove('hidden');
        summarizeButton.classList.remove('hidden');
    } else if (transcribedText === "") {
        statusP.innerText = "音声を認識できませんでした。";
        transcriptionResultTextarea.value = "(ここに結果が表示されます)";
    } else {
        statusP.innerText = "文字起こしに失敗しました。";
    }
}

// 議事録作成は引き続きサーバー機能(summarize.js)を使います
async function createSummary() {
    statusP.innerText = "議事録を作成中...";
    summarizeButton.disabled = true;
    try {
        const response = await fetch('/.netlify/functions/summarize', {
            method: 'POST',
            body: fullTranscription
        });
        if (!response.ok) throw new Error('サーバーエラー');
        const result = await response.json();
        summaryResultTextarea.value = result.summary;
        statusP.innerText = "議事録が完成しました。";
        downloadSummaryButton.classList.remove('hidden');
    } catch (error) {
        console.error("議事録作成エラー:", error);
        statusP.innerText = "議事録の作成に失敗しました。";
    } finally {
        summarizeButton.disabled = false;
    }
}

function resetUI() {
    audioChunks = [];
    finalAudioBlob = null;
    fullTranscription = "";
    transcriptionResultTextarea.value = "";
    summaryResultTextarea.value = "";
    statusP.innerText = "待機中...";
    recordButton.innerText = "録音開始";
    recordButton.classList.remove("recording");
    summarizeButton.classList.add('hidden');
    downloadAudioButton.classList.add('hidden');
    downloadTextButton.classList.add('hidden');
    downloadSummaryButton.classList.add('hidden');
}

// --- ダウンロード関数 (変更なし) ---
function downloadAudio() {
    if (!finalAudioBlob) return;
    const url = URL.createObjectURL(finalAudioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = finalAudioBlob.name || `recording-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function downloadText() {
    const text = transcriptionResultTextarea.value;
    if (!text) return;
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `transcription-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function downloadSummary() {
    const text = summaryResultTextarea.value;
    if (!text) return;
    const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
    const blob = new Blob([bom, text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `summary-${new Date().toISOString()}.txt`;
    document.body.appendChild(a);
a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}