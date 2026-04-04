/** أوضاع البحث في حقل الاسم */
export const NAME_MATCH_MODES = {
  /** النص يظهر في أي مكان في الاسم أو الهاتف */
  contains: 'contains',
  /** اسم المتجر يبدأ بهذا النص أو الحرف (الهاتف: يحتوي) */
  startsWith: 'startsWith',
  /** أي «كلمة» في اسم المتجر تحتوي النص (مثل البحث بالكلمة في القوائم) */
  word: 'word',
}

function nameOrPhoneMatches(name, phone, queryLower, mode) {
  const nameStr = String(name || '')
  const nameLower = nameStr.toLowerCase()
  const phoneLower = String(phone || '').toLowerCase()
  const q = queryLower.trim()
  if (!q) return true

  const phoneOk = phoneLower.includes(q)

  if (mode === NAME_MATCH_MODES.startsWith) {
    return nameLower.startsWith(q) || phoneOk
  }

  if (mode === NAME_MATCH_MODES.word) {
    const words = nameLower.split(/\s+/).filter(Boolean)
    const nameOk = words.some(w => w.includes(q))
    return nameOk || phoneOk
  }

  const nameOk = nameLower.includes(q)
  return nameOk || phoneOk
}

/**
 * يُرجع YYYY-MM-DD من حقل تاريخ المتجر أو null
 */
export function dateOnlyFromStoreField(val) {
  if (val == null || val === '' || val === 'لا يوجد') return null
  const t = new Date(val)
  if (Number.isNaN(t.getTime())) return null
  return t.toISOString().slice(0, 10)
}

/**
 * تصفية موحّدة: اسم، رقم/معرّف المتجر، نطاق تاريخ التسجيل، نطاق تاريخ آخر شحنة
 */
export function filterStoresByToolbar(stores, filters) {
  const {
    nameQuery = '',
    nameMatchMode = NAME_MATCH_MODES.contains,
    idQuery = '',
    regFrom = '',
    regTo = '',
    shipFrom = '',
    shipTo = '',
  } = filters

  return stores.filter(s => {
    if (nameQuery.trim()) {
      const n = nameQuery.trim().toLowerCase()
      if (!nameOrPhoneMatches(s.name, s.phone, n, nameMatchMode)) return false
    }

    if (idQuery.trim()) {
      const idStr = String(s.id ?? '')
      if (!idStr.includes(idQuery.trim())) return false
    }

    if (regFrom || regTo) {
      const d = dateOnlyFromStoreField(s.registered_at)
      if (!d) return false
      if (regFrom && d < regFrom) return false
      if (regTo && d > regTo) return false
    }

    if (shipFrom || shipTo) {
      const d = dateOnlyFromStoreField(s.last_shipment_date)
      if (!d) return false
      if (shipFrom && d < shipFrom) return false
      if (shipTo && d > shipTo) return false
    }

    return true
  })
}
