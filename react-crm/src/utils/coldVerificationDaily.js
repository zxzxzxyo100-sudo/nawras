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

function mulberry32(a) {
  return function mul() {
    let t = (a += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
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

function shuffleDeterministic(items, seedStr) {
  const seed = hashStringToUint32(seedStr)
  const rand = mulberry32(seed)
  const arr = items.slice()
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export function pickDailyColdInactiveStores(allStores, storeStates, bizDateKey, username, limit = 30) {
  const cold = (allStores || []).filter(s => {
    const cat = storeStates?.[s.id]?.category || s.category || ''
    return cat === 'cold_inactive'
  })
  cold.sort((a, b) => Number(a.id) - Number(b.id))
  const u = String(username || 'anon')
  const shuffled = shuffleDeterministic(cold, `nawras_cold_v1|${bizDateKey}|${u}`)
  return shuffled.slice(0, Math.min(limit, shuffled.length))
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
