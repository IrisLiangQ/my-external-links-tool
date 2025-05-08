/* pages/index.js — UI Pro 版 2025-05-08 ---------------------------------- */
import { useState, useRef, useEffect } from "react";
import { FiExternalLink, FiCheck, FiCopy } from "react-icons/fi";

export default function Home() {
  /* -------------------------- 状态 -------------------------- */
  const [raw, setRaw] = useState("");                 // 用户输入原文
  const [data, setData] = useState(null);             // /api/ai 返回的数据
  const [picked, setPicked] = useState({});           // { keyword: { url, reason } }
  const [activeKw, setActiveKw] = useState(null);     // 当前打开 popover 的关键词
  const [html, setHtml] = useState("");               // 生成 HTML
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  /* reference 用来定位弹出层位置 */
  const editorRef = useRef(null);
  const popRef    = useRef(null);

  /* -------------------------- 调后端分析 -------------------------- */
  async function analyze() {
    if (!raw.trim()) { alert("请先粘贴英文文章！"); return; }
    setLoading(true); setData(null); setPicked({}); setHtml("");

    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    if (!r.ok) { alert("服务器分析失败，请稍后再试"); setLoading(false); return; }
    const j = await r.json();            // {keywords:[{keyword,options:[{url}]}],original}
    setData(j);                          // 保存数据

    // ① 先把正文中的关键词 wrap 成 <mark>
    let bodyHtml = j.original;
    j.keywords.forEach(({ keyword }) => {
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      bodyHtml = bodyHtml.replace(
        reg,
        `<mark data-kw="${keyword}" class="cursor-pointer bg-green-200/60 px-1 rounded">${keyword}</mark>`
      );
    });
    setHtml(bodyHtml);
    setLoading(false);
  }

  /* -------------------------- 监听 mark 点击 -------------------------- */
  function onEditorClick(e) {
    const m = e.target;
    if (m.tagName !== "MARK") return;
    const kw = m.dataset.kw;
    if (!data) return;
    setActiveKw(kw === activeKw ? null : kw);   // 切换弹窗
    // 记录鼠标位置给 popover
    if (kw && popRef.current) {
      const rect = m.getBoundingClientRect();
      popRef.current.style.top  = `${rect.bottom + window.scrollY + 8}px`;
      popRef.current.style.left = `${rect.left + window.scrollX}px`;
    }
  }

  /* -------------------------- 选择某条链接 -------------------------- */
  async function chooseLink(kw, opt) {
    // ② 询问 GPT 1 句话 reason（可根据需要取消）
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url }),
      });
      if (r.ok) { const j = await r.json(); reason = j.reason; }
    } catch (_) { /* 忽略 */ }

    // ③ 替换 mark -> anchor + reason
    const reg = new RegExp(
      `<mark[^>]*data-kw="${kw}"[^>]*>(.*?)<\\/mark>`, "i"
    );
    const anchor = `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a> ((${reason || "source"}))`;
    setHtml(prev => prev.replace(reg, anchor));

    // ④ 更新 state
    setPicked(p => ({ ...p, [kw]: { ...opt, reason } }));
    setActiveKw(null);
  }

  /* -------------------------- 复制 HTML -------------------------- */
  function copyHtml() {
    navigator.clipboard.writeText(html);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  /* -------------------------- 渲染 -------------------------- */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* 顶部标题 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <span>⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI驱动的文章外链优化工具</p>
      </div>

      {/* 卡片容器 */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow p-8 space-y-6">
        {/* 输入框 / 分析按钮 */}
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

        {/* 文本编辑器 + 推荐理由 */}
        {data && (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-3">
              点击关键词可以选择是否添加外链
            </p>

            {/* 可编辑正文 */}
            <div
              ref={editorRef}
              className="prose max-w-none border rounded-md p-4 focus:outline-none"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onEditorClick}
            />

            {/* 推荐理由列表 */}
            {Object.keys(picked).length > 0 && (
              <section className="pt-6">
                <h3 className="font-semibold">推荐理由</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {Object.entries(picked).map(([kw, { reason }], idx) => (
                    <li key={idx}>
                      {reason || `Link inserted for "${kw}"`}
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* 右下角按钮 */}
            <div className="flex justify-end mt-8">
              <button
                onClick={copyHtml}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded-md"
              >
                <FiCopy /> {copied ? "已复制！" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ---------- 弹出层：候选链接 ---------- */}
      {activeKw && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white border rounded-xl shadow-lg overflow-hidden"
        >
          {data.keywords
            .find(k => k.keyword === activeKw)
            ?.options.map((opt, i) => {
              const active = picked[activeKw]?.url === opt.url;
              return (
                <button
                  key={i}
                  onClick={() => chooseLink(activeKw, opt)}
                  className={`flex flex-col items-start p-4 w-full text-left
                    hover:bg-gray-50 transition border-b last:border-0
                    ${active ? "bg-blue-50" : ""}`}
                >
                  <p className="font-medium line-clamp-1">
                    {opt.title || opt.url}
                  </p>
                  <p className="text-xs text-gray-600 line-clamp-1">
                    {opt.url}
                  </p>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
