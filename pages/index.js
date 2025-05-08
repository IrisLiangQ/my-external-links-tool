/* pages/index.js -----------------------------------------------------------
   YQ INSIGHT 外链优化工具 – 前端界面 & 交互逻辑
--------------------------------------------------------------------------- */

import { useState } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  /* ---------------------- React 状态 ---------------------- */
  const [input,  setInput]  = useState("");   // 用户输入
  const [data,   setData]   = useState(null); // /api/ai 返回
  const [picked, setPicked] = useState({});   // 已选链接
  const [html,   setHtml]   = useState("");   // 生成 HTML
  const [loading, setLoading] = useState(false);

  /* ---------------------- 一键分析 ---------------------- */
  async function handleAnalyze() {
    if (!input.trim()) {
      alert("请先粘贴英文文章！");
      return;
    }
    setLoading(true);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });

    if (!res.ok) {
      alert("服务器分析失败，请稍后重试");
      setLoading(false);
      return;
    }

    const result = await res.json();      // {keywords, original}
    setData(result);
    setPicked({});
    setHtml("");
    setLoading(false);
  }

  /* ---------------------- 选择链接 ---------------------- */
  async function chooseLink(keyword, option) {
    if (picked[keyword]) return;          // 已选过

    // 如需推荐理由，可在此调用 /api/reason
    const reason = "";                    // 先留空

    setPicked(prev => ({ ...prev, [keyword]: { ...option, reason } }));

    const anchor = `<a href="${option.url}" target="_blank" rel="noopener">${keyword}</a>` +
                   (reason ? ` ((${reason}))` : "");
    const regex  = new RegExp(keyword, "i");

    setHtml(prev => {
      const base = prev || data.original;
      return base.replace(regex, anchor);
    });
  }

  /* ---------------------- 复制 HTML ---------------------- */
  function copyHtml() {
    if (!html) return;
    navigator.clipboard.writeText(html);
    alert("已复制到剪贴板！");
  }

  /* ---------------------- 渲染 ---------------------- */
  return (
    <main className="flex flex-col items-center p-6 space-y-6">
      <h1 className="text-3xl font-bold">YQ INSIGHT 外链优化工具</h1>

      {/* 原文输入框 */}
      <textarea
        rows={10}
        className="w-full max-w-3xl p-4 border rounded-md"
        placeholder="粘贴英文文章（≤10,000 字）"
        value={input}
        onChange={e => setInput(e.target.value)}
      />

      {/* 分析按钮 */}
      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-md disabled:opacity-60"
      >
        {loading ? "分析中…" : "一键分析关键词"}
      </button>

      {/* 关键词 → 链接卡片 */}
      {data?.keywords && (
        <div className="w-full max-w-3xl space-y-6">
          {data.keywords.map(({ keyword, options }) => (
            <div key={keyword}>
              <p className="font-semibold mb-2">
                {keyword}
                {picked[keyword] && (
                  <span className="text-green-600 ml-2">✔ 已选</span>
                )}
              </p>

              <div className="grid sm:grid-cols-3 gap-4">
                {options.map((opt, idx) => (
                  <button
                    key={idx}
                    onClick={() => chooseLink(keyword, opt)}
                    className={`p-3 text-left border rounded-lg hover:shadow transition ${
                      picked[keyword]?.url === opt.url
                        ? "border-blue-600 ring-2 ring-blue-300"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-medium break-all">{opt.url}</p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 生成的 HTML */}
      {Object.keys(picked).length > 0 && (
        <div className="w-full max-w-3xl space-y-2">
          <h2 className="text-xl font-semibold">生成的 HTML（点击复制）</h2>
          <pre
            className="relative bg-gray-100 p-4 rounded-md overflow-x-auto cursor-pointer"
            onClick={copyHtml}
            title="点击复制到剪贴板"
          >
            <FiCopy className="absolute top-2 right-2" />
            {html}
          </pre>
        </div>
      )}
    </main>
  );   // ←←← 文件倒数第 2 行
}       // ←←← 文件最后一行
