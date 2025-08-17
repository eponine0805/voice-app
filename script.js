// in script.js

async function startRecording() {
    try {
        resetUI();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        // --- ▼ここからが音量増幅のコード▼ ---
        // Web Audio APIのセットアップ
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // AudioWorkletをロード
        await audioContext.audioWorklet.addModule('worklet-processor.js');
        
        // マイクからの音声ストリームを取得
        microphoneStream = audioContext.createMediaStreamSource(stream);
        
        // 音量を増幅するための「ゲインノード」を作成
        const gainNode = audioContext.createGain();
        // 増幅率を設定（3.0 = 3倍）。必要に応じて調整してください
        gainNode.gain.value = 3.0; 
        
        // マイクの音声をゲインノードに接続
        microphoneStream.connect(gainNode);
        
        const workletNode = new AudioWorkletNode(audioContext, 'audio-processor');
        const mediaStreamDestination = audioContext.createMediaStreamDestination();

        // 増幅された音声をWorkletに接続
        gainNode.connect(workletNode);
        // Workletから最終的な出力先に接続
        workletNode.connect(mediaStreamDestination);
        
        // 増幅・処理された音声ストリームをMediaRecorderに渡す
        mediaRecorder = new MediaRecorder(mediaStreamDestination.stream);
        // --- ▲ここまでが音量増幅のコード▲ ---

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
        alert("マイクへのアクセスまたは音声処理の初期化に失敗しました。");
        resetUI();
    }
}