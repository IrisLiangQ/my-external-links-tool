/* pages/index.js — 外链优化工具 · 2025-05-09
   功能：
   1. 自动识别段落主题 topic 并展示
   2. GPT 抽取与主题强相关的多词短语（由 /api/ai 返回）
   3. 点击短语弹窗 3 选 1，实时向 /api/reason 生成 EEAT 推荐理由
   4. 插入 <a> 后紧跟 ((reason))，兼容 Footnotes Made Easy
   5. 复制按钮一键获取完整 HTML
----------------------------------------------------------------- */

import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  /* ------------------- React 状态 ------------------- */
  const [raw,    setRaw]    = useState("");   // 文本框原文
  const [data,   setData]   = useState(null); // /api/ai 返回 {topic, keywords, original}
  const [html,   setHtml]   = useState("");   // 编辑器 HTML
  const [topic,  setTopic]  = useState("");   // 段落主题
  const [picked, setPicked] = useState({});   // 已选 {kw:{url,reason}}
  const [active, setActive] = useState(null); // 当前弹窗关键词
  const [loading,setLoading]= useState(false);
  const [copied, setCopied] = useState(false);

  const popRef = useRef(null);

  /* ------------------- 调用 /api/ai ------------------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文文章！");
    setLoading(true);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ text: raw }),
    });
    if (!res.ok) { alert("分析失败，请稍后重试"); setLoading(false); return; }

    const j = await res.json();                       // {topic, keywords, original}
    setData(j);
    setTopic(j.topic);
    setPicked({});
    setCopied(false);

    /* 高亮关键词 */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<mark data-kw="${keyword}"
               class="cursor-pointer bg-yellow-200/60 px-1 rounded">${keyword}</mark>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ------------------- 点击 mark 打开弹窗 ------------------- */
  function handleEditorClick(e) {
    const el = e.target;
    if (el.tagName !== "MARK") return;
    const kw = el.dataset.kw;
    if (!kw || !data) return;

    setActive(active === kw ? null : kw);
    if (popRef.current) {
      const rect = el.getBoundingClientRect();
      popRef.current.style.top  = `${rect.bottom + window.scrollY + 8}px`;
      popRef.current.style.left = `${rect.left  + window.scrollX}px`;
    }
  }

  /* ------------------- 选择链接 ➜ fetch /api/reason ------------------- */
  async function chooseLink(keyword, option) {
    if (picked[keyword]) return;

    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ url: option.url, phrase: keyword }),
      });
      if (r.ok) reason = (await r.json()).reason;
      else {
        const err = await r.json();
        console.error("reason API error:", err);
      }
    } catch (e) { console.error(e); }
    if (!reason) reason = "authoritative reference";

    /* 更新状态 + 替换文本 */
    setPicked(prev => ({ ...prev, [keyword]: { ...option, reason } }));

    const reg = new RegExp(
      `<mark[^>]*data-kw="${keyword}"[^>]*>.*?<\\/mark>`,
      "i"
    );
    const anchor =
      `<a href="${option.url}" target="_blank" rel="noopener">${keyword}</a> ((${reason}))`;
    setHtml(prev => prev.replace(reg, anchor));

    setActive(null);
  }

  /* ------------------- 复制 HTML ------------------- */
  function copyHtml() {
    navigator.clipboard.writeText(html);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ------------------- 渲染 ------------------- */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      {/* 顶部标题 */}
      <header className="mb-8 w-full max-w-5xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI驱动的文章外链优化工具</p>
      </header>

      {/* 主卡片 */}
      <div className="w-full max-w-5xl bg-white rounded-2xl shadow p-8 space-y-6">

        {/* ------ 输入阶段 ------ */}
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

        {/* ------ 编辑阶段 ------ */}
        {data && (
          <>
            {/* 主题展示 */}
            {topic && (
              <p className="text-sm text-gray-600">
                识别到的主题：<span className="font-medium">{topic}</span>
              </p>
            )}

            <h2 className="font-semibold text-lg mt-4">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-3">
              点击关键词可选择是否添加外链
            </p>

            {/* 富文本编辑器 */}
            <div
              className="prose max-w-none border rounded-md p-4 md:px-6 focus:outline-none"
              onClick={handleEditorClick}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {/* 推荐理由列表 */}
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
            <div className="flex justify-end mt-6">
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

      {/* ------ 链接弹窗 ------ */}
      {active && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white rounded-xl shadow-lg border overflow-hidden"
        >
          {data.keywords
            .find(k => k.keyword === active)
            ?.options.map((opt, idx) => (
              <button
                key={idx}
                onClick={() => chooseLink(active, opt)}
                className="flex flex-col items-start w-full p-4 gap-1
                           hover:bg-gray-50 transition border-b last:border-0 text-left"
              >
                <p className="font-medium line-clamp-1 leading-snug">
                  {opt.title || opt.url}
                </p>
                <p className="text-xs text-gray-600 line-clamp-1 leading-snug">
                  {opt.url}
                </p>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
