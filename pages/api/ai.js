// pages/api/ai.js
// 统一关键词提取 + 外链搜索接口
// ---------------------------------------------------
export const config = {
  runtime: "edge", // 使用 Edge Runtime，减少冷启动
};

const OPENAI_API_KEY  = process.env.OPENAI_API_KEY;
const SERPER_API_KEY  = process.env.SERPER_API_KEY;

if (!OPENAI_API_KEY || !SERPER_API_KEY) {
  console.warn("[api/ai] 缺少 OPENAI_API_KEY 或 SERPER_API_KEY 环境变量！");
}

/* -------------------------------------------------- */
const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const SERPER_URL = "https://google.serper.dev/search";

/**
 * 调用 OpenAI，返回 { topics: string[], keywords: string[] }
 */
async function extractKeywords(text) {
  const prompt = `You are an SEO assistant.\n\nGiven the following English paragraph between <text></text>,\n1. Identify the MAIN TOPIC in 3 ~ 5 words.\n2. Pick up to 6 keyword phrases (1 ~ 3 words each) suitable for inserting external links.\n3. Do NOT repeat the same surface form.\n4. Return ONLY valid JSON like {\n  \"topics\": [ ... ],\n  \"keywords\": [ ... ]\n}`;

  const body = {
    model: "gpt-3.5-turbo", // 免费模型
    messages: [
      { role: "system", content: prompt },
      { role: "user",   content: `<text>\n${text}\n</text>` }
    ],
    temperature: 0.3,
  };

  const r = await fetch(OPENAI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`OpenAI error: ${r.status}`);
  const { choices } = await r.json();
  const raw = choices?.[0]?.message?.content?.trim();
  const json = JSON.parse(raw);
  return json;
}

/**
 * 用 Serper 搜索关键词，返回前 3 条 { url,title }
 */
async function searchLinks(keyword) {
  const r = await fetch(SERPER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": SERPER_API_KEY,
    },
    body: JSON.stringify({ q: keyword, autocorrect: true, gl: "us", num: 5 }),
  });
  if (!r.ok) throw new Error("Serper error");
  const json = await r.json();
  const results = json?.organic ?? [];
  return results.slice(0, 3).map((o) => ({ url: o.link, title: o.title }));
}

/* -------------------------------------------------- */
export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  const text = body?.text?.trim?.();
  if (!text) return new Response("Missing text", { status: 400 });

  try {
    // 1. 提取关键词
    const { topics = [], keywords = [] } = await extractKeywords(text);

    // 2. 去重（忽略大小写）
    const unique = Array.from(new Set(keywords.map((k) => k.toLowerCase())));

    // 3. 查询外链（并发）
    const kwObjects = await Promise.all(
      unique.map(async (kw) => {
        const options = await searchLinks(kw);
        return { keyword: kw, options };
      })
    );

    /* 返回结构：{ topics, keywords:[{keyword,options}], original } */
    const payload = {
      topics,
      keywords: kwObjects,
      original: text,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("/api/ai", err);
    return new Response("Internal Server Error", { status: 500 });
  }
}
