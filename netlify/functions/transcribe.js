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
        
        // --- ▼ここから変更▼ ---
        // Buffer形式のデータを、ライブラリがより確実に扱えるBlob形式に変換します
        const audioBlob = new Blob([audioBuffer]);
        // --- ▲ここまで変更▲ ---

        const response = await hf.automaticSpeechRecognition({
            model: 'openai/whisper-base',
            data: audioBlob, // Bufferの代わりにBlobを渡す
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