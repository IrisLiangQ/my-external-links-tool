/**
 * /api/ai  —— 把原文发送给 OpenAI，返回：
 * { original: string, keywords:[ { keyword, options } ] }
 * 关键词为 1-4 个英文单词的短语
 */

/* ========= 取得当前域名（本地 dev / Vercel prod 通用） ========= */
function getBaseUrl(req) {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const host  = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}
/* =========================================================== */

export default async function handler(req, res) {
  const { text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text required' });

  /* ---------- 1. GPT 提取「1-4 词短语」 ---------- */
  let phrases = [];
  try {
    const gptResp = await fetch('https://api.openai.com/v1/chat/completions', {
      method : 'POST',
      headers: {
        'Content-Type' : 'application/json',
        Authorization  : `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model        : 'gpt-3.5-turbo-0125',
        temperature  : 0,
        max_tokens   : 120,
        messages: [
          {
            role   : 'system',
            content: 'Extract up to 7 KEY PHRASES (1-4 English words) that a blogger ' +
                     'would link to authoritative sources. Return ONLY a JSON array of strings.',
          },
          { role: 'user', content: text.slice(0, 2000) },
        ],
    }),
    }).then(r => r.json());

    const raw = gptResp?.choices?.[0]?.message?.content || '[]';
    phrases = JSON.parse(raw);           // 可能抛错，交给 catch
  } catch {
    phrases = [];                        // 解析失败保持空数组
  }

  /* ---------- 2. 为每个短语调用 /api/search ---------- */
  const base = getBaseUrl(req);

  const keywords = await Promise.all(
    phrases.map(async (kw) => {
      let links = [];
      try {
        const s = await fetch(`${base}/api/search`, {
          method : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body   : JSON.stringify({ kw, text }),
          signal : AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined,
        }).then(r => r.json());

        if (Array.isArray(s?.links)) links = s.links;
      } catch {
        /* 调用失败保持空 links */
      }
      return { keyword: kw, options: links };
    }),
  );

  /* ---------- 3. 返回给前端 ---------- */
  return res.status(200).json({ original: text, keywords });
}
