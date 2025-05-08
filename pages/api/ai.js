import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* 1. 取关键词（JSON 数组） */
    const kwResp = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
            `Extract up to 20 important English keywords from the following article. Reply ONLY with a JSON array:\n\n${text}`,
        },
      ],
    });
    const keywords = JSON.parse(kwResp.choices[0].message.content);

    /* 2. 每个关键词查 3 条结果 + GPT 写推荐理由 */
    const payload = [];
    for (const kw of keywords) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: kw, num: 3 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );

      const options = [];
      for (const link of data.organic.slice(0, 3).map((i) => i.link)) {
        const reasonResp = await openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "You are an SEO assistant." },
            {
              role: "user",
              content: `In ONE sentence, explain why linking to ${link} demonstrates EEAT authority.`,
            },
          ],
        });
        options.push({
          url: link,
          reason: reasonResp.choices[0].message.content.trim(),
        });
      }

      payload.push({ keyword: kw, options });
    }

    return res.status(200).json({ keywords: payload, original: text });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "Server error" });
  }
}
