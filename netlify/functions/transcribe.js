// ファイルパス: netlify/functions/transcribe.js

// 最新のimport構文を使います
import { HfInference } from "@huggingface/inference";

// Hugging Face Inferenceクライアントを初期化
// Netlifyの環境変数からAPIキーを自動で読み込みます
const hf = new HfInference(process.env.HUGGINGFACE_TOKEN);

// Netlifyが実行するメインの関数
export const handler = async (event) => {
    // POSTリクエストのみを受け付ける
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // ブラウザから送信された音声データはevent.bodyに入っている
        // NetlifyによってBase64エンコードされているため、Bufferに変換する
        const audioBuffer = Buffer.from(event.body, 'base64');

        // Whisperモデルを使って文字起こしAPIを呼び出す
        const response = await hf.automaticSpeechRecognition({
            model: 'openai/whisper-large-v3', // より高速な small や base モデルも選択肢
            data: audioBuffer,
        });

        // 文字起こし結果を成功レスポンスとして返す
        return {
            statusCode: 200,
            body: JSON.stringify(response),
        };

    } catch (error) {
        console.error("Netlify Function内でエラー:", error);
        // エラーメッセージをブラウザに返す
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};