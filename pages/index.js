/* pages/index.js – 卡片式 UI V1.1 --------------------------------------- */

import { useState } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";

export default function Home() {
  /* ----------------------- 状态 ----------------------- */
  const [input,  setInput]  = useState("");
  const [data,   setData]   = useState(null);   // /api/ai 返回
  const [picked, setPicked] = useState({});     // 已选 {kw:{url,reason}}
  const [html,   setHtml]   = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  /* ----------------------- 调用分析 ----------------------- */
  async function handleAnalyze() {
    if (!input.trim()) return alert("请先粘贴英文文章！");
    setLoading(true); setCopied(false);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });

    if (!res.ok) { alert("服务器分析失败，请稍后再试"); setLoading(false); return; }

    const result = await res.json();          // {keywords, original}
    setData(result); setPicked({}); setHtml(""); setLoading(false);
  }

  /* ----------------------- 选择链接 ----------------------- */
  function chooseLink(keyword, option) {
    if (picked[keyword]) return;

    setPicked(prev => ({ ...prev, [keyword]: option }));
    const anchor = `<a href="${option.url}" target="_blank" rel="noopener">${keyword}</a>`;
    const regex  = new RegExp(keyword, "i");
    setHtml(prev => (prev || data.original).replace(regex, anchor));
  }

  /* ----------------------- 复制 HTML ----------------------- */
  function copyHtml() {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ----------------------- 渲染 ----------------------- */
  return (
    <main className="flex flex-col items-center p-6 space-y-8">
      <h1 className="text-3xl font-bold">YQ INSIGHT 外链优化工具</h1>

      {/* 输入框 + 按钮 */}
      <textarea
        rows={10}
        className="w-full max-w-4xl p-4 border rounded-md"
        placeholder="粘贴英文文章（≤10,000 字）"
        value={input}
        onChange={e => setInput(e.target.value)}
      />
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="px-8 py-2 bg-blue-600 text-white rounded-md disabled:opacity-60"
      >
        {loading ? "分析中…" : "一键分析关键词"}
      </button>

      {/* 关键词卡片区 */}
      {data?.keywords && (
        <div className="w-full max-w-6xl space-y-10">
          {data.keywords.map(({ keyword, options }) => (
            <section key={keyword} className="space-y-4">
              <h2 className="font-semibold text-lg">
                ❯ {keyword}
                {picked[keyword] && <FiCheck className="inline text-green-600 ml-1" />}
              </h2>

              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {options.map((opt, idx) => {
                  const active = picked[keyword]?.url === opt.url;
                  return (
                    <button
                      key={idx}
                      onClick={() => chooseLink(keyword, opt)}
                      className={`flex flex-col items-start p-4 rounded-xl border 
                        shadow-sm hover:shadow-md transition text-left
                        ${active ? "ring-2 ring-blue-500 bg-blue-50" : ""}`}
                    >
                      <span className="text-sm break-all line-clamp-2">{opt.url}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* 生成 HTML & 复制浮层 */}
      {Object.keys(picked).length > 0 && (
        <>
          <pre
            className="relative w-full max-w-6xl bg-gray-100 p-4 rounded-md overflow-x-auto"
          >
            {html}
          </pre>

          <button
            onClick={copyHtml}
            className="fixed bottom-8 right-8 flex items-center gap-2 px-5 py-3
                       rounded-full shadow-lg bg-green-600 text-white"
          >
            <FiCopy /> {copied ? "已复制！" : "复制 HTML"}
          </button>
        </>
      )}
    </main>
  );
}
