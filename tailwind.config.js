// tailwind.config.js
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    // 若后续有 server 组件或 app 目录，也别忘了加进来
    './pages/_app.{js,jsx}',
  ],
  safelist: [
    // 绿色高亮 & 蓝色链接
    { pattern: /(bg|text)-(green|blue)-(50|100|200|600|700|800)/ },
    // --------- 新增 ↓ 保底 ---------
    'truncate',         // 单行省略
    'underline',        // picked 状态
    'text-blue-800',    // picked 状态
    // --------- 旧有 ---------
    'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl',
    'shadow', 'shadow-lg', 'prose', 'cursor-pointer',
    'animate-fadeIn',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Microsoft YaHei"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: '#ffae38',
        kwBg:  '#d1fae5',
        kwFg:  '#047857',
        cardBg:'#ffffff',
      },
      maxWidth: {
        screen: '1180px',
      },
      keyframes: {
        fadeIn: { from: { opacity: '0' }, to: { opacity: '1' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.15s ease-out',
      },
    },
  },
  plugins: [
    // 如果你仍想用 line-clamp，可以再装：
    // require('@tailwindcss/line-clamp'),
  ],
};
