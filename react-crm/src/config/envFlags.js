/**
 * سلوك «مسار المهام v2» (إخفاء «تم»، استبيان التهيئة عند الاتصال، التحقق السريع، …):
 * المواصفات: `process.env.NODE_ENV === 'development'` — في Vite = `import.meta.env.DEV`.
 * البناء التجريبي على الخادم يكون `production`؛ لذلك نفعّل أيضاً `__STAGING__` لاختبار التجريبي فقط.
 */
export const IS_STAGING_OR_DEV =
  Boolean(import.meta.env.DEV) ||
  (typeof __STAGING__ !== 'undefined' && __STAGING__)

/** مطابقة process.env.NODE_ENV === 'development' في Vite — التطوير المحلي فقط (لا يشمل التجريبي المبنى). */
export const IS_DEV_ONLY = Boolean(import.meta.env.DEV)

/** نفس مجال الميزات أعلاه — للتوثيق في الواردات الجديدة */
export const IS_DEV_OR_STAGING_FEATURES = IS_STAGING_OR_DEV
