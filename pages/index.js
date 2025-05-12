import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ------------------------------------------------ util */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");        // 转义正则
const kwStyle =
  "display:inline-flex;background:#ecfdf5;color:#065f46;" +
  "border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer";

/* 仅给 “第一次出现” 包 span，其余保持原文 ---------------------- */
function highlight(body, kwArr) {
  const list = [...kwArr].sort((a, b) => b.length - a.length);    // 长词优先
  let html = body.replace(/(<[^>]+>)/g, "\0$1\0").split("\0");    // 暂时断开 html 标签
  list.forEach(k => {
    let first = false;
    const re = new RegExp(esc(k).replace(/\s+/g, "\\s+"), "gi");
    html = html.map(chunk =>
      chunk.startsWith("<") || chunk.includes(`data-kw="${k}"`)
        ? chunk
        : chunk.replace(re, m => {
            if (first) return m;
            first = true;
            return `<span data-kw="${k}" style="${kwStyle}">${m}</span>`;
          })
    );
  });
  return html.join("");
}

/* ------------------------------------------------ component */
export default function Home() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);                  // {original, kwArr, keywords}
  const [html, setHtml] = useState("");
  const [active, setActive] = useState(null);              // 当前弹窗 keyword
  const [loading, setLoading] = useState(false);
  const [pickedCnt, setCnt] = useState(0);
  const [copied, setCopied] = useState(false);
  const popRef = useRef(null);

  /* ---------------- 调 /api/ai ---------------- */
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

  /* ---------------- 点击编辑区 ---------------- */
  function onClickEditor(e) {
    if (e.ctrlKey || e.metaKey) return;                     // 允许 ctrl+click
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

  /* ---------------- 选择/移除链接 ---------------- */
  async function chooseLink(kw, opt) {
    /* === 移除 === */
    if (!opt) {
      const reg = new RegExp(
        `<a[^>]*>${esc(kw)}<\\/a>(\\s*\\(\\(.*?\\)\\))?`,
        "gi"
      );
      const regSpan = new RegExp(
        `<span[^>]*data-kw="${esc(kw)}"[^>]*>(.*?)<\\/span>`,
        "gi"
      );
      setHtml(p =>
        highlight(
          p.replace(reg, kw).replace(regSpan, kw),          // 还原成裸文本
          [kw]
        )
      );
      setCnt(c => Math.max(0, c - 1));
      setActive(null);
      return;
    }

    /* === reason === */
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

    /* link style */
    const blue =
      "background:#dbeafe;color:#1e3a8a;" +
      "border:1px solid #bfdbfe;padding:0 2px;border-radius:4px;" +
      "text-decoration:underline;font-weight:700";

    const linkHTML =
      `<a href="${opt.url}" target="_blank" rel="noopener" style="${blue}">${kw}</a>` +
      `<sup style="margin-left:2px">▾</sup>`;

    setHtml(prev => {
      /* 把首次 span → link+reason */
      let out = prev.replace(
        new RegExp(
          `<span[^>]*data-kw="${esc(kw)}"[^>]*>(.*?)</span>`,
          "i"
        ),
        `${linkHTML} ((${reason}))`
      );
      /* 其余裸文本全部同步替换成 link（不附 reason） */
      const bare = new RegExp(`\\b${esc(kw)}\\b`, "gi");
      out = out.replace(bare, linkHTML);
      setCnt(c => (c ? c : 1));            // 首次统计
      return out;
    });
    setActive(null);
  }

  /* ---------------- 复制 ---------------- */
  function copyHtml() {
    const clean = html.replace(/<span[^>]*>|\<\/span>/g, "");      // 移除 kw span
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  /* ---------------- render ---------------- */
  return (
    <div
      style={{
        fontFamily: '"Microsoft YaHei", system-ui, sans-serif',
        padding: 32
      }}
    >
      {/* 顶部 */}
      <header style={{ maxWidth: 1040, margin: "0 auto 24px" }}>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            display: "flex",
            gap: 8,
            alignItems: "center"
          }}
        >
          <span style={{ color: "#f97316" }}>⚡</span> 外链优化
        </h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          AI驱动的文章外链优化工具
        </p>
      </header>

      {/* 卡片 */}
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

      {/* 弹窗 */}
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
