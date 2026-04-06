/**
 * سلوك «مسار المهام v2» (إخفاء «تم»، استبيان التهيئة عند الاتصال في المهام اليومية، …):
 * - التطوير المحلي: `import.meta.env.DEV`
 * - التجريبي: `vite.config.staging.js` يعرّف `__STAGING__` + وضع البناء `--mode staging` يحمّل `.env.staging` → `VITE_APP_STAGING=1`
 */
const VITE_STAGING =
  String(import.meta.env.VITE_APP_STAGING ?? '') === '1'

export const IS_STAGING_OR_DEV =
  Boolean(import.meta.env.DEV) ||
  (typeof __STAGING__ !== 'undefined' && __STAGING__) ||
  VITE_STAGING

/** مطابقة process.env.NODE_ENV === 'development' في Vite — التطوير المحلي فقط (لا يشمل التجريبي المبنى). */
export const IS_DEV_ONLY = Boolean(import.meta.env.DEV)

/** نفس مجال الميزات أعلاه — للتوثيق في الواردات الجديدة */
export const IS_DEV_OR_STAGING_FEATURES = IS_STAGING_OR_DEV
