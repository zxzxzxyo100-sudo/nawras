/**
 * طابور مسؤول المتاجر الجديدة (الاحتضان) — منطق الأداء والرقابة (تجريبي/تطوير فقط).
 */

/** يوم الدورة من الخادم (_cycle_day): المكالمة 1 = 1، المكالمة 2 = 3، المكالمة 3 = 10 */
export const INCUBATION_PERIODIC_CALL1_CYCLE_DAY = 1
export const INCUBATION_PERIODIC_CALL2_CYCLE_DAY = 3
export const INCUBATION_PERIODIC_CALL3_CYCLE_DAY = 10

/** وسوم satisfaction_gap_tags من التحقيق السريع: موظف الاحتضان لم يتصل في المرحلة المذكورة */
export const QV_MISSED_INC_TAG = {
  call1: 'qv_missed_inc_call_1',
  call2: 'qv_missed_inc_call_2',
  call3: 'qv_missed_inc_call_3',
}

/** تاريخ اليوم المحلي YYYY-MM-DD (للمطابقة مع مواعيد الاستحقاق) */
export function localDateYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysInSystem(store) {
  const raw = store?.registered_at
  if (!raw) return 0
  const t = new Date(raw).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86400000)
}

/**
 * يوم دورة الاحتضان 1…14 — مطابق لـ api-php/all-stores.php (incubation_cycle_day).
 * يُفضَّل `_cycle_day` من الخادم إن وُجد.
 */
export function getIncubationCycleDay(store) {
  const raw = store?._cycle_day
  if (raw != null && raw !== '') {
    const n = Number(raw)
    if (Number.isFinite(n)) return Math.min(14, Math.max(1, Math.floor(n)))
  }
  const days = daysInSystem(store)
  return Math.min(14, Math.max(1, days + 1))
}

export function isMoPeriodicTouchCycleDay(cycleDay) {
  return (
    cycleDay === INCUBATION_PERIODIC_CALL1_CYCLE_DAY
    || cycleDay === INCUBATION_PERIODIC_CALL2_CYCLE_DAY
    || cycleDay === INCUBATION_PERIODIC_CALL3_CYCLE_DAY
  )
}

export function retroStageMeta(days) {
  if (days <= 2) {
    return {
      key: 'call_1',
      label: 'مكالمة 1: ترحيب',
      badge: '[مكالمة 1: ترحيب]',
      rangeLabel: 'اليوم 0 — 2',
    }
  }
  if (days <= 9) {
    return {
      key: 'call_2',
      label: 'مكالمة 2: متابعة',
      badge: '[مكالمة 2: متابعة]',
      rangeLabel: 'اليوم 3 — 9',
    }
  }
  if (days <= 13) {
    return {
      key: 'call_3',
      label: 'مكالمة 3: تقييم',
      badge: '[مكالمة 3: تقييم]',
      rangeLabel: 'اليوم 10 — 13',
    }
  }
  return {
    key: 'beyond',
    label: 'بعد اليوم 13',
    badge: '[خارج النافذة]',
    rangeLabel: `يوم ${days}`,
  }
}

export function countAnsweredCalls(log) {
  return Object.values(log || {}).filter(c => {
    const o = String(c?.outcome ?? '').trim()
    return o === 'answered' || o === ''
  }).length
}

function onboardingDoneForStore(doneSet, storeId) {
  if (!doneSet || storeId == null) return false
  return doneSet.has(storeId) || doneSet.has(String(storeId)) || doneSet.has(Number(storeId))
}

function storeHasShipped(store) {
  if (!store) return false
  const n = Number(store.total_shipments ?? 0)
  if (n > 0) return true
  const d = store.last_shipment_date
  return Boolean(d && d !== 'لا يوجد')
}

function latestCallEntry(log) {
  const entries = Object.values(log || {}).filter(c => c?.date)
  if (!entries.length) return null
  entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  return entries[0]
}

/**
 * هل تاريخ سجل المكالمة (من الخادم، غالباً UTC) يقع في نفس اليوم التقويمي المحلي للمستخدم.
 * يصلح عدم ظهور «تم التواصل» عندما لا يطابق بادئة YYYY-MM-DD المحلية بسبب انزياح التوقيت.
 */
export function isCallLogDateLocalToday(dateStr, ref = new Date()) {
  if (!dateStr) return false
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return false
  return (
    d.getFullYear() === ref.getFullYear()
    && d.getMonth() === ref.getMonth()
    && d.getDate() === ref.getDate()
  )
}

export function hideDailyTaskDueToCallToday(log) {
  const top = latestCallEntry(log)
  if (!top?.date || !isCallLogDateLocalToday(top.date)) return false
  return String(top.outcome ?? '').trim() !== 'no_answer'
}

