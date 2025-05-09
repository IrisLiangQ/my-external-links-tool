import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    return res.status(200).end();
  }
  if (req.method !== "POST") return res.status(405).end();

  const { url, phrase } = req.body;
  try {
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You write concise EEAT justifications." },
        {
          role: "user",
          content:
`Within 15 English words, tell readers how this link helps them understand "${phrase}". Focus on insight or data, not the URL.`,
        },
      ],
    });
    res.status(200).json({ reason: g.choices[0].message.content.trim() });
  } catch (e) {
    console.error("reason error:", e);
    res.status(500).json({ error: e.message });
  }
}
