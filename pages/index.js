/* pages/index.js – 外链优化工具 | 全量修订 2025‑05‑xx
   --------------------------------------------------------
   ‑ 多词语高亮（浅绿）
   ‑ 仅首词带 ▾ + ((reason))，其余位置不变动
   ‑ 点击 caret 可重选 / 移除外链
   ‑ 复制 HTML 时去 wrapper，兼容 Footnotes Made Easy
*/

import { useState, useRef, useEffect } from "react";
import { FiCopy, FiTrash2 } from "react-icons/fi";

/* ------------------------------- 组件 ------------------------------- */
export default function Home() {
  /* ------- 状态 ------- */
  const [raw, setRaw] = useState("");                 // 原文输入
  const [data, setData] = useState(null);              // { topics, keywords, original }
  const [html, setHtml] = useState("");               // 渲染中的富文本
  const [active, setActive] = useState(null);          // 当前弹窗关键词
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const popRef = useRef(null);

  /* ---------------- 调 /api/ai ---------------- */
  async function analyze() {
    if (!raw.trim()) return alert("Please paste an English paragraph first!");
    setLoading(true);
    try {
      const r = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: raw })
      });
      if (!r.ok) throw new Error("AI API failed");
      const j = await r.json();
      setData(j);
      setCopied(false);

      /* 关键词高亮：浅绿 + caret */
      let body = j.original;
      j.keywords.forEach(({ keyword }) => {
        // 仅首次出现插入 caret，其余只保留绿色 wrapper
        let firstDone = false;
        body = body.replace(new RegExp(`\\b${keyword}\\b`, "gi"), (m) => {
          if (firstDone) return `<span data-kw="${keyword}" class="kw">${m}</span>`;
          firstDone = true;
          return `
            <span data-kw="${keyword}" class="kw">
              ${m}<sup class="caret ml-0.5">▾</sup>
            </span>`;
        });
      });
      setHtml(body);
    } catch (e) {
      console.error(e);
      alert("Server analysis failed");
    } finally {
      setLoading(false);
    }
  }

  /* ----------- 点击关键词 / caret ----------- */
  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    setActive(active === kw ? null : kw);

    // 定位弹窗
    if (popRef.current && span) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top = `${rc.bottom + window.scrollY + 8}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* ----------- 选 / 重选链接 ----------- */
  async function chooseLink(kw, opt) {
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw })
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch (e) { console.error(e); }
    if (!reason) reason = "authoritative reference";

    /* HTML 片段，一次写完避免编译器误解析 */
    const replacement = `
      <span data-kw="${kw}" class="picked">
        <a href="${opt.url}" target="_blank" rel="noopener">${kw}</a>
        <sup class="caret ml-0.5">▾</sup> ((${reason}))
      </span>`;

    // 全局替换：之前首处 kw 或已选版本都换成 replacement，其余 kw 去掉 wrapper
    const pickReg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`, "i");
    const plainReg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>(${kw})<\\/span>`, "gi");

    setHtml(prev => {
      // 1) 先替换首处 / 已选
      let tmp = prev.replace(pickReg, replacement);
      // 2) 把剩余同关键词转成普通文字（不带链接）
      tmp = tmp.replace(plainReg, "$1");
      return tmp;
    });
    setActive(null);
  }

  /* ----------- 移除外链 ----------- */
  function removeLink(kw) {
    const reg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>(?:<a[^>]*>)?${kw}(?:<\\/a>)?.*?<\\/span>`, "gi");
    setHtml(prev => prev.replace(reg, `<span data-kw="${kw}" class="kw bg-green-100 text-green-800 px-1 cursor-pointer">${kw}</span>`));
    setActive(null);
  }

  /* ----------- 复制 HTML ----------- */
  function copyHtml() {
    const final = html
      .replace(/<span class="kw"[^>]*>(.*?)<\\/span>/g, "$1")
      .replace(/<span class="picked"[^>]*>(.*?)<\\/span>/g, "$1");
    navigator.clipboard.writeText(final);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen font-sans flex flex-col items-center py-10 px-4 bg-gray-50">
      {/* Header */}
      <header className="text-center mb-6 w-full max-w-4xl">
        <h1 className="text-3xl font-bold flex items-center gap-2 justify-start">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500 mt-1">AI驱动的文章外链优化工具</p>
      </header>

      {/* Card */}
      <div className="w-full max-w-4xl bg-white shadow rounded-2xl p-6 md:p-8">
        {!data ? (
          /* ------ 输入阶段 ------ */
          <>
            <textarea
              rows={8}
              className="w-full border rounded-md p-4 focus:outline-none focus:ring-2 focus:ring-blue-600"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="mt-4 px-6 py-2 rounded text-white font-bold bg-black disabled:opacity-40"
            >{loading ? "Analyzing…" : "分析关键词"}</button>
          </>
        ) : (
          /* ------ 编辑阶段 ------ */
          <>
            <p className="text-xs text-gray-500 mb-2">绿色块可添加外链；选后变蓝，可再次点击修改或移除。</p>
            <div
              className="prose max-w-none leading-relaxed cursor-text"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />
            <div className="text-right mt-4">
              <button
                onClick={copyHtml}
                className="inline-flex items-center gap-1 px-5 py-2 rounded font-bold text-white bg-black hover:bg-gray-800"
              >{copied ? <span>✔ 已复制</span> : <><FiCopy /> 复制 HTML</>}</button>
            </div>
          </>
        )}
      </div>

      {/* Popup */}
      {active && (
        <div ref={popRef} className="fixed z-50 w-96 bg-white rounded-xl shadow-lg border overflow-hidden animate-fadeIn">
          {data.keywords.find(k => k.keyword === active)?.options.map((o,i) => (
            <button key={i} onClick={() => chooseLink(active, o)}
              className="flex flex-col items-start w-full p-4 gap-1 hover:bg-gray-50 border-b last:border-0 text-left">
              <p className="font-medium line-clamp-1">{o.title || o.url}</p>
              <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
            </button>
          ))}
          <button onClick={() => removeLink(active)}
            className="w-full flex items-center justify-center gap-2 py-3 text-red-600 hover:bg-red-50">
            <FiTrash2 /> 移除外链
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------------- helpers ---------------- */
function escapeHtml(str = "") {
  return str.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[c]);
}
