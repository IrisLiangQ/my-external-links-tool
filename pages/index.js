// pages/index.js
import { useState, useRef, useEffect } from 'react';
import { FiCopy, FiLink } from 'react-icons/fi';

export default function Home() {
  /* ---- state ---- */
  const [raw,  setRaw]  = useState('');
  const [data, setData] = useState(null);            // { original, keywords:[{keyword, options}] }
  const [html, setHtml] = useState('');
  const [activeKw, setActiveKw] = useState(null);    // 当前弹窗关键词
  const [loading, setLoading]  = useState(false);
  const [copied,  setCopied]   = useState(false);

  /* 文章级：额外语境与显示开关 */
  const [extraInput, setExtraInput] = useState('');
  const [showExtra, setShowExtra]   = useState(false);

  /* refs */
  const linkedMap      = useRef(new Map());          // kw → 首个已插入外链 span
  const keywordCounter = useRef({});                 // kw → 出现序号
  const popupRef       = useRef(null);
  const extraRef       = useRef(null);               // Extra input 聚焦用

  /* ---- esc 关闭 extraInput ---- */
  useEffect(() => {
    function onEsc(e){ if (e.key === 'Escape') setShowExtra(false); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  /* ---- /api/ai ---- */
  async function analyze() {
    if (!raw.trim()) { alert('请先粘贴英文段落！'); return; }

    setLoading(true); setData(null); keywordCounter.current = {};
    const r = await fetch('/api/ai', {
      method : 'POST',
      headers: { 'Content-Type':'application/json' },
      body   : JSON.stringify({ text: raw })
    });
    setLoading(false);
    if (!r.ok) { alert('服务器分析失败'); return; }

    const j = await r.json();
    setData(j); linkedMap.current.clear();

    /* 高亮：先长后短避免嵌套 */
    let body = j.original;
    j.keywords.sort((a,b)=>b.keyword.length-a.keyword.length).forEach(({keyword})=>{
      const kw  = keyword.trim();
      const pos = keywordCounter.current[kw] ?? 0;
      keywordCounter.current[kw] = pos + 1;
      body = body.replace(
        new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\$&')}\\b`,'i'),
        `<span data-kw="${kw}" data-pos="${pos}"
          class="kw bg-kwBg text-kwFg px-1 rounded cursor-pointer hover:bg-kwFg/10">
          ${kw}<sup class="caret ml-0.5">▾</sup></span>`
      );
    });
    setHtml(body);
  }

  /* ---- 编辑器点击 ---- */
  function onClickEditor(e){
    const span = e.target.closest('span.kw,span.picked');
    if(!span) return;
    const kw = span.dataset.kw;
    if(linkedMap.current.has(kw) && span!==linkedMap.current.get(kw)) return;
    setActiveKw(activeKw===kw?null:kw);

    if(popupRef.current){
      const rc = span.getBoundingClientRect();
      popupRef.current.style.top  = `${rc.bottom+window.scrollY+6}px`;
      popupRef.current.style.left = `${rc.left+rc.width/2+window.scrollX}px`;
      popupRef.current.style.transform='translateX(-50%)';
    }
  }

  /* ---- 选 / 移除 链接 ---- */
  async function chooseLink(kw,opt){
    const span = linkedMap.current.get(kw) ||
      document.querySelector(`span[data-kw="${CSS.escape(kw)}"][data-pos="0"]`);
    if(!span) return;

    const sentence = span.closest('p')?.innerText || '';
    const extra = extraInput.split(/[,\s]+/).filter(Boolean);
    let reason='';
    try{
      const r = await fetch('/api/reason',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({url:opt.url,phrase:kw,sentence,extra})
      });
      if(r.ok) reason=(await r.json()).reason;
    }catch{}
    if(!reason) reason='relevant reference';

    span.className='picked underline text-blue-800';
    span.innerHTML=`<a href="${opt.url}" target="_blank" rel="noopener">${kw}</a> ((${reason}))`;
    linkedMap.current.set(kw,span);
    setActiveKw(null);
  }
  function removeLink(kw){
    const span=linkedMap.current.get(kw);
    if(!span) return;
    span.className='kw bg-kwBg text-kwFg px-1 rounded cursor-pointer hover:bg-kwFg/10';
    span.innerHTML=`${kw}<sup class="caret ml-0.5">▾</sup>`;
    linkedMap.current.delete(kw); setActiveKw(null);
  }

  /* ---- 复制 HTML ---- */
  function copyHtml(){
    let final=html
      .replace(/<span[^>]*>([\s\S]*?)<\/span>/gi,'$1')
      .replace(/<sup[^>]*>[\s\S]*?<\/sup>/gi,'')
      .replace(/\s+\)/g,')');
    navigator.clipboard.writeText(final);
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  }

  /* ================= UI ================= */
  return (
    <div className="min-h-screen flex flex-col items-center py-8 px-4 bg-gray-50 font-sans">
      {/* extraInput：浮层，默认隐藏 */}
      {showExtra && (
        <div
          className="fixed inset-0 bg-black/20 flex items-start justify-center pt-14 z-50"
          onClick={()=>setShowExtra(false)}
        >
          <input
            ref={extraRef}
            onClick={e=>e.stopPropagation()}
            type="text"
            value={extraInput}
            onChange={e=>setExtraInput(e.target.value)}
            placeholder="Extra context (e.g. EV, charger)"
            className="w-96 bg-white border px-4 py-2 rounded shadow focus:outline-brand"
          />
        </div>
      )}

      <header className="text-center mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <span className="text-brand">⚡</span> 外链优化
        </h1>
        <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
      </header>

      <div className="w-full max-w-screen cardBg shadow rounded-2xl p-8 space-y-6">
        {!data ? (
          <>
            <textarea rows={10} className="w-full border rounded-md p-4 focus:outline-brand"
              placeholder="Paste English paragraph…" value={raw}
              onChange={e=>setRaw(e.target.value)} />
            <button onClick={analyze} disabled={loading}
              className="px-6 py-2 rounded bg-black text-white hover:bg-gray-800 disabled:opacity-60 flex items-center gap-2">
              <FiLink/>{loading?'Analyzing…':'Analyze Keywords'}
            </button>
          </>
        ) : (
          <>
            <h2 className="font-semibold text-lg">文本编辑器</h2>
            <p className="text-xs text-gray-500 mb-2">绿色块可添加外链；选后变蓝，可再次点击修改或移除。</p>
            <div dangerouslySetInnerHTML={{__html:html}}
              className="prose max-w-none border rounded-md p-4 leading-7"
              onClick={onClickEditor}/>
            <div className="text-right">
              <button onClick={copyHtml}
                className="inline-flex items-center gap-2 px-6 py-2 rounded bg-black text-white hover:bg-gray-800">
                <FiCopy/>{copied?'Copied!':'复制 HTML'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 改进推荐按钮 */}
      {data && (
        <button
          onClick={()=>{ setShowExtra(true); setTimeout(()=>extraRef.current?.focus(),50); }}
          className="fixed bottom-8 right-8 bg-blue-600 text-white px-4 py-2 rounded-full shadow hover:bg-blue-500 z-40">
          ✎ 改进推荐
        </button>
      )}

      {/* 关键词弹窗 */}
      {activeKw && data && (
        <div ref={popupRef}
          className="fixed z-50 w-96 bg-white shadow-lg rounded-xl border animate-fadeIn">
          {data.keywords.find(k=>k.keyword===activeKw)?.options.map((o,i)=>(
            <button key={i} onClick={()=>chooseLink(activeKw,o)}
              className="flex flex-col items-start text-left gap-0.5 px-4 py-3 min-h-[64px] hover:bg-gray-50 border-b last:border-0">
              <p className="text-sm font-medium truncate w-full">{o.title||o.url}</p>
              <p className="text-xs text-gray-600 truncate w-full">{o.url}</p>
            </button>
          ))}
          {linkedMap.current.has(activeKw)&&(
            <button onClick={()=>removeLink(activeKw)}
              className="w-full text-red-600 py-3 text-center hover:bg-red-50 rounded-b-xl">
              ✕ 移除外链
            </button>
          )}
        </div>
      )}
    </div>
  );
}
