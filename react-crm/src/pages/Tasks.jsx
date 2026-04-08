import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, RefreshCw, CheckCircle, X, ClipboardList, Snowflake,
} from 'lucide-react'
import { useStores }  from '../contexts/StoresContext'
import { useAuth }    from '../contexts/AuthContext'
import { usePoints }  from '../contexts/PointsContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import StoreDrawer    from '../components/StoreDrawer'
import StoreNameWithId from '../components/StoreNameWithId'
import {
  getDailyTaskDismissals, markDailyTaskDone, logCall, markSurveyNoAnswer, getMyWorkflow,
  completeInactiveQueueSuccess,
  postMerchantOfficerAutomation,
} from '../services/api'
import {
  generateIncubationOfficerStagingTasks,
  daysInSystem,
  countAnsweredCalls,
  dedupeIncubationDailyTasksByStore,
  hideDailyTaskDueToCallToday,
  isCallLogDateLocalToday,
  isContactedAnsweredToday,
} from '../utils/merchantOfficerQueue'
import {
  getBizDateKeyAt9am,
  getDailyColdBatchStores,
  buildColdVerificationTasks,
  getDailyActiveManagerColdBatchStores,
  buildActiveManagerColdVerificationTasks,
  COLD_INACTIVE_DAILY_LIMIT,
  ACTIVE_MANAGER_COLD_VERIFY_LIMIT,
} from '../utils/coldVerificationDaily'
import { needsActiveSatisfactionSurvey } from '../constants/satisfactionSurvey'
import { needsNewMerchantOnboardingSurvey } from '../constants/newMerchantOnboardingSurvey'
import NewMerchantOnboardingModal from '../components/NewMerchantOnboardingModal'
import InactiveGoalCelebration, { InactiveGoalCounterBadge } from '../components/InactiveGoalCelebration'
import { IS_SIMPLE_LOG_CALL_MODAL, IS_STAGING_OR_DEV } from '../config/envFlags'
import { NawrasHeroImageLayer, NawrasTaglineStack } from '../components/NawrasBrandBackdrop'

const MIN_TASK_NOTE_LENGTH = 10

/** مسؤول الاحتضان: طابور المهام بأيام الدورة 1 و 3 و 10 (مصدر التاريخ `_cycle_day` من الخادم) */

function storeHasShipped(store) {
  if (!store) return false
  const n = Number(store.total_shipments ?? 0)
  if (n > 0) return true
  const d = store.last_shipment_date
  return Boolean(d && d !== 'لا يوجد')
}

/** نوع المكالمة لـ log_call حسب مفتاح المهمة */
function taskIdToCallType(taskId) {
  const m = String(taskId).match(/-inc-(call_[123])(?:-done)?$/)
  if (m) {
    const n = m[1].replace('call_', '')
    return `inc_call${n}`
  }
  return 'general'
}

/** أحدث سجل مكالمة للمتجر (حسب التاريخ) */
function latestCallEntry(log) {
  const entries = Object.values(log || {}).filter(c => c?.date)
  if (!entries.length) return null
  entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  return entries[0]
}

/** كل صفوف السجل ذات تاريخ (يشمل general_answered من الخادم) */
function callLogTimelineEntries(log) {
  return Object.values(log || {}).filter(c => c && typeof c === 'object' && c.date)
}

/**
 * أحدث حدث زمنياً بين كل أنواع المكالمات — عند التعادل تُفضَّل «تم الرد» على «لم يرد»
 * (مهم عندما يكون general = لم يرد لكن general_answered = تم الرد سابقاً).
 */
function lastChronologicalCallEntry(log) {
  const entries = callLogTimelineEntries(log)
  if (!entries.length) return null
  const rank = o => {
    const x = String(o ?? '').trim()
    if (x === 'answered' || x === 'callback' || x === '') return 2
    if (x === 'no_answer') return 0
    return 1
  }
  entries.sort((a, b) => {
    const tb = new Date(b.date).getTime()
    const ta = new Date(a.date).getTime()
    if (tb !== ta) return tb - ta
    return rank(b.outcome) - rank(a.outcome)
  })
  return entries[0]
}

/** آخر نتيجة في الخط الزمني تُلغي بقاء المتجر تحت «لم يرد» في الواجهة */
function latestOutcomeClearsNoAnswerUi(log) {
  const top = lastChronologicalCallEntry(log)
  const oc = String(top?.outcome ?? '').trim()
  return oc === 'answered' || oc === 'callback' || oc === ''
}

/** مهمة ضمن تبويب «متاجر لم ترد»: آخر مكالمة عدم رد، أو تعيين سير عمل no_answer */
function taskIsNoAnswer(task, callLogs, assignments) {
  if ((task.type === 'assigned_store' || task.type === 'new_merchant_onboarding') && assignments) {
    const a = assignments[String(task.store.id)] || assignments[task.store.id]
    if (a?.workflow_status === 'completed') return false
  }
  const log = callLogs[task.store.id] || {}
  if (latestOutcomeClearsNoAnswerUi(log)) return false
  const top = lastChronologicalCallEntry(log)
  if (top && String(top.outcome ?? '').trim() === 'no_answer') return true
  if ((task.type === 'assigned_store' || task.type === 'new_merchant_onboarding') && assignments) {
    const a = assignments[String(task.store.id)] || assignments[task.store.id]
    if (a?.workflow_status === 'no_answer') return true
  }
  if (task.type === 'recovery_call' && task.workflowQueue === 'inactive' && assignments) {
    const a = assignments[String(task.store.id)] || assignments[task.store.id]
    if (a?.assignment_queue === 'inactive' && a?.workflow_status === 'no_answer') return true
  }
  return false
}

/** تاريخ التعيين قبل اليوم التقويمي المحلي (متابعة متأخرة من يوم سابق) */
function assignmentLocalCalendarBeforeToday(assignedAtStr, ref = new Date()) {
  if (!assignedAtStr) return false
  const a = new Date(assignedAtStr)
  if (Number.isNaN(a.getTime())) return false
  const r0 = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate()).getTime()
  const a0 = new Date(a.getFullYear(), a.getMonth(), a.getDate()).getTime()
  return a0 < r0
}

// ══════════════════════════════════════════════════════════════════
// توليد المهام — مسار الاحتضان (الوضع الذكي): لمسات دورية يوم 1 / 3 / 10 من دورة التسجيل؛
// بين المكالمات يُدرَج يوم 3 و 10 فقط؛ فوات النافذة يخفي المهمة إلا بوسم التحقيق السريع في الاستبيان.
// ══════════════════════════════════════════════════════════════════
function onboardingDoneForStore(doneSet, storeId) {
  if (!doneSet || storeId == null) return false
  return doneSet.has(storeId) || doneSet.has(String(storeId)) || doneSet.has(Number(storeId))
}

/**
 * مسؤول المتاجر النشطة — التجريب/التطوير: وسوم صف المهمة حسب مرحلة الاحتضان (_inc).
 * [مكالمة أولى] جديد؛ [مكالمة ثانية] بعد 3 أيام؛ [مكالمة ثالثة] بعد 10 أيام.
 */
function activeManagerStagingCallPhase(incBucket, needsOnboarding) {
  if (needsOnboarding) {
    return {
      label: 'استبيان تهيئة — مُسنَد',
      incubationBadge: '[استبيان جديد]',
      descHint: 'استبيان التهيئة (نعم/لا) — ثم حفظ المكالمة أو لم يرد',
    }
  }
  switch (incBucket) {
    case 'call_1':
      return {
        label: 'متجر مُسنَد إليك',
        incubationBadge: '[مكالمة أولى]',
        descHint: 'جديد — المكالمة الأولى',
      }
    case 'call_2':
      return {
        label: 'متجر مُسنَد إليك',
        incubationBadge: '[مكالمة ثانية]',
        descHint: 'بعد 3 أيام من إتمام المكالمة الأولى',
      }
    case 'call_3':
      return {
        label: 'متجر مُسنَد إليك',
        incubationBadge: '[مكالمة ثالثة]',
        descHint: 'بعد 10 أيام من إتمام المكالمة الثانية',
      }
    case 'between_calls':
      return {
        label: 'متجر مُسنَد إليك',
        incubationBadge: '[بين المكالمات]',
        descHint: 'انتظار نافذة المكالمة التالية',
      }
    default:
      return {
        label: 'متجر مُسنَد إليك',
        incubationBadge: null,
        descHint: '',
      }
  }
}

/** هل سجل المكالمة يخص المستخدم الحالي؟ (الخادم يخزّن performed_by أحياناً كاسم كامل وأحياناً كاسم الدخول) */
function callLogPerformedByMatchesUser(performedBy, username, fullname) {
  const w = String(performedBy ?? '').trim()
  if (!w) return false
  const u = String(username ?? '').trim()
  if (u && w === u) return true
  const f = String(fullname ?? '').trim()
  if (f && w === f) return true
  return false
}

/** «تم الرد» اليوم من نفس المستخدم (اسم الدخول أو الاسم الظاهر في سجل المكالمات) */
function isContactedAnsweredTodayForUser(log, username, fullname, ref = new Date()) {
  return callLogTimelineEntries(log).some(c => {
    if (!c?.date || !isCallLogDateLocalToday(c.date, ref)) return false
    if (!callLogPerformedByMatchesUser(c.performed_by, username, fullname)) return false
    const o = String(c.outcome ?? '').trim()
    return o === 'answered' || o === 'callback' || o === ''
  })
}

