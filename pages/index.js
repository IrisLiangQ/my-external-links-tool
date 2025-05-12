import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------------- utils ---------------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* 将 ((reason)) 暂存，避免被高亮正则误替换 */
function stashReason(text) {
  const stash = [];
  const html = text.replace(/\(\([\s\S]*?\)\)/g, m => {
    const key = `¤¤${stash.length}¤¤`;
    stash.push(m);
    return key;
  });
  return { html, stash };
}
const restoreReason = (text, stash) =>
  text.replace(/¤¤(\d+)¤¤/g, (_, i) => stash[+i]);

/* 仅高亮每个关键词的首处出现 */
function highlight(body, kws) {
  const { html: raw, stash } = stashReason(body);
  const seen = new Set();
  const ordered = [...kws]
    .filter(Boolean)
    .filter(k => {
      const l = k.toLowerCase();
      if (seen.has(l)) return false;
      seen.add(l);
      return true;
    })
    .sort((a, b) => b.length - a.length); // 长词优先

  const spanBase =
    "display:inline-flex;background:#ecfdf5;color:#065f46;" +
    "border:1px solid #bbf7d0;border-radius:4px;padding:0 2px;cursor:pointer";

  let parts = raw.replace(/(<[^>]+>)/g, "\0$1\0").split("\0");
  ordered.forEach(kw => {
    let first = true;
    const re = new RegExp(`\\b${esc(kw)}\\b`, "i");
    parts = parts.map(p =>
      p.startsWith("<")
        ? p
        : p.replace(re, m => {
            if (!first) return m;
            first = false;
            return `<span data-kw="${kw}" style="${spanBase}">${m}</span>`;
          })
    );
  });
  return restoreReason(parts.join(""), stash);
}

/* ---------------- component ---------------- */
export default function Home() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);           // { kwArr, keywords, original }
  const [html, setHtml] = useState("");
  const [active, setActive] = useState(null);
  const [picked, setPicked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const pop = useRef(null);

  /* ---------- 调 /api/ai ---------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw })
    });
    if (!r.ok) {
      setLoading(false);
      return alert("服务器分析失败");
    }
    const j = await r.json();
    const kwArr = j.keywords.map(k => (typeof k === "string" ? k : k.keyword));
    setData({ ...j, kwArr });
    setHtml(highlight(j.original, kwArr));
    setPicked(false);
    setLoading(false);
  }

  /* ---------- 点击编辑区 ---------- */
  function onClickEditor(e) {
    const span = e.target.closest("span[data-kw]");
    if (!span) return;
    const kw = span.dataset.kw;
    setActive(prev => (prev === kw ? null : kw));
    if (pop.current) {
      const rc = span.getBoundingClientRect();
      pop.current.style.top = `${rc.bottom + window.scrollY + 6}px`;
      pop.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      pop.current.style.transform = "translateX(-50%)";
    }
  }

  /* ---------- 选择 / 移除 外链 ---------- */
  async function chooseLink(kw, opt) {
    /* === 移除 === */
    if (!opt) {
      const green =
        "display:inline-flex;background:#ecfdf5;color:#065f46;" +
        "border:1px solid #bbf7d0;border-radius:4px;padding:0 2px;cursor:pointer";
      const reg = new RegExp(
        `<span data-kw="${esc(kw)}"[^>]*>\\s*<a[^>]+>${esc(kw)}<\\/a>.*?<\\/span>`,
        "i"
      );
      setHtml(p =>
        p.replace(
          reg,
          `<span data-kw="${kw}" style="${green}">${kw}</span>`
        )
      );
      setActive(null);
      setPicked(false);
      return;
    }

    /* === 获取 reason === */
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

    /* 包裹 span 保留 data-kw，方便再编辑 */
    const link =
      `<span data-kw="${kw}" ` +
      `style="background:#dbeafe;color:#1e3a8a;border:1px solid #bfdbfe;` +
      `border-radius:4px;padding:0 2px;cursor:pointer">` +
      `<a href="${opt.url}" target="_blank" rel="noopener" ` +
      `style="color:inherit;text-decoration:underline;font-weight:700">${kw}</a>` +
      `<sup style="margin-left:2px">▾</sup> ((${reason}))` +
      `</span>`;

    setHtml(p =>
      p.replace(
        new RegExp(
          `<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>`,
          "i"
        ),
        link
      )
    );
    setPicked(true);
    setActive(null);
  }

  /* ---------- 复制 ---------- */
  function copyHtml() {
    navigator.clipboard.writeText(
      html.replace(/<span[^>]*>|<\/span>/g, "")
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------- UI ---------- */
  const btn = {
    padding: "10px 24px",
    fontWeight: 700,
    borderRadius: 6,
    background: "#000",
    color: "#fff"
  };

  return (
    <div
      style={{
        fontFamily: '"Microsoft YaHei","PingFang SC",sans-serif',
        padding: 32
      }}
    >
      {/* header */}
      <header style={{ maxWidth: 1040, margin: "0 auto 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, display: "flex", gap: 8 }}>
          <span style={{ color: "#f97316" }}>⚡</span> 外链优化
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          AI驱动的文章外链优化工具
        </p>
      </header>

      {/* card */}
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
              style={{ ...btn, opacity: loading ? 0.5 : 1, marginTop: 16 }}
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
                lineHeight: 1.6,
                minHeight: 120
              }}
              dangerouslySetInnerHTML={{ __html: html }}
              onClick={onClickEditor}
            />
            <div style={{ textAlign: "right", marginTop: 16 }}>
              <button
                disabled={!picked}
                onClick={copyHtml}
                style={{
                  ...btn,
                  background: picked ? "#000" : "#9ca3af"
                }}
              >
                <FiCopy style={{ marginRight: 6 }} />
                {copied ? "Copied!" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* popup */}
      {active && (
        <div
          ref={pop}
          style={{
            position: "fixed",
            zIndex: 50,
            width: 380,
            background: "#fff",
            borderRadius: 12,
            boxShadow: "0 6px 24px rgba(0,0,0,.12)",
            border: "1px solid #e5e7eb",
            overflow: "hidden"
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
                  borderBottom: "1px solid #f3f4f6"
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
              color: "#dc2626"
            }}
          >
            ✕ 移除外链
          </button>
        </div>
      )}
    </div>
  );
}