export function isContactedAnsweredToday(log) {
  const ref = new Date()
  return Object.values(log || {}).some(c => {
    if (!c?.date || !isCallLogDateLocalToday(c.date, ref)) return false
    const o = String(c.outcome ?? '').trim()
    return o === 'answered' || o === ''
  })
}

export function isDueForPeriodicStage(store, storeStates, days) {
  const st = storeStates[store.id] || {}
  const inc1 = st.inc_call1_at
  const inc2 = st.inc_call2_at
  const inc3 = st.inc_call3_at
  if (days <= 2) return !inc1
  if (days <= 9) return Boolean(inc1) && !inc2
  if (days <= 13) return Boolean(inc2) && !inc3
  return false
}

/**
 * هل مكالمة احتضان هذه المرحلة مُوثَّقة (نجاح/محتوى) بحيث لا تُعرَض في «متابعة دورية»
 * حتى يحين موعد المكالمة التالية حسب الخادم (_inc و inc_call*_at)؟
 * «عدم رد» لا يُعتبر إتماماً — يبقى المتابعة أو تبويب لم يتم الرد.
 */
export function incubationStageCallDocumentedNonNoAnswer(log, storeStateRow, incBucket) {
  if (!['call_1', 'call_1_delayed', 'call_2', 'call_3'].includes(incBucket)) return false
  const st = storeStateRow || {}
  if ((incBucket === 'call_1' || incBucket === 'call_1_delayed') && st.inc_call1_at) return true
  if (incBucket === 'call_2' && st.inc_call2_at) return true
  if (incBucket === 'call_3' && st.inc_call3_at) return true
  const key = incBucket === 'call_2' ? 'inc_call2' : incBucket === 'call_3' ? 'inc_call3' : 'inc_call1'
  const e = log?.[key]
  if (!e?.date) return false
  const o = String(e.outcome ?? '').trim()
  if (o === 'no_answer') return false
  return true
}

/**
 * قراءة وسم «لم يتصل في احتضان» من آخر استبيان للمتجر (get_surveys).
 */
export function parseQvMissedIncAlerts(surveyRow) {
  const empty = { call1: false, call2: false, call3: false }
  if (!surveyRow) return empty
  const raw = surveyRow.satisfaction_gap_tags
  let arr = []
  if (Array.isArray(raw)) arr = raw
  else if (typeof raw === 'string' && raw.trim()) {
    try {
      const p = JSON.parse(raw)
      arr = Array.isArray(p) ? p : []
    } catch {
      arr = []
    }
  }
  const set = new Set(arr.map(x => String(x).trim()))
  return {
    call1: set.has(QV_MISSED_INC_TAG.call1) || set.has('missed_inc_call_1'),
    call2: set.has(QV_MISSED_INC_TAG.call2) || set.has('missed_inc_call_2'),
    call3: set.has(QV_MISSED_INC_TAG.call3) || set.has('missed_inc_call_3'),
  }
}

/**
 * متابعة دورية: م1 يوم 1 فقط؛ م2 يوم 3؛ م3 يوم 10 — بدون استثناء أيام أخرى (لا 2 ولا 5 ولا 9).
 * بعد فوات النافذة (يوم > 3 بدون م2، يوم > 10 بدون م3) لا يُعاد الظهور في هذه القائمة.
 */
export function resolvePeriodicIncTouchpoint(incBucket, store, storeStates) {
  const st = storeStates[store.id] || {}
  const cd = getIncubationCycleDay(store)

  if (!st.inc_call1_at && incBucket === 'call_1_delayed') {
    return 'call_1_delayed'
  }
  if (!st.inc_call1_at && incBucket === 'call_1') {
    if (cd === INCUBATION_PERIODIC_CALL1_CYCLE_DAY) return 'call_1'
    return null
  }

  const betweenC1C2 = incBucket === 'between_calls' && st.inc_call1_at && !st.inc_call2_at
  if (!st.inc_call2_at && st.inc_call1_at && (incBucket === 'call_2' || betweenC1C2)) {
    if (cd > INCUBATION_PERIODIC_CALL2_CYCLE_DAY) return null
    if (cd === INCUBATION_PERIODIC_CALL2_CYCLE_DAY) return 'call_2'
    return null
  }

  const betweenC2C3 = incBucket === 'between_calls' && st.inc_call2_at && !st.inc_call3_at
  if (!st.inc_call3_at && st.inc_call2_at && (incBucket === 'call_3' || betweenC2C3)) {
    if (cd > INCUBATION_PERIODIC_CALL3_CYCLE_DAY) return null
    if (cd === INCUBATION_PERIODIC_CALL3_CYCLE_DAY) return 'call_3'
    return null
  }

  return null
}

