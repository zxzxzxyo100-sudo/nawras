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

/** يتوافق مع الخادم: status الفارغ يُعامل كـ نشط */
export function isActiveMerchantStatus(s) {
  const st = s?.status
  if (st == null || st === '') return true
  if (typeof st === 'boolean') return st
  if (typeof st === 'number') return st === 1
  const t = String(st).trim().toLowerCase()
  return t === 'active' || t === '1' || t === 'true' || t === 'yes'
}
