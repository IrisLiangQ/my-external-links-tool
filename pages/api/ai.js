/**
 * /api/ai   —— 把原文发送给 OpenAI，返回
 * { original: string, keywords:[ { keyword, options } ] }
 * 关键词改为 “1-4 个英文单词的短语”
 */

export default async function handler(req, res) {
  const { text = '' } = req.body || {};
  if (!text.trim()) return res.status(400).json({ error: 'text required' });

  /* ---------- 1. GPT 提取短语 ---------- */
  const gpt = await fetch('https://api.openai.com/v1/chat/completions', {
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
  }).then(r => r.json()).catch(() => null);

  let phrases = [];
  try {
    phrases = JSON.parse(gpt.choices[0].message.content);
  } catch {
    /* 万一解析失败，退回空数组 */
  }

  /* ---------- 2. 调 /api/search 为每个短语找外链 ---------- */
  const keywords = await Promise.all(
    phrases.map(async (kw) => {
      const r = await fetch('http://localhost:3000/api/search', {   // ← 若部署域名不同请改
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ kw, text }),
      }).then(r => r.json()).catch(() => ({ links: [] }));
      return { keyword: kw, options: r.links };
    }),
  );

  return res.status(200).json({ original: text, keywords });
}
