import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* 生成绿色高亮 */
function highlight(original, kwArr) {
  const sorted = [...kwArr].sort((a, b) => b.length - a.length);
  const green =
    "display:inline-flex;background:#ecfdf5;color:#065f46;" +
    "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";

  let html = original.replace(/(<[^>]+>)/g, "\u0000$1\u0000").split("\u0000");
  sorted.forEach(k => {
    const re = new RegExp(esc(k).replace(/\s+/g, "\\s+"), "gi");
    html = html.map(p =>
      p.startsWith("<") || p.includes(`data-kw="${k}"`)
        ? p
        : p.replace(re, m => `<span data-kw="${k}" style="${green}">${m}</span>`)
    );
  });
  return html.join("");
}

export default function Home() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);
  const [html, setHtml] = useState("");
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pickedCnt, setCnt] = useState(0);
  const [copied, setCopied] = useState(false);

  const popRef = useRef(null);

  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    if (!r.ok) return alert("AI 分析失败");
    const j = await r.json();
    const kwArr = j.keywords
      .map(k => (typeof k === "string" ? k : k.keyword || k.phrase || ""))
      .filter(Boolean);

    setData({ ...j, kwArr });
    setHtml(highlight(j.original, kwArr));
    setCnt(0);
    setLoading(false);
  }

  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    setActive(prev => (prev === kw ? null : kw));

    if (popRef.current) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  async function chooseLink(kw, opt) {
    if (!opt) {
      const green =
        "display:inline-flex;background:#ecfdf5;color:#065f46;" +
        "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";
      const reg = new RegExp(
        `<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>`,
        "gi"
      );
      setHtml(p =>
        p.replace(reg, `<span data-kw="${kw}" style="${green}">${kw}</span>`)
      );
      setCnt(c => Math.max(0, c - 1));
      setActive(null);
      return;
    }

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

    const blue =
      "display:inline-flex;background:#dbeafe;color:#1e3a8a;" +
      "border:1px solid #bfdbfe;padding:0 2px;border-radius:4px;cursor:pointer";

    const repl =
      `<span data-kw="${kw}">` +
      `<a href="${opt.url}" target="_blank" rel="noopener" ` +
      `style="${blue};text-decoration:underline;font-weight:700">${kw}</a>` +
      `</span> ((${reason}))`;

    const regSel = new RegExp(
      `<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>(\\s*\\(\\(.*?\\)\\))?`,
      "gi"
    );
    setHtml(p => {
      if (!/#dbeafe/.test(p.match(regSel)?.[0] || "")) setCnt(c => c + 1);
      return p.replace(regSel, repl);
    });
    setActive(null);
  }

  function copyHtml() {
    const clean = html.replace(
      /<span[^>]*data-kw="[^"]+"[^>]*>(.*?)<\/span>/g,
      "$1"
    );
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------- render ---------- */
  return (
    <div
      className="min-h-screen flex flex-col items-center py-10 px-4"
      style={{ fontFamily: '"Microsoft YaHei", sans-serif' }}
    >
      <h1 className="text-2xl font-bold mb-6">
        <span style={{ color: "#f97316" }}>⚡</span> 外链优化
      </h1>

      <div className="w-full max-w-4xl border rounded-xl p-8 space-y-6">
        {!data ? (
          <>
            <textarea
              rows={8}
              className="w-full border rounded p-3"
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-6 py-2 rounded"
              style={{
                background: loading ? "#94a3b8" : "#000",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              {loading ? "Analyzing…" : "分析关键词"}
            </button>
          </>
        ) : (
          <>
            <p className="text-xs text-gray-600 mb-2">
              绿色块可添加外链；选后变蓝，可再次点击修改或移除。
            </p>

            <div
              className="prose max-w-none border rounded p-4"
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />

            <div className="text-right">
              <button
                disabled={pickedCnt === 0}
                onClick={copyHtml}
                className="inline-flex items-center gap-2 px-6 py-2 rounded"
                style={{
                  background: pickedCnt === 0 ? "#94a3b8" : "#000",
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                <FiCopy /> {copied ? "Copied!" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {active && (
        <div
          ref={popRef}
          style={{
            position: "fixed",
            zIndex: 50,
            width: 380,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,.1)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            fontFamily: '"Microsoft YaHei", sans-serif',
          }}
        >
          {data.keywords
            .find(k => (k.keyword || k) === active)
            ?.options.map(o => (
              <button
                key={o.url}
                onClick={() => chooseLink(active, o)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "12px 16px",
                  borderBottom: "1px solid #f3f4f6",
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.title || o.url}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#6b7280",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {o.url}
                </p>
              </button>
            ))}
          <button
            onClick={() => chooseLink(active, null)}
            style={{
              display: "block",
              width: "100%",
              padding: 10,
              fontSize: 14,
              color: "#dc2626",
            }}
          >
            ✕ 移除外链
          </button>
        </div>
      )}
    </div>
  );
}
