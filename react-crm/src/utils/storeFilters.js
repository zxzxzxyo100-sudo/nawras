/** مطابقة الهاتف: نص كما هو، أو أرقام فقط في أي موضع (حتى لو لم يُكتب أول الرقم) */
function phoneMatches(phone, queryLower) {
  const raw = String(phone || '')
  const phoneLower = raw.toLowerCase()
  const q = queryLower.trim()
  if (!q) return true

  const digits = raw.replace(/\D/g, '')
  const qDigits = q.replace(/\D/g, '')
  if (qDigits.length > 0 && digits.includes(qDigits)) return true

  return phoneLower.includes(q)
}

/** الاسم يحتوي النص أو الهاتف يطابق */
function nameOrPhoneMatches(name, phone, queryLower) {
  const nameLower = String(name || '').toLowerCase()
  const q = queryLower.trim()
  if (!q) return true
  const phoneOk = phoneMatches(phone, queryLower)
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
    /** عند الاختيار من Autocomplete: تصفية بحسب المعرّف فقط */
    namePickedStoreId = null,
    idQuery = '',
    regFrom = '',
    regTo = '',
    shipFrom = '',
    shipTo = '',
  } = filters

  return stores.filter(s => {
    if (namePickedStoreId != null && namePickedStoreId !== '') {
      if (String(s.id) !== String(namePickedStoreId)) return false
    } else if (nameQuery.trim()) {
      const n = nameQuery.trim().toLowerCase()
      if (!nameOrPhoneMatches(s.name, s.phone, n)) return false
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
