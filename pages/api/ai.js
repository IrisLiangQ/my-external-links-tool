import OpenAI from "openai";
import axios from "axios";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- 工具函数 ---------- */
async function embed(text) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return data[0].embedding;
}
function cosine(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
const STOP = ["time","people","things","important","great","good","bad","nice","big","small","many"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* 1️⃣ GPT：topic + 短语打分 */
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
`Step1 ► List 2‒3 keyword TAGS describing the paragraph topic.
Step2 ► Extract up to 15 KEY PHRASES (2-4 English words) strongly related to that topic.
Return ONLY JSON:

{
 "topics":["tag1","tag2"],
 "phrases":[ {"text":"…","score":1-5}, … ]
}

Paragraph:
"""${text}"""`,
        },
      ],
    });
    const { topics, phrases } = JSON.parse(g.choices[0].message.content);

    /* 2️⃣ 语义过滤：score≥3 + 非停用词 + 相似度>0.2 */
    const paraVec = await embed(text);
    const filtered = [];
    for (const p of phrases) {
      if (p.score < 3) continue;
      if (STOP.some(w => p.text.toLowerCase().split(" ").includes(w))) continue;
      const sim = cosine(await embed(p.text), paraVec);
      if (sim > 0.2) filtered.push(p.text);
      if (filtered.length === 10) break;
    }
    if (!filtered.length) return res.status(500).json({ error: "No key phrases" });

    /* 3️⃣ 查外链 */
    const result = [];
    for (const kw of filtered) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: kw, num: 3 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );
      result.push({
        keyword: kw,
        options: data.organic.slice(0, 3).map(o => ({ url: o.link, title: o.title })),
      });
    }
    return res.status(200).json({ topics, keywords: result, original: text });
  } catch (e) {
    console.error("ai.js error", e);
    return res.status(500).json({ error: e.message });
  }
}
