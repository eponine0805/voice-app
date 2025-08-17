// HTML要素を取得
const recordButton = document.getElementById('recordButton');
const statusP = document.getElementById('status');
const transcriptionResultTextarea = document.getElementById('transcriptionResult');
const summaryResultTextarea = document.getElementById('summaryResult'); 
const summarizeButton = document.getElementById('summarizeButton');

// ダウンロードボタンを取得
const downloadAudioButton = document.getElementById('downloadAudioButton');
const downloadTextButton = document.getElementById('downloadTextButton');
const downloadSummaryButton = document.getElementById('downloadSummaryButton');

// グローバル変数
let mediaRecorder;
let isRecording = false;
let audioChunks = [];
let finalAudioBlob = null; // 録音完了後の音声データを保存する変数
let fullTranscription = "";

// Web Audio API関連の変数
let audioContext;
let microphoneStream;
let scriptProcessor;

// --- メインのイベントリスナー ---

// 録音ボタンのクリック処理
recordButton.addEventListener('click', async () => {
    if (!isRecording) {
        await startRecording();
    } else {
        stopRecording();
    }
});

// 議事録作成ボタンのクリック処理
summarizeButton.addEventListener('click', createSummary);

// ダウンロードボタンのクリック処理
downloadAudioButton.addEventListener('click', downloadAudio);
downloadTextButton.addEventListener('click', downloadText);
downloadSummaryButton.addEventListener('click', downloadSummary);


// --- 機能ごとの関数 ---

// 録音開始の処理
async function startRecording() {
    try {
        // UIと変数を初期状態にリセット
        resetUI();
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        microphoneStream = audioContext.createMediaStreamSource(stream);
        
        const bufferSize = 4096;
        scriptProcessor = audioContext.createScriptProcessor(bufferSize, 1, 1);
        scriptProcessor.onaudioprocess = (event) => {};

        const mediaStreamDestination = audioContext.createMediaStreamDestination();
        microphoneStream.connect(scriptProcessor);
        scriptProcessor.connect(mediaStreamDestination);
        
        mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        
        isRecording = true;
        recordButton.innerText = "録音停止";
        recordButton.classList.add("recording");
        statusP.innerText = "録音中...";

        mediaRecorder.start();

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                audioChunks.push(event.data);
            }
        };

        mediaRecorder.onstop = async () => {
            statusP.innerText = "録音が完了しました。";
            finalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });

            // ★録音停止後、すぐに音声ダウンロードボタンを表示
            downloadAudioButton.classList.remove('hidden');

            statusP.innerText += " 文字起こしを開始します...";
            const transcribedText = await transcribeChunk(finalAudioBlob);
            
            if (transcribedText !== "[エラー]") {
                fullTranscription = transcribedText;
                transcriptionResultTextarea.value = fullTranscription;
                statusP.innerText = "文字起こしが完了しました。";

                // ★文字起こし成功後、テキストダウンロードと議事録作成ボタンを表示
                downloadTextButton.classList.remove('hidden');
                summarizeButton.classList.remove('hidden');
            } else {
                statusP.innerText = "文字起こしに失敗しました。";
            }
        };

    } catch (error) {
        console.error("録音開始エラー:", error);
        alert("マイクへのアクセスまたは音声処理の初期化に失敗しました。");
    }
}

// 録音停止の処理
function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.innerText = "録音開始";
        recordButton.classList.remove("recording");

        microphoneStream.disconnect();
        scriptProcessor.disconnect();
        audioContext.close();
    }
}

// 文字起こし処理（サーバー通信）
async function transcribeChunk(audioBlob) {
    try {
        const response = await fetch('/.netlify/functions/transcribe', {
            method: 'POST',
            body: audioBlob,
        });
        if (!response.ok) throw new Error('サーバーエラー');
        const result = await response.json();
        return result.text || "";
    } catch (error) {
        console.error('文字起こし中にエラー:', error);
        return "[エラー]";
    }
}

// 議事録作成処理（サーバー通信）
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

        // ★議事録作成成功後、議事録ダウンロードボタンを表示
        downloadSummaryButton.classList.remove('hidden');

    } catch (error) {
        console.error("議事録作成エラー:", error);
        statusP.innerText = "議事録の作成に失敗しました。";
    } finally {
        summarizeButton.disabled = false;
    }
}

// UIリセット関数
function resetUI() {
    audioChunks = [];
    finalAudioBlob = null;
    fullTranscription = "";
    transcriptionResultTextarea.value = "";
    summaryResultTextarea.value = "";
    statusP.innerText = "待機中...";

    // 全てのボタンを初期状態に戻す
    summarizeButton.classList.add('hidden');
    downloadAudioButton.classList.add('hidden');
    downloadTextButton.classList.add('hidden');
    downloadSummaryButton.classList.add('hidden');
}

// --- ダウンロード関数 ---

function downloadAudio() {
    if (!finalAudioBlob) return;
    const url = URL.createObjectURL(finalAudioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = `recording-${new Date().toISOString()}.webm`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    a.remove();
}

function downloadText() {
    const text = transcriptionResultTextarea.value;
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain' });
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
    const blob = new Blob([text], { type: 'text/plain' });
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