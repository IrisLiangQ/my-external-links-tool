// pages/index.js – hover Popover showing 3 links, click = select (2025‑04‑24)
import { useState, useMemo, useRef } from 'react';
import axios from 'axios';

export default function Tool() {
  /* ───────── state ───────── */
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);          // [{keyword,query,reason}]
  const [selected, setSelected] = useState(new Set());   // Set<string>
  const [linksCache, setLinksCache] = useState({});      // { kw: [ {title,link,snippet} ] }
  const [step, setStep] = useState(1);                   // 1 edit | 2 choose | 3 pick link
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  /* popover */
  const [tip, setTip] = useState({ show:false, kw:'', x:0, y:0 });

  /* ───────── highlighter ───────── */
  const previewHTML = useMemo(() => {
    if (!keywords.length) return text.replace(/\n/g,'<br/>');
    let html = text;
    keywords.forEach(({keyword})=>{
      const reg = new RegExp(keyword,'gi');
      html = html.replace(reg, m=>{
        const picked = selected.has(keyword);
        const bg = picked? '#fb923c':'#fde047';
        const fg = picked? '#fff':'#000';
        return `<mark data-kw="${keyword}" style="background:${bg};color:${fg};cursor:pointer;">${m}</mark>`;
      });
    });
    return html.replace(/\n/g,'<br/>');
  }, [text, keywords, selected]);

  /* ───────── markdown ───────── */
  const markdown = useMemo(()=>{
    if(step!==3) return '';
    let md=text;
    Object.entries(linksCache).forEach(([kw,arr])=>{
      if(!arr.length) return;
      md = md.replace(new RegExp(kw,'i'),`[${kw}](${arr[0].link})`);
    });
    return md;
  },[step,text,linksCache]);

  /* ───────── api helpers ───────── */
  async function fetchLinks(kw){
    if(linksCache[kw]) return;            // 已缓存
    const query = keywords.find(k=>k.keyword===kw).query;
    try{
      const {data} = await axios.post('/api/search',{query});
      setLinksCache(prev=>({...prev,[kw]:data.results||[]}));
    }catch{ /* 忽略 */ }
  }

  /* ───────── handlers ───────── */
  function handleHighlightClick(e){
    let el = e.target;
    if(el.nodeType!==1) el = el.parentElement;
    const mark = el && el.closest('mark[data-kw]');
    if(!mark) return;
    const kw = mark.dataset.kw;
    setSelected(prev=>{
      const next=new Set(prev);
      next.has(kw)?next.delete(kw):next.add(kw);
      return new Set(next);
    });
  }

  function handleMouseOver(e){
    let el=e.target;
    if(el.nodeType!==1) el=el.parentElement;
    const mark=el && el.closest('mark[data-kw]');
    if(!mark) return;
    const kw=mark.dataset.kw;
    const rect=mark.getBoundingClientRect();
    setTip({show:true,kw,x:rect.right+4,y:rect.top+window.scrollY});
    fetchLinks(kw);
  }
  function hideTip(){ setTip(t=>({...t,show:false})); }

  /* ───────── actions ───────── */
  async function analyze(){
    if(!text.trim()) return;
    setLoading(true); setMsg('');
    try{
      const {data}=await axios.post('/api/ai',{text});
      setKeywords(data.keywords||[]);
      setSelected(new Set());
      setStep(2);
    }catch(e){setMsg(e.response?.data?.error||e.message);}finally{setLoading(false);} }

  /* ───────── render ───────── */
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">AI 外链优化工具</h1>
      {msg && <p className="text-red-600">{msg}</p>}

      {/* step 1 */}
      {step===1 && (
        <>
          <textarea className="w-full border p-3 h-72" placeholder="粘贴英文文章" value={text} onChange={e=>setText(e.target.value)} />
          <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded" disabled={loading} onClick={analyze}>{loading?'分析中…':'分析关键词'}</button>
        </>
      )}

      {/* step 2 */}
      {step===2 && (
        <div className="space-y-4">
          <div className="border p-3 h-72 overflow-auto whitespace-pre-wrap rounded"
               onClick={handleHighlightClick}
               onMouseOver={handleMouseOver}
               onMouseOut={hideTip}
               dangerouslySetInnerHTML={{__html:previewHTML}} />
          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={()=>setStep(3)} disabled={!selected.size}>确认选择</button>
        </div>
      )}

      {/* step 3 – 简化为第一条链接直接插入 */}
      {step===3 && (
        <div className="space-y-3">
          <textarea readOnly className="w-full border p-3 h-48" value={markdown} />
          <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={()=>{navigator.clipboard.writeText(markdown);alert('已复制')}}>复制 Markdown</button>
        </div>
      )}

      {/* popover */}
      {tip.show && (
        <div style={{top:tip.y,left:tip.x}} className="fixed z-50 w-72 bg-white border p-3 shadow-xl rounded">
          <p className="font-semibold mb-2">{tip.kw}</p>
          {(linksCache[tip.kw]||[]).length===0 ? (<p className="text-sm text-gray-500">加载中…</p>) : (
            <ul className="space-y-1 text-sm">
              {linksCache[tip.kw].map(it=> (
                <li key={it.link} className="truncate"><a href={it.link} target="_blank" className="text-blue-600 underline flex items-start gap-1"><svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 3h7v7m0-7L10 14m-4 4h7m-7 0v-7"/></svg>{it.title}</a></li>
              ))}
            </ul>) }
        </div>
      )}
    </main>
  );
}
