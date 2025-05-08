import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function parseJson(str, fallback = []) {
  try {
    const s = str.indexOf("[");
    const e = str.lastIndexOf("]");
    return JSON.parse(str.slice(s, e + 1));
  } catch {
    return fallback;
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* GPT 3.5 免费模型抽重点短语 + 评分 */
    const gpt = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",            // ← 改这里，免费
      messages: [
        { role: "system", content: "You are an expert SEO assistant." },
        {
          role: "user",
          content:
            `For the following paragraph, list up to 10 KEY PHRASES (2-5 English words) ` +
            `that are most important to the author's main idea. ` +
            `Return a pure JSON array where each item is {"phrase":"...", "score":1-5}. ` +
            `Score 5 = absolutely central; 1 = barely relevant.\n\n${text}`,
        },
      ],
    });

    const pick = parseJson(gpt.choices[0].message.content);

    const phrases = pick
      .filter(p => p.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    if (!phrases.length) {
      return res.status(500).json({ error: "No key phrases" });
    }

    /* Serper 查链接 */
    const result = [];
    for (const { phrase } of phrases) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: phrase, num: 3 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );
      result.push({
        keyword: phrase,
        options: data.organic.slice(0, 3).map(i => ({
          url: i.link,
          title: i.title || i.link,
        })),
      });
    }

    return res.status(200).json({ keywords: result, original: text });
  } catch (e) {
    console.error("API ERROR:", e);
    return res.status(500).json({ error: "Internal error" });
  }
}
