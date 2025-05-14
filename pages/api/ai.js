// pages/api/ai.js
// ---------------------------------------------
// 提供：关键词提取 + 外链搜索
// Edge Runtime → 冷启动更快
export const config = { runtime: 'edge' };

/* ========== 环境变量检查 ========== */
const { OPENAI_API_KEY, SERPER_API_KEY } = process.env;
if (!OPENAI_API_KEY || !SERPER_API_KEY) {
  console.error('[api/ai] 缺少 OPENAI_API_KEY / SERPER_API_KEY！');
}

/* ========== 常量 ========== */
const OPENAI_URL = 'https://api.openai.com/v1/chat/completions';
const SERPER_URL = 'https://google.serper.dev/search';

/* ---------- 调 OpenAI 抽取关键词 ---------- */
async function extractKeywords(text) {
  const systemPrompt = [
    'You are an SEO assistant.',
    'Given the English paragraph between <text></text>:',
    '1. Identify the MAIN TOPIC in 3-5 words.',
    '2. Pick up to 6 keyword phrases (1-3 words) for external links.',
    '3. Do NOT repeat surface forms.',
    'Respond **only** valid JSON like',
    '{ "topics": [...], "keywords": [...] }',
  ].join('\n');

  const body = {
    model: 'gpt-3.5-turbo',          // 免费模型
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: `<text>\n${text}\n</text>` },
    ],
  };

  const r = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) {
    throw new Error(`OpenAI ${r.status} ${r.statusText}`);
  }

  const { choices } = await r.json();
  const raw = choices?.[0]?.message?.content?.trim() ?? '{}';

  // 某些场景 OpenAI 会在 JSON 前后加说明文字 → 尝试截取 {...}
  const match = raw.match(/\{[\s\S]*}/);
  const jsonStr = match ? match[0] : raw;

  return JSON.parse(jsonStr);
}

/* ---------- Serper (Google) 搜索 ---------- */
async function searchLinks(keyword) {
  const resp = await fetch(SERPER_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': SERPER_API_KEY,
    },
    body: JSON.stringify({
      q: keyword,
      gl: 'us',
      autocorrect: true,
      num: 6,
    }),
  });

  if (!resp.ok) {
    console.warn('[Serper] request failed', resp.status);
    return [];
  }

  const json = await resp.json();
  const list = json?.organic ?? [];
  return list.slice(0, 3).map((o) => ({
    url:   o.link,
    title: o.title,
  }));
}

/* ========== Edge API Handler ========== */
export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  /* ---- 解析请求体 ---- */
  let text = '';
  try {
    const body = await req.json();
    text = (body?.text || '').toString().trim();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }
  if (!text) return new Response('Missing text', { status: 400 });

  /* ---- 主流程 ---- */
  try {
    // 1⃣  调 OpenAI
    const { topics = [], keywords = [] } = await extractKeywords(text);

    // 2⃣  关键词去重（忽略大小写）
    const uniq = Array.from(
      new Set(
        keywords
          .map((k) => (k || '').trim())
          .filter(Boolean)
          .map((k) => k.toLowerCase()),
      ),
    ).slice(0, 6); // 再保险截断 6 个

    // 3⃣  并发搜索外链
    const kwObjs = await Promise.all(
      uniq.map(async (kw) => ({
        keyword: kw,
        options: await searchLinks(kw),
      })),
    );

    /* ---- 返回给前端 ---- */
    const payload = {
      topics,
      keywords: kwObjs,
      original: text,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('[api/ai] fatal', err);
    return new Response('Internal Server Error', { status: 500 });
  }
}
