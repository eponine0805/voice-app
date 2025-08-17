// ファイルパス: netlify/functions/transcribe.js

const API_URL = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";

// 'axios'ライブラリを読み込む
const axios = require('axios');

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

        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        
        // fetchの代わりにaxiosを使ってHugging Face APIにリクエストを送信
        const response = await axios.post(API_URL, audioBuffer, {
            headers: {
                'Authorization': `Bearer ${HUGGINGFACE_TOKEN}`,
                // axiosはBufferを送信する際に自動で適切なContent-Typeを設定してくれる
            },
            // Netlifyのタイムアウト（最大26秒）に合わせて設定
            timeout: 25000 
        });

        // 成功レスポンスを返す（axiosでは結果は .data プロパティに入る）
        return {
            statusCode: 200,
            body: JSON.stringify(response.data),
        };

    } catch (error) {
        console.error("Netlify Function Error:", error.response ? error.response.data : error.message);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};