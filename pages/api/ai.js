// pages/api/ai.js – 2025‑05 全量最新版
// --------------------------------------------
// 1) 依赖：OpenAI & Serper
// 2) POST { text }  ⇒ { topics, keywords:[{ keyword, options:[{url,title}] }], original }
// --------------------------------------------
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SERPER_KEY = process.env.SERPER_API_KEY;
const SERPER_ENDPOINT = "https://google.serper.dev/search";

export const config = { runtime: "edge" };

/* ---------- 小工具 ---------- */
const uniqBy = (arr, keyFn) => {
  const map = {};
  arr.forEach((o) => {
    map[keyFn(o)] = o;
  });
  return Object.values(map);
};

async function googleOptions(keyword) {
  const res = await fetch(SERPER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_KEY,
    },
    body: JSON.stringify({ q: keyword, gl: "us" }),
  });
  if (!res.ok) return [];
  const json = await res.json();
  const list = [
    ...(json.organic || []),
    ...(json.news || []),
    ...(json.answerBox?.links || []),
  ].filter((x) => x.link && x.title);
  return uniqBy(list, (o) => o.link)
    .slice(0, 3)
    .map((o) => ({ url: o.link, title: o.title }));
}

/* ---------- 主 handler ---------- */
export default async function handler(req) {
  if (req.method !== "POST") return new Response("", { status: 405 });

  const { text = "" } = await req.json();
  const prompt = `You are an SEO assistant.\nGiven the English paragraph delimited by <text>,\n1. Return 2~3 topical phrases that represent the main subject.\n2. Return up to 10 candidate anchor keywords (single words or short phrases that could be externally linked).\nRespond as JSON with keys {\"topics\":[],\"keywords\":[]} only.\n<text>${text}</text>`;

  const gpt = await openai.chat.completions.create({
    model: "gpt-3.5-turbo-0125",
    temperature: 0.4,
    messages: [
      { role: "system", content: "You output JSON only." },
      { role: "user", content: prompt },
    ],
  });

  let parsed;
  try {
    parsed = JSON.parse(gpt.choices[0].message.content);
  } catch {
    parsed = { topics: [], keywords: [] };
  }

  const rawKw = (parsed.keywords || [])
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 1 && s.length < 60);

  const keywords = uniqBy(rawKw, (s) => s.toLowerCase()).slice(0, 8);

  // 逐个查外链
  const kwWithOptions = [];
  for (const kw of keywords) {
    const options = await googleOptions(kw);
    if (options.length) kwWithOptions.push({ keyword: kw, options });
  }

  return new Response(
    JSON.stringify({
      topics: parsed.topics || [],
      keywords: kwWithOptions,
      original: text,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
}
