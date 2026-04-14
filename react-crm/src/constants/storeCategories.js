/** بعد الاستعادة التلقائية (طلبية جديدة) يخزّن الـ API «recovered»؛ التحديث اليدوي قد يستخدم «restored». */
export function isRestoredCategory(category) {
  return category === 'restored' || category === 'recovered'
}

function parseDateInfo(v) {
  if (v == null || v === '') return { ts: null, day: null, hasTime: false }
  const raw = String(v).trim().replace(/\//g, '-')
  const hasTime = /(?:T|\s)\d{1,2}:\d{2}/.test(raw)
  const head = raw.length >= 10 ? raw.slice(0, 10) : raw
  let day = null
  if (/^\d{4}-\d{2}-\d{2}$/.test(head)) day = head
  const norm = hasTime ? raw.replace(' ', 'T') : `${head}T12:00:00`
  const ts = Date.parse(norm)
  if (day == null && !Number.isNaN(ts)) day = new Date(ts).toISOString().slice(0, 10)
  return { ts: Number.isNaN(ts) ? null : ts, day, hasTime }
}

/**
 * السجل ما زال «restoring» لكن آخر شحنة في يوم ≥ يوم بدء الاستعادة (نفس اليوم يُعتبر مكتملاً).
 */
export function isRecoveryCompletedByShipment(store, stateRow) {
  if (!stateRow?.restore_date) return false
  if (stateRow.category !== 'restoring') return false
  const ship = store?.last_shipment_date
  if (!ship || ship === 'لا يوجد') return false
  const shipInfo = parseDateInfo(ship)
  const restoreInfo = parseDateInfo(stateRow.restore_date)
  if (!shipInfo.day || !restoreInfo.day) return false

  if (shipInfo.hasTime && restoreInfo.hasTime && shipInfo.ts != null && restoreInfo.ts != null) {
    return shipInfo.ts >= restoreInfo.ts
  }
  if (!shipInfo.hasTime && restoreInfo.hasTime) {
    // تاريخ شحنة بدون وقت: لا نعتبر "نفس يوم بدء/إعادة البدء" استعادة مكتملة.
    return shipInfo.day > restoreInfo.day
  }
  return shipInfo.day >= restoreInfo.day
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
