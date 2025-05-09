/** @type {import('tailwindcss').Config} */
module.exports = {
  /* 扫描路径 —— 保留你项目里的 pages / components */
  content: [
    './pages/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],

  /* 关键：顶层 safelist（v3 写法） */
  safelist: [
    /* 绿色块（未选关键词） */
    'bg-green-100', 'text-green-900', 'border-green-300', 'hover:bg-green-200',

    /* 蓝色块（已选关键词） */
    'bg-blue-100',  'text-blue-900',  'border-blue-300',  'hover:bg-blue-200',
  ],

  theme: { extend: {} },

  plugins: [
    require('@tailwindcss/typography'),
  ],
};
