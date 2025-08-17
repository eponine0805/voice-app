// in script.js

// この関数だけを置き換えてください
async function transcribeAudio(audioData) {
    try {
        console.log("チェックポイント1：文字起こし処理を開始しました。");
        statusP.innerText = "AIモデルを準備中... (初回は時間がかかります)";
        
        console.log("チェックポイント2：AIパイプラインの準備を開始します。");
        const transcriber = await pipeline('automatic-speech-recognition', 'Xenova/whisper-small', {
            progress_callback: (data) => {
                if (data.status === 'progress') {
                    const progress = (data.progress).toFixed(2);
                    statusP.innerText = `AIモデルを準備中... (${progress}%)`;
                } else if (data.status === 'ready') {
                    console.log("チェックポイント2.5：モデルの準備が完了しました。");
                    statusP.innerText = `AIモデルを準備中... (${data.status})`;
                }
            }
        });
        console.log("チェックポイント3：AIパイプラインの準備が完了しました。", transcriber);

        statusP.innerText = "文字起こしを実行中...";
        console.log("チェックポイント4：AIモデルによる音声処理を開始します。");

        const output = await transcriber(await audioData.arrayBuffer(), {
            chunk_length_s: 30,
            language: 'japanese',
            task: 'transcribe',
        });
        
        console.log("チェックポイント5：AIモデルの処理が完了しました。出力:", output);
        
        const transcribedText = output.text;
        console.log("チェックポイント6：抽出されたテキスト:", transcribedText);
        
        await processTranscriptionResult(transcribedText);

    } catch (error) {
        console.error("チェックポイントX：エラーが発生しました。", error);
        statusP.innerText = "文字起こし中にエラーが発生しました。";
        await processTranscriptionResult("[エラー]");
    }
}