// pages/api/ai.js  – 2025‑05‑12 unified version
// --------------------------------------------------
// POST  { text }  =>  {
//   topics: [...],
//   keywords: [ { keyword, options:[{ url, title }] } ],
//   original: <escaped‑html>
// }
// --------------------------------------------------

import { Configuration, OpenAIApi } from "openai";

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

const SERPER_KEY = process.env.SERPER_API_KEY;
const SERPER_ENDPOINT = "https://google.serper.dev/search";

export const config = { runtime: "edge" };

export default async function handler(req) {
  if (req.method !== "POST")
    return new Response("Method not allowed", { status: 405 });

  const { text = "" } = await req.json();
  if (!text.trim())
    return new Response("{error:'empty'}", { status: 400 });

  /* --------------------------------------------------
       1️⃣  让 GPT 抽取主题 + 关键词
     -------------------------------------------------- */
  const sys = `You are an SEO assistant. Read user article and output JSON ONLY.`;
  const usr = `Article:\n"""${text.slice(0,3800)}"""
Return a JSON object with fields:\n- topics: 2‑4 short strings of the main subject\n- keywords: 5‑10 noun phrases (max 3 words) that deserve authoritative outbound links\n  * Do NOT include duplicate or generic stop‑words\n  * Exclude phrases that already contain URLs\nExample:\n{"topics":["Electric vehicles"],"keywords":["AC charging","EV drivers"]}`;

  const gpt = await openai.createChatCompletion({
    model: "gpt-3.5-turbo",
    temperature: 0.2,
    messages: [ { role:"system", content: sys }, { role:"user", content: usr } ]
  });

  let parsed;
  try { parsed = JSON.parse(gpt.data.choices[0].message.content); }
  catch { parsed = { topics:[], keywords:[] }; }

  const kws = [...new Set(parsed.keywords || [])].slice(0,10);

  /* --------------------------------------------------
       2️⃣  为每个关键词查 3 个外链（Serper）
     -------------------------------------------------- */
  async function fetchSerper(q){
    try {
      const r = await fetch(SERPER_ENDPOINT, {
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "X-API-KEY": SERPER_KEY
        },
        body: JSON.stringify({ q, num: 10, autocorrect: true })
      });
      const j = await r.json();
      return (j.organic || []).slice(0,3).map(o=>({ url:o.link, title:o.title }));
    } catch(e){ return []; }
  }

  const keywords = [];
  for (const kw of kws){
    let options = await fetchSerper(kw);
    if(!options.length){
      // fallback wikipedia
      options = [{ url:`https://en.wikipedia.org/wiki/${encodeURIComponent(kw.replace(/ /g,"_"))}`, title:`${kw} – Wikipedia` }];
    }
    keywords.push({ keyword: kw, options });
  }

  /* --------------------------------------------------
       3️⃣  返回
     -------------------------------------------------- */
  return new Response(
    JSON.stringify({ topics: parsed.topics || [], keywords, original: escapeHtml(text) }),
    { headers:{"Content-Type":"application/json"} }
  );
}

/* util: very light HTML escape so < & > don’t break editing area */
function escapeHtml(str){
  return str.replace(/[&<>]/g, c=> ({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
}
