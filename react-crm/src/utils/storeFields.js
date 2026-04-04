/**
 * إجمالي الطرود من واجهة Nawris — المفتاح المعياري total_shipments مع بدائل شائعة.
 */
export function totalShipments(s) {
  if (!s || typeof s !== 'object') return 0
  const raw =
    s.total_shipments ??
    s.totalShipments ??
    s.Total_Shipments ??
    (s.stats && typeof s.stats === 'object'
      ? (s.stats.total_shipments ?? s.stats.totalShipments)
      : undefined)
  if (raw == null || raw === '') return 0
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.trunc(raw)
  const n = parseInt(String(raw).replace(/[^\d]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/**
 * طرود ضمن نطاق orders-summary (يُحقَن في StoresContext كـ shipments_in_range).
 * إذا وُجدت تواريخ النطاق في الكائن فلا نعرض total_shipments (إجمالي الحياة من all-stores).
 */
export function parcelsInRangeDisplay(store) {
  if (!store || typeof store !== 'object') return 0
  const hasRangeMeta =
    store.shipments_range_from != null &&
    store.shipments_range_to != null &&
    String(store.shipments_range_from).trim() !== '' &&
    String(store.shipments_range_to).trim() !== ''
  if (hasRangeMeta) {
    const v = store.shipments_in_range
    if (v !== undefined && v !== null && v !== '') {
      const n = Number(v)
      return Number.isFinite(n) ? n : 0
    }
    return 0
  }
  if (store.shipments_in_range !== undefined && store.shipments_in_range !== null && store.shipments_in_range !== '') {
    const n = Number(store.shipments_in_range)
    return Number.isFinite(n) ? n : 0
  }
  return totalShipments(store)
}

/** يتوافق مع الخادم: status الفارغ يُعامل كـ نشط؛ Nawris قد يعيد «نشط» بالعربية */
export function isActiveMerchantStatus(s) {
  const st = s?.status ?? s?.account_status
  if (st == null || st === '') return true
  if (typeof st === 'boolean') return st
  if (typeof st === 'number') return st === 1
  const raw = String(st).trim()
  const t = raw.toLowerCase()
  if (t === 'active' || t === '1' || t === 'true' || t === 'yes') return true
  if (/غير\s*نشط/u.test(raw) || raw.includes('موقوف') || raw.includes('معطل')) return false
  if (raw.includes('نشط') && !/غير\s*نشط/u.test(raw)) return true
  if (raw === 'مفعل' || raw === 'فعال') return true
  if (['inactive', 'suspended', 'disabled', 'blocked', 'closed'].includes(t)) return false
  return false
}
