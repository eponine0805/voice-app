// ファイルパス: netlify/functions/transcribe.js

// 安定して高速な whisper-base モデルのURL
const API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";

// 'exports.handler' を使って、最も標準的な形式で関数を定義します
exports.handler = async (event) => {
    // POSTリクエスト以外は受け付けない
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // APIキーを環境変数から読み込む
        const HUGGINGFACE_TOKEN = process.env.HUGGINGFACE_TOKEN;
        if (!HUGGINGFACE_TOKEN) {
            throw new Error("Hugging Face API token is not configured.");
        }

        // リクエストボディが存在しない場合はエラー
        if (!event.body) {
            throw new Error("Request body is missing.");
        }

        // 音声データをBufferに変換
        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        
        // Hugging Face APIに直接fetchでリクエストを送信
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
            },
            body: audioBuffer,
        });

        // 応答が正常でない場合、APIからのエラーメッセージをそのまま返す
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Hugging Face API Error:", errorBody);
            // エラーをJSON形式でラップして返す
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: `Hugging Face API responded with status ${response.status}: ${errorBody}` })
            };
        }

        const result = await response.json();

        // 成功レスポンスを返す
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