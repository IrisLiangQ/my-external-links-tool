import { useState, useMemo } from 'react';
import axios from 'axios';

export default function Tool() {
  const [text, setText] = useState('');
  const [keywords, setKeywords] = useState([]);
  const [selected, setSelected] = useState(new Set());
  const [links, setLinks] = useState({});
  const [chosen, setChosen] = useState({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState('');

  const previewHTML = useMemo(() => {
    if (!keywords.length) return text.replace(/\n/g, '<br/>');
    let html = text;
    keywords.forEach(({ keyword }) => {
      const reg = new RegExp(keyword, 'gi');
      html = html.replace(reg, match => {
        const picked = selected.has(keyword);
        const bg = picked ? '#fb923c' : '#fde047';
        const fg = picked ? '#ffffff' : '#000000';
        return `<mark data-kw="${keyword}" style="background:${bg};color:${fg};cursor:pointer;">${match}</mark>`;
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
    if (!selected.size) { setMsg('请至少点击一个关键词'); return; }
    setLoading(true); setMsg('');
    try {
      const tasks = Array.from(selected).map(async kw => {
        const query = keywords.find(k => k.keyword === kw).query;
        const { data } = await axios.post('/api/search', { query });
        return [kw, data.results.slice(0, 3)];
      });
      const obj = Object.fromEntries(await Promise.all(tasks));
      setLinks(obj);
      setChosen(Object.fromEntries(Object.entries(obj).map(([k,a])=>[k, a[0]?.link || ''])));
      setStep(3);
    } catch (e) {
      setMsg(e.response?.data?.error || e.message);
    } finally { setLoading(false); }
  }

  function handleClick(e) {
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

  return (
    <main className="max-w-6xl mx-auto p-6 space-y-5" onClick={step===2?handleClick:undefined}>
      <h1 className="text-2xl font-bold mb-2">AI 外链优化工具</h1>
      {msg && <p className="text-red-600">{msg}</p>}

      {step===1 && (
        <>
          <textarea className="w-full border p-3 h-80" value={text} placeholder="粘贴英文文章" onChange={e=>setText(e.target.value)} />
          <button className="mt-3 bg-blue-600 text-white px-4 py-2 rounded" onClick={analyze} disabled={loading}>
            {loading?'分析中…':'分析关键词'}
          </button>
        </>
      )}

      {step===2 && (
        <div className="space-y-4">
          <div className="border p-3 h-72 overflow-auto whitespace-pre-wrap rounded" dangerouslySetInnerHTML={{__html:previewHTML}} />
          <p className="text-sm text-gray-600">点击黄色关键词选中（变橙色）。</p>
          <button className="bg-green-600 text-white px-4 py-2 rounded" onClick={confirmKW} disabled={loading}>
            {loading?'处理中…':'确认选择并生成外链'}
          </button>
        </div>
      )}

      {step===3 && (
        <div className="space-y-6">
          {Object.entries(links).map(([kw,list])=>(
            <div key={kw} className="border rounded p-4 space-y-2">
              <p className="font-semibold">{kw}</p>
              {list.length===0? <p className="text-red-600 text-sm">未找到外链</p>:
                list.map(item=>(
                  <label key={item.link} className="flex items-start space-x-2">
                    <input type="radio" name={`link-${kw}`} value={item.link} checked={chosen[kw]===item.link} onChange={()=>setChosen({...chosen,[kw]:item.link})} />
                    <div>
                      <p className="font-medium text-blue-700 underline truncate max-w-xl" title={item.title}>{item.title}</p>
                      <p className="text-sm text-gray-600 truncate max-w-xl" title={item.snippet}>{item.snippet}</p>
                    </div>
                  </label>
                ))
              }
            </div>
          ))}
          <textarea readOnly className="w-full border p-3 h-52" value={markdown} />
          <button className="bg-purple-600 text-white px-4 py-2 rounded" onClick={()=>{navigator.clipboard.writeText(markdown);alert('已复制 Markdown')}}>
            复制 Markdown
          </button>
        </div>
      )}
    </main>
  );
}
