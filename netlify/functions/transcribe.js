// ファイルパス: netlify/functions/transcribe.js

import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

export const handler = async (event) => {
    // POSTリクエスト以外は受け付けない
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // リクエストボディが存在しない場合はエラー
        if (!event.body) {
            throw new Error("Request body is missing.");
        }

        // NetlifyはバイナリデータをBase64エンコードして渡すため、
        // それを元の音声データ（Buffer）に戻す
        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        
        // Hugging Faceのライブラリを使って文字起こしを実行
        // このライブラリがデータ形式を判断し、適切なヘッダーを付けてくれる
        const response = await hf.automaticSpeechRecognition({
            model: 'openai/whisper-base', // 安定性と速度のため'base'モデルを推奨
            data: audioBuffer,
        });

        // 成功した結果をブラウザに返す
        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        // エラーが発生した場合、その内容をブラウザに返す
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};