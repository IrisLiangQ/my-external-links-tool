/**
 * /api/ai   —— 把原文发送给 OpenAI，返回
 * { original: string, keywords:[ { keyword, options } ] }
 * 关键词改为 “1-4 个英文单词的短语”
 */

/* ===== BEGIN 修改：获取当前域名 ===== */
function getBaseUrl(req) {
  // ① Vercel 线上
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  // ② 本地 dev / 其他
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}
/* ===== END 修改 ===================== */

export default async function handler(req, res) {
  const { text = '' } = req.body || {};
  if (!text.trim()) {
    return res.status(400).json({ error: 'text required' });
  }

  /* ---------- 1. GPT 提取短语 ---------- */
  const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization : `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo-0125',
      temperature: 0,
      max_tokens: 120,
      messages: [
        {
          role: 'system',
          content:
            'Extract up to 7 KEY PHRASES (1-4 English words) that a blogger would ' +
            'link to authoritative sources. Return ONLY a JSON array of strings.',
        },
        { role: 'user', content: text.slice(0, 2000) },
      ],
    }),
  }).then(r => r.json())
    .catch(() => null);        // 网络 / OpenAI 报错保护

  /* ===== BEGIN 修改：安全 JSON.parse ===== */
  let phrases = [];
  try {
    const raw = gptResp?.choices?.[0]?.message?.content || '[]';
    phrases = JSON.parse(raw);
  } catch {
    // 解析失败直接置空，后续就不会请求 search
    phrases = [];
  }
  /* ===== END 修改 ======================= */

  /* ---------- 2. 调 /api/search 为每个短语找外链 ---------- */
  const base = getBaseUrl(req);                 // ← 使用动态域名
  const keywords = await Promise.all(
    phrases.map(async (kw) => {
      let links = [];
      try {
        const s = await fetch(`${base}/api/search`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ kw, text }),
        }).then(r => r.json());
        // ===== BEGIN 修改：search JSON 安全读取
        if (Array.isArray(s?.links)) links = s.links;
        // ===== END 修改
      } catch {
        /* 网络错误时保持 links 为空 */
      }
      return { keyword: kw, options: links };
    }),
  );
