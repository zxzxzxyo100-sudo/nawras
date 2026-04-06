/**
 * طابور مسؤول المتاجر الجديدة (الاحتضان) — منطق الأداء والرقابة (تجريبي/تطوير فقط).
 */

import {
  ONBOARD_DAYS_AFTER_CALL1,
  ONBOARD_DAYS_AFTER_CALL2,
} from '../constants/onboardingSchedule'

/** تاريخ اليوم المحلي YYYY-MM-DD (للمطابقة مع مواعيد الاستحقاق) */
export function localDateYmd(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** تاريخ تقويمي بعد N يوم من طابع MySQL (محلي) */
function dueYmdAfterMysql(mysqlDatetime, addDays) {
  if (!mysqlDatetime) return null
  const t = new Date(mysqlDatetime)
  if (Number.isNaN(t.getTime())) return null
  t.setDate(t.getDate() + addDays)
  const y = t.getFullYear()
  const m = String(t.getMonth() + 1).padStart(2, '0')
  const day = String(t.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function daysInSystem(store) {
  const raw = store?.registered_at
  if (!raw) return 0
  const t = new Date(raw).getTime()
  if (Number.isNaN(t)) return 0
  return Math.floor((Date.now() - t) / 86400000)
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

function hideDailyTaskDueToCallToday(log, todayIso) {
  const top = latestCallEntry(log)
  if (!top?.date || !String(top.date).startsWith(todayIso)) return false
  return String(top.outcome ?? '').trim() !== 'no_answer'
}

export function isContactedAnsweredToday(log, todayIso) {
  return Object.values(log || {}).some(c => {
    if (!c?.date || !String(c.date).startsWith(todayIso)) return false
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
  if (!['call_1', 'call_2', 'call_3'].includes(incBucket)) return false
  const st = storeStateRow || {}
  if (incBucket === 'call_1' && st.inc_call1_at) return true
  if (incBucket === 'call_2' && st.inc_call2_at) return true
  if (incBucket === 'call_3' && st.inc_call3_at) return true
  const key = incBucket === 'call_1' ? 'inc_call1' : incBucket === 'call_2' ? 'inc_call2' : 'inc_call3'
  const e = log?.[key]
  if (!e?.date) return false
  const o = String(e.outcome ?? '').trim()
  if (o === 'no_answer') return false
  return true
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
 * متابعة دورية: يظهر المتجر في «يوم اللمس» المتفق فقط
 * — م1: يوم الدورة 1 (من الخادم _cycle_day)؛ م2/m3: يوم استحقاق المكالمة = inc_call* + الأيام في onboardingSchedule؛
 * مع إظهار إضافي عند التأخير المعتمد (نفس تلميحات isOverdueForStage).
 */
export function isAgreedPeriodicFollowUpDay(incBucket, store, storeStates, days, todayYmd) {
  const st = storeStates[store.id] || {}
  const cycleDay = store._cycle_day != null ? Number(store._cycle_day) : (days + 1)

  if (incBucket === 'call_1') {
    if (st.inc_call1_at) return false
    if (cycleDay === 1) return true
    const ov = isOverdueForStage(store, storeStates, days)
    return ov.overdue && ov.hint === 'لم تُسجَّل المكالمة الأولى بعد'
  }

  if (incBucket === 'call_2') {
    if (st.inc_call2_at) return false
    const due = dueYmdAfterMysql(st.inc_call1_at, ONBOARD_DAYS_AFTER_CALL1)
    if (due && todayYmd === due) return true
    const ov = isOverdueForStage(store, storeStates, days)
    return ov.overdue && ov.hint === 'تأخّر المكالمة الثانية'
  }

  if (incBucket === 'call_3') {
    if (st.inc_call3_at) return false
    const due = dueYmdAfterMysql(st.inc_call2_at, ONBOARD_DAYS_AFTER_CALL2)
    if (due && todayYmd === due) return true
    const ov = isOverdueForStage(store, storeStates, days)
    return ov.overdue && ov.hint === 'تأخّر المكالمة الثالثة'
  }

  return true
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
  const today = localDateYmd(new Date())
  const tasks = []

  allStores.forEach(store => {
    const log = callLogs[store.id] || {}
    const dbCat = storeStates[store.id]?.category || store.category
    const incBucket = store._inc
    const topCall = latestCallEntry(log)
    const lastCallDate = topCall?.date
    const callTodayHidesTask = hideDailyTaskDueToCallToday(log, today)
    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    const cat = storeStates[store.id]?.category || store.category || ''
    if (cat === 'hot_inactive' || cat === 'frozen') return

    const days = daysInSystem(store)
    const retro = retroStageMeta(days)

    if (days >= 14 && !storeHasShipped(store)) return
    if (days >= 11 && storeHasShipped(store) && countAnsweredCalls(log) === 0) return

    if (
      store.bucket === 'incubating'
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
    ) {
      const answeredToday = isContactedAnsweredToday(log, today) && hideDailyTaskDueToCallToday(log, today)
      const base = {
        id: `${store.id}-new-onboarding`,
        store,
        priority: 'normal',
        type: 'new_merchant_onboarding',
        label: 'استبيان تهيئة متجر جديد',
        desc: isStagingOrDev
          ? `يوم ${days} — كود ${store.id} — ${retro.label} — اضغط «اتصل» للاستبيان`
          : `قيّم تجربة التاجر — يوم ${days} في النظام`,
        incubationBadge: retro.badge,
        moDays: days,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: answeredToday,
        moOverdue: false,
        moOverdueHint: '',
      }
      tasks.push(base)
      return
    }

    if (['call_1', 'call_2', 'call_3'].includes(incBucket)) {
      const incubationBadge =
        isStagingOrDev && incBucket === 'call_2'
          ? '⚠️ المكالمة الثانية للمتجر'
          : isStagingOrDev && incBucket === 'call_3'
            ? '🚨 المكالمة الثالثة والأخيرة'
            : retro.badge

      const answeredToday = isContactedAnsweredToday(log, today) && hideDailyTaskDueToCallToday(log, today)
      const overdueInfo = isOverdueForStage(store, storeStates, days)
      const due = isDueForPeriodicStage(store, storeStates, days)
      const needWork = due || overdueInfo.overdue
      const stRow = storeStates[store.id] || {}
      const stageDocumentedOk = incubationStageCallDocumentedNonNoAnswer(log, stRow, incBucket)

      /** لا تُدرَج في المتابعة الدورية إلا في «يوم اللمس» المتفق (أو تأخير معتمد) */
      if (!isAgreedPeriodicFollowUpDay(incBucket, store, storeStates, days, today)) return

      const label =
        incBucket === 'call_1'
          ? 'مسار الاحتضان — المكالمة الأولى'
          : incBucket === 'call_2'
            ? 'مسار الاحتضان — المكالمة الثانية'
            : 'مسار الاحتضان — المكالمة الثالثة (تخريج)'

      const descBase = `سجّل المكالمة — يوم ${days} — كود ${store.id} — ${retro.label}`

      if (answeredToday) {
        tasks.push({
          id: `${store.id}-inc-${incBucket}-done`,
          store,
          priority: 'normal',
          type: 'new_call',
          label: 'تم التواصل اليوم',
          desc: `${descBase}`,
          incubationBadge,
          moDays: days,
          moRetro: retro,
          moStoreCode: store.id,
          moContactedToday: true,
          moOverdue: false,
          moOverdueHint: '',
          _incBucket: incBucket,
        })
        return
      }

      /** مكالمة هذه المرحلة مُوثَّقة مسبقاً — لا تظهر في المتابعة الدورية؛ تعود مع المكالمة التالية حسب التوقيت */
      if (stageDocumentedOk) return

      if (!needWork && !overdueInfo.overdue) return

      tasks.push({
        id: `${store.id}-inc-${incBucket}`,
        store,
        priority: incBucket === 'call_1' || incBucket === 'call_3' ? 'high' : 'normal',
        type: 'new_call',
        label,
        desc: `${descBase} — الموعد يُحسب من الخادم بعد إتمام المكالمة السابقة`,
        incubationBadge,
        moDays: days,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: false,
        moOverdue: overdueInfo.overdue,
        moOverdueHint: overdueInfo.hint,
        _incBucket: incBucket,
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
        desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم — يوم ${days}` : `لم يُتصل به قط — يوم ${days}`,
        moDays: days,
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
        desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'يحتاج متابعة',
        moDays: days,
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
