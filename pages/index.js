/* pages/index.js — 2025‑05‑12 all‑in‑one revision
   -------------------------------------------------
   ✓  Tailwind safelist 依赖的动态类统一抽离常量 KW_HL / PICKED_HL
   ✓  只高亮首处关键词，其余保持原文
   ✓  已选关键词首处呈蓝色链接+▾+((reason))，可再次点击弹窗
   ✓  移除外链 => 首处回绿色 kw，高亮逻辑自动恢复
   ✓  多次点击 ▾ 可重复选/移除，不跳转
   ------------------------------------------------- */

import { useState, useRef, useEffect } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------- Tailwind 动态类常量 (与 safelist 对应) ---------- */
const KW_HL = "bg-green-100 text-green-800 px-1";      // 未选高亮
const PICKED_LINK = "text-blue-600 underline";          // 已选链接 a
const CARET_CLASS = "caret ml-0.5 cursor-pointer select-none";

/* ------------------------ 组件 ------------------------ */
export default function Home() {
  const [raw, setRaw]         = useState("");             // 原始输入
  const [data, setData]       = useState(null);            // { topics, keywords, original }
  const [html, setHtml]       = useState("");             // 当前富文本
  const [active, setActive]   = useState(null);            // 当前弹窗关键词
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const popRef = useRef(null);

  /* ---------------- 调后台 ---------------- */
  async function analyze() {
    if (!raw.trim()) return alert("Please paste paragraph first!");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    setLoading(false);
    if (!r.ok) { alert("Server error"); return; }
    const j = await r.json();
    setData(j);
    highlight(j);
  }

  /* ---------------- 高亮逻辑 ---------------- */
  function highlight(j) {
    let body = j.original;
    const done = new Set();

    j.keywords.forEach(({ keyword }) => {
      if (done.has(keyword)) return;
      done.add(keyword);

      const reg = new RegExp(`\\b${keyword.replace(/([.*+?^${}()|[\\]\\\\])/g,"\\$1")}\\b`, "i");
      body = body.replace(reg, (_match) =>
        `<span data-kw="${keyword}" class="kw ${KW_HL} cursor-pointer">${keyword}" +
          `<sup class=\"${CARET_CLASS}\">▾</sup></span>`
      );
    });
    setHtml(body);
  }

  /* ---------------- 监听点击 ---------------- */
  function onClickEditor(e) {
    const caret = e.target.closest("sup.caret");
    const span  = e.target.closest("span[data-kw]");
    if (!caret && !span) return;

    const kw = span?.dataset.kw;
    if (!kw) return;

    // 计算弹窗位置
    const rc = span.getBoundingClientRect();
    popRef.current.style.top  = `${rc.bottom + window.scrollY + 6}px`;
    popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
    popRef.current.style.transform = "translateX(-50%)";

    setActive(active === kw ? null : kw);
  }

  /* ---------------- 选择外链 ---------------- */
  function applyLink(kw, opt, reason) {
    // reason 已由后台给出；兜底
    if (!reason) reason = "relevant reference";

    // 替换所有 data-kw=kw，高效 & 安全
    const regAll = new RegExp(`<span[^>]*data-kw=\"${kw}\"[^>]*>(.*?)<\\/span>`, "gi");
    let idx = 0;
    const replaced = html.replace(regAll, (_, inner) => {
      if (idx++ === 0) {
        return `<span data-kw="${kw}" class="picked">` +
               `<a href="${opt.url}" target="_blank" rel="noopener" class="${PICKED_LINK}">${kw}</a>` +
               ` <sup class="${CARET_CLASS}">▾</sup>((${reason}))</span>`;
      }
      return inner; // 其余位置只保留纯文本
    });
    setHtml(replaced);
    setActive(null);
  }

  /* ---------------- 移除外链 ---------------- */
  function removeLink(kw) {
    const reg = new RegExp(`<span[^>]*data-kw=\"${kw}\"[^>]*>(.*?)<\\/span>`, "i");
    const m   = html.match(reg);
    if (!m) return;
    // 恢复首处为绿色 kw
    const plain = `<span data-kw="${kw}" class="kw ${KW_HL} cursor-pointer">${kw}<sup class=\"${CARET_CLASS}\">▾</sup></span>`;
    setHtml(html.replace(reg, plain));
    setActive(null);
  }

  /* ---------------- 复制 HTML ---------------- */
  function copyHtml() {
    const final = html
      .replace(/<span class=\"kw[^>]*>(.*?)<\/span>/g, "$1")
      .replace(/<span class=\"picked[^>]*>(.*?)<\/span>/g, "$1");
    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  return (
    <div className="min-h-screen px-4 py-6 font-['Microsoft_YaHei'] bg-gray-50">
      {/* 头部 */}
      <header className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-600">AI驱动的文章外链优化工具</p>
      </header>

      {/* 主容器 */}
      <div className="max-w-4xl mx-auto bg-white rounded-2xl shadow p-6 space-y-6">
        {!data ? (
          <>
            <textarea
              rows={10}
              className="w-full border rounded p-4"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e=>setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-5 py-2 bg-black text-white font-bold rounded disabled:opacity-50"
            >{loading ? "Analyzing…" : "分析关键词"}</button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-500 mb-1">绿色块可添加外链；选后变蓝，可再次点击修改或移除。</p>
            <div
              className="prose max-w-none leading-relaxed"
              onClick={onClickEditor}
              dangerouslySetInnerHTML={{__html: html}}
            />
            <button
              onClick={copyHtml}
              className="flex items-center gap-2 px-5 py-2 bg-black text-white font-bold rounded"
            ><FiCopy/>{copied?"Copied!":"复制 HTML"}</button>
          </>
        )}
      </div>

      {/* 弹窗 */}
      {active && (
        <div ref={popRef}
             className="fixed z-50 w-96 bg-white border rounded-xl shadow-lg overflow-hidden">
          {data.keywords.find(k=>k.keyword===active)?.options.map((o,i)=>(
            <button key={i} onClick={()=>applyLink(active,o,o.title)}
                    className="block w-full text-left p-4 border-b last:border-0 hover:bg-gray-50">
              <p className="font-medium line-clamp-1">{o.title||o.url}</p>
              <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
            </button>
          ))}
          <button onClick={()=>removeLink(active)}
                  className="block w-full text-center py-3 text-red-500 hover:bg-gray-50">✕ 移除外链</button>
        </div>
      )}
    </div>
  );
}
