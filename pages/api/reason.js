import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url, phrase } = req.body;

  try {
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.4,
      messages: [
        { role: "system",
          content:
"You write short academic-style citation notes (≤18 words, third-person). \
Never use the words 'link', 'linked', 'linking', 'refer', 'click'." },

        /* few-shot 样例，无 'link' 用词 */
        { role: "user", content: 'Why cite WHO report for "global life expectancy"?' },
        { role: "assistant", content: "WHO report supplies peer-reviewed global life-expectancy statistics used by epidemiologists." },

        { role: "user", content: 'Why cite IEEE paper for "Li-ion battery degradation"?' },
        { role: "assistant", content: "IEEE study offers longitudinal data on Li-ion cycle degradation under varied thermal profiles." },

        { role: "user", content: 'Why cite NREL dataset for "solar panel efficiency"?' },
        { role: "assistant", content: "NREL dataset provides field-measured module efficiency curves validated against lab benchmarks." },

        /* 本次请求 */
        { role: "user",
          content:
`Write one note (≤18 English words) explaining how this source strengthens discussion of "${phrase}". \
Avoid the words: link, linked, linking, refer, click. \
Highlight data, authority, or practical guidance. Do not include the URL.

Source: ${url}` },
      ],
    });

    res.status(200).json({ reason: g.choices[0].message.content.trim() });
  } catch (e) {
    console.error("reason error", e);
    res.status(500).json({ error: e.message });
  }
}
