/**
 * يجب أن تطابق القيم `api-php/onboarding-config.php` (NAWRAS_ONBOARD_*)
 * التطوير المحلي وبناء التجريبي (__STAGING__): 3 و 10 أيام — مطابقة لـ API على localhost
 */
const _stagingOrDev =
  Boolean(import.meta.env.DEV)
  || (typeof __STAGING__ !== 'undefined' && __STAGING__)

export const ONBOARD_DAYS_AFTER_CALL1 = _stagingOrDev ? 3 : 2
export const ONBOARD_DAYS_AFTER_CALL2 = _stagingOrDev ? 10 : 7
