// ファイルパス: netlify/functions/summarize.js

import { GoogleGenerativeAI } from "@google/generative-ai";

// Netlifyの環境変数からAPIキーを読み込む
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// この行が重要です。'export const handler' と正しく記述されているか確認します。
export const handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        const transcript = event.body; // script.jsから送られてきた文字起こしテキスト
        if (!transcript) {
            throw new Error("文字起こしテキストがありません。");
        }

        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        const prompt = `
# 命令書
あなたは優秀なビジネスアシスタントです。以下の制約条件と入力テキストをもとに、ビジネス用の議事録を作成してください。

# 制約条件
・決定事項、ToDo（担当者も含む）、要点を明確に分けて見出しを付けてください。
・箇条書きを効果的に使用し、簡潔で分かりやすい文章にしてください。
・発言者名は特定せず、内容を客観的にまとめてください。

# 入力テキスト
${transcript}
`;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const summaryText = response.text();

        return {
            statusCode: 200,
            body: JSON.stringify({ summary: summaryText }),
        };

    } catch (error) {
        console.error("Gemini API Error:", error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message }),
        };
    }
};