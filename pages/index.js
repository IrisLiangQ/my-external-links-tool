import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------- Utils ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 高亮函数：接收纯字符串关键词数组 */
function highlight(original, kwArr) {
  // 按长度降序，避免短词先匹配
  const sorted = [...kwArr].sort((a, b) => b.length - a.length);
  // 把 tag 隔离，避免替换入标签
  let html = original.replace(/(<[^>]+>)/g, '\u0000$1\u0000');
  let parts = html.split('\u0000');

  sorted.forEach(k => {
    const pat = esc(k).replace(/\s+/g, '\\s+');
    const re = new RegExp(pat, 'gi');
    parts = parts.map(p => {
      if (p.startsWith('<')) return p;                     // 跳过 HTML tag
      if (p.includes(`data-kw="${k}"`)) return p;          // 已高亮
      return p.replace(
        re,
        m => `<span data-kw="${k}" class="unkw bg-green-100 text-green-900 px-1 rounded
                         border border-green-300 cursor-pointer hover:bg-green-200">${m}</span>`
      );
    });
  });

  return parts.join('');
}

export default function Home() {
  /* ---------- 状态 ---------- */
  const [raw, setRaw]         = useState("");
  const [data, setData]       = useState(null);   // { original, keywords, kwArr }
  const [html, setHtml]       = useState("");
  const [active, setActive]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [pickedCnt, setPickedCnt] = useState(0);
  const [copied, setCopied]   = useState(false);

  const popRef = useRef(null);

  /* ---------- 调 /api/ai ---------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    if (!r.ok) { alert("服务器分析失败"); setLoading(false); return; }
    const j = await r.json();

    /* --- 统一关键词格式为字符串数组 kwArr --- */
    const kwArr = j.keywords.map(k =>
      typeof k === "string"
        ? k
        : (k.keyword || k.kw || k.phrase || "")
    ).filter(Boolean);

    setData({ ...j, kwArr });
    setPickedCnt(0);
    setCopied(false);
    setHtml(highlight(j.original, kwArr));
    setLoading(false);
  }

  /* ---------- 点击关键词 ---------- */
  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    setActive(prev => (prev === kw ? null : kw));

    if (popRef.current) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* ---------- 选择 / 移除 外链 ---------- */
  async function chooseLink(kw, opt) {
    /* 移除 */
    if (!opt) {
      const reg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`, 'gi');
      const green =
        `<span data-kw="${kw}" class="unkw bg-green-100 text-green-900 px-1 rounded
                        border border-green-300 cursor-pointer hover:bg-green-200">${kw}</span>`;
      setHtml(prev => prev.replace(reg, green));
      setPickedCnt(c => Math.max(0, c - 1));
      setActive(null);
      return;
    }

    /* 获取 reason */
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw }),
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch {}
    if (!reason) reason = "authoritative source";

    /* 蓝色块 */
    const blue =
      `<span data-kw="${kw}" class="picked bg-blue-100 text-blue-900 px-1 rounded
                         border border-blue-300 cursor-pointer hover:bg-blue-200">` +
        `<a href="${opt.url}" target="_blank" rel="noopener" class="underline">${kw}</a>` +
        ` ((${reason}))</span>`;

    const regSel = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`, 'gi');
    setHtml(prev => {
      const already = /class="picked"/.test(prev.match(regSel)?.[0] || "");
      if (!already) setPickedCnt(c => c + 1);
      return prev.replace(regSel, blue);
    });
    setActive(null);
  }

  /* ---------- 复制 ---------- */
  function confirmCopy() {
    const out = html
      .replace(/<span class="unkw"[^>]*>(.*?)<\/span>/g, '$1')
      .replace(/<span class="picked"[^>]*>(.*?)<\/span>/g, '$1');
    navigator.clipboard.writeText(out);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  }

  /* ---------- 渲染 ---------- */
  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-gray-50">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2 justify-center">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      <div className="w-full max-w-5xl bg-white shadow rounded-2xl p-8 space-y-6">
        {!data ? (
          <>
            <textarea
              rows={8}
              className="w-full border rounded-md p-4"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {loading ? "Analyzing…" : "分析关键词"}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500">
              绿色块可添加外链；选后变蓝，可再次点击修改或移除。
            </p>

            <div
              className="prose max-w-none border rounded-md p-4 md:px-6"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />

            <div className="text-right mt-6">
              <button
                disabled={pickedCnt === 0}
                onClick={confirmCopy}
                className={
                  pickedCnt === 0
                    ? "px-6 py-2 bg-gray-400 text-white rounded cursor-not-allowed"
                    : "px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
                }
              >
                <FiCopy /> {copied ? "Copied!" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 弹窗 */}
      {active && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white rounded-xl shadow-lg border overflow-hidden"
        >
          {data.keywords
            .find(k => (k.keyword || k.kw || k.phrase || k) === active)
            ?.options.map((o, i) => (
              <button
                key={i}
                onClick={() => chooseLink(active, o)}
                className="flex flex-col items-start w-full p-4 gap-1 hover:bg-gray-50 border-b last:border-0 text-left"
              >
                <p className="font-medium line-clamp-1">{o.title || o.url}</p>
                <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
              </button>
            ))}
          <button
            onClick={() => chooseLink(active, null)}
            className="w-full p-3 text-red-500 text-sm hover:bg-red-50"
          >
            ✕ 移除外链
          </button>
        </div>
      )}
    </div>
  );
}
