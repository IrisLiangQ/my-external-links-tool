/**
 * /api/search  —— 返回最贴合语境、且高权威的 3 条外链
 */

import { WHITELIST, BLACKLIST, BRAND_PRIORITY } from '../../config/domainQuality';
import { getDomain }      from 'tldts';
import nlp                from 'compromise';        // ★ 新增：NLP 抽名词短语

/* ---------- 根据关键词所在句子生成「关键词 + 语境词」搜索串 ---------- */
function buildContextQuery(kw, fullText) {
  // 取关键词所在句子，再向前后各取一句，组成 3 句上下文
  const sents = fullText.split(/(?<=[.!?])\s+/);
  const idx   = sents.findIndex(s => s.toLowerCase().includes(kw.toLowerCase()));
  const ctxRaw = [sents[idx - 1] || '', sents[idx] || '', sents[idx + 1] || ''].join(' ');

  // NLP 抽名词短语
  const nounPhrases = nlp(ctxRaw).nouns().out('array').map(w => w.toLowerCase());

  // 去重 + 过滤 stop-words + 排除关键词本身
  const uniq = [...new Set(nounPhrases)]
    .filter(w =>
      w.length > 3 &&
      !['the','and','with','that','from','your','have','will','this','more','such','where','any','other'].includes(w) &&
      !kw.toLowerCase().includes(w)
    )
    .slice(0, 3);                        // 取前 3 个

  return `${kw} ${uniq.join(' ')}`.trim();
}

/* ---------- OpenAI Embedding ---------- */
async function getEmbedding(text) {
  const r = await fetch('https://api.openai.com/v1/embeddings', {
    method : 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization : `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!r.ok) return [];
  const j = await r.json();
  return j.data?.[0]?.embedding || [];
}

/* ---------- 余弦相似度 ---------- */
function cosineSim(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const dot  = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB + 1e-9);
}

/* ================= 主处理函数 ================= */
export default async function handler(req, res) {
  const { kw, text = '' } = req.body || {};
  if (!kw) return res.status(400).json({ error: 'kw required' });

  /* ---------- 1. 生成查询串 & 调 Serper ---------- */
  const exclude = BLACKLIST.map(d => `-site:${d}`).join(' ');
  const qBase   = buildContextQuery(kw, text);           // 关键词 + 语境词
  const q       = `${qBase} ${exclude}`;
  const sr      = await fetch('https://serper.p.rapidapi.com/search', {
    method : 'POST',
    headers: { 'content-type':'application/json', 'X-RapidAPI-Key': process.env.SERPER_KEY },
    body   : JSON.stringify({ q, gl:'us', hl:'en' }),
  });
  if (!sr.ok) return res.status(500).json({ error:'Serper search failed' });
  const serper = await sr.json();
  if (!serper.organic?.length) return res.status(200).json({ links: [] });

  /* ---------- 2. 文章整体 embedding ---------- */
  const baseEmb = await getEmbedding(`${kw} ${text}`.slice(0, 6000));
  const mustWord = kw.split(' ')[0].toLowerCase();              // 关键词首词
  const ctxFirst = qBase.split(' ').slice(-1)[0]?.toLowerCase() || ''; // 最后一个语境词

  /* ---------- 3. 逐条结果打分 ---------- */
  const scored = await Promise.all(
    serper.organic.slice(0, 12).map(async (item, idx) => {
      const domain  = getDomain(item.link) || '';
      const titleLc = item.title.toLowerCase();
      let   score   = 100 - idx;                                // 基础：Google 顺序

      /* 权威域名 */
      if (domain.endsWith('.gov') || domain.endsWith('.edu')) score += 60;
      else if (domain.endsWith('.org')) score += 40;

      /* Domain Authority（可选）*/
      if (process.env.OPENPAGERANK_KEY) {
        try {
          const daResp = await fetch(
            `https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${domain}`,
            { headers: { 'API-OPR': process.env.OPENPAGERANK_KEY } }
          ).then(r => r.json());
          const da = daResp.response?.[0]?.page_rank_integer || 0;
          score += (da / 100) * 50;                             // 0-50
        } catch {}
      }

      /* 品牌专属域名 */
      if
