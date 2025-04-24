import { Configuration, OpenAIApi } from 'openai';

const openai = new OpenAIApi(new Configuration({ apiKey: process.env.OPENAI_API_KEY }));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'no text' });

  const prompt = `
You are an SEO expert. Extract 1-3 important English keywords from the text.
Return pure JSON: [{"keyword":"...","query":"...","reason":"..."}]
Text:
${text}
`;

  try {
    const resp = await openai.createChatCompletion({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
    });
    const data = JSON.parse(resp.data.choices[0].message.content);
    res.status(200).json({ keywords: data });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
