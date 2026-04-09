import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  X, Phone, Zap, Star, CheckCircle2, PhoneOff, Undo2, PhoneCall,
} from 'lucide-react'
import {
  logCall,
  saveSurvey,
  markSurveyNoAnswer,
  markDailyTaskDone,
  completeInactiveQueueSuccess,
  releaseAfterSurvey,
  postInactiveFollowupSuccess,
  postInactiveFollowupToNoAnswer,
  postInactiveFollowupNoAnswerLog,
} from '../services/api'
import { IS_STAGING_OR_DEV } from '../config/envFlags'
import StoreNameWithId         from './StoreNameWithId'
import { useAuth }             from '../contexts/AuthContext'
import { useStores }           from '../contexts/StoresContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import {
  getSatisfactionQuestionsForUi,
  needsActiveSatisfactionSurvey,
  isInactiveMerchantCategory,
  PENDING_CALL_PIPELINE_CATEGORIES,
} from '../constants/satisfactionSurvey'
import {
  NEW_MERCHANT_ONBOARDING_QUESTIONS_DEV,
  needsNewMerchantOnboardingSurvey,
  buildOnboardingYesNoForApi,
} from '../constants/newMerchantOnboardingSurvey'

const MIN_INACTIVE_FEEDBACK_LEN = 10

/** عناوين الاستبيان المبسّط (نفس الأسئلة + النص الكامل من DEV) */
const SIMPLE_ONBOARDING_HEADINGS = [
  'إدخال الشحنات والباركود',
  'أداء التطبيق والتتبع',
  'المهام (راجع/تسوية/تجميع)',
]

/** أزرار نتيجة المكالمة — الوضع الكامل فقط */
const OUTCOME_OPTIONS = [
  { id: 'answered', label: 'تم الرد', Icon: CheckCircle2 },
  { id: 'no_answer', label: 'لم يرد', Icon: PhoneOff },
  { id: 'busy', label: 'مشغول', Icon: Undo2 },
  { id: 'callback', label: 'طلب معاودة الاتصال', Icon: PhoneCall },
]