function generateTasks(allStores, callLogs, storeStates, userRole, username, assignments, inactiveWf, newMerchantOnboardingDoneIds, userFullname = '') {
  /** مسؤول الاستعادة: طابور 50 متجر غير نشط فقط (سير عمل من الخادم) */
  if (userRole === 'inactive_manager') {
    const tasks = []
    const rows = [
      ...(inactiveWf?.active_tasks || []),
      ...(inactiveWf?.no_answer_tasks || []),
    ]
    for (const row of rows) {
      const store = allStores.find(s => String(s.id) === String(row.store_id))
      if (!store) continue
      const log = callLogs[store.id] || {}
      const lastCallDate = latestCallEntry(log)?.date
      const callTodayHidesTask = hideDailyTaskDueToCallToday(log)
      const daysSinceLast = lastCallDate
        ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
        : 999
      if (callTodayHidesTask) continue
      tasks.push({
        id: `${store.id}-recovery-inactive`,
        store,
        priority: daysSinceLast >= 7 ? 'high' : 'normal',
        type: 'recovery_call',
        label: 'مكالمة استعادة',
        desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        workflowQueue: 'inactive',
      })
    }
    return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
  }

  /** مسؤول المتاجر الجديدة — منطق التجريب/التطوير: طابور احتضان + تبويبات (لا يعتمد على الإسناد) */
  if (userRole === 'incubation_manager') {
    return generateIncubationOfficerStagingTasks(
      allStores,
      callLogs,
      storeStates,
      newMerchantOnboardingDoneIds,
      IS_STAGING_OR_DEV,
    )
  }

  const tasks = []
  /** التنفيذي: نفس طابور مسؤول الاحتضان (دورة 14 يوماً) + مهام إضافية (استعادة ساخن/بارد، متابعة نشط) */
  if (userRole === 'executive') {
    tasks.push(
      ...generateIncubationOfficerStagingTasks(
        allStores,
        callLogs,
        storeStates,
        newMerchantOnboardingDoneIds,
        IS_STAGING_OR_DEV,
      ),
    )
  }
  const skipExecMoDuplicates = userRole === 'executive'

  /** كل التعيينات النشطة — سقف الـ 50 يُطبَّق فقط على تبويب «متابعة دورية» */
  const amActiveIds = (() => {
    if (userRole !== 'active_manager' || !assignments) return null
    const active = Object.entries(assignments)
      .filter(([, a]) => a?.assigned_to === username && a?.workflow_status === 'active' && a?.assignment_queue === 'active')
      .map(([sid]) => sid)
    return new Set(active)
  })()

  allStores.forEach(store => {
    const log          = callLogs[store.id] || {}
    const dbCat        = storeStates[store.id]?.category || store.category
    const incBucket    = store._inc
    const topCall      = latestCallEntry(log)
    const lastCallDate = topCall?.date
    const callTodayHidesTask = hideDailyTaskDueToCallToday(log)
    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    const execOrIncOfficer = ['incubation_manager', 'executive'].includes(userRole)
    const needsNewOnboarding =
      store.bucket === 'incubating'
      && execOrIncOfficer
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
    const onbDesc = IS_STAGING_OR_DEV
      ? 'اضغط «اتصل» ليظهر استبيان التهيئة (ثلاثة أسئلة) فوراً، ثم سجّل المكالمة من البطاقة — أو من لوحة المتاجر الجديدة'
      : 'قيّم تجربة التاجر ثم اضغط «تم» في الاستبيان — أو من لوحة المتاجر الجديدة'

    if (!skipExecMoDuplicates && ['call_1', 'call_2', 'call_3'].includes(incBucket) && execOrIncOfficer) {
      const incubationBadge =
        IS_STAGING_OR_DEV && incBucket === 'call_2'
          ? '⚠️ المكالمة الثانية للمتجر'
          : IS_STAGING_OR_DEV && incBucket === 'call_3'
            ? '🚨 المكالمة الثالثة والأخيرة'
            : null
      const incLabel =
        incBucket === 'call_1' ? 'مسار الاحتضان — المكالمة الأولى'
          : incBucket === 'call_2' ? 'مسار الاحتضان — المكالمة الثانية'
            : 'مسار الاحتضان — المكالمة الثالثة (تخريج)'
      const incDesc =
        'سجّل المكالمة من صفحة المتاجر أو الاتصال السريع — الموعد يُحسب من الخادم بعد إتمام المكالمة السابقة'
      const incTask = {
        id: `${store.id}-inc-${incBucket}`,
        store,
        priority: incBucket === 'call_1' || incBucket === 'call_3' ? 'high' : 'normal',
        type: 'new_call',
        label: incLabel,
        desc: incDesc,
        incubationBadge,
      }
      /** التنفيذي: صف واحد — كانت تُضاف مهمتان منفصلتان لنفس المتجر */
      if (userRole === 'executive' && needsNewOnboarding) {
        tasks.push({
          ...incTask,
          label: `${incLabel} · استبيان تهيئة متجر جديد`,
          desc: `${incDesc} — ${onbDesc}`,
          moMergedOnboarding: true,
        })
      } else {
        tasks.push(incTask)
      }
    }

    if (!skipExecMoDuplicates && needsNewOnboarding) {
      const mergedIntoIncCall =
        userRole === 'executive' && ['call_1', 'call_2', 'call_3'].includes(incBucket)
      if (!mergedIntoIncCall) {
        tasks.push({
          id: `${store.id}-new-onboarding`,
          store,
          priority: 'normal',
          type: 'new_merchant_onboarding',
          label: 'استبيان تهيئة متجر جديد',
          desc: onbDesc,
        })
      }
    }

    if (!skipExecMoDuplicates && incBucket === 'never_started' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-never`, store,
          priority: daysSinceLast >= 3 ? 'high' : 'normal',
          type: 'recovery_call', label: 'استعادة — لم تبدأ بعد',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به قط',
        })
      }
    }

    if (!skipExecMoDuplicates && incBucket === 'restoring' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-restoring`, store,
          priority: daysSinceLast >= 2 ? 'high' : 'normal',
          type: 'recovery_call', label: 'متابعة جاري الاستعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'يحتاج متابعة',
        })
      }
    }

    if (['hot_inactive', 'cold_inactive'].includes(dbCat) && userRole === 'executive') {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-recovery`, store,
          priority: daysSinceLast >= 7 ? 'high' : 'normal',
          type: 'recovery_call', label: 'مكالمة استعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        })
      }
    }

    if (userRole === 'executive' && dbCat === 'active_shipping') {
      const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
        ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
        : 999
      if (daysSinceShip >= 10 && !callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-followup`, store,
          priority: daysSinceShip >= 14 ? 'high' : 'normal',
          type: 'followup_call', label: 'متابعة متجر نشط',
          desc: `لم يشحن منذ ${daysSinceShip} يوم`,
        })
      }
    }

    if (userRole === 'active_manager' && username && assignments && amActiveIds) {
      const asgn = assignments[String(store.id)] || assignments[store.id]
      if (asgn?.assigned_to === username && (amActiveIds.has(String(store.id)) || asgn?.workflow_status !== 'active')) {
        /** «تم التواصل» = workflow مكتمل أو «تم الرد» اليوم من نفس الموظف (performed_by = اسم كامل أو يوزر) */
        const moContactedToday =
          asgn?.workflow_status === 'completed'
          || isContactedAnsweredTodayForUser(log, username, userFullname)
        const assignedAtTs = asgn?.assigned_at ? new Date(asgn.assigned_at).getTime() : 0
        const limboCallNotAnsweredToday =
          hideDailyTaskDueToCallToday(log)
          && !isContactedAnsweredTodayForUser(log, username, userFullname)
        const assignedBeforeToday = assignmentLocalCalendarBeforeToday(asgn?.assigned_at)
        const draft = {
          store,
          moContactedToday,
          amTaskInDelays: false,
          assignedAtTs,
        }
        const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
          ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
          : 999
        const needsOnboarding =
          store.bucket === 'incubating'
          && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
        const shipDesc = daysSinceShip < 999 ? `آخر شحنة قبل ${daysSinceShip} يوم` : 'لا توجد شحنات بعد'
        const stagingAm = IS_STAGING_OR_DEV
          ? activeManagerStagingCallPhase(incBucket, needsOnboarding)
          : null
        /** مسؤول المتاجر: مهمة استبيان التهيئة منفصلة (نفس مسار المكالمة المبسّط) — لا تُكرَّر مع «متجر مُسنَد» */
        if (needsOnboarding) {
          const t = {
            id: `${store.id}-new-onboarding-am`,
            ...draft,
            priority: 'high',
            type: 'new_merchant_onboarding',
            label: stagingAm?.label ?? 'استبيان تهيئة — متجر مُسنَد إليك',
            incubationBadge: stagingAm?.incubationBadge,
            desc: stagingAm
              ? `${shipDesc} — ${stagingAm.descHint} — اضغط «اتصل»`
              : `${shipDesc} — أكمل استبيان التهيئة من «اتصل» ثم سجّل المكالمة`,
          }
          t.amTaskInDelays =
            !taskIsNoAnswer(t, callLogs, assignments)
            && !moContactedToday
            && (assignedBeforeToday || limboCallNotAnsweredToday)
          tasks.push(t)
        } else {
          const descBase = shipDesc
          const desc = stagingAm?.descHint
            ? `${descBase} — ${stagingAm.descHint} — اضغط «تسجيل مكالمة»`
            : descBase
          const t = {
            id: `${store.id}-assigned`,
            ...draft,
            priority: daysSinceShip >= 10 ? 'high' : 'normal',
            type: 'assigned_store',
            label: stagingAm?.label ?? 'متجر مُسنَد إليك',
            incubationBadge: stagingAm?.incubationBadge ?? undefined,
            desc,
          }
          t.amTaskInDelays =
            !taskIsNoAnswer(t, callLogs, assignments)
            && !moContactedToday
            && (assignedBeforeToday || limboCallNotAnsweredToday)
          tasks.push(t)
        }
      }
    }
  })

  /**
   * مسؤول المتاجر النشطة: أي متجر سجّل له «تم الرد» هذا الشهر من هذا المستخدم
   * يظهر في «تم التواصل» حتى لو لم يعد التعيين موجوداً في قاعدة البيانات.
   */
  if (userRole === 'active_manager' && username) {
    const now = new Date()
    const cutoff = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)
    const generatedIds = new Set(tasks.map(t => String(t.store.id)))
    allStores.forEach(store => {
      if (generatedIds.has(String(store.id))) return
      const log = callLogs[store.id] || {}
      const hasAnsweredThisMonth = callLogTimelineEntries(log).some(entry => {
        if (!entry?.date) return false
        if (!callLogPerformedByMatchesUser(entry?.performed_by, username, userFullname)) return false
        const o = String(entry?.outcome ?? '').trim()
        if (o !== 'answered' && o !== 'callback' && o !== '') return false
        const d = new Date(entry.date)
        return d >= cutoff
      })
      if (!hasAnsweredThisMonth) return
      tasks.push({
        id: `${store.id}-contacted-month`,
        store,
        moContactedToday: true,
        amTaskInDelays: false,
        assignedAtTs: 0,
        priority: 'normal',
        type: 'assigned_store',
        label: 'متجر مُسنَد إليك',
        desc: '',
      })
    })
  }

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}

