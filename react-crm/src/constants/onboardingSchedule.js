/**
 * يجب أن تطابق منطق api-php/onboarding-config.php (NAWRAS_ONBOARD_CYCLE_CALL*)
 * المكالمة 2 و 3 من يوم التسجيل ضمن دورة 14 يوماً.
 */
export const ONBOARD_CYCLE_CALL2_DAY = 3
export const ONBOARD_CYCLE_CALL3_DAY = 10
export const ONBOARD_FIRST_CALL_HOURS = 48

/** @deprecated استخدم ONBOARD_CYCLE_CALL2_DAY — كان يفرق تجريبي/فعلي حسب تاريخ المكالمة السابقة */
const _stagingOrDev =
  Boolean(import.meta.env.DEV)
  || (typeof __STAGING__ !== 'undefined' && __STAGING__)

export const ONBOARD_DAYS_AFTER_CALL1 = _stagingOrDev ? 3 : 2
export const ONBOARD_DAYS_AFTER_CALL2 = _stagingOrDev ? 10 : 7
