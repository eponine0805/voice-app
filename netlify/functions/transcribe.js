// ファイルパス: netlify/functions/transcribe.js

import { HfInference } from "@huggingface/inference";

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        if (!event.body) {
            throw new Error("Request body is missing.");
        }

        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');

        // BufferをBlobに変換
        const audioBlob = new Blob([audioBuffer]);

        // Hugging Faceライブラリを使って文字起こしを実行
        const response = await hf.automaticSpeechRecognition({
            model: 'openai/whisper-base', // 安定性と速度のため'base'モデルを使用
            data: audioBlob,
        });

        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};