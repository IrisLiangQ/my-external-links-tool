import { useState, useMemo } from 'react';
import axios from 'axios';

export default function ExternalLinksTool() {
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [links, setLinks] = useState({});
  const [chosen, setChosen] = useState({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const highlightedHTML = useMemo(() => {
    if (keywords.length === 0) return '';
    let html = text;
    keywords.forEach(({ keyword }) => {
      const reg = new RegExp(keyword, 'gi');
      html = html.replace(reg, `<mark class="bg-orange-300">${keyword}</mark>`);
    });
    return html.replace(/\n/g, '<br/>');
  }, [text, keywords]);

  const markdownOutput = useMemo(() => {
    if (step !== 3) return '';
    let md = text;
    Object.entries(chosen).forEach(([kw, link]) => {
      const reg = new RegExp(kw, 'i');
      md = md.replace(reg, `[${kw}](${link})`);
    });
    return md;
  }, [step, text, chosen]);

  async function analyze() {
    if (!text.trim()) return;
    setLoading(true);
    setMessage('');
    try {
      const res = await axios.post('/api/ai', { text });
      setKeywords(res.data.keywords || []);
      setSelected(new Set());
      setStep(2);
    } catch (e) {
      setMessage(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  function toggleKeyword(kw) {
    const next = new Set(selected);
    if (next.has(kw)) next.delete(kw);
    else next.add(kw);
    setSelected(next);
  }

  async function confirmKeywords() {
    if (selected.size === 0) {
      setMessage('请至少选择一个关键词');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const tasks = Array.from(selected).map(async (kw) => {
        const { data } = await axios.post('/api/search', { query: keywords.find(k => k.keyword === kw).query });
        return [kw, data.results || []];
      });
      const results = Object.fromEntries(await Promise.all(tasks));
      setLinks(results);
      const defaultChosen = Object.fromEntries(Object.entries(results).map(([k, arr]) => [k, arr[0]?.link || '']));
      setChosen(defaultChosen);
      setStep(3);
    } catch (e) {
      setMessage(e.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }

  function handleLinkChange(kw, link) {
    setChosen({ ...chosen, [kw]: link });
  }

  function copyMarkdown() {
    navigator.clipboard.writeText(markdownOutput);
    alert('已复制到剪贴板');
  }

  function renderStep1() {
    return (
      <>
        <textarea
          className="w-full border p-2 mb-2"
          rows={8}
          placeholder="粘贴英文文章"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? '分析中…' : '分析关键词'}
        </button>
      </>
    );
  }

  function renderStep2() {
    return (
      <>
        <div
          className="border p-3 mb-3 whitespace-pre-wrap"
          dangerouslySetInnerHTML={{ __html: highlightedHTML }}
        />
        <ul className="mb-4">
          {keywords.map(({ keyword, reason }) => (
            <li key={keyword} className="mb-1">
              <label>
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selected.has(keyword)}
                  onChange={() => toggleKeyword(keyword)}
                />
                <b>{keyword}</b>
              </label>
              <span className="text-sm text-gray-600 ml-2">{reason}</span>
            </li>
          ))}
        </ul>
        <button
          className="bg-green-600 text-white px-4 py-2 rounded disabled:opacity-50"
          onClick={confirmKeywords}
          disabled={loading}
        >
          {loading ? '处理中…' : '确认选择并生成外链'}
        </button>
      </>
    );
  }

  function renderStep3() {
    return (
      <>
        <div className="space-y-4 mb-6">
          {Object.entries(links).map(([kw, list]) => (
            <div key={kw} className="border p-3 rounded">
              <p className="font-semibold mb-1">{kw}</p>
              {list.length === 0 ? (
                <p className="text-sm text-red-600">未找到外链</p>
              ) : (
                <select
                  className="border px-2 py-1"
                  value={chosen[kw] || ''}
                  onChange={(e) => handleLinkChange(kw, e.target.value)}
                >
                  {list.map((item) => (
                    <option key={item.link} value={item.link}>
                      {item.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
        <textarea
          readOnly
          className="w-full border p-3 mb-3 h-48"
          value={markdownOutput}
        />
        <button
          className="bg-purple-600 text-white px-4 py-2 rounded"
          onClick={copyMarkdown}
        >
          复制 Markdown
        </button>
      </>
    );
  }

  return (
    <main className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">AI 外链优化工具</h1>
      {message && <p className="text-red-600 mb-3">{message}</p>}
      {step === 1 && renderStep1()}
      {step === 2 && renderStep2()}
      {step === 3 && renderStep3()}
    </main>
  );
}
