import OpenAI from "openai";
import axios from "axios";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { text } = req.body;

  try {
    /* 1️⃣ 让 GPT 只返回纯 JSON 数组，方便 JSON.parse */
    const gptKw = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",            // 用通用可用型号即可
      messages: [
        { role: "system", content: "You are an SEO assistant." },
        {
          role: "user",
          content:
            `Extract up to 20 important English keywords from the following article. Reply ONLY with a valid JSON array, e.g. ["EV charger","Level 2 charger"].\n\n${text}`,
        },
      ],
    });

    const keywords = JSON.parse(gptKw.choices[0].message.content);

    /* 2️⃣ 正确调用 Serper：必须用 POST，并发送 JSON */
    const results = {};
    for (const kw of keywords) {
      const { data } = await axios.post(
        "https://google.serper.dev/search",
        { q: kw, num: 3 },
        { headers: { "X-API-KEY": process.env.SERPER_API_KEY } }
      );
      results[kw] = data.organic.slice(0, 3).map((i) => i.link);
    }

    /* 3️⃣ 组装 HTML：关键词首现处 → 默认第 1 条链接 + 3 选 1 列表 + 推荐理由 */
    let html = text;
    for (const kw of keywords) {
      const chooseBlock = `<ul>${results[kw]
        .map(
          (url) =>
            `<li><a href="${url}" target="_blank" rel="noopener">${url}</a></li>`
        )
        .join("")}</ul>`;

      const gptReason = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are an SEO assistant." },
          {
            role: "user",
            content: `In ONE short sentence, explain why linking to ${results[kw][0]} demonstrates EEAT authority.`,
          },
        ],
      });
      const reason = gptReason.choices[0].message.content.trim();

      const linkHtml = `<a href="${results[kw][0]}" target="_blank" rel="noopener">${kw}</a> ${chooseBlock} ((${reason}))`;

      /* 只替换第一次出现，避免全部替换 */
      html = html.replace(new RegExp(kw, "i"), linkHtml);
    }

    return res.status(200).json({ html });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ error: "Server error. Check function logs for details." });
  }
}
