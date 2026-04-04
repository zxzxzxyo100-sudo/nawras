/** بعد الاستعادة التلقائية (طلبية جديدة) يخزّن الـ API «recovered»؛ التحديث اليدوي قد يستخدم «restored». */
export function isRestoredCategory(category) {
  return category === 'restored' || category === 'recovered'
}

/** YYYY-MM-DD لمقارنة يومية — يتجنب خطأ «نفس اليوم»: شحنة ببداية اليوم تبدو قبل مساء بدء الاستعادة */
function calendarDayKey(v) {
  if (v == null || v === '') return null
  const s = String(v).replace(/\//g, '-').trim()
  const head = s.length >= 10 ? s.slice(0, 10) : s
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) return head
  const t = Date.parse(s.includes('T') ? s : `${head}T12:00:00`)
  if (Number.isNaN(t)) return null
  return new Date(t).toISOString().slice(0, 10)
}

/**
 * السجل ما زال «restoring» لكن آخر شحنة في يوم ≥ يوم بدء الاستعادة (نفس اليوم يُعتبر مكتملاً).
 */
export function isRecoveryCompletedByShipment(store, stateRow) {
  if (!stateRow?.restore_date) return false
  if (stateRow.category !== 'restoring') return false
  const ship = store?.last_shipment_date
  if (!ship || ship === 'لا يوجد') return false
  const dShip = calendarDayKey(ship)
  const dRestore = calendarDayKey(stateRow.restore_date)
  if (!dShip || !dRestore) return false
  return dShip >= dRestore
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
