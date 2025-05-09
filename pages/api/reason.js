// pages/api/reason.js
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  /* 0. 预检请求直接放行 */
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }

  /* 1. 只处理 POST，其余再 405 */
  if (req.method !== "POST") return res.status(405).end();

  const { url, phrase } = req.body;
  try {
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert SEO copywriter." },
        {
          role: "user",
          content: `In ONE short sentence, explain why linking to ${url} adds authority when talking about "${phrase}".`,
        },
      ],
    });
    res.status(200).json({ reason: g.choices[0].message.content.trim() });
  } catch (e) {
    console.error("reason API error:", e);
    res.status(500).json({ error: e.message });
  }
}
