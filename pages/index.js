import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

/* ---------- Utils ---------- */
const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** 用内联 style 高亮（绿色） */
function highlight(original, kwArr) {
  const sorted = [...kwArr].sort((a, b) => b.length - a.length);
  let html = original.replace(/(<[^>]+>)/g, '\u0000$1\u0000');
  let parts = html.split('\u0000');

  const greenStyle = 'background:#ecfdf5;color:#065f46;'
    + 'border:1px solid #bbf7d0;padding:0 2px;border-radius:4px;cursor:pointer';

  sorted.forEach(k => {
    const pat = esc(k).replace(/\s+/g, '\\s+');
    const re  = new RegExp(pat, 'gi');
    parts = parts.map(p=>{
      if (p.startsWith('<')) return p;
      if (p.includes(`data-kw="${k}"`)) return p;
      return p.replace(re, m => `<span data-kw="${k}" style="${greenStyle}">${m}</span>`);
    });
  });
  return parts.join('');
}

export default function Home(){
  const [raw,setRaw]         = useState("");
  const [data,setData]       = useState(null);
  const [html,setHtml]       = useState("");
  const [active,setActive]   = useState(null);
  const [loading,setLoading] = useState(false);
  const [pickedCnt,setCnt]   = useState(0);
  const [copied,setCopied]   = useState(false);

  const popRef = useRef(null);

  /* -------------- /api/ai ---------------- */
  async function analyze(){
    if(!raw.trim()) return alert("请先粘贴英文段落！");
    setLoading(true);
    const r = await fetch("/api/ai",{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify({text:raw})});
    if(!r.ok){alert("AI 分析失败");setLoading(false);return;}
    const j = await r.json();
    const kwArr = j.keywords.map(k=>typeof k==='string'?k:(k.keyword||k.kw||k.phrase)).filter(Boolean);
    setData({...j,kwArr});
    setCnt(0);setCopied(false);
    setHtml(highlight(j.original,kwArr));
    setLoading(false);
  }

  /* -------------- 点击关键词 -------------- */
  function onClickEditor(e){
    const span = e.target.closest("span[data-kw]");
    if(!span) return;
    const kw = span.dataset.kw;
    setActive(prev=>prev===kw?null:kw);
    if(popRef.current){
      const rc = span.getBoundingClientRect();
      popRef.current.style.top  = `${rc.bottom+window.scrollY+6}px`;
      popRef.current.style.left = `${rc.left+rc.width/2+window.scrollX}px`;
      popRef.current.style.transform='translateX(-50%)';
    }
  }

  /* -------------- 选 / 移除 -------------- */
  async function choose(kw,opt){
    /* --- 移除 --- */
    if(!opt){
      const green = `style="background:#ecfdf5;color:#065f46;border:1px solid #bbf7d0;
                     padding:0 2px;border-radius:4px;cursor:pointer"`;
      const reg = new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?</span>`,'gi');
      setHtml(p=>p.replace(reg, `<span data-kw="${kw}" ${green}>${kw}</span>`));
      setCnt(c=>Math.max(0,c-1)); setActive(null); return;
    }

    /* --- reason --- */
    let reason="";
    try{
      const r = await fetch("/api/reason",{method:"POST",headers:{'Content-Type':'application/json'},body:JSON.stringify({url:opt.url,phrase:kw})});
      if(r.ok) reason=(await r.json()).reason;
    }catch{}
    if(!reason) reason="authoritative source";

    const blueStyle='background:#dbeafe;color:#1e3a8a;border:1px solid #bfdbfe;'
      +'padding:0 2px;border-radius:4px;cursor:pointer';

    const blue = `<span data-kw="${kw}" style="${blueStyle}">
      <a href="${opt.url}" target="_blank" rel="noopener" style="text-decoration:underline">${kw}</a>
      ((${reason}))
    </span>`;

    const regSel=new RegExp(`<span[^>]*data-kw="${kw}"[^>]*>.*?</span>`,'gi');
    setHtml(p=>{
      const picked=/style="[^"]*#dbeafe/.test(p.match(regSel)?.[0]||"");
      if(!picked) setCnt(c=>c+1);
      return p.replace(regSel,blue);
    });
    setActive(null);
  }

  /* -------------- 复制 -------------- */
  function copy(){
    const out=html
      .replace(/<span[^>]*data-kw="[^"]+"[^>]*>(.*?)<\/span>/g,'$1');
    navigator.clipboard.writeText(out);
    setCopied(true);setTimeout(()=>setCopied(false),2e3);
  }

  /* -------------- 渲染 -------------- */
  return(
    <div className="min-h-screen flex flex-col items-center py-10 px-4">
      <h1 className="text-2xl font-bold mb-4 flex items-center gap-2"><span className="text-orange-500">⚡</span> 外链优化</h1>

      <div className="w-full max-w-4xl border rounded-xl p-6 space-y-6">
        {!data?(
          <>
            <textarea rows={8} className="w-full border rounded p-3" value={raw} onChange={e=>setRaw(e.target.value)}
              placeholder="Paste English paragraph…"/>
            <button onClick={analyze} disabled={loading}
              className="px-6 py-2 rounded text-white"
              style={{background:loading?'#94a3b8':'#2563eb'}}>
              {loading?'Analyzing…':'分析关键词'}
            </button>
          </>
        ):(
          <>
            <p className="text-sm text-gray-600">绿色块可添加外链；选后变蓝，可再次点击修改或移除。</p>
            <div className="prose max-w-none border rounded p-4" dangerouslySetInnerHTML={{__html:html}}
              onClick={onClickEditor}/>

            <div className="text-right">
              <button onClick={copy} disabled={pickedCnt===0}
                className="px-6 py-2 rounded text-white inline-flex items-center gap-2"
                style={{background:pickedCnt===0?'#94a3b8':'#000'}}>
                <FiCopy/>{copied?'Copied!':'确认选择'}
              </button>
            </div>
          </>
        )}
      </div>

      {/* 弹窗 */}
      {active&&(
        <div ref={popRef} style={{position:'fixed',zIndex:50,width:380,
             background:'#fff',borderRadius:12,boxShadow:'0 4px 12px rgba(0,0,0,.1)',
             border:'1px solid #e5e7eb',overflow:'hidden'}}>
          {data.keywords.find(k=>(k.keyword||k.kw||k.phrase)===active)?.options.map((o,i)=>(
            <button key={i} onClick={()=>choose(active,o)} style={{display:'block',width:'100%',textAlign:'left',
              padding:'12px 16px',borderBottom:'1px solid #f3f4f6'}} >
              <p style={{fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.title||o.url}</p>
              <p style={{fontSize:12,color:'#6b7280',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{o.url}</p>
            </button>
          ))}
          <button onClick={()=>choose(active,null)}
            style={{display:'block',width:'100%',padding:'10px',fontSize:14,color:'#dc2626'}}>✕ 移除外链</button>
        </div>
      )}
    </div>
  );
}
