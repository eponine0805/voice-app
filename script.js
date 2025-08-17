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
        
        // AudioContextとWorkletのセットアップ (変更なし)
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

        // MediaRecorderのセットアップ
        mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        
        isRecording = true;
        recordButton.innerText = "録音停止";
        recordButton.classList.add("recording");
        statusP.innerText = "録音中... (15秒ごとに文字起こしを実行します)";
        
        // --- ここからがリアルタイム処理の核 ---

        mediaRecorder.ondataavailable = async (event) => {
            if (event.data.size > 0) {
                statusP.innerText = "音声チャンクを取得。文字起こし中...";
                
                // 15秒分の音声データをサーバーに送信
                const transcribedText = await transcribeChunk(event.data);
                
                if (transcribedText && transcribedText !== "[エラー]") {
                    // 結果をテキストエリアに追記
                    fullTranscription += transcribedText;
                    transcriptionResultTextarea.value = fullTranscription;
                    // 自動で一番下までスクロール
                    transcriptionResultTextarea.scrollTop = transcriptionResultTextarea.scrollHeight;
                }
                // 状態を「録音中」に戻す
                if(isRecording) {
                    statusP.innerText = "録音中... (15秒ごとに文字起こしを実行します)";
                }
            }
        };

        mediaRecorder.onstop = () => {
             // 録音停止時の最終処理
            statusP.innerText = "録音を停止しました。";
            summarizeButton.classList.remove('hidden');
            downloadTextButton.classList.remove('hidden');
            // finalAudioBlobの生成ロジックはダウンロード機能を使わないなら不要
        };
        
        // 15000ミリ秒 (15秒) ごとに ondataavailable イベントを発生させる
        mediaRecorder.start(15000);

    } catch (error) {
        console.error("録音開始エラー:", error);
        alert("マイクへのアクセスまたは音声処理の初期化に失敗しました。");
        resetUI();
    }
}

function stopRecording() {
    if (mediaRecorder && isRecording) {
        mediaRecorder.stop(); // これで最後のondataavailableが呼ばれ、onstopも呼ばれる
        isRecording = false;
        recordButton.innerText = "録音開始";
        recordButton.classList.remove("recording");
        
        // マイクとAudioContextを解放
        microphoneStream.mediaStream.getTracks().forEach(track => track.stop());
        audioContext.close();
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    resetUI();
    statusP.innerText = "ファイルを読み込んでいます...";
    
    try {
        // 新しい分割処理関数を呼び出す
        await sliceAndTranscribeFile(file);
    } catch (error) {
        console.error("ファイル処理中にエラーが発生しました:", error);
        statusP.innerText = `エラー: ${error.message}`;
        alert("ファイルの処理に失敗しました。ファイル形式がサポートされていない可能性があります。");
    } finally {
        // ファイル選択をリセットして同じファイルを再選択できるようにする
        event.target.value = ''; 
    }
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
    a.download = finalAudioBlob.name || `recording-${new Date().toISOString()}.web`;
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

/**
 * 音声ファイルを3分（180秒）ごとに分割して文字起こしする関数
 * @param {File} file ユーザーが選択した音声ファイル
 */
async function sliceAndTranscribeFile(file) {
    // Web Audio APIを使ってファイルをデコード
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const duration = audioBuffer.duration; // ファイルの総再生時間（秒）
    const sampleRate = audioBuffer.sampleRate; // サンプリングレート
    const numChannels = audioBuffer.numberOfChannels; // チャンネル数
    const chunkDuration = 180; // チャンクの長さ（秒）= 3分

    let currentTime = 0;
    fullTranscription = ""; // 文字起こし結果をリセット

    while (currentTime < duration) {
        const chunkStartTime = currentTime;
        const chunkEndTime = Math.min(currentTime + chunkDuration, duration);
        const progress = Math.round((chunkStartTime / duration) * 100);
        
        statusP.innerText = `ファイルを処理中... (${progress}%) - ${Math.round(chunkStartTime)}秒 / ${Math.round(duration)}秒`;

        // 必要な部分のフレームを計算
        const startFrame = Math.floor(chunkStartTime * sampleRate);
        const endFrame = Math.floor(chunkEndTime * sampleRate);
        const frameCount = endFrame - startFrame;
        
        // 新しいAudioBufferにデータをコピー
        const chunkBuffer = audioCtx.createBuffer(numChannels, frameCount, sampleRate);
        for (let i = 0; i < numChannels; i++) {
            const channelData = audioBuffer.getChannelData(i);
            const chunkChannelData = chunkBuffer.getChannelData(i);
            chunkChannelData.set(channelData.subarray(startFrame, endFrame));
        }

        // AudioBufferをWAV形式のBlobにエンコード（この部分は少し複雑です）
        const wavBlob = bufferToWave(chunkBuffer, frameCount);

        // 分割したチャンクを文字起こし
        const transcribedText = await transcribeChunk(wavBlob);
        if (transcribedText && transcribedText !== "[エラー]") {
            fullTranscription += transcribedText;
            transcriptionResultTextarea.value = fullTranscription;
            transcriptionResultTextarea.scrollTop = transcriptionResultTextarea.scrollHeight;
        }
        
        currentTime += chunkDuration;
    }

    statusP.innerText = "文字起こしが完了しました。";
    summarizeButton.classList.remove('hidden');
    downloadTextButton.classList.remove('hidden');
}

/**
 * AudioBufferをWAV形式のBlobに変換するヘルパー関数
 * @param {AudioBuffer} abuffer 変換したいAudioBuffer
 * @param {number} len フレーム数
 * @returns {Blob} WAV形式のBlobオブジェクト
 */
function bufferToWave(abuffer, len) {
    let numOfChan = abuffer.numberOfChannels,
        length = len * numOfChan * 2 + 44,
        buffer = new ArrayBuffer(length),
        view = new DataView(buffer),
        channels = [],
        i, sample,
        offset = 0,
        pos = 0;

    // ヘッダーを書き込む
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(abuffer.sampleRate);
    setUint32(abuffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    // チャンネルデータを書き込む
    for (i = 0; i < abuffer.numberOfChannels; i++)
        channels.push(abuffer.getChannelData(i));

    while (pos < length) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++
    }
    
    return new Blob([view], { type: 'audio/wav' });

    function setUint16(data) {
        view.setUint16(pos, data, true);
        pos += 2;
    }
    function setUint32(data) {
        view.setUint32(pos, data, true);
        pos += 4;
    }
}