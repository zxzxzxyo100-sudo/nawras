/**
 * دفعة «تحقيق البارد»: 30 متجراً غير نشط بارد يومياً، تتجدد الساعة 9:00 صباحاً (توقيت الجهاز).
 * الترتيب حتمي حسب (يوم العمل + اسم المستخدم) ليتطابق لكل موظف.
 */

function hashStringToUint32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** يوم «الدفعة»: قبل 9:00 صباحاً يُعتبر اليوم السابق. */
export function getBizDateKeyAt9am(now = new Date()) {
  const d = new Date(now.getTime())
  if (d.getHours() < 9) {
    d.setDate(d.getDate() - 1)
  }
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * يختار حتى `limit` متجراً من «غير النشط البارد» ليوم العمل الحالي.
 *
 * **مهم:** الترتيب اليومي يُشتق من `(يوم العمل + المستخدم + معرف المتجر)` وليس من
 * خلط القائمة الحالية فقط. بذلك عند تجميد متجر أو اتصال يخرج من البارد، يبقى
 * ترتيب بقية المتاجر ثابتاً ويُستبدل الفراغ تلقائياً بالمتجر التالي في الترتيب
 * (دون أن ينهار العدد من 30 إلى 29 طالما يوجد في النظام 30+ متجر بارد).
 */
export function pickDailyColdInactiveStores(allStores, storeStates, bizDateKey, username, limit = 30) {
  const cold = (allStores || []).filter(s => {
    const cat = storeStates?.[s.id]?.category || s.category || ''
    return cat === 'cold_inactive'
  })
  const u = String(username || 'anon')
  const seed = `nawras_cold_v1|${bizDateKey}|${u}`
  const withRank = cold.map(s => ({
    store: s,
    rank: hashStringToUint32(`${seed}|id:${s.id}`),
  }))
  withRank.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : Number(a.store.id) - Number(b.store.id)))
  return withRank.slice(0, Math.min(limit, withRank.length)).map(x => x.store)
}

export function buildColdVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-cold-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'cold_verification',
    label: 'تحقيق بارد',
    desc: `متجر غير نشط بارد — دفعة يومية تتجدد 9:00 ص (${bizDateKey})`,
    coldVerifyBatchDate: bizDateKey,
  }))
}
