import OpenAI from "openai";
import axios from "axios";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ---------- 工具 ---------- */
function stripWrapper(str) {
  // 去掉 ```json 块或其他前后杂文，只保留 {...}
  const s = str.indexOf("{");
  const e = str.lastIndexOf("}");
  return str.slice(s, e + 1);
}
function safeObj(str) {
  try { return JSON.parse(stripWrapper(str)); }
  catch { return { topics: [], phrases: [] }; }
}
async function embed(text) {
  const { data } = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
  });
  return data[0].embedding;
}
function cosine(a, b) {
  let d = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    d  += a[i] * b[i];
    na += a[i] ** 2;
    nb += b[i] ** 2;
  }
  return d / (Math.sqrt(na) * Math.sqrt(nb));
}

/* ---------- 停用 & 杂域名 ---------- */
const STOP = ["time","people","things","important","great","good","bad","nice","big","small","many",
              "type","average","full","mistake","expecting"];
const LOW_AUTH = ["reddit.com","medium.com","wikipedia.org","linkedin.com","github.com"];

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* 1️⃣ GPT: topic & phrases */
    const gpt = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
`Step-1 ► Give 2-3 short TAGS for the paragraph topic.
Step-2 ► Extract ≤15 strongly-related KEY PHRASES (2-4 English words) with a 1-5 relevance score.
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

    const { topics = [], phrases = [] } = safeObj(gpt.choices[0].message.content);

    /* 2️⃣ 语义 & 停用过滤 */
    const baseVec = await embed(text);
    const wanted = [];
    for (const p of phrases) {
      if (p.score < 3) continue;
      if (STOP.some(w => p.text.toLowerCase().split(" ").includes(w))) continue;
      const sim = cosine(await embed(p.text), baseVec);
      if (sim >= 0.25) wanted.push(p.text);
      if (wanted.length === 10) break;
    }
    if (!wanted.length) return res.status(500).json({ error: "No key phrases" });

    /* 3️⃣ 外链查询 + 域名优先级 */
    const rank = url => {
      const host = new URL(url).hostname.replace("www.","");
      if (host.endsWith(".gov") || host.endsWith(".edu")) return 0;
      if (/tesla|chargepoint|nrel|energystar|shell|bp|chargehub/i.test(host)) return 1;
      if (LOW_AUTH.some(d => host.includes(d))) return 3;
      return 2;
    };

    const keywords = [];
    for (const kw of wanted) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: kw, num: 8 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );
      const options = data.organic
        .sort((a,b) => rank(a.link) - rank(b.link))
        .slice(0,3)
        .map(o => ({ url: o.link, title: o.title || o.link }));
      keywords.push({ keyword: kw, options });
    }

    return res.status(200).json({ topics, keywords, original: text });
  } catch (e) {
    console.error("ai.js error:", e);
    res.status(500).json({ error: e.message });
  }
}
