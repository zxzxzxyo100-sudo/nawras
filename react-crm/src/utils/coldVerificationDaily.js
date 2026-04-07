/**
 * دفعات التحقيق اليومية (يوم العمل يبدأ 9:00 صباحاً — توقيت الجهاز).
 *
 * - عند أول بناء للدفعة تُختار المعرفات (ترتيب حتمي) وتُحفَظ محلياً.
 * - لا استبدال بمتجر آخر داخل نفس اليوم في هذه الخانات.
 * - دفعة جديدة بعد يوم عمل جديد (بعد 9:00 ص).
 */

/** مسؤول المتاجر الجديدة — دفعة «غير نشط بارد». */
export const COLD_INACTIVE_DAILY_LIMIT = 30

/** مسؤول المتاجر النشطة — دفعة «تحقيق بارد» من نفس الفئة (غير نشط بارد)، منفصلة عن دفعة المسؤول الآخر. */
export const ACTIVE_MANAGER_COLD_VERIFY_LIMIT = 20

function hashStringToUint32(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** يوم «الدفعة»: قبل 9:00 صباحاً يُعتبر اليوم السابق (توقيت الجهاز). */
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

const STORAGE_KEY_PREFIX = 'nawras_cold_daily_ids_v2'
/** تخزين منفصل لمسؤول المتاجر النشطة — لا يختلط مع دفعة مسؤول المتاجر الجديدة. */
const STORAGE_KEY_AM_COLD = 'nawras_am_cold_verify_daily_v1'

function storageKey(bizDateKey, username) {
  return `${STORAGE_KEY_PREFIX}|${bizDateKey}|${String(username || 'anon')}`
}

function storageKeyAmCold(bizDateKey, username) {
  return `${STORAGE_KEY_AM_COLD}|${bizDateKey}|${String(username || 'anon')}`
}

function listColdInactiveStores(allStores, storeStates) {
  return (allStores || []).filter(s => {
    const cat = storeStates?.[s.id]?.category || s.category || ''
    return cat === 'cold_inactive'
  })
}

function computeInitialBatchIds(allStores, storeStates, bizDateKey, username, limit, seedPrefix) {
  const cold = listColdInactiveStores(allStores, storeStates)
  const u = String(username || 'anon')
  const seed = `${seedPrefix}|${bizDateKey}|${u}`
  const withRank = cold.map(s => ({
    id: Number(s.id),
    rank: hashStringToUint32(`${seed}|id:${s.id}`),
  }))
  withRank.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id - b.id))
  return withRank.slice(0, Math.min(limit, withRank.length)).map(x => x.id)
}

/**
 * دفعة مسؤول المتاجر الجديدة — غير نشط بارد (حتى 30).
 */
export function getDailyColdBatchStores(allStores, storeStates, bizDateKey, username, limit = COLD_INACTIVE_DAILY_LIMIT) {
  const key = storageKey(bizDateKey, username)
  let ids = null

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) {
          ids = parsed.map(x => Number(x))
        }
      }
    } catch {
      /* ignore */
    }
  }

  const coldNow = listColdInactiveStores(allStores, storeStates)

  if (!ids || ids.length === 0) {
    if (coldNow.length === 0) return []
    ids = computeInitialBatchIds(allStores, storeStates, bizDateKey, username, limit, 'nawras_cold_v1')
    if (typeof window !== 'undefined' && ids.length > 0) {
      try {
        window.localStorage.setItem(key, JSON.stringify(ids))
      } catch {
        /* ignore */
      }
    }
  }

  const byId = {}
  ;(allStores || []).forEach(s => {
    const n = Number(s.id)
    byId[n] = s
  })

  const out = []
  for (const rawId of ids) {
    const id = Number(rawId)
    const s = byId[id]
    if (!s) continue
    const cat = storeStates?.[s.id]?.category || s.category || ''
    if (cat === 'cold_inactive') out.push(s)
  }
  return out
}

/** مسؤول المتاجر النشطة — غير نشط بارد، حتى 20، مخزن ومفتاح عشوائي منفصل. */
export function getDailyActiveManagerColdBatchStores(
  allStores,
  storeStates,
  bizDateKey,
  username,
  limit = ACTIVE_MANAGER_COLD_VERIFY_LIMIT,
) {
  const key = storageKeyAmCold(bizDateKey, username)
  let ids = null

  if (typeof window !== 'undefined') {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed) && parsed.length) {
          ids = parsed.map(x => Number(x))
        }
      }
    } catch {
      /* ignore */
    }
  }

  const coldNow = listColdInactiveStores(allStores, storeStates)

  if (!ids || ids.length === 0) {
    if (coldNow.length === 0) return []
    ids = computeInitialBatchIds(allStores, storeStates, bizDateKey, username, limit, 'nawras_am_cold_v1')
    if (typeof window !== 'undefined' && ids.length > 0) {
      try {
        window.localStorage.setItem(key, JSON.stringify(ids))
      } catch {
        /* ignore */
      }
    }
  }

  const byId = {}
  ;(allStores || []).forEach(s => {
    const n = Number(s.id)
    byId[n] = s
  })

  const out = []
  for (const rawId of ids) {
    const id = Number(rawId)
    const s = byId[id]
    if (!s) continue
    const cat = storeStates?.[s.id]?.category || s.category || ''
    if (cat === 'cold_inactive') out.push(s)
  }
  return out
}

export function pickDailyColdInactiveStores(allStores, storeStates, bizDateKey, username, limit = COLD_INACTIVE_DAILY_LIMIT) {
  return getDailyColdBatchStores(allStores, storeStates, bizDateKey, username, limit)
}

function lastShipmentLabel(store) {
  const d = store?.last_shipment_date
  if (d && String(d).trim() !== '' && d !== 'لا يوجد') return String(d)
  return 'لا يوجد'
}

export function buildColdVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-cold-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'cold_verification',
    label: 'تحقيق بارد',
    desc: `غير نشط بارد — آخر شحنة: ${lastShipmentLabel(store)} — دفعة حتى ${COLD_INACTIVE_DAILY_LIMIT}؛ 9:00 ص (${bizDateKey})`,
    coldVerifyBatchDate: bizDateKey,
  }))
}

export function buildActiveManagerColdVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-am-cold-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'am_cold_verification',
    label: 'تحقيق بارد',
    desc: `غير نشط بارد — آخر شحنة: ${lastShipmentLabel(store)} — دفعة ${ACTIVE_MANAGER_COLD_VERIFY_LIMIT} ثابتة (لا استبدال اليوم)؛ 9:00 ص (${bizDateKey})`,
    amColdVerifyBatchDate: bizDateKey,
  }))
}
