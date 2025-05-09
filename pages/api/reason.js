import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { url, phrase } = req.body;

  try {
    const g = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      temperature: 0.4,            // 略收敛，以保持学术语气
      messages: [
        { role: "system", content: "You produce concise, academic-style citation notes (≤20 words, third-person)." },

        /* ----- Few-shot 范例：学术引注语气 ----- */
        { role: "user", content: 'Why cite WHO report for "global life expectancy"?' },
        { role: "assistant", content: "WHO provides peer-reviewed global life-expectancy statistics used by public-health researchers." },

        { role: "user", content: 'Why cite IEEE paper for "Li-ion battery degradation"?' },
        { role: "assistant", content: "IEEE study offers longitudinal data on Li-ion cycle degradation under varied temperature profiles." },

        { role: "user", content: 'Why cite NREL dataset for "solar panel efficiency"?' },
        { role: "assistant", content: "NREL dataset supplies field-measured module efficiency curves validated against laboratory benchmarks." },

        /* ----- 本次请求 ----- */
        {
          role: "user",
          content:
`Now craft one note (≤20 words) explaining why linking to the source below strengthens discussion of "${phrase}".
Avoid filler adjectives; emphasize data, authority, or practical guidance.
Do not mention the URL.

Source: ${url}`
        },
      ],
    });

    res.status(200).json({ reason: g.choices[0].message.content.trim() });
  } catch (e) {
    console.error("reason API error", e);
    res.status(500).json({ error: e.message });
  }
}
