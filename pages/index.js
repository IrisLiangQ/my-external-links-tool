/* pages/index.js — 外链优化工具 · 2025-05-09
   功能：
   1. 自动识别段落主题 topic 并展示
   2. GPT 抽取与主题强相关的多词短语（由 /api/ai 返回）
   3. 点击短语弹窗 3 选 1，实时向 /api/reason 生成 EEAT 推荐理由
   4. 插入 <a> 后紧跟 ((reason))，兼容 Footnotes Made Easy
   5. 复制按钮一键获取完整 HTML
----------------------------------------------------------------- */

import { useState, useRef } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  /* ------------------- React 状态 ------------------- */
  const [raw,    setRaw]    = useState("");   // 文本框原文
  const [data,   setData]   = useState(null); // /api/ai 返回 {topic, keywords, original}
  const [html,   setHtml]   = useState("");   // 编辑器 HTML
  const [topic,  setTopic]  = useState("");   // 段落主题
  const [picked, setPicked] = useState({});   // 已选 {kw:{url,reason}}
  const [active, setActive] = useState(null); // 当前弹窗关键词
  const [loading,setLoading]= useState(false);
  const [copied, setCopied] = useState(false);

  const popRef = useRef(null);

  /* ------------------- 调用 /api/ai ------------------- */
  async function analyze() {
    if (!raw.trim()) return alert("请先粘贴英文文章！");
    setLoading(true);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ text: raw }),
    });
    if (!res.ok) { alert("分析失败，请稍后重试"); setLoading(false); return; }

    const j = await res.json();                       // {topic, keywords, original}
    setData(j);
    setTopic(j.topic);
    setPicked({});
    setCopied(false);

    /* 高亮关键词 */
    let body = j.original;
    j.keywords.forEach(({ keyword }) => {
      const reg = new RegExp(`\\b${keyword}\\b`, "i");
      body = body.replace(
        reg,
        `<mark data-kw="${keyword}"
               class="cursor-pointer bg-yellow-200/60 px-1 rounded">${keyword}</mark>`
      );
    });
    setHtml(body);
    setLoading(false);
  }

  /* ------------------- 点击 mark 打开弹窗 ------------------- */
  function handleEditorClick(e) {
    const el = e.target
