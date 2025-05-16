// 权威域名优先、黑名单剔除、品牌域名可自定义
export const WHITELIST = [
  'gov', 'edu',                // 顶级权威
  'who.int', 'un.org',         // 国际机构示例
];

export const BLACKLIST = [
  'blogspot.com', 'medium.com', 'reddit.com',
  'quora.com', 'pinterest.com', 'youtube.com',
  'amazon.com', 'aliexpress.com',
];

// 如需让自己网站永远排第一可在此添加
export const BRAND_PRIORITY = {
  // 例如：besen: ['besen-group.com'],
};
