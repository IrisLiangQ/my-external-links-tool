import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'no query' });

  const apiKey = process.env.SERPER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Missing SERPER_API_KEY' });

  try {
    const resp = await axios.post(
      'https://google.serper.dev/search',
      { q: query, gl: 'us', hl: 'en' },
      { headers: { 'X-API-KEY': apiKey } }
    );
    const top = (resp.data.organic || []).slice(0, 3).map((r) => ({
      title: r.title,
      link: r.link,
    }));
    res.status(200).json({ results: top });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
