import { useState } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  const [input, setInput] = useState("");
  const [data, setData]   = useState(null);   // GPT+Serper 返回
  const [picked, setPicked] = useState({});   // 记录已选择的链接
  const [html, setHtml]   = useState("");
  const [loading, setLoading] = useState(false);

  /* 触发分析 */
  async function handleAnalyze() {
    if (!input.trim()) return;
    setLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: input }),
    });
    const result = await res.json();
    setData(result);
    setPicked({});   // 重置已选
    setHtml("");     // 清空旧 HTML
    setLoading(false);
  }

  /* 用户点选某条链接后立即替换正文 */
  function chooseLink(kw, option) {
    // 1. 标记选中
    setPicked((p) => ({ ...p, [kw]: option }));

    // 2. 只替换首现
    const anchor = `<a href="${option.url}" target="_blank" rel="noopener">${kw}</a> ((${option.reason}))`;
    const regex  = new RegExp(kw, "i");
    setHtml((prev) => {
      const base = prev || data.original;
      return base.replace(regex, anchor);
    });
  }

  /* 复制剪贴板 */
  function copyHtml() {
    navigator.clipboard.writeText(html);
    alert("已复制到剪贴板！");
  }

  return (
    <main className="flex flex-col items-center p-6 space-y-6">
      <h1 className="text-3xl font-bold">YQ INSIGHT 外链优化工具</h1>

      <textarea
        rows={10}
        className="w-full max-w-3xl p-4 border rounded-md"
        placeholder="粘贴英文文章（≤10,000 字）"
        value={input}
        onChange={(e) => setInput(e.target.value)}
      />

      <button
        onClick={handleAnalyze}
        disabled={loading}
        className="px-6 py-2 bg-blue-600 text-white rounded-md"
      >
        {loading ? "分析中…" : "一键分析关键词"}
      </button>

      {/* ---------- 关键词候选卡片 ---------- */}
      {data && (
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
                    className={`p-3 text-left border rounded-lg hover:shadow ${
                      picked[keyword]?.url === opt.url
                        ? "border-blue-600 ring-2 ring-blue-300"
                        : ""
                    }`}
                  >
                    <p className="text-sm font-medium truncate">{opt.url}</p>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {opt.reason}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ---------- 生成的 HTML ---------- */}
      {Object.keys(picked).length > 0 && (
        <div className="w-full max-w-3xl space-y-2">
          <h2 className="text-xl font-semibold">生成的 HTML（点击复制）</h2>
          <pre
            className="relative bg-gray-100 p-4 rounded-md overflow-x-auto cursor-pointer"
            onClick={copyHtml}
          >
            <FiCopy className="absolute top-2 right-2" />
            {html}
          </pre>
        </div>
      )}
    </main>
  );
}
