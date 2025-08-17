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
async function startRecording() {
    try {
        resetUI();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        await audioContext.audioWorklet.addModule('worklet-processor.js');
        
        microphoneStream = audioContext.createMediaStreamSource(stream);
        const gainNode = audioContext.createGain();
        gainNode.gain.value = 2.0;
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
        mediaRecorder.start();

        mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) audioChunks.push(event.data);
        };

        mediaRecorder.onstop = async () => {
            statusP.innerText = "録音が完了しました。";
            finalAudioBlob = new Blob(audioChunks, { type: 'audio/webm' });
            downloadAudioButton.classList.remove('hidden');

            statusP.innerText += " 文字起こしを開始します...";
            const transcribedText = await transcribeChunk(finalAudioBlob);
            await processTranscriptionResult(transcribedText);
        };
    } catch (error) {
        console.error("録音開始エラー:", error);
        alert("マイクへのアクセスまたは音声処理の初期化に失敗しました。");
        resetUI();
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop();
        isRecording = false;
        recordButton.innerText = "録音開始";
        recordButton.classList.remove("recording");
        microphoneStream.mediaStream.getTracks().forEach(track => track.stop());
        audioContext.close();
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    resetUI();
    statusP.innerText = "ファイルを読み込みました。文字起こしを開始します...";
    finalAudioBlob = file;
    downloadAudioButton.classList.remove('hidden');

    const transcribedText = await transcribeChunk(file);
    await processTranscriptionResult(transcribedText);
    event.target.value = '';
}

async function processTranscriptionResult(transcribedText) {
    if (transcribedText !== "[エラー]") {
        fullTranscription = transcribedText;
        transcriptionResultTextarea.value = fullTranscription;
        statusP.innerText = "文字起こしが完了しました。";
        downloadTextButton.classList.remove('hidden');
        summarizeButton.classList.remove('hidden');
    } else {
        statusP.innerText = "文字起こしに失敗しました。";
    }
}

async function transcribeChunk(audioBlob) {
    try {
        const response = await fetch('/.netlify/functions/transcribe', {
            method: 'POST',
            body: audioBlob,
        });
        if (!response.ok) {
            const errorResult = await response.json();
            console.error("サーバーからのエラー詳細:", errorResult);
            throw new Error(`サーバーエラー: ${response.status} ${JSON.stringify(errorResult)}`);
        }
        const result = await response.json();
        return result.text || "";
    } catch (error) {
        console.error('文字起こし中にエラー:', error);
        return "[エラー]";
    }
}

async function createSummary() {
    statusP.innerText = "議事録を作成中...";
    summarizeButton.disabled = true;
    try {
        const response = await fetch('/.netlify/functions/summarize', {
            method: 'POST',
            body: fullTranscription
        });
        if (!response.ok) {
            console.error("サーバーからのエラー詳細:", await response.json());
            throw new Error('サーバーエラー');
        }
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

function downloadAudio() {
    if (!finalAudioBlob) return;
    const url = URL.createObjectURL(finalAudioBlob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = finalAudioBlob.name || `recording-${new Date().toISOString()}.mp3`;
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