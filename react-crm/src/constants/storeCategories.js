/** بعد الاستعادة التلقائية (طلبية جديدة) يخزّن الـ API «recovered»؛ التحديث اليدوي قد يستخدم «restored». */
export function isRestoredCategory(category) {
  return category === 'restored' || category === 'recovered'
}

function parseDateMs(v) {
  if (v == null || v === '') return NaN
  const s = String(v).replace(/\//g, '-').trim()
  const day = s.length >= 10 ? s.slice(0, 10) : s
  const t = Date.parse(day.includes('T') ? day : `${day}T12:00:00`)
  return Number.isNaN(t) ? NaN : t
}

/**
 * السجل ما زال «restoring» لكن آخر شحنة أحدث من restore_date (انتقل للنشط قبل تشغيل check-recovery أو فشل النطاق الزمني).
 */
export function isRecoveryCompletedByShipment(store, stateRow) {
  if (!stateRow?.restore_date) return false
  if (stateRow.category !== 'restoring') return false
  const ship = store?.last_shipment_date
  if (!ship || ship === 'لا يوجد') return false
  const tRestore = parseDateMs(stateRow.restore_date)
  const tShip = parseDateMs(ship)
  if (Number.isNaN(tRestore) || Number.isNaN(tShip)) return false
  return tShip > tRestore
}

/** يظهر في «تمت الاستعادة»: recovered/restored أو اكتمال شحني معلّق على تحديث DB */
export function isRestoredForRecoveryLists(store, stateRow) {
  return isRestoredCategory(stateRow?.category) || isRecoveryCompletedByShipment(store, stateRow)
}

/** يظهر في «جاري الاستعادة»: restoring ولم تكتمل الشحنة بعد حسب التواريخ */
export function isStillRestoringStore(store, stateRow) {
  if (!stateRow || stateRow.category !== 'restoring') return false
  return !isRecoveryCompletedByShipment(store, stateRow)
}
