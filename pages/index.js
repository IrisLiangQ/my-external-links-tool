import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  /* ---------- 状态 ---------- */
  const [raw, setRaw]   = useState("");
  const [data, setData] = useState(null);           // /api/ai 结果
  const [html, setHtml] = useState("");
  const [active, setActive] = useState(null);       // 弹窗关键词
  const [loading, setLoading] = useState(false);
  const [pickedCount, setPickedCount] = useState(0);
  const [copied, setCopied] = useState(false);

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
    setData(j); setPickedCount(0); setCopied(false);

    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      if (body.includes(`data-kw="${keyword}"`)) return;
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<span data-kw="${keyword}"` +
        ` class="kw inline-block bg-green-100 text-green-900 px-1 rounded` +
        ` border border-green-300 hover:bg-green-200 cursor-pointer transition">` +
          `${keyword}` +
        `</span>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ---------- 点击关键词 ---------- */
  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    setActive(active === kw ? null : kw);

    if (popRef.current) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* ---------- 选 / 移除 外链 ---------- */
  async function chooseLink(kw, opt) {
    /* 移除外链  -------------------------------- */
    if (!opt) {
      const regSel = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`,"gi");
      const green =
        `<span data-kw="${kw}" class="kw inline-block bg-green-100 text-green-900 px-1 rounded` +
        ` border border-green-300 hover:bg-green-200 cursor-pointer transition">` +
          `${kw}` +
        `</span>`;
      setHtml(prev => {
        const after = prev.replace(regSel, green);
        setPickedCount((cnt)=>cnt-1);
        return after;
      });
      setActive(null);
      return;
    }

    /* 新建 / 替换外链  -------------------------- */
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw }),
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch { /* ignore */ }
    if (!reason) reason = "authoritative source";

    const blue =
      `<span data-kw="${kw}" class="picked inline-block bg-blue-100 text-blue-900 px-1 rounded` +
        ` border border-blue-300 hover:bg-blue-200 cursor-pointer transition">` +
        `<a href="${opt.url}" target="_blank" rel="noopener" class="underline">${kw}</a>` +
        ` ((${reason}))` +
      `</span>`;

    const reg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?<\\/span>`,"gi");
    setHtml(prev => {
      const existed = /class="picked"/.test(prev.match(reg)?.[0] || "");
      if (!existed) setPickedCount(cnt=>cnt+1);
      return prev.replace(reg, blue);
    });
    setActive(null);
  }

  /* ---------- 确认选择 / 复制 HTML ---------- */
  function confirmAndCopy() {
    let final = html
      .replace(/<span class="kw"[^>]*>(.*?)<\/span>/g, "$1")
      .replace(/<span class="picked"[^>]*>(.*?)<\/span>/g, "$1");
    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  /* ---------- UI ---------- */
  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-gray-50">
      <header className="text-center mb-6">
        <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      <div className="w-full max-w-5xl bg-white shadow rounded-2xl p-8 space-y-6">
        {!data ? (
          /* -------- 输入阶段 -------- */
          <>
            <textarea
              rows={10}
              className="w-full border rounded-md p-4"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e=>setRaw(e.target.value)}
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
          /* -------- 编辑阶段 -------- */
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-2">
              绿色块表示可添加外链，点击选择后变蓝。必须至少选择一个才能继续。
            </p>
            <div
              className="prose max-w-none border rounded-md p-4 md:px-6"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />

            {/* 确认按钮 */}
            <div className="text-right mt-6">
              <button
                onClick={confirmAndCopy}
                disabled={pickedCount === 0}
                className={
                  "inline-flex items-center gap-2 px-6 py-2 rounded " +
                  (pickedCount === 0
                    ? "bg-gray-400 text-white cursor-not-allowed"
                    : "bg-black text-white hover:bg-gray-800")
                }
              >
                <FiCopy/>{copied ? "Copied!" : "确认选择"}
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
          {data.keywords.find(k=>k.keyword===active)?.options.map((o,i)=>(
            <button
              key={i}
              onClick={()=>chooseLink(active,o)}
              className="flex flex-col items-start w-full p-4 gap-1
                         hover:bg-gray-50 border-b last:border-0 text-left"
            >
              <p className="font-medium line-clamp-1">{o.title || o.url}</p>
              <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
            </button>
          ))}
          <button
            onClick={()=>chooseLink(active,null)}
            className="w-full p-3 text-red-500 text-sm hover:bg-red-50">
            ✕ 移除外链
          </button>
        </div>
      )}
    </div>
  );
}
