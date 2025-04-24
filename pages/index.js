import { useState } from 'react';

export default function Home() {
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingSearch, setLoadingSearch] = useState(false);

  async function handleAnalyze() {
    if (!text.trim()) return;
    setLoading(true);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (data.keywords) setKeywords(data.keywords);
    setLoading(false);
  }

  async function handleSearch(query) {
    setLoadingSearch(true);
    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    if (data.results) setResults(data.results);
    setLoadingSearch(false);
  }

  function handleCopy(link, kw) {
    const md = text.replace(kw, `[${kw}](${link})`);
    navigator.clipboard.writeText(md);
    alert('已复制带链接的文本');
  }

  return (
    <main className="max-w-xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">AI 外链工具</h1>
      <textarea
        className="w-full border p-2 mb-2"
        rows={6}
        placeholder="粘贴英文文章"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <button
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
        disabled={loading}
        onClick={handleAnalyze}
      >
        {loading ? '分析中…' : '分析关键词'}
      </button>

      {keywords.length > 0 && (
        <div className="mt-4">
          <h2 className="font-semibold">关键词</h2>
          <ul className="list-disc ml-5">
            {keywords.map((k) => (
              <li key={k.keyword} className="mb-2">
                <b>{k.keyword}</b> – {k.reason}
                <button
                  className="ml-3 bg-green-600 text-white px-2 py-1 rounded"
                  onClick={() => handleSearch(k.query)}
                >
                  搜索外链
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadingSearch && <p className="mt-4">搜索中…</p>}

      {results.length > 0 && (
        <div className="mt-4 border-t pt-3">
          <h2 className="font-semibold">搜索结果</h2>
          <ul className="list-decimal ml-5">
            {results.map((r) => (
              <li key={r.link} className="mb-2">
                <a href={r.link} target="_blank" rel="noreferrer" className="underline">
                  {r.title}
                </a>
                <button
                  className="ml-2 bg-purple-600 text-white px-2 py-1 rounded"
                  onClick={() => handleCopy(r.link, keywords[0].keyword)}
                >
                  复制 Markdown
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
