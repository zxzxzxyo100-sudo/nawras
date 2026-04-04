/**
 * يُحقَن من Vite: `true` في `vite.config.staging.js` فقط.
 * عند التجريب: إخفاء النقاط و«أدائي» وعدم استدعاء get_my_stats.
 */
export const DISABLE_POINTS_AND_PERFORMANCE =
  typeof __STAGING__ !== 'undefined' && __STAGING__

/**
 * كبار التجار: عند true تُعرض صفحة «قريباً» فقط ولا يُستدعى vip-merchants.php.
 * عيّن false بعد ضبط الـ API لإعادة القائمة والجدول الكامل.
 */
export const VIP_MERCHANTS_COMING_SOON = true
