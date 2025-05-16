/**
 * /api/reason
 * 请求体：{ url: string, phrase: string, sentence?: string }
 * 响应体：{ reason: string }   // 不含 ((...)) 包装，前端插入时再补
 *
 * 生成规则：
 * 1. ≤ 18 个英文单词
 * 2. 第三人称、陈述句；禁止使用 marketing 词和 “link/page/article”
 * 3. 只说“这个来源提供了什么信息”——要么数字、要么结论、要么法规
 */
import { getDomain } from 'tldts';

export default async function handler(req, res) {
  const { url, phrase, sentence = '' } = req.body || {};
  if (!url || !phrase) {
    return res.status(400).json({ error: 'url & phrase required' });
  }

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
      max_tokens: 40,
      messages: [
        {
          role: 'system',
          content:
            `You write concise parenthetical footnotes (max 18 words) for a WordPress blog. \
Style: factual, third-person, no marketing adjectives, no imperatives, no words like link/page/article/click.`
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
    ?.replace(/^[(\s]+|[)\s]+$/g, '')        // 去掉开头/结尾括号
    ?.trim()
    ?.slice(0, 140)                          // 双保险：绝不超 18 词≈140 字符
    || 'relevant supporting source';

  return res.status(200).json({ reason });
}
