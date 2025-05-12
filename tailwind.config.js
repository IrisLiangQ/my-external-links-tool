/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Microsoft YaHei"', 'Helvetica', 'Arial', 'sans-serif'],
      },
      colors: {
        brand: '#ffae38',       // logo 小闪电色
        kwBg:  '#d1fae5',       // 关键词高亮
        kwFg:  '#047857',
        cardBg:'#ffffff',
      },
      maxWidth: {
        screen: '1180px',
      },
    },
  },
  plugins: [],
};
