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
