/* pages/index.js -----------------------------------------------------------
   YQ INSIGHT 外链优化工具 – 前端界面 & 交互逻辑
--------------------------------------------------------------------------- */

import { useState } from "react";
import { FiCopy } from "react-icons/fi";

export default function Home() {
  /* ---------------------- React 状态 ---------------------- */
  const [input,  setInput]  = useState("");   // 用户粘贴的原文
  const [data,   setData]   = useState(null); // /api/ai 返回 {keywords, original}
  const [picked, setPicked] = useState({});   // 已为每个关键词选中的 { url, reason }
  const [html,   setHtml]   = useState("");   // 生成的最终 HTML
  const [loading, setLoading] = useState(false);

  /* ---------------------- 第一步：分析关键词 ---------------------- */
  async function handleAnalyze() {
    if (!input.trim()) return alert("请先粘贴英文文章！");
    setLoading(true);

    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body:   JSON.stringify({ text: input })
    });

    if (!res.ok) {
      alert("服务器分析失败，请稍后重试");
      setLoading(false);
      return;
    }

    const result = await res.json();
    setData(result);  // { keywords: [{keyword,options:[{url}…]}…], original }
    setPicked({});
    setHtml("");
    setLoading(false);
  }

  /* ---------------------- 第二步：用户为某个关键词选 1 条链接 ---------------------- */
  async function chooseLink(keyword, option) {
    if (picked[keyword]) return;          // 已选过则忽略

    /* 可选：向后端请求推荐理由；若暂不需要可直接注释掉此块 */
    let reason = "";
    try {
      const res = await fetch("/api/reason", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:   JSON.stringify({ url: option.url })
      });
      if (res.ok) {
        const json = await res.json();   // {reason:"…"}
        reason = json.reason;
      }
    } catch (_) {
      /* 静默忽略，reason 保持空字符串 */
    }

    /* 标记选中 */
    setPicked(prev => ({ ...prev, [keyword]: { ...option, reason } }));

    /* 仅替换正文中首次出现的该关键词（大小写不敏感）*/
    const anchor = `<a
