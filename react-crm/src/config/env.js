/**
 * بيئة تجريبية: من بناء `vite.config.staging.js`، أو من اسم النطاق إذا وُضع بناء الإنتاج
 * على السابدومين التجريبي (حتى لا تبقى «أدائي» وNRS ظاهرة بالخطأ).
 */
function isStagingHostname() {
  if (typeof window === 'undefined') return false
  const h = window.location.hostname.toLowerCase()
  return h === 'staging.nawras-ly.com' || h.startsWith('staging.')
}

export const IS_STAGING_BUILD =
  (typeof __STAGING__ !== 'undefined' && __STAGING__) ||
  isStagingHostname()
