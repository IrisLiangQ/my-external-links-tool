import { useState, useRef } from 'react';
import { FiCopy } from 'react-icons/fi';

/* ---------- 小工具 ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/* 临时包掉 ((reason))，避免被高亮正则误命中 */
const stashReason = html => {
  const stash = [];
  const keep  = html.replace(/\(\([\s\S]*?\)\)/g, m => {
    const key = `¤¤${stash.length}¤¤`;
    stash.push(m); return key;
  });
  return { keep, stash };
};
const restoreReason = (html, stash) =>
  html.replace(/¤¤(\d+)¤¤/g, (_,i) => stash[+i]);

/* 只高亮“首处”出现的关键词 */
const highlightOnce = (body, kws) => {
  const { keep, stash } = stashReason(body);
  let out = keep;
  kws.forEach(kw => {
    const re  = new RegExp(`\\b${esc(kw)}\\b`,'i');
    out = out.replace(re, 
      `<span data-kw="${kw}" class="kw">` +
      `${kw}<sup class="caret">▾</sup></span>`);
  });
  return restoreReason(out,stash);
};

export default function Home(){

  /* -------- state -------- */
  const [raw,setRaw]           = useState('');
  const [data,setData]         = useState(null);      // /api/ai 返回
  const [html,setHtml]         = useState('');
  const [active,setActive]     = useState(null);      // 当前弹窗 kw
  const [copied,setCopied]     = useState(false);
  const [loading,setLoading]   = useState(false);

  const popRef = useRef(null);

  /* -------- 调 /api/ai -------- */
  const analyze = async()=>{
    if(!raw.trim()) return alert('Paste some text first!');
    setLoading(true);
    const r = await fetch('/api/ai',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:raw})
    });
    setLoading(false);
    if(!r.ok){return alert('Server error');}
    const j = await r.json();
    setData(j);

    /* 只取 keyword 字段并去重(保险) */
    const kwArr = [...new Set(
      j.keywords.map(k=> typeof k==='string'?k:k.keyword)
    )];

    setHtml(highlightOnce(j.original, kwArr));
  };

  /* -------- 点击关键词 -------- */
  const onClickEditor = e=>{
    const span = e.target.closest('span.kw, span.picked');
    if(!span) return;
    const kw  = span.dataset.kw;
    setActive(a => a===kw ? null : kw);
    if(!popRef.current) return;
    const rc = span.getBoundingClientRect();
    popRef.current.style.top  = rc.bottom + window.scrollY + 6 + 'px';
    popRef.current.style.left = rc.left + rc.width/2 + window.scrollX + 'px';
    popRef.current.style.transform = 'translateX(-50%)';
  };

  /* -------- 选择 / 重新选择链接 -------- */
  const chooseLink = async(kw,opt)=>{
    // reason
    let reason = '';
    try{
      const r = await fetch('/api/reason',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url:opt.url,phrase:kw})
      });
      if(r.ok) reason = (await r.json()).reason;
    }catch{}
    if(!reason) reason = 'authoritative reference';

    // 生成替换片段
    const replacement =
      `<span data-kw="${kw}" class="picked">`+
      `<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a>`+
      ` <sup class="caret">▾</sup> ((${reason}))</span>`;

    /* 所有位置统一替换为同一个节点 */
    const reg = new RegExp(`<span[^>]*data-kw="${esc(kw)}"[^>]*>[\\s\\S]*?<\\/span>`,'gi');
    setHtml(h => h.replace(reg, replacement));
    setActive(null);
  };

  /* -------- 移除外链（恢复绿色） -------- */
  const removeLink = kw=>{
    const regPicked = new RegExp(
      `<span[^>]*class="picked"[^>]*data-kw="${esc(kw)}"[^>]*>`+
      `<a[^>]*>${esc(kw)}<\\/a>[^<]*<\\/span>`,'gi');
    setHtml(h => highlightOnce(h.replace(regPicked, kw), [kw]));
    setActive(null);
  };

  /* -------- 复制输出 -------- */
  const copyHtml = ()=>{
    const txt = html
      .replace(/<span class="kw"[^>]*>(.*?)<\/span>/g,'$1')
      .replace(/<span class="picked"[^>]*>(.*?)<\/span>/g,'$1');
    navigator.clipboard.writeText(txt);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  /* =================================================================== */
  return (
    <main className="flex justify-center py-14 px-4">
      <article className="max-w-screen shadow-xl rounded-3xl bg-cardBg w-full">
        {/* ------------ header logo ------------ */}
        <header className="px-7 pt-8 pb-6">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-brand text-2xl">⚡</span> 外链优化
          </h1>
          <p className="text-sm text-gray-500 mt-1">AI驱动的文章外链优化工具</p>
        </header>

        {/* ------------ main card ------------ */}
        <section className="p-7 pt-0 space-y-6">

          {!data ? (
            <>
              <textarea
                rows={10}
                className="w-full border rounded-md p-4 font-sans"
                placeholder="Paste English paragraph…"
                value={raw}
                onChange={e=>setRaw(e.target.value)}
              />
              <button
                onClick={analyze}
                disabled={loading}
                className="px-6 py-2 bg-black text-white font-bold rounded
                           hover:bg-gray-800 disabled:opacity-40"
              >
                {loading?'Analyzing…':'分析关键词'}
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500">
                绿色块可添加外链；选后变蓝，可再次点击修改或移除。
              </p>

              <div
                className="prose max-w-none border rounded-md p-5 leading-7"
                dangerouslySetInnerHTML={{__html:html}}
                onClick={onClickEditor}
              />

              <div className="flex justify-end">
                <button
                  onClick={copyHtml}
                  className="inline-flex gap-2 items-center bg-black text-white font-bold
                             px-6 py-2 rounded hover:bg-gray-800"
                >
                  <FiCopy/>{copied?'已复制':'复制 HTML'}
                </button>
              </div>
            </>
          )}
        </section>
      </article>

      {/* ------------ popover ------------ */}
      {active && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white border rounded-xl shadow-lg overflow-hidden"
        >
          {data.keywords.find(k=>k.keyword===active).options.map((o,i)=>(
            <button key={i}
              onClick={()=>chooseLink(active,o)}
              className="block w-full text-left p-4 hover:bg-gray-50 border-b last:border-0"
            >
              <p className="font-medium line-clamp-1">{o.title||o.url}</p>
              <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
            </button>
          ))}

          {/* 移除 */}
          <button
            onClick={()=>removeLink(active)}
            className="block w-full text-center text-brand font-bold py-3"
          >
            ✕ 移除外链
          </button>
        </div>
      )}
    </main>
  );
}
