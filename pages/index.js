import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* util -------------------------------------------------------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const green =
  "display:inline-flex;background:#ecfdf5;color:#065f46;" +
  "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";
function highlight(text, kws) {
  const list = [...kws].sort((a, b) => b.length - a.length);
  let html = text.replace(/(<[^>]+>)/g, "\0$1\0").split("\0");
  list.forEach(k => {
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
  /* state ------------------------------------------------------ */
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);          // ai 返回
  const [html, setHtml] = useState("");            // 编辑区 innerHTML
  const [active, setActive] = useState(null);      // 当前弹窗 kw
  const [loading, setLoading] = useState(false);
  const [pickedCnt, setCnt] = useState(0);
  const [copied, setCopied] = useState(false);
  const popRef = useRef(null);

  /* AI --------------------------------------------------------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw })
    });
    if (!r.ok) return alert("AI 请求失败");
    const j = await r.json();
    const kwArr = j.keywords
      .map(k => (typeof k === "string" ? k : k.keyword || k.phrase || ""))
      .filter(Boolean);
    setData({ ...j, kwArr });
    setHtml(highlight(j.original, kwArr));
    setCnt(0);
    setLoading(false);
  }

  /* 编辑区点击 -------------------------------------------------- */
  function onClickEditor(e) {
    if (e.ctrlKey || e.metaKey) return;            // 允许 ctrl 新标签
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    e.preventDefault();
    const kw = span.dataset.kw;
    setActive(prev => (prev === kw ? null : kw));

    if (popRef.current) {
      const rc = span.getBoundingClientRect();
      popRef.current.style.top = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* 选择 / 移除 -------------------------------------------------- */
  async function chooseLink(kw, opt) {
    /* 移除外链 ---------------- */
    if (!opt) {
      const reg = new RegExp(
        `<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>(\\s*\\(\\(.*?\\)\\))?`,
        "gi"
      );
      setHtml(p =>
        p.replace(reg, `<span data-kw="${kw}" style="${green}">${kw}</span>`)
      );
      setCnt(c => Math.max(0, c - 1));
      setActive(null);
      return;
    }

    /* 生成 reason -------------- */
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw })
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
      `style="${blue};text-decoration:underline;font-weight:700">` +
      `${kw}</a><sup style="margin-left:2px">▾</sup></span> ((${reason}))`;

    const reg = new RegExp(
      `<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>(\\s*\\(\\(.*?\\)\\))?`,
      "gi"
    );
    setHtml(p => {
      if (!/#dbeafe/.test(p.match(reg)?.[0] || "")) setCnt(c => c + 1);
      return p.replace(reg, repl);
    });
    setActive(null);
  }

  /* 复制 -------------------------------------------------------- */
  function copyHtml() {
    const out = html.replace(
      /<span[^>]*data-kw="[^"]+"[^>]*>(.*?)<\/span>/g,
      "$1"
    );
    navigator.clipboard.writeText(out);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ----------------------------- render ----------------------- */
  return (
    <div
      style={{
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        padding: "32px"
      }}
    >
      {/* -------- 顶部 logo -------- */}
      <header style={{ maxWidth: 1040, margin: "0 auto 24px" }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: 8
          }}
        >
          <span style={{ color: "#f97316" }}>⚡</span> 外链优化
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          AI驱动的文章外链优化工具
        </p>
      </header>

      {/* -------- 卡片容器 -------- */}
      <div
        style={{
          maxWidth: 1040,
          margin: "0 auto",
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 4px 24px rgba(0,0,0,.06)",
          padding: 32
        }}
      >
        {!data ? (
          <>
            <textarea
              rows={8}
              style={{
                width: "100%",
                border: "1px solid #d1d5db",
                borderRadius: 8,
                padding: 12,
                resize: "vertical"
              }}
              placeholder="Paste English paragraph…"
              value={raw}
              onChange={e => setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              style={{
                marginTop: 16,
                padding: "10px 24px",
                background: loading ? "#9ca3af" : "#000",
                color: "#fff",
                fontWeight: 700,
                borderRadius: 6,
                cursor: loading ? "not-allowed" : "pointer"
              }}
            >
              {loading ? "Analyzing…" : "分析关键词"}
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>
              绿色块可添加外链；选后变蓝，可再次点击修改或移除。
            </p>
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 8,
                padding: 16,
                lineHeight: 1.6
              }}
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                disabled={!pickedCnt}
                onClick={copyHtml}
                style={{
                  padding: "10px 24px",
                  background: pickedCnt ? "#000" : "#9ca3af",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 6,
                  cursor: pickedCnt ? "pointer" : "not-allowed",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6
                }}
              >
                <FiCopy /> {copied ? "Copied!" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* -------- 弹窗 -------- */}
      {active && (
        <div
          ref={popRef}
          style={{
            position: "fixed",
            zIndex: 50,
            width: 380,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 6px 24px rgba(0,0,0,.12)",
            border: "1px solid #e5e7eb",
            overflow: "hidden",
            fontFamily: '"Microsoft YaHei", sans-serif'
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
                  padding: 16,
                  borderBottom: "1px solid #f3f4f6",
                  cursor: "pointer"
                }}
              >
                <p
                  style={{
                    fontWeight: 700,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
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
                    whiteSpace: "nowrap"
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
              padding: 12,
              fontSize: 14,
              color: "#dc2626",
              cursor: "pointer"
            }}
          >
            ✕ 移除外链
          </button>
        </div>
      )}
    </div>
  );
}
