// ファイルパス: netlify/functions/transcribe.js

// Hugging FaceのAPIエンドポイントURL
const API_URL = "https://api-inference.huggingface.co/models/openai/whisper-base";

// Netlifyが実行するメインの関数
export const handler = async (event) => {
    // POSTリクエスト以外は受け付けない
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Netlifyの環境変数からAPIキーを安全に読み込む
        const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
        if (!HUGGINGFACE_TOKEN) {
            throw new Error("Hugging Face API token not configured.");
        }

        // ブラウザから送られてきたContent-Typeヘッダーを取得する【重要】
        const contentType = event.headers['content-type'];
        if (!contentType || !contentType.startsWith('audio/')) {
            throw new Error("Valid audio Content-Type header is required.");
        }

        // 音声データをBufferに変換
        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        
        // Hugging Face APIに直接fetchでリクエストを送信する
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                // 認証情報と、ブラウザから受け取ったContent-Typeをそのまま設定する【重要】
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                'Content-Type': contentType,
            },
            body: audioBuffer,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Hugging Face API Error:", errorBody);
            throw new Error(`Hugging Face API responded with status ${response.status}`);
        }

        const result = await response.json();

        // 成功レスポンスを返す
        return {
            statusCode: 200,
            body: JSON.stringify(result),
        };

    } catch (error) {
        console.error("Netlify Function内でエラー:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};