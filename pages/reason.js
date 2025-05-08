import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url, phrase } = req.body;                 // phrase 供 GPT 参考

  try {
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an expert SEO copywriter." },
        {
          role: "user",
          content:
            `In ONE short sentence, explain why linking to ${url} adds authority ` +
            `when talking about "${phrase}".`,
        },
      ],
    });
    const reason = g.choices[0].message.content.trim();
    res.status(200).json({ reason });
  } catch (e) {
    console.error("reason API error", e);
    res.status(500).json({ reason: "high-quality additional reading" }); // 兜底
  }
}