export function isOverdueForStage(store, storeStates, days) {
  const st = storeStates[store.id] || {}
  const inc1 = st.inc_call1_at
  const inc2 = st.inc_call2_at
  const inc3 = st.inc_call3_at
  if (days >= 3 && days <= 9 && inc1 && !inc2) {
    const d1 = new Date(inc1).getTime()
    if (!Number.isNaN(d1) && Date.now() - d1 > 4 * 86400000) {
      return { overdue: true, hint: 'تأخّر المكالمة الثانية' }
    }
  }
  if (days >= 10 && days <= 13 && inc2 && !inc3) {
    const d2 = new Date(inc2).getTime()
    if (!Number.isNaN(d2) && Date.now() - d2 > 3 * 86400000) {
      return { overdue: true, hint: 'تأخّر المكالمة الثالثة' }
    }
  }
  if (days <= 2 && !inc1 && days >= 1) {
    return { overdue: true, hint: 'لم تُسجَّل المكالمة الأولى بعد' }
  }
  return { overdue: false, hint: '' }
}

/**
 * مهام مسؤول المتاجر الجديدة (احتضان) — بديل توليد المهام الافتراضي عند تفعيل الوضع الذكي.
 */
export function generateIncubationOfficerStagingTasks(
  allStores,
  callLogs,
  storeStates,
  newMerchantOnboardingDoneIds,
  isStagingOrDev,
) {
  const tasks = []

  allStores.forEach(store => {
    const log = callLogs[store.id] || {}
    const dbCat = storeStates[store.id]?.category || store.category
    const incBucket = store._inc
    const topCall = latestCallEntry(log)
    const lastCallDate = topCall?.date
    const callTodayHidesTask = hideDailyTaskDueToCallToday(log)
    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    const cat = storeStates[store.id]?.category || store.category || ''
    if (cat === 'hot_inactive' || cat === 'frozen') return

    const days = daysInSystem(store)
    const retro = retroStageMeta(days)

    if (days >= 14 && !storeHasShipped(store)) return
    if (days >= 11 && storeHasShipped(store) && countAnsweredCalls(log) === 0) return

    const cycleDay = getIncubationCycleDay(store)
    /** أي مهمة في هذه الصفحة فقط في أيام الموعد 1 و 3 و 10 — ما عدا «تأخير المكالمة الأولى» (يظهر يومياً) */
    if (incBucket !== 'call_1_delayed' && !isMoPeriodicTouchCycleDay(cycleDay)) return

    if (
      store.bucket === 'incubating'
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
    ) {
      const answeredToday = isContactedAnsweredToday(log) && hideDailyTaskDueToCallToday(log)
      const base = {
        id: `${store.id}-new-onboarding`,
        store,
        priority: 'normal',
        type: 'new_merchant_onboarding',
        label: 'استبيان تهيئة متجر جديد',
        desc: isStagingOrDev
          ? `يوم الدورة ${cycleDay} من 14 — كود ${store.id} — ${retro.label} — اضغط «اتصل» للاستبيان`
          : `قيّم تجربة التاجر — يوم الدورة ${cycleDay} من 14`,
        incubationBadge: retro.badge,
        moDays: days,
        moCycleDay: cycleDay,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: answeredToday,
        moOverdue: false,
        moOverdueHint: '',
      }
      tasks.push(base)
      return
    }

    if (['call_1', 'call_1_delayed', 'call_2', 'call_3', 'between_calls'].includes(incBucket)) {
      const periodicInc = resolvePeriodicIncTouchpoint(incBucket, store, storeStates)
      if (!periodicInc) return

      const incubationBadge =
        periodicInc === 'call_1_delayed'
          ? '⏰ تأخير المكالمة الأولى'
          : isStagingOrDev && periodicInc === 'call_2'
            ? '⚠️ المكالمة الثانية للمتجر'
            : isStagingOrDev && periodicInc === 'call_3'
              ? '🚨 المكالمة الثالثة والأخيرة'
              : retro.badge

      const answeredToday = isContactedAnsweredToday(log) && hideDailyTaskDueToCallToday(log)
      const overdueInfo = isOverdueForStage(store, storeStates, days)
      const due = isDueForPeriodicStage(store, storeStates, days)
      const needWork = due || overdueInfo.overdue
      const stRow = storeStates[store.id] || {}
      const stageDocumentedOk = incubationStageCallDocumentedNonNoAnswer(log, stRow, periodicInc)

      const label =
        periodicInc === 'call_1_delayed'
          ? 'مسار الاحتضان — تأخير المكالمة الأولى'
          : periodicInc === 'call_1'
            ? 'مسار الاحتضان — المكالمة الأولى'
            : periodicInc === 'call_2'
              ? 'مسار الاحتضان — المكالمة الثانية'
              : 'مسار الاحتضان — المكالمة الثالثة (تخريج)'

      const descBase = `سجّل المكالمة — يوم الدورة ${cycleDay} من 14 — كود ${store.id} — ${retro.label}`

      if (answeredToday) {
        tasks.push({
          id: `${store.id}-inc-${periodicInc}-done`,
          store,
          priority: 'normal',
          type: 'new_call',
          label: 'تم التواصل اليوم',
          desc: `${descBase}`,
          incubationBadge,
        moDays: days,
        moCycleDay: cycleDay,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: true,
        moOverdue: false,
        moOverdueHint: '',
        _incBucket: periodicInc,
        })
        return
      }

      /** مكالمة هذه المرحلة مُوثَّقة مسبقاً — لا تظهر في المتابعة الدورية؛ تعود مع المكالمة التالية حسب التوقيت */
      if (stageDocumentedOk) return

      if (!needWork && !overdueInfo.overdue) return

      tasks.push({
        id: `${store.id}-inc-${periodicInc}`,
        store,
        priority: periodicInc === 'call_1' || periodicInc === 'call_1_delayed' || periodicInc === 'call_3' ? 'high' : 'normal',
        type: 'new_call',
        label,
        desc: `${descBase} — الموعد يُحسب من الخادم بعد إتمام المكالمة السابقة`,
        incubationBadge,
        moDays: days,
        moCycleDay: cycleDay,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: false,
        moOverdue: overdueInfo.overdue,
        moOverdueHint: overdueInfo.hint,
        _incBucket: periodicInc,
      })
      return
    }

    if (incBucket === 'never_started') {
      if (callTodayHidesTask) return
      tasks.push({
        id: `${store.id}-never`,
        store,
        priority: daysSinceLast >= 3 ? 'high' : 'normal',
        type: 'recovery_call',
        label: 'استعادة — لم تبدأ بعد',
        desc: lastCallDate
          ? `آخر تواصل قبل ${daysSinceLast} يوم — يوم الدورة ${cycleDay}`
          : `لم يُتصل به قط — يوم الدورة ${cycleDay}`,
        moDays: days,
        moCycleDay: cycleDay,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: false,
        moOverdue: false,
        moOverdueHint: '',
      })
      return
    }

    if (incBucket === 'restoring') {
      if (callTodayHidesTask) return
      tasks.push({
        id: `${store.id}-restoring`,
        store,
        priority: daysSinceLast >= 2 ? 'high' : 'normal',
        type: 'recovery_call',
        label: 'متابعة جاري الاستعادة',
        desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم — يوم الدورة ${cycleDay}` : `يحتاج متابعة — يوم الدورة ${cycleDay}`,
        moDays: days,
        moCycleDay: cycleDay,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: false,
        moOverdue: false,
        moOverdueHint: '',
      })
    }
  })

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}

const MO_DEDUPE_TYPES = new Set(['new_call', 'new_merchant_onboarding'])

function mergeMoTaskGroup(group) {
  if (group.length === 1) return group[0]
  const onboarding = group.find(t => t.type === 'new_merchant_onboarding')
  const calls = group.filter(t => t.type === 'new_call')
  const call = calls.length
    ? [...calls].sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))[0]
    : null
  if (onboarding && call) {
    const priority = call.priority === 'high' || onboarding.priority === 'high' ? 'high' : 'normal'
    return {
      ...call,
      id: call.id,
      type: 'new_call',
      priority,
      label: `${call.label} · ${onboarding.label}`,
      desc: [call.desc, onboarding.desc].filter(Boolean).join(' — '),
      moContactedToday: Boolean(call.moContactedToday || onboarding.moContactedToday),
      moOverdue: Boolean(call.moOverdue || onboarding.moOverdue),
      moOverdueHint: call.moOverdueHint || onboarding.moOverdueHint || '',
      incubationBadge: call.incubationBadge ?? onboarding.incubationBadge,
      moMergedOnboarding: true,
    }
  }
  return [...group].sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))[0]
}

/**
 * صف واحد لكل متجر عند تعدّد مهام الاحتضان/التهيئة (مسؤول المتاجر الجديدة + التنفيذي).
 */
export function dedupeIncubationDailyTasksByStore(tasks) {
  if (!Array.isArray(tasks) || !tasks.length) return tasks
  const byStore = new Map()
  for (const t of tasks) {
    const sid = t.store?.id
    if (sid == null || !MO_DEDUPE_TYPES.has(t.type)) continue
    const k = String(sid)
    if (!byStore.has(k)) byStore.set(k, [])
    byStore.get(k).push(t)
  }
  const out = []
  const emitted = new Set()
  for (const t of tasks) {
    const sid = t.store?.id
    if (sid == null || !MO_DEDUPE_TYPES.has(t.type)) {
      out.push(t)
      continue
    }
    const k = String(sid)
    if (emitted.has(k)) continue
    emitted.add(k)
    const g = byStore.get(k) || [t]
    out.push(mergeMoTaskGroup(g))
  }
  return out.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}
