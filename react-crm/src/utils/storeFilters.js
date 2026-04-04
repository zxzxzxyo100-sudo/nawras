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
    idQuery = '',
    regFrom = '',
    regTo = '',
    shipFrom = '',
    shipTo = '',
  } = filters

  return stores.filter(s => {
    if (nameQuery.trim()) {
      const n = nameQuery.trim().toLowerCase()
      const nameOk = String(s.name || '').toLowerCase().includes(n)
      const phoneOk = String(s.phone || '').toLowerCase().includes(n)
      if (!nameOk && !phoneOk) return false
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
