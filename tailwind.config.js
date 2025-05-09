/** @type {import('tailwindcss').Config} */
module.exports = {
  /* === 保留你原先的扫描路径 === */
  content: [
    './pages/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],

  /* === 关键：防止生产环境被 purge 掉的动态类 === */
  safelist: [
    /* 绿色块（未选关键词） */
    'bg-green-100',
    'text-green-900',
    'border-green-300',
    'hover:bg-green-200',

    /* 蓝色块（已选关键词） */
    'bg-blue-100',
    'text-blue-900',
    'border-blue-300',
    'hover:bg-blue-200',
  ],

  theme: {
    extend: {
      /* 若要自定义颜色 / 字体，在此追加 */
    },
  },

  /* typography 只是示例，可按需删掉或添加其它插件 */
  plugins: [
    require('@tailwindcss/typography'),
  ],
};
