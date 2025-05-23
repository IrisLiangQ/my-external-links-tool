import { BLACKLIST, BRAND_PRIORITY } from '../../config/domainQuality';
import { getDomain } from 'tldts';
import nlp from 'compromise';

/* ========== GPT 行业分类 ========== */
async function getIndustry(sentence='') {
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method:'POST',
    headers:{'Content-Type':'application/json',Authorization:`Bearer ${process.env.OPENAI_API_KEY}`},
    body:JSON.stringify({
      model:'gpt-3.5-turbo-0125',
      temperature:0,
      max_tokens:10,
      messages:[
        {role:'system',content:'Return ONE lowercase industry label: automotive, medical, finance, education, tech, food, other.'},
        {role:'user',content:sentence.slice(0,120)}
      ]
    })
  }).then(r=>r.json()).catch(()=>null);
  return resp?.choices?.[0]?.message?.content?.trim() || 'other';
}
/* 预置“行业关键词库” */
const INDUSTRY_TERMS={
  automotive:['ev','charger','vehicle','plug','sae','j1772'],
  medical:['diabetes','insulin','clinic','symptom','disease'],
  finance:['stock','market','revenue','profit'],
  tech:['ai','software','cloud','app'],
  education:['student','university','curriculum'],
  food:['recipe','calorie','restaurant']
};
/* ---------------------------------- */

function buildContextQuery(kw, fullText, extra=[]) {
  const sents=fullText.split(/(?<=[.!?])\\s+/);
  const idx=sents.findIndex(s=>s.toLowerCase().includes(kw.toLowerCase()));
  const ctxRaw=[sents[idx-1]||'',sents[idx]||'',sents[idx+1]||''].join(' ');
  const nounPhrases=nlp(ctxRaw).nouns().out('array').map(w=>w.toLowerCase());
  const ctxWords=[...new Set([...nounPhrases,...extra.map(e=>e.toLowerCase())])].filter(w=>w.length>3&&!kw.toLowerCase().includes(w)).slice(0,3);
  return {q:`${kw} ${ctxWords.join(' ')}`.trim(),ctxWords,sentence:sents[idx]||kw};
}

function includesAny(str,arr){return arr.some(w=>str.includes(w));}
async function getEmbedding(text){/* 与原来一致 */};
function cosineSim(a,b){/* 与原来一致 */};

export default async function handler(req,res){
  const {kw,text='',extra=[]}=req.body||{};
  if(!kw) return res.status(400).json({error:'kw required'});

  /* 1️⃣ 语境 + 行业词 */
  const {q:qBase,ctxWords,sentence}=buildContextQuery(kw,text,extra);
  const industry=await getIndustry(sentence);
  const industryTerms=INDUSTRY_TERMS[industry]||[];
  const allCtx=[...ctxWords,...industryTerms];

  /* 2️⃣ 调 Serper */
  const exclude=BLACKLIST.map(d=>`-site:${d}`).join(' ');
  const q=`${qBase} ${exclude}`;
  /* fetch Serper 逻辑同之前 */

  /* 3️⃣ 打分里改过滤行 */
  // let titleLc = item.title.toLowerCase();
  // if (sim < 0.2 || !titleLc.includes(mustWord) || !includesAny(titleLc, allCtx)) score=0;

  /* 其余逻辑保持不变 */
}
