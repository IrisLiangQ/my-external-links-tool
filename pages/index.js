/* pages/index.js */

import { useState, useRef, useEffect } from 'react'
import { FiCopy } from 'react-icons/fi'

/* -------------------------------------
   工具函数
------------------------------------- */
const kwSpan = (kw) =>
  `<span data-kw="${kw}" class="kw inline-block bg-green-100 text-green-800 px-1 rounded cursor-pointer">${kw}</span>`

const caret = `<sup class="caret ml-0.5 select-none">▾</sup>`

/* =====================================
   组件
===================================== */
export default function Home() {
  /* ---------------- state ---------------- */
  const [raw, setRaw] = useState('')
  const [data, setData] = useState(null) // { keywords: [ {keyword, options}], original }
  const [html, setHtml] = useState('')
  const [activeKw, setActiveKw] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const popRef = useRef(null)

  /* ---------------- 调用 /api/ai ---------------- */
  async function analyze() {
    if (!raw.trim()) return alert('请先粘贴英文段落！')
    setLoading(true)

    const r = await fetch('/api/ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: raw }),
    })
    if (!r.ok) {
      alert('服务器分析失败')
      setLoading(false)
      return
    }
    const j = await r.json()
    setData(j)
    setCopied(false)

    /* 先整体替换为绿色 kwSpan */
    let body = j.original
    j.keywords.forEach(({ keyword }) => {
      const re = new RegExp(`\\b${keyword}\\b`, 'gi')
      body = body.replace(re, kwSpan(keyword))
    })

    setHtml(body)
    setLoading(false)
  }

  /* ---------------- 编辑器点击 ---------------- */
  function onClickEditor(e) {
    const span = e.target.closest('[data-kw]')
    if (!span) return

    /* 记录点击词 */
    setActiveKw(span.dataset.kw)

    /* 计算弹窗位置 */
    const rc = span.getBoundingClientRect()
    popRef.current.style.top = `${rc.bottom + window.scrollY + 6}px`
    popRef.current.style.left = `${rc.left + rc.width / 2 + window.scrollX}px`
    popRef.current.style.transform = 'translateX(-50%)'
  }

  /* ---------------- 选择 / 替换链接 ---------------- */
  function syncAll(kw, replacement) {
    const re = new RegExp(
      `<span[^>]*data-kw="${kw}"[^>]*>[\\s\\S]*?<\\/span>`,
      'gi'
    )
    setHtml((prev) => prev.replace(re, replacement))
  }

  async function chooseLink(kw, opt) {
    /* 请求理由 */
    let reason = ''
    try {
      const r = await fetch('/api/reason', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: opt.url, phrase: kw }),
      })
      if (r.ok) reason = (await r.json()).reason
    } catch {}
    if (!reason) reason = 'authoritative reference'

    const firstReplacement = `<span data-kw="${kw}" class="picked text-blue-700 underline"><a href="${opt.url}" target="_blank" rel="noopener">${kw}</a>${caret} ((${reason}))</span>`
    const others = `<span data-kw="${kw}" class="picked text-blue-700 underline"><a href="${opt.url}" target="_blank" rel="noopener">${kw}</a>${caret}</span>`

    /* 先把所有实例替成 others，然后首个换成 firstReplacement */
    syncAll(kw, others)
    setHtml((prev) => prev.replace(others, firstReplacement))
    setActiveKw(null)
  }

  /* ---------------- 移除外链 ---------------- */
  function removeLink(kw) {
    syncAll(kw, kwSpan(kw))
    setActiveKw(null)
  }

  /* ---------------- 复制结果 ---------------- */
  function copyHtml() {
    let final = html
      /* 移除 caret + 外层 span，仅保留内容 */
      .replace(/<sup class="caret[^>]*>▾<\/sup>/g, '')
      .replace(/<span[^>]*class="picked"[^>]*>(.*?)<\/span>/g, '$1')
      .replace(/<span[^>]*class="kw"[^>]*>(.*?)<\/span>/g, '$1')
    navigator.clipboard.writeText(final)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen font-sans bg-gray-50 p-6 flex justify-center">
      <div className="w-full max-w-4xl space-y-6">
        {/* 头部 */}
        <header className="space-y-1">
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <span className="text-orange-500">⚡</span> 外链优化
          </h1>
          <p className="text-sm text-gray-500">AI驱动的文章外链优化工具</p>
        </header>

        {/* 主卡片 */}
        <div className="bg-white rounded-lg shadow p-6 space-y-4">
          {!data ? (
            /* 输入阶段 */
            <>
              <textarea
                rows={8}
                className="w-full border rounded p-4"
                placeholder="Paste English paragraph…"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
              />
              <button
                onClick={analyze}
                disabled={loading}
                className="font-bold bg-black text-white px-4 py-2 rounded disabled:opacity-50"
              >
                {loading ? 'Analyzing…' : '分析关键词'}
              </button>
            </>
          ) : (
            /* 编辑阶段 */
            <>
              <p className="text-xs text-gray-500 mb-2">
                绿色块可添加外链；选后变蓝，可再次点击修改或移除。
              </p>
              <div
                className="prose max-w-none text-[17px] leading-7"
                dangerouslySetInnerHTML={{ __html: html }}
                onClick={onClickEditor}
              />
              <button
                onClick={copyHtml}
                className="font-bold bg-black text-white px-4 py-2 rounded flex items-center gap-2"
              >
                <FiCopy /> {copied ? '已复制' : '复制 HTML'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 弹窗 */}
      {activeKw && (
        <div
          ref={popRef}
          className="fixed z-50 w-96 bg-white border shadow-lg rounded-xl"
        >
          {data.keywords
            .find((k) => k.keyword === activeKw)
            .options.map((o, i) => (
              <button
                key={i}
                onClick={() => chooseLink(activeKw, o)}
                className="w-full text-left p-4 hover:bg-gray-50 border-b last:border-0"
              >
                <p className="font-medium line-clamp-1">
                  {o.title || o.url}
                </p>
                <p className="text-xs text-gray-600 line-clamp-1">{o.url}</p>
              </button>
            ))}

          <button
            onClick={() => removeLink(activeKw)}
            className="w-full text-center text-red-600 py-3 font-medium"
          >
            × 移除外链
          </button>
        </div>
      )}
    </div>
  )
}