// ══════════════════════════════════════════════════════════════════
// رمز النورس (طائر النورس كزخرفة في الخلفية)
// ══════════════════════════════════════════════════════════════════
function SeagullMark({ size = 100, opacity = 0.07 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" fill="white" opacity={opacity} aria-hidden="true">
      {/* جسم */}
      <ellipse cx="60" cy="38" rx="22" ry="9" />
      {/* الجناح الأيسر */}
      <path d="M52,33 C38,14 6,18 2,28 C18,24 36,28 50,33 Z" />
      {/* الجناح الأيمن */}
      <path d="M68,33 C82,14 114,18 118,28 C102,24 84,28 70,33 Z" />
      {/* الرأس */}
      <circle cx="79" cy="31" r="7" />
      {/* المنقار */}
      <path d="M85,30 L95,32 L85,34 Z" />
      {/* الذيل */}
      <path d="M40,39 L25,45 L33,44 L23,52 L40,42 Z" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════
// زر الاتصال مع تأثير Ripple
// ══════════════════════════════════════════════════════════════════
function CallButton({ onClick, disabled = false }) {
  const [rippling, setRippling] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    if (disabled) return
    setRippling(true)
    setTimeout(() => setRippling(false), 650)
    onClick()
  }

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      whileHover={{ scale: disabled ? 1 : 1.06, y: disabled ? 0 : -1 }}
      whileTap={{ scale: disabled ? 1 : 0.9 }}
      className="relative overflow-hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-50 disabled:pointer-events-none"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
      }}
    >
      <Phone size={12} />
      اتصل
      <AnimatePresence>
        {rippling && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.55) 0%, transparent 65%)',
            }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  )
}

