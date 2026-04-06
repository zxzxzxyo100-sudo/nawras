/**
 * سلوك «مسار المهام v2» (إخفاء «تم»، إتمام عبر حفظ المكالمة فقط، لوحة الرضا):
 * يُفعَّل في التطوير المحلي أو بناء التجريبي (__STAGING__).
 * ملاحظة: في Vite، `import.meta.env.DEV` يعادل NODE_ENV=development؛
 * البناء التجريبي يكون عادةً production لذا نعتمد __STAGING__.
 */
export const IS_STAGING_OR_DEV =
  Boolean(import.meta.env.DEV) ||
  (typeof __STAGING__ !== 'undefined' && __STAGING__)
