import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------------- 组件 ---------------- */
export default function Home() {
  /* 状态 */
  const [raw, setRaw]       = useState("");
  const [data, setData]     = useState(null);   // {topics, keywords, original}
  const [html, setHtml]     = useState("");
  const [picked, setPicked] = useState({});     // {kw:{url,reason,no}}
  const [active, setActive] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied]   = useState(false);

  const popRef = useRef(null);

  /* ------------ 调 /api/ai ------------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    if (!r.ok) { alert("分析失败"); setLoading(false); return; }
    const j = await r.json();
    setData(j); setPicked({}); setCopied(false);

    /* 高亮关键词：绿色虚线下划线 + ▾ */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      if (body.includes(`data-kw="${keyword}"`)) return;   // 去重
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<span class="kw">` +
          `<a data-kw="${keyword}" class="border-b border-dashed border-green-600">${keyword}</a>` +
          `<sup class="caret">▾</sup></span>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ------------ 点击关键词 ------------ */
  function onClickEditor(e) {
    const el = e.target.closest("a[data-kw]");
    if (!el) return;
    const kw = el.dataset.kw;
    setActive(active === kw ? null : kw);

    if (popRef.current) {
      const rc = el.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom + window.scrollY + 6}px`;
      popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`;
      popRef.current.style.transform = "translateX(-50%)";
    }
  }

  /* ------------ 选中外链 ------------ */
  async function chooseLink(kw, opt) {
    if (picked[kw]) return;

    /* 后端要理由 */
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

    /* 脚注号 */
    const no = Object.keys(picked).length + 1;
    setPicked(p => ({ ...p, [kw]: { ...opt, reason, no } }));

    /* 替换 mark */
    const reg = new RegExp(
      `<span class="kw"><a[^>]*data-kw="${kw}"[^>]*>.*?<\\/a><sup class="caret">▾<\\/sup><\\/span>`,
      "i"
    );
    const anchor =
      `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a>` +
      `<sup id="fnref-${no}">[${no}]</sup>`;
    setHtml(prev => prev.replace(reg, anchor));

    setActive(null);
  }

  /* ------------ 复制 HTML ------------ */
  function copyHtml() {
    /* 无已选链接时提示 */
    if (Object.keys(picked).length === 0) {
      alert("请先点击关键词并选择外链，再复制 HTML");
      return;
    }

    /* 去掉残余占位 span */
    let final = html.replace(
      /<span class="kw"><a [^>]+>(.*?)<\/a><sup class="caret">▾<\/sup><\/span>/g,
      "$1"
    );

    /* 拼脚注 */
    final += "<hr><ol>";
    Object.values(picked)
      .sort((a,b)=>a.no-b.no)
      .forEach(p=>{
        final += `<li id="fn-${p.no}">${p.reason} <a href="#fnref-${p.no}">↩</a></li>`;
      });
    final += "</ol>";

    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  /* ---------------- 渲染 ---------------- */
  return (
    <div className="min-h-screen flex flex-col items-center py-10 px-4 bg-gray-50">
      {/* Header */}
      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold flex items-center justify-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      {/* Card */}
      <div className="w-full max-w-5xl bg-white shadow rounded-2xl p-8 space-y-6">
        {/* 主题 badge */}
        {data?.topics && (
          <div className="flex gap-2 flex-wrap items-center text-sm mb-2">
            <span className="text-gray-600">主题:</span>
            {data.topics.map(t=>(
              <span key={t} className="bg-gray-200 px-2 rounded">{t}</span>
            ))}
          </div>
        )}

        {!data ? (
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

            {/* 推荐理由 */}
            {Object.keys(picked).length > 0 && (
              <section className="pt-6">
                <h3 className="font-semibold">推荐理由</h3>
                <ol className="list-decimal pl-5 text-sm text-gray-600 space-y-1">
                  {Object.values(picked)
                    .sort((a,b)=>a.no-b.no)
                    .map(p=>(
                      <li key={p.no}>{p.reason}</li>
                    ))}
                </ol>
              </section>
            )}

            {/* Copy Button */}
            <div className="text-right mt-6">
              <button
                onClick={copyHtml}
                className="inline-flex items-center gap-2 px-6 py-2 bg-black text-white rounded"
              >
                <FiCopy/>{copied ? "Copied!" : "Copy HTML"}
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
        </div>
      )}
    </div>
  );
}