/** صف مهمّة خفيف — مسؤول المتاجر (تجريبي) */
function MerchantOfficerTaskRow({
  task,
  index,
  onCall,
  onDone,
  onNoAnswerWorkflow,
  noAnswerLoading,
  userRole,
  doneDisabled,
  hideDoneButton,
  taskIsNoAnswerFn,
  callLogs,
  assignments,
}) {
  const noAns = taskIsNoAnswerFn(task, callLogs, assignments)
  const showNoAnswer =
    typeof onNoAnswerWorkflow === 'function'
    && ((task.type === 'assigned_store' && userRole === 'active_manager')
      || (task.type === 'new_merchant_onboarding' && userRole === 'active_manager')
      || (task.type === 'new_call' && ['incubation_manager', 'executive'].includes(userRole))
      || (task.type === 'new_merchant_onboarding' && ['incubation_manager', 'executive'].includes(userRole))
      || task.type === 'recovery_call')
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.15) }}
      className={`flex flex-wrap items-center gap-3 border-b border-slate-100 bg-white px-3 py-3 sm:px-4 ${
        noAns ? 'border-r-4 border-r-amber-400 bg-amber-50/40' : ''
      } ${task.moOverdue ? 'bg-rose-50/30' : ''}`}
    >
      <div className="min-w-0 flex-1 text-right">
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className="font-bold text-slate-900 text-sm">
            <StoreNameWithId
              store={task.store}
              nameClassName="font-bold text-slate-900 text-sm"
              idClassName="font-mono text-xs text-slate-500"
            />
          </span>
          {task.incubationBadge ? (
            <span className="rounded-md bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-900">
              {task.incubationBadge}
            </span>
          ) : null}
          {task.amTaskInDelays ? (
            <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-900">
              متأخر — يحتاج تم الرد
            </span>
          ) : null}
          {task.moOverdue ? (
            <span className="rounded-md bg-amber-200/90 px-2 py-0.5 text-[10px] font-black text-amber-950">
              تنبيه: {task.moOverdueHint}
            </span>
          ) : null}
          {task.moContactedToday ? (
            <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-900">تم التواصل اليوم</span>
          ) : null}
        </div>
        <p className="mt-1 text-xs text-slate-600">
          كود المتجر: <span className="font-mono font-bold">{task.moStoreCode ?? task.store.id}</span>
          {' — '}
          {task.moCycleDay != null ? (
            <>
              يوم الدورة <span className="font-mono font-bold tabular-nums text-violet-900">{task.moCycleDay}</span>
              من 14
              {task.moDays != null ? (
                <>
                  {' '}
                  (<span className="tabular-nums">{task.moDays}</span> يوماً مضت منذ التسجيل)
                </>
              ) : null}
            </>
          ) : (
            <>
              <span className="tabular-nums">{task.moDays ?? '—'}</span> يوماً في النظام
            </>
          )}
          {task.moRetro ? (
            <span className="mr-2 text-violet-800 font-semibold">{task.moRetro.label}</span>
          ) : null}
        </p>
        {task.desc ? <p className="mt-0.5 text-[11px] text-slate-500 line-clamp-2">{task.desc}</p> : null}
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center justify-end gap-2">
        {task.moContactedToday ? (
          <motion.button
            type="button"
            onClick={() => onCall(task)}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
          >
            <ClipboardList size={14} className="text-slate-500" aria-hidden />
            سجل
          </motion.button>
        ) : (
          <>
            <CallButton onClick={() => onCall(task)} />
            {showNoAnswer && (
              <motion.button
                type="button"
                onClick={() => onNoAnswerWorkflow(task)}
                disabled={noAnswerLoading}
                whileHover={{ scale: noAnswerLoading ? 1 : 1.04 }}
                className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-950 disabled:opacity-50"
              >
                عدم الرد
              </motion.button>
            )}
          </>
        )}
        {!hideDoneButton && (
          <motion.button
            type="button"
            onClick={() => onDone(task)}
            disabled={doneDisabled}
            className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-45"
          >
            تم
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════
// بطاقة المهمة المتحركة
// ══════════════════════════════════════════════════════════════════
const TYPE_STYLES = {
  new_call:       { borderColor: '#c4b5fd', accent: '#7c3aed', badge: 'bg-violet-100 text-violet-700', bg: 'rgba(124,58,237,0.04)' },
  recovery_call:  { borderColor: '#fca5a5', accent: '#dc2626', badge: 'bg-red-100 text-red-700',       bg: 'rgba(220,38,38,0.04)'  },
  followup_call:  { borderColor: '#fcd34d', accent: '#d97706', badge: 'bg-amber-100 text-amber-700',   bg: 'rgba(217,119,6,0.04)'  },
  assigned_store: { borderColor: '#93c5fd', accent: '#2563eb', badge: 'bg-blue-100 text-blue-700',     bg: 'rgba(37,99,235,0.04)'  },
  new_merchant_onboarding: { borderColor: '#ddd6fe', accent: '#6d28d9', badge: 'bg-violet-100 text-violet-800', bg: 'rgba(109,40,217,0.06)' },
  cold_verification: {
    borderColor: '#a5f3fc',
    accent: '#0891b2',
    badge: 'bg-cyan-100 text-cyan-900 border border-cyan-200/80',
    bg: 'linear-gradient(135deg, rgba(224,242,254,0.85) 0%, rgba(240,249,255,0.95) 50%, rgba(248,250,252,0.9) 100%)',
  },
  am_cold_verification: {
    borderColor: '#a5f3fc',
    accent: '#0e7490',
    badge: 'bg-cyan-100 text-cyan-950 border border-cyan-200/80',
    bg: 'linear-gradient(135deg, rgba(224,242,254,0.9) 0%, rgba(240,249,255,0.95) 50%, rgba(248,250,252,0.92) 100%)',
  },
}

function TaskCard({
  task,
  index,
  onCall,
  onDone,
  onNoAnswerWorkflow,
  noAnswerLoading,
  userRole,
  doneDisabled,
  hideDoneButton,
  callButtonLabel,
}) {
  const s = TYPE_STYLES[task.type] || TYPE_STYLES.followup_call
  const handleDone = () => {
    void onDone(task)
  }
  const showNoAnswer =
    typeof onNoAnswerWorkflow === 'function'
    && (
      (task.type === 'assigned_store' && userRole === 'active_manager')
      || (task.type === 'new_merchant_onboarding' && userRole === 'active_manager')
      || (task.type === 'cold_verification' && ['incubation_manager', 'executive'].includes(userRole))
      || (task.type === 'am_cold_verification' && userRole === 'active_manager')
      || task.type === 'recovery_call'
    )
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.25), ease: 'easeOut' }}
      className="flex items-center gap-3 lg:gap-4 p-3.5 lg:p-4 rounded-2xl border"
      style={{ background: s.bg, borderColor: s.borderColor }}
    >
      {/* نقطة الأولوية النابضة */}
      <motion.div
        className="flex-shrink-0 w-3 h-3 rounded-full"
        style={{ background: task.priority === 'high' ? '#ef4444' : s.accent }}
        animate={task.priority === 'high' ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* أفاتار المتجر */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${s.accent}dd, ${s.accent}88)` }}
      >
        {task.store.name?.charAt(0) || '؟'}
      </div>

      {/* معلومات المهمة */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <div className="font-bold text-slate-800 text-sm min-w-0">
            <StoreNameWithId store={task.store} nameClassName="font-bold text-slate-800" idClassName="font-mono text-xs font-semibold text-slate-500" />
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.badge}`}>
            {task.label}
          </span>
          {task.incubationBadge && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-200/80 flex-shrink-0 max-w-[14rem] leading-snug">
              {task.incubationBadge}
            </span>
          )}
          {task.amTaskInDelays && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-black bg-rose-100 text-rose-900 border border-rose-200/80 flex-shrink-0">
              متأخر — يحتاج تم الرد
            </span>
          )}
          {task.priority === 'high' && (
            <motion.span
              className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              عاجل
            </motion.span>
          )}
        </div>
        <p className="text-xs text-slate-500">{task.desc}</p>
      </div>

      {/* أزرار الإجراء */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
        <CallButton onClick={() => onCall(task)} />
        {showNoAnswer && (
          <motion.button
            type="button"
            onClick={() => onNoAnswerWorkflow(task)}
            disabled={noAnswerLoading}
            whileHover={{ scale: noAnswerLoading ? 1 : 1.06, y: -1 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            عدم الرد
          </motion.button>
        )}
        {!hideDoneButton && (
          <motion.button
            onClick={handleDone}
            disabled={doneDisabled}
            title={doneDisabled ? 'يجب إكمال الاستبيان أولاً لإتمام المهمة.' : undefined}
            whileHover={{ scale: doneDisabled ? 1 : 1.06, y: doneDisabled ? 0 : -1 }}
            whileTap={{ scale: doneDisabled ? 1 : 0.9 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-45 disabled:cursor-not-allowed disabled:grayscale"
            style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
            }}
          >
            <CheckCircle size={12} />
            تم
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════════════════
function IncManagerDoneModal({ task, onClose, onConfirm, saving, error }) {
  const [note, setNote] = useState('')
  const ok = note.trim().length >= MIN_TASK_NOTE_LENGTH
  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[600] p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-emerald-50/80">
          <p className="font-bold text-slate-800 text-sm">إتمام المهمة — محتوى المكالمة</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 min-w-0">
            <StoreNameWithId store={task.store} nameClassName="font-semibold text-slate-800" idClassName="font-mono text-slate-500 text-[11px]" />
            <span className="text-slate-400 mr-2">— {task.label}</span>
          </p>
          <label className="block text-xs font-bold text-slate-700">محتوى المكالمة (إلزامي — {MIN_TASK_NOTE_LENGTH} أحرف فأكثر)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y min-h-[120px]"
            placeholder="اكتب ملخص ما دار في المكالمة..."
          />
          <p className="text-[11px] text-slate-400">
            {note.trim().length}/{MIN_TASK_NOTE_LENGTH} حرفاً على الأقل
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!ok || saving}
              onClick={() => onConfirm(note.trim())}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold"
            >
              {saving ? 'جارٍ الحفظ...' : 'تأكيد وإخفاء المهمة'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm">
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function Tasks() {
  const location = useLocation()
  const {
    allStores, callLogs, storeStates, assignments, loading, reload, lastLoaded, surveyByStoreId,
    newMerchantOnboardingDoneIds,
  } = useStores()
  const { user } = useAuth()
  const { onCallSaved } = usePoints()
  const [selectedTask, setSelectedTask] = useState(null)
  /** مفاتيح مهام مُخفاة بعد «تم» — مُحمّلة من الخادم + نفس اليوم */
  const [dismissalKeys, setDismissalKeys] = useState(() => new Set())
  const [filter, setFilter]     = useState('all') // 'all' | 'high' | 'no_answer'
  /** تبويبات مسؤول المتاجر الجديدة (تجريبي): متابعة دورية | تم التواصل | لم يتم الرد */
  const [moTab, setMoTab] = useState('periodic')
  useEffect(() => {
    if (moTab === 'am_delays') setMoTab('periodic')
  }, [moTab])
  const moSweepLoadedRef = useRef(null)
  const [dismissErr, setDismissErr] = useState('')
  /** مسؤول المتاجر: يجب كتابة ملاحظة مكالمة قبل الإخفاء */
  const [pendingDoneTask, setPendingDoneTask] = useState(null)
  const [doneSaving, setDoneSaving] = useState(false)
  const [doneModalErr, setDoneModalErr] = useState('')
  const [noAnswerLoadingId, setNoAnswerLoadingId] = useState(null)
  /** إشعار بعد «لم يرد» أو بلوغ الهدف */
  const [toastMsg, setToastMsg] = useState('')
  /** فتح استبيان تهيئة المتجر الجديد من «تم» أو من «اتصل» */
  const [pendingOnboardingTask, setPendingOnboardingTask] = useState(null)
  /** بعد حفظ الاستبيان: فتح نافذة ملاحظة المكالمة (احتضان) أو إخفاء مهمة التنفيذي */
  const pendingOnboardingFlowRef = useRef(null)
  /** طابور موظف الاستعادة (50 متجر غير نشط) من active-workflow.php */
  const [inactiveWf, setInactiveWf] = useState(null)
  /** طابور مسؤول المتاجر النشطة (50) + عدّ «تم التواصل» يومياً */
  const [activeWf, setActiveWf] = useState(null)
  /** لإطلاق الاحتفال فور استجابة API الخاصة بطابور الاستعادة */
  const [goalBurstNonce, setGoalBurstNonce] = useState(0)
  /** تجديد دفعة «تحقيق البارد» عند حدود الساعة 9:00 صباحاً (توقيت الجهاز) */
  const [nowTick, setNowTick] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  const loadInactiveWf = useCallback(async () => {
    if (user?.role !== 'inactive_manager' || !user?.username) return
    try {
      const res = await getMyWorkflow(user.username, { queue: 'inactive' })
      if (res?.success) setInactiveWf(res)
    } catch {
      setInactiveWf(null)
    }
  }, [user?.role, user?.username])

  const loadActiveWf = useCallback(async () => {
    if (user?.role !== 'active_manager' || !user?.username) {
      setActiveWf(null)
      return
    }
    try {
      const res = await getMyWorkflow(user.username, { queue: 'active' })
      if (res?.success) setActiveWf(res)
    } catch {
      setActiveWf(null)
    }
  }, [user?.role, user?.username])

  const loadDismissals = useCallback(() => {
    const u = user?.username
    if (!u) return
    getDailyTaskDismissals(u)
      .then(r => {
        if (r?.success && Array.isArray(r.keys)) {
          setDismissalKeys(new Set(r.keys))
        }
      })
      .catch(() => {})
  }, [user?.username])

  useEffect(() => {
    loadDismissals()
  }, [loadDismissals, lastLoaded])

  /** فتح تبويب محدد من لوحة التحكم (تحقيق نشط / بارد) */
  useEffect(() => {
    const t = location.state?.openTasksTab
    if (t === 'am_cold_verify' || t === 'cold_verify') {
      setMoTab(t)
    }
  }, [location.state])

  /** مسؤول المتاجر النشطة: تبويبه «am_cold_verify» وليس دفعة مسؤول المتاجر الجديدة */
  useEffect(() => {
    if (user?.role === 'active_manager' && moTab === 'cold_verify') {
      setMoTab('am_cold_verify')
    }
  }, [user?.role, moTab])

  useEffect(() => {
    loadInactiveWf()
  }, [loadInactiveWf, lastLoaded])

  useEffect(() => {
    loadActiveWf()
  }, [loadActiveWf, lastLoaded])

  /** ترحيل آلي لمسار الاحتضان: يوم 14 بدون شحن → ساخن؛ يوم 11 بشحن وبدون مكالمات → نشط + أداء */
  useEffect(() => {
    if (!['incubation_manager', 'executive'].includes(user?.role) || !user?.username || !lastLoaded) return
    if (moSweepLoadedRef.current === lastLoaded) return
    moSweepLoadedRef.current = lastLoaded
    let cancelled = false
    function storeInIncubationSweep(s) {
      if (s.bucket === 'incubating') return true
      if (s._inc) return true
      const d = daysInSystem(s)
      return d >= 1 && d <= 20
    }
    ;(async () => {
      let anyReload = false
      for (const store of allStores) {
        if (!storeInIncubationSweep(store)) continue
        const log = callLogs[store.id] || {}
        const d = daysInSystem(store)
        const ship = Number(store.total_shipments ?? 0) > 0
          || (store.last_shipment_date && store.last_shipment_date !== 'لا يوجد')
          ? 1
          : 0
        const answered = countAnsweredCalls(log)
        try {
          const r = await postMerchantOfficerAutomation({
            user_role: user.role,
            username: user.username,
            store_id: store.id,
            store_name: store.name || '',
            days_in_system: d,
            total_shipments: ship,
            answered_call_count: answered,
          })
          if (r?.success && r?.rule && r.rule !== 'none') anyReload = true
        } catch {
          /* ignore */
        }
        if (cancelled) return
      }
      if (anyReload && !cancelled) await reload()
    })()
    return () => { cancelled = true }
  }, [lastLoaded, user?.role, user?.username, allStores, callLogs, reload])

  const drawerTaskCompletion = useMemo(() => {
    if (!selectedTask || !user?.username) return undefined
    const releaseActiveWorkflow =
      user.role === 'active_manager'
      && (selectedTask.type === 'assigned_store' || selectedTask.type === 'new_merchant_onboarding')
    const inactiveRecovery =
      selectedTask.type === 'recovery_call' && selectedTask.workflowQueue === 'inactive'
    /** مهام مسؤول الاحتضان/التنفيذ من «المهام اليومية» — يجب تمرير dailyTaskKey في الفعلي أيضاً (لا يقتصر على التجريبي) */
    const moStyleDailyTask =
      ['incubation_manager', 'executive'].includes(user.role)
      && (
        selectedTask.type === 'new_call'
        || selectedTask.type === 'new_merchant_onboarding'
        || (selectedTask.type === 'recovery_call' && selectedTask.workflowQueue !== 'inactive')
      )
    if (
      !IS_STAGING_OR_DEV
      && !releaseActiveWorkflow
      && !inactiveRecovery
      && !moStyleDailyTask
    ) {
      return undefined
    }
    return {
      dailyTaskKey: selectedTask.id,
      inactiveRecovery,
      releaseActiveWorkflow,
      onInactiveGoalBurst: () => setGoalBurstNonce(n => n + 1),
      onActiveGoalBurst: () => { void loadActiveWf() },
    }
  }, [selectedTask, user?.username, user?.role, loadActiveWf])

  /**
   * فتح «تسجيل مكالمة» (استبيان 3 نعم/لا) مباشرة عند الحاجة لاستبيان التهيئة.
   * — مسؤول المتاجر: دائماً عند الحاجة (جميع المهام: استبيان جديد أو متابعة قديمة).
   * — التجريبي: + مدير الاحتضان / تنفيذي لمهمة «استبيان تهيئة متجر جديد».
   */
  const drawerAutoOpenCallModal = useMemo(() => {
    if (!selectedTask) return false
    const allowAuto =
      IS_SIMPLE_LOG_CALL_MODAL || user?.role === 'active_manager'
    if (!allowAuto) return false
    /** مكالمات الاحتضان من المهام اليومية: افتح نافذة التسجيل مباشرة (كانت تبقى مغلقة فيعتقد المستخدم أن «اتصل» لا يعمل) */
    if (selectedTask.type === 'new_call' && user?.role === 'incubation_manager') return true
    const needs = needsNewMerchantOnboardingSurvey(selectedTask.store, newMerchantOnboardingDoneIds)
    if (needs) {
      if (user?.role === 'active_manager' && selectedTask.type === 'new_merchant_onboarding') return true
      if (
        selectedTask.type === 'new_merchant_onboarding'
        && ['incubation_manager', 'executive'].includes(user?.role)
      ) return true
      if (
        selectedTask.moMergedOnboarding
        && ['incubation_manager', 'executive'].includes(user?.role)
      ) return true
    }
    /** مسؤول المتاجر + متابعة دورية: افتح «تسجيل مكالمة» مباشرة (استبيان رضا إلزامي من CallModal) */
    /** أي «متجر مسند» لمسؤول المتاجر: افتح نافذة التسجيل فوراً (استبيان رضا / تهيئة حسب الحالة) */
    if (user?.role === 'active_manager' && selectedTask.type === 'assigned_store') {
      return true
    }
    return false
  }, [user?.role, selectedTask, newMerchantOnboardingDoneIds])

  function handleTaskCall(taskRow) {
    /** استبيان التهيئة: الدرج + CallModal — مسؤول المتاجر دائماً؛ التجريبي لباقي الأدوار عند تفعيل النافذة المبسّطة */
    if (taskRow.type === 'new_merchant_onboarding') {
      if (IS_SIMPLE_LOG_CALL_MODAL || user?.role === 'active_manager') {
        setSelectedTask(taskRow)
        return
      }
      if (IS_STAGING_OR_DEV) {
        setPendingOnboardingTask(taskRow)
        return
      }
      setSelectedTask(taskRow)
      return
    }
    setSelectedTask(taskRow)
  }

  useEffect(() => {
    if (!toastMsg) return undefined
    const t = setTimeout(() => setToastMsg(''), 8000)
    return () => clearTimeout(t)
  }, [toastMsg])

  const tasks = useMemo(() => {
    let t = generateTasks(
      allStores, callLogs, storeStates, user?.role, user?.username, assignments, inactiveWf,
      newMerchantOnboardingDoneIds,
      user?.fullname ?? '',
    )
    t = dedupeIncubationDailyTasksByStore(t)
    return t
  }, [allStores, callLogs, storeStates, user, assignments, inactiveWf, newMerchantOnboardingDoneIds])

  const pendingTasks = tasks.filter(t => t.moContactedToday || !dismissalKeys.has(t.id))

  const { mainTasks, noAnswerTasks, highCountMain } = useMemo(() => {
    const main = []
    const noAns = []
    for (const t of pendingTasks) {
      if (t.moContactedToday) {
        main.push(t)
      } else if (taskIsNoAnswer(t, callLogs, assignments)) {
        noAns.push(t)
      } else {
        main.push(t)
      }
    }
    return {
      mainTasks: main,
      noAnswerTasks: noAns,
      highCountMain: main.filter(t => t.priority === 'high').length,
    }
  }, [pendingTasks, callLogs, assignments])

  /** مسؤول المتاجر الجديدة + مسؤول المتاجر النشطة + التنفيذي — تبويبات المهام (دورة 14 / تم التواصل / لم يتم الرد) */
  const isTaskTabUser =
    user?.role === 'incubation_manager'
    || user?.role === 'active_manager'
    || user?.role === 'executive'
  /** دفعة «تحقيق بارد» لمسؤول المتاجر الجديدة والتنفيذي — من غير نشط بارد (حتى 30) */
  const showColdInactiveTab =
    user?.role === 'incubation_manager' || user?.role === 'executive'
  /** دفعة «تحقيق بارد» لمسؤول المتاجر النشطة — من غير نشط بارد (20 ثابتة، تخزين منفصل) */
  const showAmColdTab = user?.role === 'active_manager'
  const bizDateKeyCold = useMemo(() => getBizDateKeyAt9am(new Date(nowTick)), [nowTick])

  const coldInactivePoolCount = useMemo(
    () => allStores.filter(s => {
      const cat = storeStates[s.id]?.category || s.category || ''
      return cat === 'cold_inactive'
    }).length,
    [allStores, storeStates],
  )

  const coldVerificationTasksAll = useMemo(() => {
    if (!showColdInactiveTab) return []
    const picked = getDailyColdBatchStores(
      allStores,
      storeStates,
      bizDateKeyCold,
      user?.username,
      COLD_INACTIVE_DAILY_LIMIT,
    )
    return buildColdVerificationTasks(picked, bizDateKeyCold)
  }, [showColdInactiveTab, allStores, storeStates, bizDateKeyCold, user?.username])

  const pendingColdVerifyTasks = useMemo(
    () => coldVerificationTasksAll.filter(t => !dismissalKeys.has(t.id)),
    [coldVerificationTasksAll, dismissalKeys],
  )

  const amColdVerificationTasksAll = useMemo(() => {
    if (!showAmColdTab) return []
    const picked = getDailyActiveManagerColdBatchStores(
      allStores,
      storeStates,
      bizDateKeyCold,
      user?.username,
      ACTIVE_MANAGER_COLD_VERIFY_LIMIT,
    )
    return buildActiveManagerColdVerificationTasks(picked, bizDateKeyCold)
  }, [showAmColdTab, allStores, storeStates, bizDateKeyCold, user?.username])

  const pendingAmColdVerifyTasks = useMemo(
    () => amColdVerificationTasksAll.filter(t => !dismissalKeys.has(t.id)),
    [amColdVerificationTasksAll, dismissalKeys],
  )

  const moPeriodicTasks = useMemo(() => {
    if (!isTaskTabUser) return mainTasks
    const filtered = mainTasks.filter(
      t =>
        !t.moContactedToday
        && !taskIsNoAnswer(t, callLogs, assignments),
    )
    if (user?.role !== 'active_manager') return filtered
    return [...filtered].sort((a, b) => {
      const da = a.amTaskInDelays ? 1 : 0
      const db = b.amTaskInDelays ? 1 : 0
      if (da !== db) return db - da
      const ta = Number(a.assignedAtTs || 0)
      const tb = Number(b.assignedAtTs || 0)
      if (ta !== tb) return ta - tb
      return String(a.id).localeCompare(String(b.id))
    }).slice(0, 50)
  }, [isTaskTabUser, mainTasks, callLogs, assignments, user?.role])

  const moContactedTasks = useMemo(() => {
    if (!isTaskTabUser) return []
    return mainTasks.filter(t => t.moContactedToday)
  }, [isTaskTabUser, mainTasks])

  const displayed = useMemo(() => {
    if (isTaskTabUser) {
      if (moTab === 'cold_verify') return pendingColdVerifyTasks
      if (moTab === 'am_cold_verify') return pendingAmColdVerifyTasks
      if (moTab === 'contacted') return moContactedTasks
      if (moTab === 'no_answer') return noAnswerTasks
      return moPeriodicTasks
    }
    if (filter === 'no_answer') return noAnswerTasks
    if (filter === 'high') return mainTasks.filter(t => t.priority === 'high')
    return mainTasks
  }, [
    isTaskTabUser,
    moTab,
    moPeriodicTasks,
    moContactedTasks,
    pendingColdVerifyTasks,
    pendingAmColdVerifyTasks,
    filter,
    mainTasks,
    noAnswerTasks,
  ])

  const focusNoAnswerView = useCallback(() => {
    setFilter('no_answer')
    if (isTaskTabUser) setMoTab('no_answer')
  }, [isTaskTabUser])

  async function dismissTaskOnly(id) {
    setDismissErr('')
    const u = user?.username
    if (!u) return
    try {
      await markDailyTaskDone({ username: u, task_key: id })
      setDismissalKeys(prev => new Set([...prev, id]))
    } catch (e) {
      setDismissErr(e.response?.data?.error || 'تعذّر حفظ «تم»')
    }
  }

  async function requestDone(task) {
    setDismissErr('')
    if (task.type === 'recovery_call' && task.workflowQueue === 'inactive' && user?.role === 'inactive_manager') {
      try {
        const res = await completeInactiveQueueSuccess({
          store_id: task.store.id,
          store_name: task.store.name,
          username: user.username,
        })
        if (res?.goal_just_met) {
          setGoalBurstNonce(n => n + 1)
        }
        await dismissTaskOnly(task.id)
        await reload()
        await loadInactiveWf()
        loadDismissals()
        if (res?.daily_target_reached && !res?.goal_just_met) {
          setToastMsg('تم بلوغ هدف 50 اتصالاً ناجحاً اليوم.')
        }
      } catch (e) {
        setDismissErr(e.response?.data?.error || 'تعذّر تسجيل الاتصال الناجح.')
      }
      return
    }
    if (task.type === 'new_merchant_onboarding') {
      pendingOnboardingFlowRef.current = null
      if (onboardingDoneForStore(newMerchantOnboardingDoneIds, task.store.id)) {
        dismissTaskOnly(task.id)
        return
      }
      setPendingOnboardingTask(task)
      return
    }
    if (task.type === 'assigned_store') {
      const cat = storeStates[task.store.id]?.category || task.store.category || ''
      if (needsActiveSatisfactionSurvey(task.store.id, cat, surveyByStoreId)) {
        setDismissErr('يجب إكمال الاستبيان أولاً لإتمام المهمة.')
        return
      }
    }

    const storeNeedsOnboardingSurvey =
      needsNewMerchantOnboardingSurvey(task.store, newMerchantOnboardingDoneIds)
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, task.store.id)

    /** مكالمة احتضان / تنفيذي: استبيان التهيئة إلزامي قبل نافذة «تم» (ملاحظة المكالمة) */
    if (
      ['incubation_manager', 'executive'].includes(user?.role)
      && task.type === 'new_call'
      && storeNeedsOnboardingSurvey
    ) {
      pendingOnboardingFlowRef.current = { after: 'inc_done', task }
      setPendingOnboardingTask(task)
      return
    }

    if (['incubation_manager', 'executive'].includes(user?.role)) {
      setDoneModalErr('')
      setPendingDoneTask(task)
      return
    }

    dismissTaskOnly(task.id)
  }

  async function handleNoAnswerWorkflow(task) {
    if (!user?.username) return
    setDismissErr('')
    setNoAnswerLoadingId(task.id)
    try {
      if (task.type === 'recovery_call') {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: 'general',
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        if (task.workflowQueue === 'inactive' && user?.username) {
          const mar = await markSurveyNoAnswer({
            store_id: task.store.id,
            store_name: task.store.name,
            username: user.username,
            queue: 'inactive',
          })
          if (mar?.notify_ar) setToastMsg(mar.notify_ar)
        }
        await reload()
        await loadInactiveWf()
        loadDismissals()
        focusNoAnswerView()
        return
      }
      if (task.type === 'new_call' && ['incubation_manager', 'executive'].includes(user?.role)) {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: taskIdToCallType(task.id),
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        await reload()
        loadDismissals()
        focusNoAnswerView()
        return
      }
      /** مسؤول الاحتضان: استبيان التهيئة ليس ضمن طابور store_assignments — لا نستدعي mark_no_answer */
      if (task.type === 'new_merchant_onboarding' && ['incubation_manager', 'executive'].includes(user?.role)) {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: 'general',
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        await reload()
        loadDismissals()
        focusNoAnswerView()
        return
      }
      if (task.type === 'cold_verification') {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: 'general',
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        await reload()
        loadDismissals()
        return
      }
      if (task.type === 'am_cold_verification') {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: 'general',
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        await reload()
        loadDismissals()
        return
      }
      if (
        user?.role === 'active_manager'
        && (task.type === 'assigned_store' || task.type === 'new_merchant_onboarding')
      ) {
        const mar = await markSurveyNoAnswer({
          store_id: task.store.id,
          store_name: task.store.name,
          username: user.username,
          queue: 'active',
        })
        if (mar?.notify_ar) setToastMsg(mar.notify_ar)
        await reload()
        await loadActiveWf()
        loadDismissals()
        focusNoAnswerView()
        return
      }
    } catch (e) {
      setDismissErr(e.response?.data?.error || 'تعذّر تسجيل عدم الرد.')
    } finally {
      setNoAnswerLoadingId(null)
    }
  }

  async function confirmIncManagerDone(note) {
    const task = pendingDoneTask
    if (!task || !user?.username) return
    setDoneSaving(true)
    setDoneModalErr('')
    try {
      const callType = taskIdToCallType(task.id)
      const payload = {
        store_id: task.store.id,
        store_name: task.store.name,
        call_type: callType,
        outcome: 'answered',
        note,
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        registration_date: task.store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(task.store)
      }
      const res = await logCall(payload)
      if (!DISABLE_POINTS_AND_PERFORMANCE) {
        onCallSaved(res?.points_awarded ?? 10)
      }
      await markDailyTaskDone({ username: user.username, task_key: task.id })
      setDismissalKeys(prev => new Set([...prev, task.id]))
      setPendingDoneTask(null)
      await reload()
    } catch (e) {
      setDoneModalErr(e.response?.data?.error || 'فشل حفظ المكالمة أو إتمام المهمة')
    } finally {
      setDoneSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-20" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {user?.role === 'inactive_manager' && user?.username && (
        <InactiveGoalCelebration
          username={user.username}
          successfulCount={inactiveWf?.daily_successful_contacts ?? 0}
          target={inactiveWf?.inactive_daily_target ?? 50}
          dailyTargetReached={inactiveWf?.daily_target_reached}
          burstNonce={goalBurstNonce}
        />
      )}

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[500] max-w-md w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-violet-300/80 bg-violet-950/95 text-violet-50 px-4 py-3 text-sm font-medium shadow-xl shadow-violet-900/40 flex items-start justify-between gap-3"
            dir="rtl"
          >
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg('')}
              className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/80"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ بطاقة الهيدر + التحدي الذاتي ═══════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative rounded-3xl overflow-hidden text-white p-5 lg:p-7"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 55%, #1a0a4e 100%)' }}
      >
        <NawrasHeroImageLayer opacity={0.14} footerCropPct={16} className="z-0 mix-blend-soft-light" />
        {/* Blobs */}
        <div className="absolute top-0 left-1/3 z-[1] w-60 h-60 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 z-[1] w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* نورس كبير خلفية */}
        <div className="absolute bottom-2 left-4 z-[1] pointer-events-none">
          <SeagullMark size={110} opacity={0.06} />
        </div>
        {/* نورس صغير مقلوب */}
        <div className="absolute top-3 right-8 z-[1] pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <SeagullMark size={65} opacity={0.04} />
        </div>

        <div className="relative z-10 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl lg:text-2xl font-black leading-tight">
              المهام اليومية
            </h1>
            <NawrasTaglineStack light compact className="mt-1.5 max-w-[min(100%,20rem)]" />
            <p className="text-white/50 text-sm mt-0.5">
              مرحباً{' '}
              <span className="text-violet-300 font-semibold">{user?.fullname || user?.username}</span>
            </p>
            {dismissErr && (
              <p className="text-red-300 text-xs mt-1">{dismissErr}</p>
            )}
            {user?.role === 'inactive_manager' && inactiveWf?.success && (
              <>
                <p className="text-violet-200/90 text-sm mt-2">
                  طابور الاستعادة:{' '}
                  {(inactiveWf.active_count ?? 0) + (inactiveWf.no_answer_count ?? 0)}
                  {' / '}
                  {inactiveWf.target ?? 50} متجراً غير نشط
                </p>
                <p
                  className={`text-sm mt-1.5 flex flex-wrap items-center gap-2 ${
                    inactiveWf.daily_target_reached ? 'text-emerald-200' : 'text-amber-200/95'
                  }`}
                >
                  <span className="font-bold">اتصالات ناجحة اليوم:</span>
                  <InactiveGoalCounterBadge
                    successfulCount={inactiveWf.daily_successful_contacts ?? 0}
                    target={inactiveWf.inactive_daily_target ?? 50}
                    dailyTargetReached={inactiveWf.daily_target_reached}
                    className={inactiveWf.daily_target_reached ? 'text-emerald-200' : ''}
                  />
                  {inactiveWf.daily_target_reached && (
                    <span className="text-emerald-200/90 font-medium">— تم بلوغ الهدف</span>
                  )}
                </p>
              </>
            )}
            {user?.role === 'active_manager' && activeWf?.success && (
              <p className="text-cyan-100/95 text-sm mt-2">
                قائمة «المتابعة الدورية»:{' '}
                {activeWf.active_count ?? 0}
                {' / '}
                {activeWf.target ?? 50} متجراً — عند إتمام أي متجر أو نقله إلى «لم يرد» يُضاف بديل جديد فوراً ويظهر في آخر القائمة.
              </p>
            )}
            {showColdInactiveTab && moTab === 'cold_verify' && (
              <p className="text-sky-100/95 text-xs mt-2 max-w-2xl leading-relaxed rounded-xl px-3 py-2 border border-sky-300/35 bg-gradient-to-l from-sky-400/15 to-cyan-300/10 backdrop-blur-sm">
                <Snowflake className="inline-block ml-1.5 align-text-bottom opacity-90" size={14} aria-hidden />
                {' '}
                تحقيق البارد (غير نشط): حتى {COLD_INACTIVE_DAILY_LIMIT} متجراً لكل يوم عمل (يبدأ 9:00 صباحاً — توقيت جهازك). لا يُستبدل من خرج بالتجميد أو الاتصال في نفس اليوم؛ دفعة جديدة بعد 9:00 ص يوم العمل التالي. يوم الدفعة:{' '}
                <span className="font-mono font-bold tabular-nums">{bizDateKeyCold}</span>
                {' — '}إجمالي «غير نشط بارد» في النظام:{' '}
                {coldInactivePoolCount.toLocaleString('ar-SA')}
              </p>
            )}
            {showAmColdTab && moTab === 'am_cold_verify' && (
              <p className="text-sky-100/95 text-xs mt-2 max-w-2xl leading-relaxed rounded-xl px-3 py-2 border border-sky-300/35 bg-gradient-to-l from-sky-400/15 to-cyan-300/10 backdrop-blur-sm">
                <Snowflake className="inline-block ml-1.5 align-text-bottom opacity-90" size={14} aria-hidden />
                {' '}
                تحقيق بارد من «غير نشط بارد»: دفعة ثابتة {ACTIVE_MANAGER_COLD_VERIFY_LIMIT} متجراً — لا استبدال داخل اليوم؛ يُعرض آخر شحنة لكل متجر. يوم الدفعة:{' '}
                <span className="font-mono font-bold tabular-nums">{bizDateKeyCold}</span>
                {' — '}إجمالي البارد في النظام:{' '}
                {coldInactivePoolCount.toLocaleString('ar-SA')}
              </p>
            )}
            {['incubation_manager', 'executive'].includes(user?.role) && moTab !== 'cold_verify' && moTab !== 'am_cold_verify' && (
              <p className="text-violet-200/90 text-xs mt-2 max-w-2xl leading-relaxed">
                في «متابعة دورية» تُعرَض المتاجر في أيام الدورة 1 و 3 و 10 فقط (لا يوم 2 ولا 5 ولا 9، إلخ). استبيان التهيئة واستعادة المسار يخضعان لنفس أيام اللمس. يوم 14 بدون شحن يُرحّل تلقائياً إلى غير نشط ساخن؛ يوم 11 مع شحن وبدون مكالمات مجابة يُرحّل إلى النشط مع تنبيه أداء. سجّل ملاحظة المكالمة لتظهر في سجلات النظام.
              </p>
            )}
            {user?.role === 'active_manager' && moTab === 'am_cold_verify' && (
              <p className="text-cyan-100/85 text-xs mt-2 max-w-2xl leading-relaxed">
                راجع تبويب «تحقيق بارد» يومياً بعد 9:00 ص — {ACTIVE_MANAGER_COLD_VERIFY_LIMIT} متجراً من «غير نشط بارد» بانتظار التحقق (مع آخر شحنة).
              </p>
            )}
            {user?.role === 'active_manager'
              && moTab !== 'am_cold_verify'
              && moTab !== 'cold_verify'
              && (
              <p className="text-cyan-100/85 text-xs mt-2 max-w-2xl leading-relaxed">
                يُعبَّأ طابورك تلقائياً حتى 50 متجراً نشطاً؛ لا يُعاد اختيار نفس المتجر من المجمع في يومَي العمل السابقين. في «متابعة دورية» تُعرَض كل المهام غير المنجزة مع تثبيت المتأخّرات أعلى القائمة؛ سجّل المكالمة أو استخدم صفحة «طابور المهام» للإجراءات «تم التواصل» و«لم يرد».
              </p>
            )}
            {pendingTasks.length > 0 && (
              <p className="text-white/40 text-sm mt-2">
                {mainTasks.length.toLocaleString('ar-SA')} في القائمة الرئيسية
                {noAnswerTasks.length > 0 && (
                  <span className="text-amber-200/90 mr-2">
                    {' '}— {noAnswerTasks.length.toLocaleString('ar-SA')} متجر لم يُرد
                  </span>
                )}
                {highCountMain > 0 && (
                  <span className="text-amber-300/90 mr-2">
                    {' '}— {highCountMain.toLocaleString('ar-SA')} عاجلة
                  </span>
                )}
              </p>
            )}
          </div>

          {/* زر التحديث */}
          <motion.button
            onClick={reload}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white border border-white/20 bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </motion.button>
        </div>
      </motion.div>

      {/* ══ تبويبات التصفية ══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="flex flex-wrap gap-2"
      >
        {isTaskTabUser ? (
          <>
            <motion.button
              type="button"
              onClick={() => setMoTab('periodic')}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                moTab === 'periodic'
                  ? 'text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                moTab === 'periodic'
                  ? {
                      background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                      boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                    }
                  : {}
              }
            >
              متابعة دورية
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  moTab === 'periodic' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {moPeriodicTasks.length}
              </span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setMoTab('contacted')}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                moTab === 'contacted'
                  ? 'text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                moTab === 'contacted'
                  ? {
                      background: 'linear-gradient(135deg, #059669, #047857)',
                      boxShadow: '0 4px 14px rgba(5,150,105,0.35)',
                    }
                  : {}
              }
            >
              تم التواصل
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  moTab === 'contacted' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {moContactedTasks.length}
              </span>
            </motion.button>
            <motion.button
              type="button"
              onClick={() => setMoTab('no_answer')}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                moTab === 'no_answer'
                  ? 'text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                moTab === 'no_answer'
                  ? {
                      background: 'linear-gradient(135deg, #d97706, #b45309)',
                      boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
                    }
                  : {}
              }
            >
              لم يتم الرد
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  moTab === 'no_answer' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {noAnswerTasks.length}
              </span>
            </motion.button>
            {showAmColdTab && (
            <motion.button
              type="button"
              onClick={() => setMoTab('am_cold_verify')}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                moTab === 'am_cold_verify'
                  ? 'text-slate-800 shadow-lg border-cyan-200/80'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                moTab === 'am_cold_verify'
                  ? {
                      background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #ecfeff 100%)',
                      boxShadow: '0 4px 18px rgba(14,165,233,0.28)',
                    }
                  : {}
              }
            >
              <Snowflake size={16} className={moTab === 'am_cold_verify' ? 'text-cyan-600' : 'text-slate-400'} aria-hidden />
              تحقيق بارد
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  moTab === 'am_cold_verify'
                    ? 'bg-cyan-600/15 text-cyan-900'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pendingAmColdVerifyTasks.length}
              </span>
            </motion.button>
            )}
            {showColdInactiveTab && (
            <motion.button
              type="button"
              onClick={() => setMoTab('cold_verify')}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all border ${
                moTab === 'cold_verify'
                  ? 'text-slate-800 shadow-lg border-cyan-200/80'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                moTab === 'cold_verify'
                  ? {
                      background: 'linear-gradient(135deg, #e0f2fe 0%, #f0f9ff 45%, #ecfeff 100%)',
                      boxShadow: '0 4px 18px rgba(14,165,233,0.28)',
                    }
                  : {}
              }
            >
              <Snowflake size={16} className={moTab === 'cold_verify' ? 'text-cyan-600' : 'text-slate-400'} aria-hidden />
              تحقيق بارد
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  moTab === 'cold_verify'
                    ? 'bg-cyan-600/15 text-cyan-900'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                {pendingColdVerifyTasks.length}
              </span>
            </motion.button>
            )}
          </>
        ) : (
          [
            { val: 'all', label: 'الكل', count: mainTasks.length },
            { val: 'high', label: 'عالية الأولوية', count: highCountMain },
            { val: 'no_answer', label: 'متاجر لم ترد', count: noAnswerTasks.length },
          ].map(tab => (
            <motion.button
              key={tab.val}
              onClick={() => setFilter(tab.val)}
              whileTap={{ scale: 0.97 }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                filter === tab.val
                  ? 'text-white shadow-lg'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
              style={
                filter === tab.val
                  ? tab.val === 'no_answer'
                    ? {
                        background: 'linear-gradient(135deg, #d97706, #b45309)',
                        boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
                      }
                    : {
                        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                        boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                      }
                  : {}
              }
            >
              {tab.label}
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  filter === tab.val ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {tab.count}
              </span>
            </motion.button>
          ))
        )}
      </motion.div>

      {/* ══ قائمة المهام ════════════════════════════════════════════ */}
      {displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100"
        >
          {showColdInactiveTab && moTab === 'cold_verify' ? (
            coldInactivePoolCount === 0 ? (
              <>
                <Snowflake size={56} className="text-cyan-300 mx-auto mb-4" />
                <p className="font-black text-slate-700 text-xl">لا توجد متاجر «غير نشط بارد» في النظام</p>
                <p className="text-slate-500 text-sm mt-2">
                  عند وجود متاجر بارد ستُعرض دفعة يومية حتى {COLD_INACTIVE_DAILY_LIMIT}؛ تُحدَّد الدفعة الجديدة بعد 9:00 ص يوم العمل التالي
                </p>
              </>
            ) : pendingColdVerifyTasks.length === 0 && coldVerificationTasksAll.length > 0 ? (
              <>
                <CheckCircle size={56} className="text-cyan-400 mx-auto mb-4" />
                <p className="font-black text-slate-700 text-xl">لا يتبقى متاجر في دفعة تحقيق البارد</p>
                <p className="text-slate-500 text-sm mt-2">الدفعة التالية تُحدَّد الساعة 9:00 صباحاً (توقيت جهازك)</p>
              </>
            ) : (
              <p className="font-bold text-slate-600">لا توجد مهام في هذا التبويب</p>
            )
          ) : showAmColdTab && moTab === 'am_cold_verify' ? (
            coldInactivePoolCount === 0 ? (
              <>
                <Snowflake size={56} className="text-cyan-300 mx-auto mb-4" />
                <p className="font-black text-slate-700 text-xl">لا توجد متاجر «غير نشط بارد» في النظام</p>
                <p className="text-slate-500 text-sm mt-2">
                  عند وجود متاجر بارد ستُعرض دفعة حتى {ACTIVE_MANAGER_COLD_VERIFY_LIMIT}؛ يوم العمل يبدأ 9:00 ص — مع آخر شحنة في وصف المهمة
                </p>
              </>
            ) : pendingAmColdVerifyTasks.length === 0 && amColdVerificationTasksAll.length > 0 ? (
              <>
                <CheckCircle size={56} className="text-cyan-400 mx-auto mb-4" />
                <p className="font-black text-slate-700 text-xl">أحسنت — لا يتبقى متاجر في دفعة «تحقيق بارد» اليوم</p>
                <p className="text-slate-500 text-sm mt-2">الدفعة التالية بعد 9:00 ص يوم العمل التالي</p>
              </>
            ) : (
              <p className="font-bold text-slate-600">لا توجد مهام في هذا التبويب</p>
            )
          ) : pendingTasks.length === 0 ? (
            <>
              <motion.div
                animate={{ rotate: [0, 12, -12, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
              >
                <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
              </motion.div>
              <p className="font-black text-slate-700 text-xl">أحسنت! لا توجد مهام معلقة</p>
              <p className="text-slate-400 text-sm mt-2">تم الانتهاء من جميع المهام اليوم 🎉</p>
            </>
          ) : (isTaskTabUser && moTab === 'no_answer') || filter === 'no_answer' ? (
            <>
              <CheckCircle size={56} className="text-amber-400 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">لا توجد متاجر في «لم يتم الرد»</p>
              <p className="text-slate-500 text-sm mt-2">عند الضغط على «عدم الرد» يُسجَّل عدم الرد ويظهر المتجر هنا</p>
            </>
          ) : filter === 'high' ? (
            <>
              <CheckCircle size={56} className="text-slate-300 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">لا توجد مهام عاجلة</p>
              <p className="text-slate-500 text-sm mt-2">في القائمة الرئيسية حالياً</p>
            </>
          ) : filter === 'all' && mainTasks.length === 0 && noAnswerTasks.length > 0 ? (
            <>
              <CheckCircle size={56} className="text-amber-400 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">القائمة الرئيسية فارغة</p>
              <p className="text-slate-600 text-sm mt-2">
                {noAnswerTasks.length.toLocaleString('ar-SA')} متجر في تبويب «متاجر لم ترد» — راجعها من هناك
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-600">لا توجد مهام في هذا التبويب</p>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="space-y-2.5"
        >
          <AnimatePresence mode="popLayout">
            {displayed.map((task, i) => {
              const cat = storeStates[task.store.id]?.category || task.store.category || ''
              const blockDone =
                task.type === 'assigned_store'
                && needsActiveSatisfactionSurvey(task.store.id, cat, surveyByStoreId)
              const useMoRow =
                isTaskTabUser
                && (task.moDays != null
                  || task.moCycleDay != null
                  || task.type === 'new_merchant_onboarding'
                  || task.type === 'recovery_call')
              if (useMoRow) {
                return (
                  <MerchantOfficerTaskRow
                    key={task.id}
                    task={task}
                    index={i}
                    onCall={handleTaskCall}
                    onDone={requestDone}
                    userRole={user?.role}
                    onNoAnswerWorkflow={handleNoAnswerWorkflow}
                    noAnswerLoading={noAnswerLoadingId === task.id}
                    doneDisabled={blockDone}
                    hideDoneButton={
                      IS_STAGING_OR_DEV
                      || (user?.role === 'active_manager'
                        && ['assigned_store', 'new_merchant_onboarding'].includes(task.type))
                    }
                    taskIsNoAnswerFn={taskIsNoAnswer}
                    callLogs={callLogs}
                    assignments={assignments}
                  />
                )
              }
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  onCall={handleTaskCall}
                  onDone={requestDone}
                  userRole={user?.role}
                  onNoAnswerWorkflow={handleNoAnswerWorkflow}
                  noAnswerLoading={noAnswerLoadingId === task.id}
                  doneDisabled={blockDone}
                  hideDoneButton={
                    IS_STAGING_OR_DEV
                    || (user?.role === 'active_manager'
                      && ['assigned_store', 'new_merchant_onboarding'].includes(task.type))
                  }
                />
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {pendingDoneTask && (
        <IncManagerDoneModal
          task={pendingDoneTask}
          saving={doneSaving}
          error={doneModalErr}
          onClose={() => { if (!doneSaving) setPendingDoneTask(null) }}
          onConfirm={confirmIncManagerDone}
        />
      )}

      {pendingOnboardingTask && (
        <NewMerchantOnboardingModal
          store={pendingOnboardingTask.store}
          dailyTaskKey={pendingOnboardingFlowRef.current ? undefined : pendingOnboardingTask.id}
          skipMarkDailyDone={!!pendingOnboardingFlowRef.current}
          onClose={() => {
            pendingOnboardingFlowRef.current = null
            setPendingOnboardingTask(null)
          }}
          onSaved={async () => {
            const flow = pendingOnboardingFlowRef.current
            const t = pendingOnboardingTask
            pendingOnboardingFlowRef.current = null
            setPendingOnboardingTask(null)
            await reload()
            loadDismissals()
            if (flow?.after === 'inc_done' && flow.task && ['incubation_manager', 'executive'].includes(user?.role)) {
              setDoneModalErr('')
              setPendingDoneTask(flow.task)
            }
            if (t && IS_STAGING_OR_DEV && !flow) {
              setSelectedTask(t)
            }
          }}
        />
      )}

      {selectedTask && (
        <StoreDrawer
          store={selectedTask.store}
          callType={taskIdToCallType(selectedTask.id)}
          onClose={() => setSelectedTask(null)}
          taskCompletion={drawerTaskCompletion}
          autoOpenCallModal={drawerAutoOpenCallModal}
          fromDailyTasks
          extraOnSaved={() => {
            loadDismissals()
            void loadInactiveWf()
            void loadActiveWf()
            if (
              user?.role === 'active_manager'
              && selectedTask
              && ['assigned_store', 'new_merchant_onboarding'].includes(selectedTask.type)
            ) {
              setMoTab('contacted')
            }
          }}
        />
      )}
    </div>
  )
}
