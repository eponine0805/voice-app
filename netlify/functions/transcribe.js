// ファイルパス: netlify/functions/transcribe.js

const API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
        if (!HUGGINGFACE_TOKEN) {
            throw new Error("Hugging Face API token is not configured.");
        }

        if (!event.body) {
            throw new Error("Request body is missing.");
        }

        // ▼▼▼ ここからが重要な修正 ▼▼▼

        
        // ブラウザから送られてきたContent-Typeヘッダーを取得する
        const contentType = event.headers['content-type'];
        if (!contentType) {
            throw new Error("Content-Type header is missing from the request.");
        }

        // 受け取ったリクエストボディをBufferに変換
        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');

        // Hugging Face APIへのリクエスト
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // 認証情報に加えて、取得したContent-Typeをそのまま設定する
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': contentType,
            },
            body: audioBuffer,
        });
        // ▲▲▲ ここまでが重要な修正 ▲▲▲

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Hugging Face API Error:", errorBody);
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `Hugging Face API responded with an error: ${errorBody}` })
            };
        }

        const result = await response.json();
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error("Netlify Function Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};