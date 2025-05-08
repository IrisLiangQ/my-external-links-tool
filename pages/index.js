/* pages/index.js — 外链优化工具 · 全量源码 2025-05-08
   - 多词短语高亮（黄色）
   - 点击弹窗 3 选 1，实时生成 EEAT 推荐理由
   - 复制 HTML 时已带 ((reason))，兼容 Footnotes Made Easy
---------------------------------------------------------------- */

import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ------------------------------ 组件 ------------------------------ */
export default function Home() {
  /* 状态 */
  const [raw, setRaw]         = useState("");
  const [data, setData]       = useState(null);      // /api/ai 结果
  const [html, setHtml]       = useState("");
  const [picked, setPicked]   = useState({});        // {kw:{url,reason}}
  const [activeKw, setActive] = useState(null);      // 当前弹窗关键词
  const [copied, setCopied]   = useState(false);
  const [loading, setLoading] = useState(false);

  const popRef = useRef(null);

  /* ---------------- 分析段落 → 拿关键词 ---------------- */
  async function analyze() {
    if (!raw.trim()) { alert("请先粘贴英文文章！"); return; }
    setLoading(true);

    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ text: raw }),
    });
    if (!r.ok) { alert("服务器分析失败，请稍后再试"); setLoading(false); return; }
    const j = await r.json();           // {keywords, original}
    setData(j);
    setPicked({});
    setCopied(false);

    /* 把关键词首现处包 <mark> */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<mark data-kw="${keyword}" class="cursor-pointer bg-yellow-200/60 px-1 rounded">${keyword}</mark>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ---------------- 点击 <mark> 打开弹窗 ---------------- */
  function handleEditorClick(e) {
    const m = e.target;
    if (m.tagName !== "MARK") return;
    const kw = m.dataset.kw;
    if (!kw || !data) return;

    /* 切换弹窗 */
    setActive(activeKw === kw ? null : kw);
    if (popRef.current) {
      const rect = m.getBoundingClientRect();
      popRef.current.style.top  = `${rect.bottom + window.scrollY + 8}px`;
      popRef.current.style.left = `${rect.left + window.scrollX}px`;
    }
  }

  /* ---------------- 选中某条链接 ---------------- */
  async function chooseLink(keyword, option) {
    if (picked[keyword]) return;              // 已选

    /* 叫 GPT 写一句理由 */
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ url: option.url, phrase: keyword }),
      });
      if (r.ok) { reason = (await r.json()).reason; }
    } catch (_) {/* 忽略 */}
    if (!reason) reason = "authoritative reference";

    /* 更新 picked */
    setPicked(prev => ({ ...prev, [keyword]: { ...option, reason } }));

    /* 替换 mark → anchor + ((reason)) */
    const reg = new RegExp(
      `<mark[^>]*data-kw="${keyword}"[^>]*>.*?<\\/mark>`,
      "i"
    );
    const anchor =
      `<a href="${option.url}" target="_blank" rel="noopener">${keyword}</a> ((${reason}))`;
    setHtml(prev => prev.replace(reg, anchor));

    setActive(null);
  }

  /* ---------------- 复制 HTML ---------------- */
  function copyHtml() {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* 标题 */}
      <header className="mb-8 text-left w-full max-w-5xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI驱动的文章外链优化工具</p>
      </header>

      {/* 主卡片 */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow p-8 space-y-6">
        {/* 输入阶段 */}
        {!data && (
          <>
            <textarea
              rows={10}
              className="w-full border rounded-md p-4"
              placeholder="粘贴英文文章（≤10,000 字）"
              value={raw}
              onChange={e => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded-md disabled:opacity-60"
            >
              {loading ? "分析中…" : "一键分析关键词"}
            </button>
          </>
        )}

        {/* 编辑阶段 */}
        {data && (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-3">
              点击关键词可选择是否添加外链
            </p>

            <div
              className="prose max-w-none border rounded-md p-4 md:px-6 focus:outline-none"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={handleEditorClick}
            />

            {/* 推荐理由 */}
            {Object.keys(picked).length > 0 && (
              <section className="pt-6">
                <h3 className="font-semibold">推荐理由</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {Object.entries(picked).map(([kw, { reason }], i) => (
                    <li key={i}>{reason}</li>
                  ))}
                </ol>
              </section>
            )}

            {/* 复制按钮 */}
            <div className="flex justify-end mt-8">
              <button
                onClick={copyHtml}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-md"
              >
                <FiCopy />
                {copied ? "已复制！" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 链接弹窗 */}
      {activeKw && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white rounded-xl shadow-lg border overflow-hidden"
        >
          {data.keywords
            .find(k => k.keyword === activeKw)
            ?.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => chooseLink(activeKw, opt)}
                className="flex flex-col items-start w-full p-4 text-left gap-1
                           hover:bg-gray-50 transition border-b last:border-0"
              >
                <p className="font-medium line-clamp-1 leading-snug">{opt.title || opt.url}</p>
                <p className="text-xs text-gray-600 line-clamp-1 leading-snug">{opt.url}</p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
