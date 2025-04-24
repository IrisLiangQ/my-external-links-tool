// pages/index.js – improved Step‑3 result cards & clean Markdown preview (2025‑04‑24)
import { useState, useMemo } from 'react';
import axios from 'axios';

export default function Tool() {
  /* ---------- state ---------- */
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [links, setLinks] = useState({});
  const [chosen, setChosen] = useState({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  /* ---------- helpers ---------- */
  const previewHTML = useMemo(() => {
    if (!keywords.length) return text.replace(/\n/g, '<br/>');
    let html = text;
    keywords.forEach(({ keyword }) => {
      const reg = new RegExp(keyword, 'gi');
      html = html.replace(reg, m => {
        const picked = selected.has(keyword);
        const bg = picked ? '#fb923c' : '#fde047';
        const fg = picked ? '#fff' : '#000';
        return `<mark data-kw="${keyword}" style="background:${bg};color:${fg};cursor:pointer;">${m}</mark>`;
      });
    });
    return html.replace(/\n/g, '<br/>');
  }, [text, keywords, selected]);

  const markdown = useMemo(() => {
    if (step !== 3) return '';
    let md = text;
    Object.entries(chosen).forEach(([kw, link]) => {
      md = md.replace(new RegExp(kw, 'i'), `[${kw}](${link})`);
    });
    return md;
  }, [step, text, chosen]);

  /* ---------- API ---------- */
  async function analyze() {
    if (!text.trim()) return;
    setLoading(true); setMsg('');
    try {
      const { data } = await axios.post('/api/ai', { text });
      setKeywords(data.keywords || []);
      setSelected(new Set());
      setStep(2);
    } catch (e) {
      setMsg(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }

  async function confirmKW() {
    if (!selected.size) { setMsg('请先点击关键词'); return; }
    setLoading(true); setMsg('');
    try {
      const tasks = Array.from(selected).map(async kw => {
        const query = keywords.find(k => k.keyword === kw).query;
        const { data } = await axios.post('/api/search', { query });
        return [kw, data.results.slice(0, 3)];
      });
      const obj = Object.fromEntries(await Promise.all(tasks));
      setLinks(obj);
      setChosen(Object.fromEntries(Object.entries(obj).map(([k,a]) => [k, a[0]?.link || ''])));
      setStep(3);
    } catch (e) {
      setMsg(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }

  /* ---------- click highlight ---------- */
  function handleHighlight(e) {
    let el = e.target;
    if (el.nodeType !== 1) el = el.parentElement;
    const mark = el && el.closest('mark[data-kw]');
    if (!mark) return;
    const kw = mark.dataset.kw;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(kw) ? next.delete(kw) : next.add(kw);
      return new Set(next);
    });
  }

  /* ---------- UI ---------- */
  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6" onClick={step===2?handleHighlight:undefined}>
      <h1 className="text-2xl font-bold">AI 外链优化工具</h1>
      {msg && <p className="text-red-600">{msg}</p>}

      {step===1 && (
        <>
          <textarea className="w-full border p-3 h-72" placeholder="粘贴英文文章" value={text} onChange={e=>setText(e.target.value)} />
          <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded" disabled={loading} onClick={analyze}>{loading?'分析中…':'分析关键词'}</button>
        </>
      )}

      {step===2 && (
        <div className="space-y-4">
          <div className="border p-3 h-72 overflow-auto whitespace-pre-wrap rounded" dangerouslySetInnerHTML={{__html:previewHTML}} />
          <button className="bg-green-600 text-white px-4 py-2 rounded" disabled={loading} onClick={confirmKW}>{loading?'处理中…':'确认选择并生成外链'}</button>
        </div>
      )}

      {step===3 && (
        <div className="space-y-8">
          {Object.entries(links).map(([kw, list]) => (
            <section key={kw} className="border rounded-lg p-4 space-y-3">
              <h2 className="font-semibold text-orange-700">{kw}</h2>
              {list.length === 0 ? (
                <p className="text-sm text-red-600">(无可用外链)</p>
              ) : (
                list.map(item => (
                  <label key={item.link} className="flex items-start gap-2 p-2 rounded-lg border hover:bg-gray-50 cursor-pointer"
                         style={{borderColor: chosen[kw]===item.link ? '#fb923c' : 'transparent'}}>  
                    <input type="radio" name={`link-${kw}`} value={item.link} checked={chosen[kw]===item.link} onChange={()=>setChosen({...chosen,[kw]:item.link})} />
                    <div className="space-y-0.5">
                      <a href={item.link} target="_blank" rel="noreferrer" className="text-blue-700 underline font-medium">{item.title}</a>
                      <p className="text-xs text-gray-600 max-w-xl truncate" title={item.snippet}>{item.snippet}</p>
                    </div>
                  </label>
                ))
              )}
            </section>
          ))}

          <section className="space-y-2">
            <h2 className="font-semibold">Markdown 预览</h2>
            <textarea readOnly className="w-full border p-3 h-48" value={markdown} />
            <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={()=>{navigator.clipboard.writeText(markdown);alert('已复制 Markdown')}}>
              复制 Markdown
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
