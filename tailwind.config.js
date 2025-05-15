/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
    './pages/_app.{js,jsx}',
  ],
  safelist: [
    // 绿色高亮 & 蓝色链接
    { pattern: /(bg|text)-(green|blue)-(50|100|200|600|700|800)/ },
    // 圆角 / 阴影 / prose 等
    'rounded', 'rounded-md', 'rounded-lg', 'rounded-xl',
    'shadow', 'shadow-lg', 'prose', 'cursor-pointer',
    // popup 动画自定义 keyframe
    'animate-fadeIn',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Microsoft YaHei"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: '#ffae38',   // logo 小闪电色
        kwBg:  '#d1fae5',   // 关键词高亮背景
        kwFg:  '#047857',   // 关键词高亮文字
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
  plugins: [],
};
