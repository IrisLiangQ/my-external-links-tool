// pages/index.js
import { useState, useRef } from 'react';
import { FiCopy, FiLink } from 'react-icons/fi';

/* --------------- 主组件 ---------------- */
export default function Home() {
  /* ---------- 状态 ---------- */
  const [raw,        setRaw]        = useState('');
  const [data,       setData]       = useState(null);   // { original, keywords:[{keyword, options}] }
  const [html,       setHtml]       = useState('');
  const [activeKw,   setActiveKw]   = useState(null);   // 当前弹窗关键词
  const [loading,    setLoading]    = useState(false);
  const [copied,     setCopied]     = useState(false);
  const [extraInput, setExtraInput] = useState('');     // 🆕 文章级上下文

  /* refs */
  const linkedMap      = useRef(new Map());             // kw → 首个已插入外链 span
  const popupRef       = useRef(null);
  const keywordCounter = useRef({});                    // kw → 已高亮次数

  /* ---------- 调用 /api/ai ---------- */
  async function analyze() {
    if (!raw.trim()) { alert('请先粘贴英文段落！'); return; }

    setLoading(true);
    setData(null);
    keywordCounter.current = {};

    const r = await fetch('/api/ai', {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({ text: raw }),
    });
    setLoading(false);
    if (!r.ok) { alert('服务器分析失败'); return; }

    const j = await r.json();
    setData(j);
    linkedMap.current.clear();

    /* --- 高亮关键词（先长后短防止子串嵌套） --- */
    let body = j.original;
    j.keywords
      .sort((a, b) => b.keyword.length - a.keyword.length)
      .forEach(({ keyword }) => {
        const kw  = keyword.trim();
        const pos = keywordCounter.current[kw] ?? 0;
        keywordCounter.current[kw] = pos + 1;

        body = body.replace(
          new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}\\b`, 'i'),
          `<span data-kw="${kw}" data-pos="${pos}" class="kw bg-kwBg text-kwFg px-1 rounded cursor-pointer hover:bg-kwFg/10">${kw}<sup class="caret ml-0.5">▾</sup></span>`
        );
      });
    setHtml(body);
  }

  /* ---------- 点击编辑区域 ---------- */
  function onClickEditor(e) {
    const span = e.target.closest('span.kw, span.picked');
    if (!span) return;

    const kw = span.dataset.kw;
    if (linkedMap.current.has(kw) && span !== linkedMap.current.get(kw)) return;

    setActiveKw(activeKw === kw ? null : kw);

    // 让弹窗跟随选中词
    if (popupRef.current) {
      const rc = span.getBoundingClientRect();
      popupRef.current.style.top       = `${rc.bottom + window.scrollY + 6}px`;
      popupRef.current.style.left      = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popupRef.current.style.transform = 'translateX(-50%)';
    }
  }

  /* ---------- 选链接 ---------- */
  async function chooseLink(kw, opt) {
    const span =
      linkedMap.current.get(kw) ||
      document.querySelector(`span[data-kw="${CSS.escape(kw)}"][data-pos="0"]`);
    if (!span) return;

    const sentence = span.closest('p')?.innerText || '';
    const extra    = extraInput.split(/[,\s]+/).filter(Boolean);

    let reason = '';
    try {
      const r = await fetch('/api/reason', {
        method : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body   : JSON.stringify({ url: opt.url, phrase: kw, sentence, extra }),
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch {/* 忽略 */ }

    if (!reason) reason = 'relevant reference';

    span.className = 'picked underline text-blue-800';
    span.innerHTML =
      `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a> ((${reason}))`;

    linkedMap.current.set(kw, span);
    setActiveKw(null);
  }

  /* ---------- 移除外链 ---------- */
  function removeLink(kw) {
    const span = linkedMap.current.get(kw);
    if (!span) return;
    span.className = 'kw bg-kwBg text-kwFg px-1 rounded cursor-pointer hover:bg-kwFg/10';
    span.innerHTML = `${kw}<sup class="caret ml-0.5">▾</sup>`;
    linkedMap.current.delete(kw);
    setActiveKw(null);
  }

  /* ---------- 复制 HTML ---------- */
  function copyHtml() {
    let final = html
      .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi, '$1')
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi, '')
      .replace(/\s+\)/g, ')');

    navigator.clipboard.writeText(final);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 bg-gray-50 font-sans">
      {/* 文章级额外语境输入框 */}
      <input
        type="text"
        placeholder="Extra context (e.g. EV, charger)"
        value={extraInput}
        onChange={(e) => setExtraInput(e.target.value)}
        className="mb-4 w-full max-w-md border px-4 py-2 rounded focus:outline-brand"
      />

      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span className="text-brand">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      <div className="w-full max-w-screen cardBg shadow rounded-2xl p-8 space-y-6">
        {!data ? (
          <>
            <textarea
              rows={10}
              className="w-full border rounded-md p-4 focus:outline-brand"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-6 py-2 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-60 flex items-center gap-2"
            >
              <FiLink /> {loading ? 'Analyzing…' : 'Analyze Keywords'}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-2">
              绿色块可添加外链；选后变蓝，可再次点击修改或移除。
            </p>

            <div
              className="prose max-w-none border rounded-md p-4 leading-7"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />

            <div className="text-right">
              <button
                onClick={copyHtml}
                className="inline-flex items-center gap-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-800"
              >
                <FiCopy /> {copied ? 'Copied!' : '复制 HTML'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* -------- 弹窗：链接选项 / 移除 -------- */}
      {activeKw && data && (
        <div
          ref={popupRef}
          className="fixed z-50 w-96 bg-white shadow-lg rounded-xl border animate-fadeIn"
        >
          {data.keywords
            .find((k) => k.keyword === activeKw)
            ?.options.map((o, i) => (
              <button
                key={i}
                onClick={() => chooseLink(activeKw, o)}
                className="flex flex-col w-full items-start text-left gap-0.5 px-4 py-3 min-h-[64px] hover:bg-gray-50 border-b last:border-0"
              >
                <p className="text-sm font-medium truncate w-full">
                  {o.title || o.url}
                </p>
                <p className="text-xs text-gray-600 truncate w-full">{o.url}</p>
              </button>
            ))}

          {linkedMap.current.has(activeKw) && (
            <button
              onClick={() => removeLink(activeKw)}
              className="w-full text-red-600 py-3 text-center hover:bg-red-50 rounded-b-xl"
            >
              ✕ 移除外链
            </button>
          )}
        </div>
      )}
    </div>
  );
}
