/**
 * /api/search
 * 输入：{ kw: string, text?: string }
 * 输出：{ links: [ { title, url } ] }   // 最多 3 条
 *
 * 工作流程：
 * 1. 调 Serper 获取 Google 搜索结果
 * 2. 对每条结果：
 *    - 权威域名加分（.gov/.edu/.org + Domain Authority）
 *    - 品牌域名（可在 config/domainQuality.js 里配置）加分
 *    - 用 OpenAI embedding 计算“文章上下文 ↔ 网页标题”相似度再加分
 * 3. 同域名保留最高分，按得分排序，取前 3 返回
 */

import { WHITELIST, BLACKLIST, BRAND_PRIORITY } from '../../config/domainQuality';
import { getDomain } from 'tldts';

// =============== 主入口 ===============
export default async function handler(req, res) {
  const { kw, text = '' } = req.body || {};
  if (!kw) return res.status(400).json({ error: 'kw required' });

  /* ---------- 1. 调 Serper ---------- */
  const exclude = BLACKLIST.map((d) => `-site:${d}`).join(' ');
  const q = `${kw} ${exclude}`;
  const serperRes = await fetch('https://serper.p.rapidapi.com/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'X-RapidAPI-Key': process.env.SERPER_KEY,
    },
    body: JSON.stringify({ q, gl: 'us', hl: 'en' }),
  });

  if (!serperRes.ok) {
    return res.status(500).json({ error: 'Serper search failed' });
  }

  const serper = await serperRes.json();
  if (!serper.organic?.length) {
    return res.status(200).json({ links: [] });
  }

  /* ---------- 2. 预先算文章 embedding ---------- */
  const baseEmb = await getEmbedding(`${kw} ${text}`.slice(0, 6000));

  /* ---------- 3. 对每条搜索结果打分 ---------- */
  const scored = await Promise.all(
    serper.organic.slice(0, 10).map(async (item, idx) => {
      const domain = getDomain(item.link) || '';
      const kwLower = kw.toLowerCase();

      // a) 基础分：Google 原始顺序（倒序给分）
      let score = 100 - idx;

      // b) 权威域名 TLD
      if (domain.endsWith('.gov') || domain.endsWith('.edu')) score += 60;
      else if (domain.endsWith('.org')) score += 40;

      // c) Domain Authority (OpenPageRank)，可选
      let da = 0;
      if (process.env.OPENPAGERANK_KEY) {
        try {
          const daResp = await fetch(
            `https://openpagerank.com/api/v1.0/getPageRank?domains%5B0%5D=${domain}`,
            { headers: { 'API-OPR': process.env.OPENPAGERANK_KEY } }
          ).then((r) => r.json());
          da = daResp.response?.[0]?.page_rank_integer || 0;
          score += (da / 100) * 50; // 转 0-50 分
        } catch {/* 忽略失败 */}
      }

      // d) 品牌域名强加分
      if (BRAND_PRIORITY[kwLower]?.includes(domain)) score += 80;

      // e) 语义相似度（标题 vs 文章上下文）
      const sim = await cosineSim(baseEmb, await getEmbedding(item.title));
      score += sim * 80; // 0-80 分

      return { title: item.title, url: item.link, domain, score };
    })
  );

  /* ---------- 4. 同域取最高分 / 排序 / 取前 3 ---------- */
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

/* ---------- 工具函数 ---------- */

// 调 OpenAI embedding
async function getEmbedding(text) {
  const resp = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text,
    }),
  });

  if (!resp.ok) return [];

  const j = await resp.json();
  return j.data?.[0]?.embedding || [];
}

// 余弦相似度
function cosineSim(a = [], b = []) {
  if (!a.length || !b.length) return 0;
  const dot = a.reduce((s, v, i) => s + v * (b[i] || 0), 0);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB + 1e-9);
}
