/**
 * دفعة «تحقيق البارد»: حتى 30 متجراً **لليوم الواحد** (يوم العمل يبدأ 9:00 صباحاً).
 *
 * - عند أول بناء للدفعة في ذلك اليوم تُختار حتى 30 معرفاً (ترتيب حتمي) وتُحفَظ محلياً.
 * - عند تجميد أو اتصال يخرج المتجر من البارد **لا يُستبدل** بآخر في نفس اليوم.
 * - دفعة جديدة فقط مع **يوم عمل جديد** بعد الساعة 9:00 صباحاً (مفتاح التخزين = يوم الدفعة).
 */

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

function storageKey(bizDateKey, username) {
  return `${STORAGE_KEY_PREFIX}|${bizDateKey}|${String(username || 'anon')}`
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
export function getDailyColdBatchStores(allStores, storeStates, bizDateKey, username, limit = 30) {
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
export function pickDailyColdInactiveStores(allStores, storeStates, bizDateKey, username, limit = 30) {
  return getDailyColdBatchStores(allStores, storeStates, bizDateKey, username, limit)
}

export function buildColdVerificationTasks(pickedStores, bizDateKey) {
  return pickedStores.map(store => ({
    id: `${store.id}-cold-verify-${bizDateKey}`,
    store,
    priority: 'normal',
    type: 'cold_verification',
    label: 'تحقيق بارد',
    desc: `متجر غير نشط بارد — دفعة يومية ثابتة؛ تُحدَّد دفعة جديدة 9:00 ص (${bizDateKey})`,
    coldVerifyBatchDate: bizDateKey,
  }))
}
