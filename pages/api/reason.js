/**
 * /api/reason
 * 请求体：{ url: string, phrase: string, sentence?: string }
 * 响应体：{ reason: string }   // 不含 ((...)) 包装，前端插入时再补
 *
 * 规则（更新）：
 * 1. ≤ 15 个英文单词
 * 2. 不以 “Source / This site” 开头；不用 marketing 形容词
 * 3. 若能提到数字、年份或“toolkit / study / law”等文档类型更佳
 */
import { getDomain } from 'tldts';

export default async function handler(req, res) {
  const { url, phrase, sentence = '' } = req.body || {};
  if (!url || !phrase) return res.status(400).json({ error: 'url & phrase required' });

  const domain = getDomain(url) || 'source site';

  /* -------- 调 OpenAI 生成脚注理由 -------- */
  const openaiResp = await fetch('https://api.openai.com/v1/chat/completions', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization : `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-3.5-turbo-0125',
      temperature: 0.4,
      max_tokens: 28,                             // ★ 更短
      messages: [
        {
          role: 'system',
          content:
            `Write parenthetical footnotes **max 15 words**. \
Third-person factual style. \
Avoid starting with "Source" or "This site". \
No marketing adjectives; no words like link/page/article/click. \
If possible, mention a number, year, or document type (toolkit, study, law).`
        },
        {
          role: 'user',
          content:
            `Keyword: "${phrase}"\n` +
            `Sentence context: "${sentence.slice(0, 300)}"\n` +
            `Source domain: ${domain}\n` +
            `URL: ${url}\n\n` +
            `Write an English footnote explaining exactly what useful info this source gives about the keyword.`
        }
      ]
    })
  }).then(r => r.json());

  const reason = openaiResp?.choices?.[0]?.message?.content
    ?.replace(/^[(\s]+|[)\s]+$/g, '')   // 去掉开头/结尾括号
    ?.trim()
    ?.slice(0, 120)                     // 双保险：≈15 词
    || 'relevant reference';

  return res.status(200).json({ reason });
}
