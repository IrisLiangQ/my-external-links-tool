import { useState } from 'react';
import { FiCopy } from 'react-icons/fi';

export default function Home() {
  const [input, setInput] = useState('');
  const [html, setHtml]  = useState('');
  const [loading, setLoading] = useState(false);

  async function handleAnalyze() {
    if (!input.trim()) return;
    setLoading(true);
    const res = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: input }),
    });
    const data = await res.json();
    setLoading(false);
    setHtml(data.html);
  }

  return (
    <main className="flex items-start justify-center p-6">
      <div className="w-full max-w-3xl space-y-6">
        <h1 className="text-3xl font-bold text-center">YQ INSIGHT 外链优化工具</h1>

        <textarea
          rows={12}
          placeholder="粘贴最多 10,000 字英文文章"
          className="w-full p-4 border rounded-md"
          value={input}
          onChange={e => setInput(e.target.value)}
        />

        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md w-full"
        >
          {loading ? '分析中…' : '一键分析关键词'}
        </button>

        {html && (
          <div className="space-y-2">
            <h2 className="text-xl font-semibold">生成的 HTML（点击复制）</h2>
            <pre
              className="relative bg-gray-100 p-4 rounded-md overflow-x-auto"
              onClick={() => navigator.clipboard.writeText(html)}
            >
              <FiCopy className="absolute top-2 right-2 cursor-pointer" />
              {html}
            </pre>
          </div>
        )}
      </div>
    </main>
  );
}
