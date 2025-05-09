import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------------- 主组件 ---------------- */
export default function Home() {
  /* 状态 */
  const [raw, setRaw]       = useState("");
  const [data, setData]     = useState(null);       // { topics, keywords, original }
  const [html, setHtml]     = useState("");
  const [active, setActive] = useState(null);       // 当前弹窗关键词
  const [loading, setLoading] = useState(false);
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
    setData(j);
    setCopied(false);

    /* 高亮：浅绿背景 + 虚线下划线 + caret ▾  */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      if (body.includes(`data-kw="${keyword}"`)) return;         // 去重
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<span data-kw="${keyword}" class="kw bg-green-100 text-green-800 px-1 cursor-pointer">` +
          `${keyword}<sup class="caret ml-0.5">▾</sup>` +
        `</span>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ---------- 点击关键词（未选 or 已选） ---------- */
  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    if (!kw) return;

    setActive(active === kw ? null : kw);
    if (popRef.current) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* ---------- 选链接 / 重选 ---------- */
  async function chooseLink(kw, opt) {
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw }),
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch (e) { console.error(e); }
    if (!reason) reason = "authoritative reference";

    /* 用 wrapper span 保留 data-kw，方便再次点击修改 */
    const replacement =
      `<span data-kw="${kw}" class="picked">` +
        `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a> ((${reason}))` +
      `</span>`;

    /* 把原 <span data-kw="kw" …>…</span> 全部替换（包括已选旧版本） */
    const reg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`,"gi");
    setHtml(prev => prev.replace(reg, replacement));
    setActive(null);
  }

  /* ---------- 复制 HTML ---------- */
  function copyHtml() {
    /* 将所有 kw / picked wrapper 移除，只保留内部内容 */
    let final = html
      .replace(/<span class="kw"[^>]*>(.*?)<\/span>/g, "$1")       // 未选关键词：保留 caret
      .replace(/<span class="picked"[^>]*>(.*?)<\/span>/g, "$1");  // 已选：保留 a + ((reason))

    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false), 2000);
  }

  /* -------------------- UI -------------------- */
  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-gray-50">
      {/* 顶部 Logo */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      {/* 主卡片 */}
      <div className="w-full max-w-5xl bg-white shadow rounded-2xl p-8 space-y-6">

        {!data ? (
          /* ---------- 输入阶段 ---------- */
          <>
            <textarea
              rows={10}
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
              {loading ? "Analyzing…" : "Analyze Keywords"}
            </button>
          </>
        ) : (
          /* ---------- 编辑阶段 ---------- */
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-2">
              点击关键词可预览，复制后可直接使用
            </p>
            <div
              className="prose max-w-none border rounded-md p-4 md:px-6"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />

            <div className="text-right mt-6">
              <button
                onClick={copyHtml}
                className="inline-flex items-center gap-2 px-6 py-2 bg-black text-white rounded hover:bg-gray-800"
              >
                <FiCopy /> {copied ? "Copied!" : "Copy HTML"}
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
          {data.keywords.find(k => k.keyword === active)?.options.map((o, i) => (
            <button
              key={i}
              onClick={() => chooseLink(active, o)}
              className="flex flex-col items-start w-full p-4 gap-1
                         hover:bg-gray-50 border-b last:border-0 text-left"
            >
              <p className="font-medium line-clamp-1">{o.title || o.url}</p>
              <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
