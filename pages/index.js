import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------------- helpers ---------------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/* stash & restore ((reason)) blocks so they are never scanned */
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

/* only first occurrence of each keyword is wrapped */
function highlight(body, kwArr) {
  const { html: raw, stash } = stashReason(body);

  const seen = new Set();
  const list = [...kwArr]
    .filter(k => {
      const low = k.toLowerCase();
      if (seen.has(low)) return false;
      seen.add(low);
      return true;
    })
    .sort((a, b) => b.length - a.length);

  const spanStyle =
    "display:inline-flex;background:#ecfdf5;color:#065f46;" +
    "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";

  let html = raw.replace(/(<[^>]+>)/g, "\0$1\0").split("\0");
  list.forEach(k => {
    let done = false;
    const re = new RegExp(`\\b${esc(k)}\\b`, "i");
    html = html.map(chunk =>
      chunk.startsWith("<") || chunk.includes(`data-kw="${k}"`)
        ? chunk
        : chunk.replace(re, m => {
            if (done) return m;
            done = true;
            return `<span data-kw="${k}" style="${spanStyle}">${m}</span>`;
          })
    );
  });

  return restoreReason(html.join(""), stash);
}

/* ---------------- component ---------------- */
export default function Home() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);           // AI result with kwArr
  const [html, setHtml] = useState("");
  const [active, setActive] = useState(null);       // current keyword in popup
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState(false);      // at least one link chosen?
  const [copied, setCopied] = useState(false);
  const popRef = useRef(null);

  /* ------------ call AI ------------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw })
    });
    if (!res.ok) {
      setLoading(false);
      return alert("AI 分析失败");
    }
    const j = await res.json();
    const kwArr = j.keywords
      .map(k => (typeof k === "string" ? k : k.keyword || k.phrase || ""))
      .filter(Boolean);
    setData({ ...j, kwArr });
    setHtml(highlight(j.original, kwArr));
    setPicked(false);
    setLoading(false);
  }

  /* ------------ editor click -------- */
  function onClickEditor(e) {
    if (e.ctrlKey || e.metaKey) return;           // allow ctrl/cmd open
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

  /* ------------ choose / remove link ------------- */
  async function chooseLink(kw, opt) {
    /* 取消外链 → 恢复绿色块 */
    if (!opt) {
      const greenStyle =
        "display:inline-flex;background:#ecfdf5;color:#065f46;" +
        "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";
      const regFirst = new RegExp(
        `<a[^>]*>${esc(kw)}<\\/a><sup[^>]*>▾<\\/sup>\\s*\\(\\(.*?\\)\\)`,
        "i"
      );
      setHtml(p =>
        p.replace(
          regFirst,
          `<span data-kw="${kw}" style="${greenStyle}">${kw}</span>`
        )
      );
      setPicked(false);
      setActive(null);
      return;
    }

    /* 获取 reason */
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

    const linkStyle =
      "background:#dbeafe;color:#1e3a8a;border:1px solid #bfdbfe;" +
      "padding:0 2px;border-radius:4px;text-decoration:underline;font-weight:700";
    const link =
      `<a href="${opt.url}" target="_blank" rel="noopener" style="${linkStyle}">${kw}</a>` +
      `<sup style="margin-left:2px">▾</sup> ((${reason}))`;

    setHtml(prev =>
      prev.replace(
        new RegExp(`<span[^>]*data-kw="${esc(kw)}"[^>]*>.*?<\\/span>`, "i"),
        link
      )
    );
    setPicked(true);
    setActive(null);
  }

  /* ------------ copy HTML ------------ */
  function copyHtml() {
    navigator.clipboard.writeText(html.replace(/<span[^>]*>|<\/span>/g, ""));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------------- render ---------------- */
  return (
    <div style={{ fontFamily: '"Microsoft YaHei", system-ui, sans-serif', padding: 32 }}>
      {/* header */}
      <header style={{ maxWidth: 1040, margin: "0 auto 24px" }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, display: "flex", gap: 8 }}>
          <span style={{ color: "#f97316" }}>⚡</span> 外链优化
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>AI驱动的文章外链优化工具</p>
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
        {/* 输入阶段 */}
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
                background: "#000",
                opacity: loading ? 0.5 : 1,
                color: "#fff",
                fontWeight: 700,
                borderRadius: 6
              }}
            >
              {loading ? "Analyzing…" : "分析关键词"}
            </button>
          </>
        ) : (
          /* 编辑阶段 */
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
                  padding: "10px 24px",
                  background: picked ? "#000" : "#9ca3af",
                  color: "#fff",
                  fontWeight: 700,
                  borderRadius: 6
                }}
              >
                <FiCopy /> {copied ? "Copied!" : "确认选择"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* popup */}
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
