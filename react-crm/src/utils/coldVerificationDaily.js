/**
 * دفعة «تحقيق البارد» (غير نشط بارد): حتى 30 متجراً **لليوم الواحد** (يوم العمل يبدأ 9:00 صباحاً).
 * دفعة «تحقيق نشط يشحن»: حتى 20 متجراً — نفس منطق اليوم و9:00، مخزن منفصل.
 *
 * - عند أول بناء للدفعة في ذلك اليوم تُختار المعرفات (ترتيب حتمي) وتُحفَظ محلياً.
 * - عند تجميد أو اتصال يخرج المتجر من القائمة **لا يُستبدل** بآخر في نفس اليوم.
 * - دفعة جديدة فقط مع **يوم عمل جديد** بعد الساعة 9:00 صباحاً (مفتاح التخزين = يوم الدفعة).
 */

/** حد أقصى لدفعة غير النشط البارد (المهام اليومية). */
export const COLD_INACTIVE_DAILY_LIMIT = 30

/** حد أقصى لدفعة المتاجر النشطة «يشحن» (المهام اليومية). */
export const ACTIVE_SHIPPING_VERIFY_DAILY_LIMIT = 20

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
const STORAGE_KEY_ACTIVE_SHIP = 'nawras_active_ship_verify_daily_v1'

function storageKey(bizDateKey, username) {
  return `${STORAGE_KEY_PREFIX}|${bizDateKey}|${String(username || 'anon')}`
}

function storageKeyActiveShip(bizDateKey, username) {
  return `${STORAGE_KEY_ACTIVE_SHIP}|${bizDateKey}|${String(username || 'anon')}`
}

function listColdInactiveStores(allStores, storeStates) {
  return (allStores || []).filter(s => {
    const cat = storeStates?.[s.id]?.category || s.category || ''
    return cat === 'cold_inactive'
  })
}

/** ترتيب حتمي ثم أول `limit` معرفات — يُستدعى مرة عند إنشاء دفعة اليوم فقط. */
function computeInitialBatchIds(allStores, storeStates, bizDateKey, username, limit) {
  const cold = listColdInactiveStores(allStores, storeStates)
  const u = String(username || 'anon')
  const seed = `nawras_cold_v1|${bizDateKey}|${u}`
  const withRank = cold.map(s => ({
    id: Number(s.id),
    rank: hashStringToUint32(`${seed}|id:${s.id}`),
  }))
  withRank.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id - b.id))
  return withRank.slice(0, Math.min(limit, withRank.length)).map(x => x.id)
}

/**
 * يعيد متاجر «البارد» المندرجة في **دفعة اليوم المخزّنة** فقط، والتي لا تزال باردة.
 * لا إدخال بديل في نفس اليوم بعد استنفاد أو إخراج متاجر من الدفعة.
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
    ids = computeInitialBatchIds(allStores, storeStates, bizDateKey, username, limit)
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

/** اسم قديم — نفس سلوك `getDailyColdBatchStores`. */
export function pickDailyColdInactiveStores(allStores, storeStates, bizDateKey, username, limit = COLD_INACTIVE_DAILY_LIMIT) {
  return getDailyColdBatchStores(allStores, storeStates, bizDateKey, username, limit)
}

function listActiveShippingStores(allStores, storeStates) {
  return (allStores || []).filter(s => {
    const cat = storeStates?.[s.id]?.category || s.category || ''
    const bucket = s.bucket || ''
    if (bucket === 'active_shipping') return true
    return ['active_shipping', 'active', 'active_pending_calls'].includes(cat)
  })
}

function computeInitialActiveShipBatchIds(allStores, storeStates, bizDateKey, username, limit) {
  const pool = listActiveShippingStores(allStores, storeStates)
  const u = String(username || 'anon')
  const seed = `nawras_active_ship_v1|${bizDateKey}|${u}`
  const withRank = pool.map(s => ({
    id: Number(s.id),
    rank: hashStringToUint32(`${seed}|id:${s.id}`),
  }))
  withRank.sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.id - b.id))
  return withRank.slice(0, Math.min(limit, withRank.length)).map(x => x.id)
}

/**
 * دفعة يومية من متاجر «نشط يشحن» للتحقق — نفس منطق 9:00؛ لا استبدال داخل اليوم.
 */
export function getDailyActiveShippingVerifyStores(
  allStores,
  storeStates,
  bizDateKey,
  username,
  limit = ACTIVE_SHIPPING_VERIFY_DAILY_LIMIT,
) {
  const key = storageKeyActiveShip(bizDateKey, username)
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

  const poolNow = listActiveShippingStores(allStores, storeStates)

  if (!ids || ids.length === 0) {
    if (poolNow.length === 0) return []
    ids = computeInitialActiveShipBatchIds(allStores, storeStates, bizDateKey, username, limit)
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
    const bucket = s.bucket || ''
    const stillActive =
      bucket === 'active_shipping'
      || ['active_shipping', 'active', 'active_pending_calls'].includes(cat)
    if (stillActive) out.push(s)
  }
  return out
}

export function buildActiveShippingVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-active-ship-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'active_shipping_verification',
    label: 'تحقيق نشط يشحن',
    desc: `متجر نشط — دفعة يومية حتى ${ACTIVE_SHIPPING_VERIFY_DAILY_LIMIT}؛ يبدأ يوم العمل 9:00 ص (${bizDateKey})`,
    activeShipVerifyBatchDate: bizDateKey,
  }))
}

export function buildColdVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-cold-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'cold_verification',
    label: 'تحقيق بارد',
    desc: `متجر غير نشط بارد — دفعة يومية حتى ${COLD_INACTIVE_DAILY_LIMIT}؛ تُحدَّد دفعة جديدة 9:00 ص (${bizDateKey})`,
    coldVerifyBatchDate: bizDateKey,
  }))
}
