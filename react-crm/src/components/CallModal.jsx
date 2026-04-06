import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, Phone, Zap, Star } from 'lucide-react'
import {
  logCall,
  saveSurvey,
  markSurveyNoAnswer,
  markDailyTaskDone,
  completeInactiveQueueSuccess,
  releaseAfterSurvey,
} from '../services/api'
import { IS_STAGING_OR_DEV } from '../config/envFlags'
import StoreNameWithId         from './StoreNameWithId'
import { useAuth }             from '../contexts/AuthContext'
import { useStores }           from '../contexts/StoresContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import {
  SATISFACTION_QUESTIONS,
  needsActiveSatisfactionSurvey,
  isInactiveMerchantCategory,
} from '../constants/satisfactionSurvey'

const MIN_INACTIVE_FEEDBACK_LEN = 10

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

/**
 * @param {object} [taskCompletion] — عند تفعيل مسار التجريب: إتمام المهمة اليومية بعد «حفظ المكالمة»
 * @param {string} [taskCompletion.dailyTaskKey]
 * @param {boolean} [taskCompletion.inactiveRecovery] — طابور استعادة غير النشط
 * @param {boolean} [taskCompletion.releaseActiveWorkflow] — طابور نشط بعد الاستبيان
 * @param {() => void} [taskCompletion.onInactiveGoalBurst]
 */
export default function CallModal({
  store,
  callType = 'general',
  onClose,
  onSaved,
  taskCompletion = null,
}) {
  const { user } = useAuth()
  const { storeStates, surveyByStoreId, assignments } = useStores()
  const { onCallSaved, todayCalls, goalPct } = usePoints()

  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [ratings, setRatings] = useState(() => Array(6).fill(0))
  const [suggestions, setSuggestions] = useState('')
  const [inactiveFeedback, setInactiveFeedback] = useState('')

  const dbCategory = storeStates[store.id]?.category || store.category || ''
  const inactiveFeedbackNeeded = useMemo(
    () => callType === 'general' && isInactiveMerchantCategory(dbCategory),
    [callType, dbCategory],
  )
  const surveyNeeded = useMemo(
    () =>
      callType === 'general'
      && !inactiveFeedbackNeeded
      && needsActiveSatisfactionSurvey(store.id, dbCategory, surveyByStoreId),
    [callType, store.id, dbCategory, surveyByStoreId, inactiveFeedbackNeeded],
  )
  const inactiveFeedbackOk = inactiveFeedback.trim().length >= MIN_INACTIVE_FEEDBACK_LEN
  const allSurveyRated = ratings.every(r => r >= 1 && r <= 5)

  useEffect(() => {
    setNote('')
    setError('')
    setRatings(Array(6).fill(0))
    setSuggestions('')
    setInactiveFeedback('')
  }, [store.id])

  function setRating(i, v) {
    setRatings(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    if (inactiveFeedbackNeeded && !inactiveFeedbackOk) {
      setError(`يرجى كتابة 10 أحرف على الأقل في «ماذا قال المتجر؟».`)
      setSaving(false)
      return
    }
    if (surveyNeeded && !allSurveyRated) {
      setError('يرجى تقييم كل الأسئلة الستة من 1 إلى 5 قبل حفظ المكالمة.')
      setSaving(false)
      return
    }
    try {
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
          user: user?.fullname ?? '',
          user_role: user?.role ?? '',
          username: user?.username ?? '',
        })
      }
      const payload = {
        store_id:       store.id,
        store_name:     store.name,
        call_type:      callType,
        outcome:        'answered',
        note,
        performed_by:   user?.fullname || user?.username || '',
        performed_role: user?.role,
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)

      const pts = res?.points_awarded ?? 10
      onCallSaved(pts)

      if (IS_STAGING_OR_DEV && taskCompletion && user?.username) {
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
            await releaseAfterSurvey({ store_id: sid, username: u })
          }
          if (taskCompletion.dailyTaskKey) {
            await markDailyTaskDone({ username: u, task_key: taskCompletion.dailyTaskKey })
          }
        } catch (syncErr) {
          const msg = syncErr?.response?.data?.error || syncErr?.message || 'تعذّر مزامنة إتمام المهمة.'
          setError(msg)
          setSaving(false)
          return
        }
      }

      onSaved?.()

      // أغلق الـ Modal بعد لحظة قصيرة
      setTimeout(onClose, 400)
    } catch (e) {
      const msg =
        e?.response?.data?.error
        || (inactiveFeedbackNeeded || surveyNeeded ? 'تعذّر حفظ الاستبيان أو المكالمة.' : 'فشل حفظ المكالمة، حاول مرة أخرى')
      setError(msg)
      setSaving(false)
    }
  }

  async function handleNoAnswer() {
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
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)
      const pts = res?.points_awarded ?? 0
      onCallSaved(pts)

      if (user?.role === 'active_manager') {
        const a = assignments?.[store.id] ?? assignments?.[String(store.id)]
        if (a?.assigned_to === user?.username) {
          try {
            await markSurveyNoAnswer({
              store_id: store.id,
              store_name: store.name,
              username: user.username,
            })
          } catch {
            /* ليس في طابور سير العمل النشط */
          }
        }
      }

      if (
        IS_STAGING_OR_DEV
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
        } catch {
          /* لا تعيين في الطابور */
        }
      }

      onSaved?.()
      setTimeout(onClose, 400)
    } catch (e) {
      setError(e?.response?.data?.error || 'تعذّر تسجيل عدم الرد.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1,    opacity: 1, y: 0  }}
        exit={{   scale: 0.92, opacity: 0, y: 20 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] ${surveyNeeded || inactiveFeedbackNeeded ? 'max-w-lg' : 'max-w-md'}`}
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Header */}
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
                <div className="text-purple-300 text-xs max-w-[240px] min-w-0">
                  <StoreNameWithId store={store} nameClassName="text-purple-200" idClassName="font-mono text-purple-300/95" />
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {!DISABLE_POINTS_AND_PERFORMANCE && (
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

        {/* Body */}
        <div className="p-5 space-y-4 flex-1 overflow-y-auto min-h-0" dir="rtl">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          {inactiveFeedbackNeeded && (
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

          {surveyNeeded && (
            <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-black text-violet-900">استبيان رضا العميل</h4>
                <p className="text-[11px] text-violet-800/90 mt-1 leading-relaxed">
                  عبّي التقييم لكل بند قبل حفظ المكالمة — المقترحات اختيارية.
                </p>
              </div>
              {SATISFACTION_QUESTIONS.map((q, i) => (
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
        </div>

        {/* Footer */}
        <div className="flex flex-col gap-2 px-5 pb-5">
          <motion.button
            type="button"
            onClick={handleNoAnswer}
            disabled={saving}
            whileHover={{ scale: saving ? 1 : 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3 font-black rounded-xl border-2 border-amber-400 bg-amber-50 text-amber-950 text-sm disabled:opacity-50"
          >
            {saving ? 'جارٍ التسجيل…' : 'عدم الرد — يبقى المتجر في المهام اليومية'}
          </motion.button>
          <div className="flex gap-3">
            <motion.button
              type="button"
              onClick={handleSave}
              disabled={saving || (surveyNeeded && !allSurveyRated) || (inactiveFeedbackNeeded && !inactiveFeedbackOk)}
              whileHover={{ scale: saving ? 1 : 1.02 }}
              whileTap={{ scale: 0.97 }}
              className="flex-1 py-3 font-black rounded-xl text-white text-sm flex items-center justify-center gap-2 disabled:opacity-60"
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
        </div>
      </motion.div>
    </div>
  )
}
