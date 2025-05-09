import OpenAI from "openai";
import axios from "axios";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function safeJson(str, fallback) {
  try {
    const s = str.indexOf("[");
    const e = str.lastIndexOf("]");
    return JSON.parse(str.slice(s, e + 1));
  } catch { return fallback; }
}

/* ❶ 极简停用词表，可再扩充 */
const COMMON = ["time","years","people","things","way","problem","important",
                "big","small","good","bad","nice","great","new","old","many",
                "very","some","any","thing","issue","example","solution","type"];

/* API Route */
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* ① GPT：主题 + 关键词 + 评分 */
    const gpt = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
`Step1: Summarize the MAIN TOPIC of the following paragraph in one short phrase.
Step2: Extract up to 12 KEY PHRASES (2-4 English words) that are highly relevant to that topic. 
Return ONLY valid JSON:

{
  "topic": "<the main topic>",
  "keyPhrases":[
      {"phrase":"...","score":1-5},
      ...
  ]
}

Paragraph:
"""${text}"""`,
        },
      ],
    });

    /* ② 解析结果 */
    const rawObj = JSON.parse(gpt.choices[0].message.content);
    const topic  = rawObj.topic || "";
    let phrases  = rawObj.keyPhrases || [];

    /* ③ 本地过滤：score ≥3 且不含通用停用词 */
    phrases = phrases
      .filter(p => p.score >= 3)
      .filter(p => !COMMON.some(w => p.phrase.toLowerCase().split(" ").includes(w)))
      .slice(0, 10);

    if (!phrases.length) {
      return res.status(500).json({ error: "No relevant phrases" });
    }

    /* ④ 对每个短语搜外链 */
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

    /* ⑤ 返回给前端 */
    return res.status(200).json({
      topic,
      keywords: result,
      original
