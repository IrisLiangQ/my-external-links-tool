
import { useState } from 'react';
import axios from 'axios';
import { FaWandMagicSparkles } from 'react-icons/fa6';

export default function Home() {
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [selectedLinks, setSelectedLinks] = useState({});
  const [recommendations, setRecommendations] = useState({});
  const [resultHTML, setResultHTML] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    if (!text.trim()) return;
    setLoading(true);
    const res = await axios.post('/api/ai', { text });
    setKeywords(res.data.keywords || []);
    setStep(2);
    setLoading(false);
  };

  const handleGetLinks = async (keyword) => {
    if (selectedLinks[keyword]) return;
    const res = await axios.post('/api/search', { keyword });
    const links = res.data.links;
    setSelectedLinks((prev) => ({ ...prev, [keyword]: links[0]?.link }));
  };

  const generateRecommendations = async () => {
    const result = {};
    for (const keyword of keywords) {
      const link = selectedLinks[keyword.keyword];
      if (!link) continue;
      const gptRes = await axios.post('/api/ai', {
        text: `Why would linking to this page (${link}) enhance the authority and trustworthiness of an article about ${keyword.keyword}? Give 1 short paragraph in plain English.`
      });
      const idea = gptRes.data.keywords?.[0]?.reason || 'This link adds credibility by providing expert insights.';
      result[keyword.keyword] = idea;
    }
    return result;
  };

  const handleOptimize = async () => {
    let html = text;
    let finalHTML = '';
    const used = {};

    for (const keyword of keywords) {
      const link = selectedLinks[keyword.keyword];
      if (link && !used[keyword.keyword]) {
        const reg = new RegExp(`\b${keyword.keyword}\b`, 'i');
        html = html.replace(reg, `<a href="${link}" target="_blank" rel="nofollow">${keyword.keyword}</a>`);
        used[keyword.keyword] = true;
      }
    }

    const recs = await generateRecommendations();
    setRecommendations(recs);

    finalHTML += `<div>${html}</div>`;
    finalHTML += '<div style="margin-top:2em;"><strong>Recommended Reasons (for Google EEAT):</strong><ul>';
    Object.entries(recs).forEach(([kw, val]) => {
      finalHTML += `<li><strong>${kw}</strong>: ${val}</li>`;
    });
    finalHTML += '</ul></div>';

    setResultHTML(finalHTML);
    setStep(3);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col items-center justify-start py-12 px-4">
      <div className="text-center mb-10">
        <div className="flex justify-center items-center gap-2 text-3xl font-bold">
          <FaWandMagicSparkles className="text-indigo-600" />
          <span>外链优化</span>
        </div>
        <p className="text-sm text-gray-500 mt-2">AI驱动的文章外链优化工具</p>
      </div>

      <div className="w-full max-w-3xl bg-white rounded-2xl shadow p-6">
        <h2 className="text-lg font-semibold mb-2">文本编辑器</h2>
        <p className="text-sm text-gray-500 mb-4">请输入要分析的英文文本</p>

        {step === 1 && (
          <>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-64 p-4 bg-gray-50 border border-gray-300 rounded-md resize-none"
              placeholder="请输入要分析的英文文章..."
              maxLength={10000}
            />
            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="mt-4 px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              {loading ? '分析中...' : '分析关键词'}
            </button>
          </>
        )}

        {step === 2 && (
          <>
            <ul className="space-y-4">
              {keywords.map((kw) => (
                <li key={kw.keyword} className="border p-3 rounded-md bg-gray-50">
                  <div className="font-bold text-gray-800">{kw.keyword}</div>
                  <p className="text-sm text-gray-500 mb-2">{kw.reason}</p>
                  <button
                    onClick={() => handleGetLinks(kw.keyword)}
                    className="px-3 py-1 text-sm bg-emerald-600 text-white rounded hover:bg-emerald-700"
                  >
                    获取外链
                  </button>
                  {selectedLinks[kw.keyword] && (
                    <p className="text-sm mt-1 text-blue-600">{selectedLinks[kw.keyword]}</p>
                  )}
                </li>
              ))}
            </ul>
            <button
              onClick={handleOptimize}
              className="mt-6 px-6 py-2 bg-black text-white rounded hover:bg-gray-800 flex items-center gap-2"
            >
              <FaWandMagicSparkles /> 一键优化并生成 HTML
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <div
              className="mt-4 whitespace-pre-wrap leading-relaxed text-sm bg-gray-100 p-4 rounded"
              dangerouslySetInnerHTML={{ __html: resultHTML }}
            />
            <button
              onClick={() => navigator.clipboard.writeText(resultHTML)}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
            >
              复制 HTML（含推荐理由）
            </button>
          </>
        )}
      </div>
    </div>
  );
}
