import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  const [raw, setRaw] = useState("");
  const [data, setData] = useState(null);      // {topics, keywords, original}
  const [html, setHtml] = useState("");
  const [picked, setPicked] = useState({});    // {kw:{url,reason,no}}
  const [active, setActive] = useState(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  const popRef = useRef(null);

  /* -------- 调 /api/ai -------- */
  async function analyze() {
    if (!raw.trim()) return alert("请粘贴文章");
    setLoading(true);
    const r = await fetch("/api/ai", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: raw }),
    });
    if (!r.ok) { alert("分析失败"); setLoading(false); return; }
    const j = await r.json();
    setData(j); setPicked({}); setCopied(false);

    /* 高亮关键词 */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(reg,
        `<mark data-kw="${keyword}" class="cursor-pointer bg-yellow-200/60 px-1 rounded">${keyword}</mark>`
      );
    });
    setHtml(body); setLoading(false);
  }

  /* -------- mark 点击 -------- */
  function onClickEditor(e) {
    const m = e.target;
    if (m.tagName !== "MARK") return;
    const kw = m.dataset.kw;
    setActive(active === kw ? null : kw);
    if (popRef.current) {
      const rc = m.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom + window.scrollY + 8}px`;
      popRef.current.style.left = `${rc.left + window.scrollX}px`;
    }
  }

  /* -------- 选择外链 -------- */
  async function chooseLink(kw, opt) {
    if (picked[kw]) return;
    let reason = "";
    try {
      const r = await fetch("/api/reason", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: opt.url, phrase: kw }),
      });
      if (r.ok) reason = (await r.json()).reason;
    } catch (e) { console.error(e); }
    if (!reason) reason = "authoritative reference";

    /* 分配脚注号 */
    const no = Object.keys(picked).length + 1;
    setPicked(p => ({ ...p, [kw]: { ...opt, reason, no } }));

    /* 替换 mark -> anchor + 脚注号 */
    const reg = new RegExp(`<mark[^>]*data-kw="${kw}"[^>]*>.*?<\\/mark>`, "i");
    const anchor = `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a><sup>[${no}]</sup>`;
    setHtml(prev => prev.replace(reg, anchor));
    setActive(null);
  }

  /* -------- 复制 HTML -------- */
  function copyHtml() {
    /* 拼接脚注 */
    let final = html;
    if (Object.keys(picked).length) {
      final += "<hr/><ol>";
      Object.values(picked)
        .sort((a,b)=>a.no-b.no)
        .forEach(p => { final += `<li>${p.reason}</li>`; });
      final += "</ol>";
    }
    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  /* ---------------- 渲染 ---------------- */
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-10 px-4">
      <header className="mb-8 w-full max-w-5xl">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-orange-500">⚡</span> 外链优化
        </h1>
        {data?.topics && (
          <p className="mt-1 text-sm text-gray-500 flex gap-2 flex-wrap">
            主题：
            {data.topics.map(t => (
              <span key={t} className="bg-gray-200 rounded px-2">{t}</span>
            ))}
          </p>
        )}
      </header>

      <div className="w-full max-w-5xl bg-white rounded-2xl shadow p-8 space-y-6">
        {!data && (
          <>
            <textarea
              rows={10}
              className="w-full border rounded-md p-4"
              placeholder="粘贴英文文章"
              value={raw}
              onChange={e=>setRaw(e.target.value)}
            />
            <button
              onClick={analyze}
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white rounded disabled:opacity-60"
            >
              {loading ? "分析中…" : "一键分析关键词"}
            </button>
          </>
        )}

        {data && (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <div
              className="prose max-w-none border rounded-md p-4 md:px-6"
              onClick={onClickEditor}
              dangerouslySetInnerHTML={{ __html: html }}
            />

            {Object.keys(picked).length > 0 && (
              <section className="pt-6">
                <h3 className="font-semibold">推荐理由</h3>
                <ol className="list-decimal pl-5 space-y-1 text-sm">
                  {Object.values(picked)
                    .sort((a,b)=>a.no-b.no)
                    .map(p=>(
                      <li key={p.no}>{p.reason}</li>
                    ))}
                </ol>
              </section>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={copyHtml}
                className="flex items-center gap-2 px-6 py-2 bg-black text-white rounded"
              >
                <FiCopy/>{copied?"已复制！":"确认选择"}
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