function YesNoRow({ value, onChange }) {
  return (
    <div className="flex items-center gap-2 flex-row-reverse justify-end" dir="rtl">
      <button
        type="button"
        onClick={() => onChange(true)}
        className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
          value === true
            ? 'bg-emerald-600 border-emerald-600 text-white'
            : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-300'
        }`}
      >
        نعم
      </button>
      <button
        type="button"
        onClick={() => onChange(false)}
        className={`px-3 py-2 rounded-xl text-xs font-bold border-2 transition-colors ${
          value === false
            ? 'bg-rose-600 border-rose-600 text-white'
            : 'bg-white border-slate-200 text-slate-600 hover:border-rose-300'
        }`}
      >
        لا
      </button>
    </div>
  )
}

function StarRow({ value, onChange }) {
  return (
    <div className="flex items-center gap-1 flex-row-reverse justify-end" dir="rtl">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className="p-0.5 rounded-lg transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-violet-400"
          aria-label={`تقييم ${n} من 5`}
        >
          <Star
            size={22}
            className={n <= value ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
            strokeWidth={n <= value ? 0 : 1.5}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-xs font-bold text-slate-500 mr-1 tabular-nums">{value}/5</span>
      )}
    </div>
  )
}

function storeHasShipped(store) {
  if (!store) return false
  const n = Number(store.total_shipments ?? 0)
  if (n > 0) return true
  const d = store.last_shipment_date
  return Boolean(d && d !== 'لا يوجد')
}

async function runTaskCompletionAfterAnswered({
  taskCompletion,
  user,
  store,
  setError,
  setSaving,
}) {
  if (!taskCompletion || !user?.username) return true
  const u = user.username
  const sid = store.id
  const sname = store.name
  try {
    if (taskCompletion.inactiveRecovery && user?.role === 'inactive_manager') {
      const cir = await completeInactiveQueueSuccess({
        store_id: sid,
        store_name: sname,
        username: u,
      })
      if (cir?.goal_just_met) {
        taskCompletion.onInactiveGoalBurst?.()
      }
    } else if (taskCompletion.releaseActiveWorkflow && user?.role === 'active_manager') {
      const rel = await releaseAfterSurvey({ store_id: sid, store_name: sname || '', username: u })
      if (rel?.goal_just_met) {
        taskCompletion.onActiveGoalBurst?.()
      }
    }
    if (taskCompletion.dailyTaskKey) {
      const canMarkDailyDismissal =
        IS_STAGING_OR_DEV
        || user?.role === 'active_manager'
        || user?.role === 'incubation_manager'
        || user?.role === 'executive'
      if (canMarkDailyDismissal) {
        await markDailyTaskDone({ username: u, task_key: taskCompletion.dailyTaskKey })
      }
    }
  } catch (syncErr) {
    const msg = syncErr?.response?.data?.error || syncErr?.message || 'تعذّر مزامنة إتمام المهمة.'
    setError(msg)
    setSaving(false)
    return false
  }
  return true
}

/**
 * @param {object} [taskCompletion] — عند تفعيل مسار التجريب: إتمام المهمة اليومية بعد «حفظ المكالمة»
 */
export default function CallModal({
  store,
  callType = 'general',
  onClose,
  onSaved,
  taskCompletion = null,
  /** فُتح من صفحة المهام اليومية — يُستخدم مع مسؤول المتاجر لإظهار الاستبيان حتى خارج التجريبي */
  fromDailyTasks = false,
  /** متابعة بعد الاستعادة — تسجيل مكالمة بسيط دون استبيان رضا/تهيئة يعطّل الحفظ؛ لا يُحدَّث طابور active/inactive من «لم يرد» إن كان التعيين منجزاً */
  inactiveRestoredFollowup = false,
  /** بعد بلوغ 50 من مسار المتابعة المنفصل */
  onInactiveFollowupGoalBurst = null,
}) {
  const { user } = useAuth()
  const { storeStates, surveyByStoreId, assignments, newMerchantOnboardingDoneIds } = useStores()
  const { onCallSaved, todayCalls, goalPct } = usePoints()

  const satisfactionQuestionsUi = useMemo(() => getSatisfactionQuestionsForUi(), [])

  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [ratings, setRatings] = useState(() => Array(6).fill(0))
  const [suggestions, setSuggestions] = useState('')
  const [inactiveFeedback, setInactiveFeedback] = useState('')
  const [outcome, setOutcome] = useState('answered')
  const [onbYesNo, setOnbYesNo] = useState(() => [null, null, null])

  const dbCategory = storeStates[store.id]?.category || store.category || ''
  const inactiveFeedbackNeeded = useMemo(
    () =>
      !inactiveRestoredFollowup && callType === 'general' && isInactiveMerchantCategory(dbCategory),
    [inactiveRestoredFollowup, callType, dbCategory],
  )

  /**
   * مسار مبسّط: استبيان 3 أسئلة + حفظ / لم يرد
   * — استبيان التهيئة إلزامي عند أول مكالمة (تم الرد) لكل متجر احتضان لم يُكمَّل له الاستبيان بعد:
   *   مكالمة عامة أو inc_call1/2/3، في كل البيئات (ليس فقط التجريبي).
   * — مسؤول المتاجر من «المهام اليومية»: متابعة دورية لغير «قيد المكالمة» — نفس واجهة نعم/لا أدناه.
   */
  const ONBOARDING_CALL_TYPES = useMemo(
    () => new Set(['general', 'inc_call1', 'inc_call2', 'inc_call3']),
    [],
  )

  const simpleOnboardingFlow = useMemo(() => {
    if (inactiveRestoredFollowup) return false
    if (inactiveFeedbackNeeded) return false

    if (needsNewMerchantOnboardingSurvey(store, newMerchantOnboardingDoneIds)) {
      return ONBOARDING_CALL_TYPES.has(callType)
    }

    /**
     * متابعة دورية — مسؤول المتاجر من المهام اليومية: أسئلة نعم/لا (شحن/تتبع/مهام)
     * طالما المتجر ليس في مسار «نشط قيد مكالمة» (هناك استبيان النجوم منفصل).
     */
    if (
      fromDailyTasks
      && user?.role === 'active_manager'
      && callType === 'general'
      && !PENDING_CALL_PIPELINE_CATEGORIES.has(dbCategory)
    ) {
      return true
    }

    return false
  }, [
    callType,
    store,
    newMerchantOnboardingDoneIds,
    inactiveFeedbackNeeded,
    inactiveRestoredFollowup,
    fromDailyTasks,
    user?.role,
    dbCategory,
    ONBOARDING_CALL_TYPES,
  ])

  /** نسخة احتياطية إذا لم يُفعَّل المسار المبسّط — يجب أن تبقى متوافقة مع simpleOnboardingFlow للتهيئة */
  const onboardingNeeded = useMemo(
    () =>
      !inactiveRestoredFollowup
      && needsNewMerchantOnboardingSurvey(store, newMerchantOnboardingDoneIds)
      && ONBOARDING_CALL_TYPES.has(callType),
    [inactiveRestoredFollowup, callType, store, newMerchantOnboardingDoneIds, ONBOARDING_CALL_TYPES],
  )
  /**
   * استبيان الرضا (٦ أسئلة): مرة واحدة لكل متجر في المسار العادي؛
   * في «المتابعة الدورية» (مهام يومية + مسؤول المتاجر) يبقى إلزامياً عند كل «تم الرد»
   * طالما المتجر لا يزال ضمن قيد المكالمة — وإلا يختفي الاستبيان بعد أول تعبئة.
   */
  const surveyNeeded = useMemo(
    () => {
      if (inactiveRestoredFollowup) return false
      if (callType !== 'general' || outcome !== 'answered' || inactiveFeedbackNeeded) {
        return false
      }
      const inPendingPipeline = PENDING_CALL_PIPELINE_CATEGORIES.has(dbCategory)
      const periodicFollowUpMandatory =
        fromDailyTasks
        && user?.role === 'active_manager'
        && inPendingPipeline
      if (periodicFollowUpMandatory) return true
      return needsActiveSatisfactionSurvey(store.id, dbCategory, surveyByStoreId)
    },
    [
      callType,
      store.id,
      dbCategory,
      surveyByStoreId,
      inactiveFeedbackNeeded,
      inactiveRestoredFollowup,
      outcome,
      fromDailyTasks,
      user?.role,
    ],
  )
  const showOnboarding = !simpleOnboardingFlow && onboardingNeeded && outcome === 'answered'
  const inactiveFeedbackOk = inactiveFeedback.trim().length >= MIN_INACTIVE_FEEDBACK_LEN
  const allSurveyRated = ratings.every(r => r >= 1 && r <= 5)
  const allOnboardingYesNo = onbYesNo.every(v => v === true || v === false)

  useEffect(() => {
    setNote('')
    setError('')
    setRatings(Array(6).fill(0))
    setSuggestions('')
    setInactiveFeedback('')
    setOutcome('answered')
    setOnbYesNo([null, null, null])
  }, [store.id])

  function setRating(i, v) {
    setRatings(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  function setOnboardingYn(i, v) {
    setOnbYesNo(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  /** مسار مبسّط: تم الرد + حفظ الاستبيان + مكالمة — للبورصة 🔼/🔽 */
  async function saveAnsweredSimple() {
    setSaving(true)
    setError('')
    if (!allOnboardingYesNo) {
      setError('يرجى الإجابة بـ «نعم» أو «لا» على الأسئلة الثلاثة قبل حفظ المكالمة.')
      setSaving(false)
      return
    }
    try {
      const answers = buildOnboardingYesNoForApi(onbYesNo)
      if (!answers) {
        setError('إجابات الاستبيان غير صالحة.')
        setSaving(false)
        return
      }
      await saveSurvey({
        store_id: store.id,
        store_name: store.name,
        answers,
        suggestions: '',
        survey_kind: 'new_merchant_onboarding',
        user: user?.fullname ?? '',
        user_role: user?.role ?? '',
        username: user?.username ?? '',
      })

      const payload = {
        store_id: store.id,
        store_name: store.name,
        call_type: callType,
        outcome: 'answered',
        note: note.trim(),
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        username: user?.username ?? '',
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)
      onCallSaved(res?.points_awarded ?? 10)

      const ok = await runTaskCompletionAfterAnswered({
        taskCompletion, user, store, setError, setSaving,
      })
      if (!ok) return

      onSaved?.()
      setTimeout(onClose, 400)
    } catch (e) {
      setError(e?.response?.data?.error || 'تعذّر حفظ الاستبيان أو المكالمة.')
      setSaving(false)
    }
  }

  /** مسار مبسّط: لم يرد — طابور لم يتم الرد + إحضار متجر آخر عند الاستعادة */
  async function saveNoAnswerSimple() {
    setSaving(true)
    setError('')
    try {
      const payload = {
        store_id: store.id,
        store_name: store.name,
        call_type: callType,
        outcome: 'no_answer',
        note: note.trim(),
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        username: user?.username ?? '',
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)
      onCallSaved(res?.points_awarded ?? 0)

      if (user?.role === 'active_manager') {
        const a = assignments?.[store.id] ?? assignments?.[String(store.id)]
        if (a?.assigned_to === user?.username) {
          try {
            await markSurveyNoAnswer({
              store_id: store.id,
              store_name: store.name,
              username: user.username,
              queue: 'active',
            })
          } catch { /* */ }
        }
      }

      if (
        !inactiveRestoredFollowup
        && IS_STAGING_OR_DEV
        && taskCompletion?.inactiveRecovery
        && user?.role === 'inactive_manager'
        && user?.username
      ) {
        try {
          await markSurveyNoAnswer({
            store_id: store.id,
            store_name: store.name,
            username: user.username,
            queue: 'inactive',
          })
        } catch { /* */ }
      }

      onSaved?.()
      setTimeout(onClose, 400)
    } catch (e) {
      setError(e?.response?.data?.error || 'تعذّر تسجيل عدم الرد.')
    } finally {
      setSaving(false)
    }
  }

  /** متابعة المنجزة: «لم يرد» يحدّث التعيين + السجل + audit (أو تسجيل إضافي في تبويب لم يرد) */
  async function inactiveRestoredQuickNoAnswer() {
    setSaving(true)
    setError('')
    try {
      const ws = store?.assignment_workflow_status
      const noteText = note.trim()
      if (
        inactiveRestoredFollowup
        && user?.role === 'inactive_manager'
        && user?.username
      ) {
        if (ws === 'completed') {
          await postInactiveFollowupToNoAnswer({
            store_id: store.id,
            store_name: store.name || '',
            username: user.username,
            note: noteText,
            performed_by: user?.fullname || user?.username || '',
            performed_role: user?.role || 'inactive_manager',
          })
          onCallSaved(0)
          onSaved?.()
          setTimeout(onClose, 400)
          return
        }
        if (ws === 'no_answer') {
          await postInactiveFollowupNoAnswerLog({
            store_id: store.id,
            store_name: store.name || '',
            username: user.username,
            note: noteText,
            performed_by: user?.fullname || user?.username || '',
            performed_role: user?.role || 'inactive_manager',
          })
          onCallSaved(0)
          onSaved?.()
          setTimeout(onClose, 400)
          return
        }
      }
      const payload = {
        store_id: store.id,
        store_name: store.name,
        call_type: callType,
        outcome: 'no_answer',
        note: noteText,
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        username: user?.username ?? '',
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)
      onCallSaved(res?.points_awarded ?? 0)
      onSaved?.()
      setTimeout(onClose, 400)
    } catch (e) {
      setError(e?.response?.data?.error || 'تعذّر تسجيل عدم الرد.')
    } finally {
      setSaving(false)
    }
  }

  async function submitCall() {
    setSaving(true)
    setError('')

    if (outcome === 'answered') {
      if (inactiveFeedbackNeeded && !inactiveFeedbackOk) {
        setError('يرجى كتابة 10 أحرف على الأقل في «ماذا قال المتجر؟».')
        setSaving(false)
        return
      }
      if (surveyNeeded && !allSurveyRated) {
        setError('يرجى تقييم كل الأسئلة الستة من 1 إلى 5 قبل حفظ المكالمة.')
        setSaving(false)
        return
      }
      if (showOnboarding && !allOnboardingYesNo) {
        setError('يرجى الإجابة بـ «نعم» أو «لا» على الأسئلة الثلاثة قبل حفظ المكالمة.')
        setSaving(false)
        return
      }
    }

    try {
      if (outcome === 'answered') {
        if (inactiveFeedbackNeeded) {
          await saveSurvey({
            store_id: store.id,
            store_name: store.name,
            survey_kind: 'inactive_feedback',
            inactive_feedback: inactiveFeedback.trim(),
            user: user?.fullname ?? '',
            user_role: user?.role ?? '',
            username: user?.username ?? '',
          })
        } else if (surveyNeeded) {
          await saveSurvey({
            store_id: store.id,
            store_name: store.name,
            answers: ratings,
            suggestions: suggestions.trim(),
            survey_kind: 'active_csat',
            user: user?.fullname ?? '',
            user_role: user?.role ?? '',
            username: user?.username ?? '',
          })
        }
        if (showOnboarding) {
          const answers = buildOnboardingYesNoForApi(onbYesNo)
          if (!answers) {
            setError('إجابات الاستبيان غير صالحة.')
            setSaving(false)
            return
          }
          await saveSurvey({
            store_id: store.id,
            store_name: store.name,
            answers,
            suggestions: '',
            survey_kind: 'new_merchant_onboarding',
            user: user?.fullname ?? '',
            user_role: user?.role ?? '',
            username: user?.username ?? '',
          })
        }
      }

      const payload = {
        store_id: store.id,
        store_name: store.name,
        call_type: callType,
        outcome,
        note: note.trim(),
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        username: user?.username ?? '',
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)

      const pts = res?.points_awarded ?? (outcome === 'answered' ? 10 : 0)
      onCallSaved(pts)

      if (
        (outcome === 'no_answer' || outcome === 'busy')
        && user?.role === 'active_manager'
      ) {
        const a = assignments?.[store.id] ?? assignments?.[String(store.id)]
        if (a?.assigned_to === user?.username) {
          try {
            await markSurveyNoAnswer({
              store_id: store.id,
              store_name: store.name,
              username: user.username,
              queue: 'active',
            })
          } catch { /* */ }
        }
      }

      if (
        outcome === 'no_answer'
        && !inactiveRestoredFollowup
        && IS_STAGING_OR_DEV
        && taskCompletion?.inactiveRecovery
        && user?.role === 'inactive_manager'
        && user?.username
      ) {
        try {
          await markSurveyNoAnswer({
            store_id: store.id,
            store_name: store.name,
            username: user.username,
            queue: 'inactive',
          })
        } catch { /* */ }
      }

      if (
        inactiveRestoredFollowup
        && user?.role === 'inactive_manager'
        && user?.username
        && outcome === 'answered'
      ) {
        try {
          const ir = await postInactiveFollowupSuccess({
            store_id: store.id,
            store_name: store.name || '',
            username: user.username,
          })
          if (ir?.goal_just_met) {
            onInactiveFollowupGoalBurst?.()
          }
        } catch (e) {
          const msg = e?.response?.data?.error || e?.message || 'تعذّر مزامنة إتمام المتابعة مع السجل.'
          setError(msg)
          setSaving(false)
          return
        }
      } else if (taskCompletion && user?.username && outcome === 'answered') {
        const shouldSyncWorkflow =
          IS_STAGING_OR_DEV
          || (user?.role === 'active_manager' && taskCompletion.releaseActiveWorkflow)
          || (user?.role === 'inactive_manager' && taskCompletion.inactiveRecovery)
          || (Boolean(taskCompletion.dailyTaskKey)
            && ['incubation_manager', 'executive'].includes(user?.role))
        if (shouldSyncWorkflow) {
          const ok = await runTaskCompletionAfterAnswered({
            taskCompletion, user, store, setError, setSaving,
          })
          if (!ok) return
        }
      }

      onSaved?.()
      setTimeout(onClose, 400)
    } catch (e) {
      const msg =
        e?.response?.data?.error
        || (inactiveFeedbackNeeded || surveyNeeded || showOnboarding
          ? 'تعذّر حفظ الاستبيان أو المكالمة.'
          : 'فشل حفظ المكالمة، حاول مرة أخرى')
      setError(msg)
      setSaving(false)
    }
  }

  const modalWide = simpleOnboardingFlow
    || surveyNeeded
    || inactiveFeedbackNeeded
    || showOnboarding

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] ${
          modalWide ? 'max-w-lg' : 'max-w-md'
        }`}
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <div style={{ background: 'linear-gradient(135deg, #1e0a3c, #2d1466)' }} className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)', boxShadow: '0 4px 16px rgba(124,58,237,0.5)' }}
              >
                <Phone size={18} className="text-white" />
              </div>
              <div>
                <h3 className="font-black text-white text-base">تسجيل مكالمة</h3>
                {simpleOnboardingFlow && (
                  <p className="text-violet-200/95 text-[11px] mt-0.5">
                    {fromDailyTasks
                      ? 'مهمة يومية — استبيان التهيئة (إلزامي): أجب عن الأسئلة ثم «حفظ المكالمة» أو «لم يرد»'
                      : 'استبيان التهيئة — أجب عن الأسئلة ثم احفظ أو اختر «لم يرد»'}
                  </p>
                )}
                <div className="text-purple-300 text-xs max-w-[240px] min-w-0 mt-0.5">
                  <StoreNameWithId store={store} nameClassName="text-purple-200" idClassName="font-mono text-purple-300/95" />
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {!simpleOnboardingFlow && !DISABLE_POINTS_AND_PERFORMANCE && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/50 text-xs flex items-center gap-1">
                  <Zap size={10} className="text-amber-400" />
                  هدف اليوم
                </span>
                <span className="text-amber-400 text-xs font-bold">
                  {todayCalls} / {DAILY_GOAL} مكالمة
                </span>
              </div>
              <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    background: goalPct >= 100
                      ? 'linear-gradient(90deg, #10b981, #059669)'
                      : 'linear-gradient(90deg, #f59e0b, #d97706)',
                    boxShadow: '0 0 8px rgba(245,158,11,0.5)',
                  }}
                  initial={{ width: 0 }}
                  animate={{ width: `${goalPct}%` }}
                  transition={{ duration: 0.8, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0" dir="rtl">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          {simpleOnboardingFlow ? (
            <>
              <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
                {SIMPLE_ONBOARDING_HEADINGS.map((heading, i) => {
                  const q = NEW_MERCHANT_ONBOARDING_QUESTIONS_DEV[i]
                  return (
                    <div key={q.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <p className="text-xs font-black text-violet-800 mb-1">{heading}</p>
                      <p className="text-sm text-slate-800 leading-relaxed mb-3">{q.text}</p>
                      <YesNoRow value={onbYesNo[i]} onChange={v => setOnboardingYn(i, v)} />
                    </div>
                  )
                })}
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-800 text-sm resize-none"
                />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <p className="text-sm font-black text-slate-900">نتيجة المكالمة</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">
                  من بين الخيارات أدناه — مثلاً «لم يرد» ثم اضغط «حفظ المكالمة» في الأسفل.
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {OUTCOME_OPTIONS.map(o => {
                    const selected = outcome === o.id
                    const Oc = o.Icon
                    return (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => setOutcome(o.id)}
                        className={`flex items-center gap-2 rounded-xl border-2 px-2.5 py-2.5 text-[11px] sm:text-xs font-bold transition-all text-right ${
                          selected
                            ? 'border-violet-600 bg-violet-50 text-violet-950 shadow-sm ring-1 ring-violet-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <Oc
                          size={17}
                          className={`shrink-0 ${selected ? 'text-violet-700' : 'text-slate-400'}`}
                          strokeWidth={2.2}
                        />
                        <span className="leading-snug flex-1 min-w-0">{o.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {inactiveFeedbackNeeded && outcome === 'answered' && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 space-y-3">
                  <h4 className="text-sm font-black text-amber-950">ماذا قال المتجر؟</h4>
                  <p className="text-[11px] text-amber-900/85 leading-relaxed">
                    ملاحظة إلزامية للمتاجر غير النشطة — اكتب ما دار في المحادثة ({MIN_INACTIVE_FEEDBACK_LEN} أحرف فأكثر).
                  </p>
                  <textarea
                    value={inactiveFeedback}
                    onChange={e => setInactiveFeedback(e.target.value)}
                    rows={5}
                    placeholder="اكتب ملخص رد المتجر..."
                    className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-y min-h-[120px]"
                  />
                  <p className="text-[11px] text-slate-500 tabular-nums">
                    {inactiveFeedback.trim().length}/{MIN_INACTIVE_FEEDBACK_LEN} حرفاً على الأقل
                  </p>
                </div>
              )}

              {showOnboarding && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/40 p-4 space-y-3">
                  <div>
                    <h4 className="text-sm font-black text-violet-900">استبيان تهيئة المتجر</h4>
                    <p className="text-[11px] text-violet-800/90 mt-1 leading-relaxed">
                      ثلاثة أسئلة (نعم / لا) — تُحفظ مع المكالمة عند «تم الرد».
                    </p>
                  </div>
                  {NEW_MERCHANT_ONBOARDING_QUESTIONS_DEV.map((q, i) => (
                    <div key={q.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-bold text-violet-700 mb-1">{q.section}</p>
                      <p className="text-sm text-slate-800 leading-relaxed mb-2">{q.text}</p>
                      <YesNoRow value={onbYesNo[i]} onChange={v => setOnboardingYn(i, v)} />
                    </div>
                  ))}
                </div>
              )}

              {surveyNeeded && (
                <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
                  <div>
                    <h4 className="text-sm font-black text-violet-900">استبيان رضا العميل</h4>
                    <p className="text-[11px] text-violet-800/90 mt-1 leading-relaxed">
                      عبّي التقييم لكل بند قبل حفظ المكالمة — المقترحات اختيارية.
                    </p>
                  </div>
                  {satisfactionQuestionsUi.map((q, i) => (
                    <div key={q.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                      <p className="text-[10px] font-bold text-violet-700 mb-1">
                        س{i + 1} — {q.short}
                      </p>
                      <p className="text-sm text-slate-800 leading-relaxed mb-2">{q.text}</p>
                      <StarRow value={ratings[i]} onChange={v => setRating(i, v)} />
                    </div>
                  ))}
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">
                      مقترحات أو ملاحظات إضافية من المتجر
                    </label>
                    <textarea
                      value={suggestions}
                      onChange={e => setSuggestions(e.target.value)}
                      rows={3}
                      placeholder="اختياري — أي ملاحظة يذكرها التاجر تُحفظ مع سجل النظام."
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y min-h-[80px]"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">ملاحظات (اختياري)</label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={3}
                  placeholder="اكتب ملاحظاتك هنا..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-800 text-sm resize-none"
                />
              </div>
            </>
          )}
        </div>

        {simpleOnboardingFlow ? (
          <div className="shrink-0 border-t border-slate-200/90 bg-slate-50/80 px-5 py-4 space-y-3">
            <p className="text-[11px] text-slate-600 text-center leading-relaxed">
              لم يتجاوب المتجر؟ سجّل «لم يرد» دون تعبئة الاستبيان — أو أكمل الأسئلة ثم «حفظ المكالمة».
            </p>
            <div className="flex flex-row-reverse flex-wrap gap-2">
              <motion.button
                type="button"
                onClick={saveAnsweredSimple}
                disabled={saving || !allOnboardingYesNo}
                whileHover={{ scale: saving ? 1 : 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 min-w-[140px] py-3 font-black rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-55 min-h-[48px]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
                }}
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جارٍ الحفظ...</>
                  : <><Phone size={15} /> حفظ المكالمة{DISABLE_POINTS_AND_PERFORMANCE ? '' : ' 🪙'}</>
                }
              </motion.button>
              <motion.button
                type="button"
                onClick={saveNoAnswerSimple}
                disabled={saving}
                whileHover={{ scale: saving ? 1 : 1.01 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 min-w-[140px] py-3 font-black rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-950 text-sm disabled:opacity-50 shadow-sm"
              >
                {saving ? 'جارٍ التسجيل…' : 'لم يرد'}
              </motion.button>
            </div>
          </div>
        ) : (
          <>
            {inactiveRestoredFollowup && (
              <div className="shrink-0 border-t border-amber-200/80 bg-amber-50/70 px-5 py-3">
                <p className="text-[11px] text-amber-950/90 text-center leading-relaxed mb-2">
                  أو سجّل «لم يرد» — يُحدَّث التعيين وسجل المكالمات والمراجعة (لا يُحتسب نحو الـ50).
                </p>
                <button
                  type="button"
                  onClick={inactiveRestoredQuickNoAnswer}
                  disabled={saving}
                  className="w-full py-2.5 font-black rounded-xl border-2 border-amber-500 bg-white text-amber-950 text-sm disabled:opacity-50 shadow-sm"
                >
                  {saving ? 'جارٍ التسجيل…' : 'لم يرد — تسجيل سريع'}
                </button>
              </div>
            )}
            <div className="flex flex-row-reverse gap-3 px-5 pb-5 items-stretch">
              <motion.button
                type="button"
                onClick={submitCall}
                disabled={
                  saving
                  || (outcome === 'answered' && surveyNeeded && !allSurveyRated)
                  || (outcome === 'answered' && inactiveFeedbackNeeded && !inactiveFeedbackOk)
                  || (outcome === 'answered' && showOnboarding && !allOnboardingYesNo)
                }
                whileHover={{ scale: saving ? 1 : 1.02 }}
                whileTap={{ scale: 0.97 }}
                className="flex-1 py-3 font-black rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60 min-h-[48px]"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                  boxShadow: '0 6px 20px rgba(124,58,237,0.4)',
                }}
              >
                {saving
                  ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> جارٍ الحفظ...</>
                  : <><Phone size={15} /> حفظ المكالمة{DISABLE_POINTS_AND_PERFORMANCE ? '' : ' 🪙'}</>
                }
              </motion.button>
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors text-sm shrink-0"
              >
                إلغاء
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
