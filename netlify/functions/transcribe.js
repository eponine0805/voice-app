// ファイルパス: netlify/functions/transcribe.js

const API_URL = "https://api-inference.huggingface.co/models/openai/whisper-base";

export const handler = async (event) => {
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
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${HUGGINGFACE_TOKEN}` },
            body: audioBuffer,
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Hugging Face API Error:", errorBody);
            throw new Error(`Hugging Face API responded with status ${response.status}`);
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