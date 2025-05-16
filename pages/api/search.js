/**
 * /api/search
 * 输入：{ kw: string, text?: string }
 * 输出：{ links: [ { title, url } ] }   // 最多 3 条
 *
 * 工作流程：
 * 1. 利用关键词所在句子，拼接 ≤3 个高频语境词，生成更精准的 Google 查询
 * 2. 调 Serper 获取搜索结果
 * 3. 对每条结果：
 *    - 权威域名加分（.gov/.edu/.org + Domain Authority）
 *    - 品牌域名（config/domainQuality.js）加分
 *    - 用 OpenAI embedding 计算“文章上下文 ↔ 结果标题”相似度再加分
 * 4. 同域名只保留最高分，排序取前 3 返回
 */

import { WHITELIST, BLACKLIST, BRAND_PRIORITY } from '../../config/domainQuality';
import { getDomain } from 'tldts';

/* ---------- 根据关键词所在句子，生成带语境词的搜索串 ---------- */
function buildContextQuery(kw, fullText) {
  // 1) 找到包含 kw 的那一句
  const sent = fullText.split(/(?<=[.!?])\s+/)
    .find(s => s.toLowerCase().includes(kw.toLowerCase())) || '';

  // 2) 简单清洗 + 取高频词
  const words = sent
    .replace(/[^a-zA-Z\s]/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w =>
      w.length > 3 &&
      !['the','and','with','that','from','your','have','will','this','more','such'].includes(w) &&
      !kw.toLowerCase().includes(w)
    );

  const freq = {};
  words.forEach(w => (freq[w] = (freq[w] || 0) + 1));

  const ctx = Object.entries(freq)
    .sort((a,b) => b[1]-a[1])
    .slice(0,3)
    .map(([w]) => w)
    .join(' ');

  return `${kw} ${ctx}`.trim();
}

// =============== 主入口 ===============
export default async function handler(req, res) {
  const { kw, text = '' } = req.body || {};
  if (!kw) return res.status(400).json({ error: 'kw required' });

  /* ---------- 1. 调 Serper ---------- */
  const exclude = BLACKLIST.map(d => `-site:${d}`).join(' ');
  const qBase   = buildContextQuery(kw, text);           // ✨ 语境词！
  const q       = `${qBase} ${exclude}`;
  const serperRes = await fetch('https://serper.p.rapidapi.com/search', {
    method : 'POST',
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': process.env.SERPER_KEY,
    },
    body: JSON.stringify({ q, gl: 'us', hl: 'en' }),
  });

  if (!serperRes.ok) return res.status(500).json({ error: 'Serper search failed' });
  const serper = await serperRes.json();
  if (!serper.organic?.length) return res.status(200).json({ links: [] });

  /* ---------- 2. 文章 embedding ---------- */
  const baseEmb = await getEmbedding(`${kw} ${text}`.slice(0, 6000));

  /* ---------- 3. 搜索结果打分 ---------- */
  const scored = await Promise.all(
    serper.organic.slice(0, 10).map(async (item, idx) => {
      const domain  = getDomain(item.link) || '';
      const kwLower = kw.toLowerCase();
      let   score   = 100 - idx;                      // 基础：原始顺序

      // a) 权威 TLD
      if (domain.endsWith('.gov') || domain.endsWith('.edu')) score += 60;
      else if (domain.endsWith('.org')) score += 40;

      // b) Domain Authority
      if (process.env.OPENPAGERANK_KEY) {
        try {
          const daResp = await fetch(
            `https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${domain}`,
            { headers: { 'API-OPR': process.env.OPENPAGERANK_KEY } }
          ).then(r => r.json());
          const da = daResp.response?.[0]?.page_rank_integer || 0;
          score += (da / 100) * 50;
        } catch {/* ignore */}
      }

      // c) 品牌域名
      if (BRAND_PRIORITY[kwLower]?.includes(domain)) score += 80;

      // d) 语义相似度
      const sim = await cosineSim(baseEmb, await getEmbedding(item.title));
      score += sim * 80;

      return { title: item.title, url: item.link, domain, score };
    })
  );

  /* ---------- 4. 同域去重 & 取前 3 ---------- */
  const uniq = Array.from(
    scored.reduce((m, r) => {
      if (!m.has(r.domain) || r.score > m.get(r.domain).score) m.set(r.domain, r);
      return m;
    }, new Map()).values()
  )
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return res.status(200).json({ links: uniq });
}

/* ---------- Utils ---------- */
async function getEmbedding(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method : 'POST',
    headers: {
      'Content-Type' : 'application/json',
      Authorization  : `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: 'text-embedding-3-small', input: text }),
  });
  if (!resp.ok) return [];
  const j = await resp.json();
  return j.data?.[0]?.embedding || [];
}

function cosineSim(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const dot  = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB + 1e-9);
}
