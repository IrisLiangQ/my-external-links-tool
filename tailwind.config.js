// tailwind.config.js  —— 适用于 Tailwind 2.x
module.exports = {
  purge: {
    content: [
      './pages/**/*.{js,jsx}',
      './components/**/*.{js,jsx}',
    ],
    /* 关键：v2 写在 options.safelist */
    options: {
      safelist: [
        /* 绿色 */
        'bg-green-100', 'text-green-900', 'border-green-300', 'hover:bg-green-200',
        /* 蓝色 */
        'bg-blue-100',  'text-blue-900',  'border-blue-300',  'hover:bg-blue-200',
      ],
    },
  },
  theme: { extend: {} },
  plugins: [require('@tailwindcss/typography')],
};
