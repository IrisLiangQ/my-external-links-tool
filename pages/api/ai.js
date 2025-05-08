import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- 更鲁棒的解析：锁定最外层 [ ... ] ---------- */
function parseJsonArray(str, fallback = []) {
  try {
    const start = str.indexOf("[");
    const end   = str.lastIndexOf("]");
    if (start === -1 || end === -1) throw new Error("no brackets");
    const slice = str.slice(start, end + 1);
    return JSON.parse(slice);
  } catch (_) {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* 1. 要关键词 */
    const kwResp = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
            `Extract the 10 most important English keywords from the following article. ` +
            `Reply ONLY with a JSON array (no markdown, no extra text).\n\n${text}`,
        },
      ],
    });

    const raw   = kwResp.choices[0].message.content;
    const keywords = parseJsonArray(raw);

    if (!keywords.length) {
      console.error("API ERROR: keyword array empty, raw =>", raw);
      return res.status(500).json({ error: "Keyword parse failed" });
    }

    /* 2. 查 3 条链接 */
    const payload = [];
    for (const kw of keywords) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: kw, num: 3 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );

      payload.push({
        keyword: kw,
        options: data.organic.slice(0, 3).map(i => ({ url: i.link }))
      });
    }

    return res.status(200).json({ keywords: payload, original: text });
  } catch (e) {
    console.error("API ERROR:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
