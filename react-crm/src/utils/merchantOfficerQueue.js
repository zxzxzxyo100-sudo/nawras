/**
 * طابور مسؤول المتاجر النشطة — منطق الأداء والرقابة (تجريبي/تطوير فقط).
 */

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

export function isContactedAnsweredToday(log, todayIso) {
  return Object.values(log || {}).some(c => {
    if (!c?.date || !String(c.date).startsWith(todayIso)) return false
    const o = String(c.outcome ?? '').trim()
    return o === 'answered' || o === ''
  })
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

export function generateMerchantOfficerStagingTasks(
  allStores,
  callLogs,
  storeStates,
  username,
  assignments,
  newMerchantOnboardingDoneIds,
) {
  const today = new Date().toISOString().split('T')[0]
  const tasks = []

  allStores.forEach(store => {
    const asgn = assignments[String(store.id)] || assignments[store.id]
    if (!asgn || asgn.assigned_to !== username) return

    const cat = storeStates[store.id]?.category || store.category || ''
    if (cat === 'hot_inactive' || cat === 'frozen') return

    const log = callLogs[store.id] || {}
    const days = daysInSystem(store)
    const retro = retroStageMeta(days)

    if (days >= 14 && !storeHasShipped(store)) return
    if (days >= 11 && storeHasShipped(store) && countAnsweredCalls(log) === 0) return

    const needsOnboarding =
      store.bucket === 'incubating'
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)

    if (needsOnboarding) {
      tasks.push({
        id: `${store.id}-new-onboarding-am`,
        store,
        priority: 'high',
        type: 'new_merchant_onboarding',
        label: 'استبيان تهيئة — متجر مُسنَد',
        desc: `يوم ${days} في النظام — كود ${store.id} — ${retro.label}`,
        incubationBadge: retro.badge,
        moDays: days,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: false,
        moOverdue: false,
        moOverdueHint: '',
      })
      return
    }

    const answeredToday = isContactedAnsweredToday(log, today)
    const due = isDueForPeriodicStage(store, storeStates, days)
    const overdueInfo = isOverdueForStage(store, storeStates, days)
    const needWork = due || overdueInfo.overdue

    const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
      ? Math.floor((Date.now() - new Date(store.last_shipment_date)) / 86400000)
      : 999
    const shipDesc = daysSinceShip < 999 ? `آخر شحنة قبل ${daysSinceShip} يوم` : 'لا توجد شحنات بعد'

    if (answeredToday && hideDailyTaskDueToCallToday(log, today)) {
      tasks.push({
        id: `${store.id}-assigned-mo-done`,
        store,
        priority: 'normal',
        type: 'assigned_store',
        label: 'تم التواصل اليوم',
        desc: `${shipDesc} — ${retro.label} — يوم ${days} — كود: ${store.id}`,
        incubationBadge: retro.badge,
        moDays: days,
        moRetro: retro,
        moStoreCode: store.id,
        moContactedToday: true,
        moOverdue: false,
        moOverdueHint: '',
      })
      return
    }

    if (!needWork) return

    tasks.push({
      id: `${store.id}-assigned-mo`,
      store,
      priority: overdueInfo.overdue || daysSinceShip >= 10 ? 'high' : 'normal',
      type: 'assigned_store',
      label: 'متابعة دورية — متجر مُسنَد',
      desc: `${shipDesc} — ${retro.label} — يوم ${days} — كود: ${store.id}`,
      incubationBadge: retro.badge,
      moDays: days,
      moRetro: retro,
      moStoreCode: store.id,
      moContactedToday: false,
      moOverdue: overdueInfo.overdue,
      moOverdueHint: overdueInfo.hint,
    })
  })

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}
