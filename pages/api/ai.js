import { Configuration, OpenAIApi } from 'openai';
import axios from 'axios';

const config = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(config);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { text } = req.body;

  /* 1️⃣ 从 GPT 获取关键词（示例：最多 20 个） */
  const gptResp = await openai.createChatCompletion({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: 'You are an SEO assistant.' },
      { role: 'user', content: `Extract up to 20 important keywords from the following English article:\n\n${text}` }
    ]
  });
  const keywords = JSON.parse(gptResp.data.choices[0].message.content);

  /* 2️⃣ 对每个关键词用 Serper 搜索前 3 条权威链接 */
  const results = {};
  for (const kw of keywords) {
    const { data } = await axios.get('https://google.serper.dev/search', {
      headers: { 'X-API-KEY': process.env.SERPER_API_KEY },
      data: { q: kw, num: 3 }
    });
    results[kw] = data.organic.map(item => item.link).slice(0, 3);
  }

  /* 3️⃣ 拼装 HTML，GPT 生成 EEAT 推荐理由 */
  let html = text;
  for (const kw of keywords) {
    const linksList = results[kw]
      .map(url => `<li><a href="${url}" target="_blank" rel="noopener">${url}</a></li>`)
      .join('');
    const chooseBlock = `<ul>${linksList}</ul>`;

    /* 👇 用最第 1 条链接生成简短理由 */
    const reasonResp = await openai.createChatCompletion({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are an SEO assistant.' },
        { role: 'user', content: `Write a two-sentence EEAT-style reason why linking to ${results[kw][0]} adds authority.` }
      ]
    });
    const reason = reasonResp.data.choices[0].message.content.trim();

    /* 替换正文中的关键词（仅首次出现） */
    const linkHtml = `<a href="${results[kw][0]}" target="_blank" rel="noopener">${kw}</a> ${chooseBlock} ((${reason}))`;
    html = html.replace(kw, linkHtml);
  }

  res.status(200).json({ html });
}
