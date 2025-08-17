// ファイルパス: netlify/functions/transcribe.js

// 'import'の代わりに'require'を使ってライブラリを読み込みます
const { HfInference } = require("@huggingface/inference");

const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

// 'export const handler'の代わりに'exports.handler'を使います
exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        if (!event.body) {
            throw new Error("Request body is missing.");
        }

        const audioBuffer = Buffer.from(event.body, event.isBase64Encoded ? 'base64' : 'binary');
        
        const audioBlob = new Blob([audioBuffer]);

        const response = await hf.automaticSpeechRecognition({
            model: 'openai/whisper-base',
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