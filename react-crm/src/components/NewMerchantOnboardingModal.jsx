import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { X, Star, ClipboardList, Info } from 'lucide-react'
import { saveSurvey, markDailyTaskDone } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import StoreNameWithId from './StoreNameWithId'
import {
  NEW_MERCHANT_ONBOARDING_QUESTIONS,
  buildOnboardingAnswersForApi,
} from '../constants/newMerchantOnboardingSurvey'

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
            size={24}
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

/**
 * استبيان تهيئة المتاجر الجديدة — ثلاثة أسئلة (لوحة متاجر جديدة / مهام يومية فقط)
 */
export default function NewMerchantOnboardingModal({
  store,
  onClose,
  onSaved,
  /** إن وُجدت، تُخفى مهمة اليوم ذات المفتاح بعد حفظ الاستبيان بنجاح */
  dailyTaskKey,
}) {
  const { user } = useAuth()
  const [ratings, setRatings] = useState(() => [0, 0, 0])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allStarsSet = ratings.every(r => r >= 1 && r <= 5)

  useEffect(() => {
    setRatings([0, 0, 0])
    setError('')
  }, [store?.id])

  function setRating(i, v) {
    setRatings(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (!allStarsSet) {
      setError('يرجى تقييم الأسئلة الثلاثة بالنجوم قبل «تم».')
      return
    }
    const answers = buildOnboardingAnswersForApi(ratings)
    if (!answers) {
      setError('تقييم غير صالح.')
      return
    }

    const payload = {
      store_id: store.id,
      store_name: store.name,
      answers,
      suggestions: '',
      survey_kind: 'new_merchant_onboarding',
      user: user?.fullname ?? '',
      user_role: user?.role ?? '',
      username: user?.username ?? '',
    }

    setSaving(true)
    try {
      await saveSurvey(payload)
      if (dailyTaskKey && user?.username) {
        await markDailyTaskDone({ username: user.username, task_key: dailyTaskKey })
      }
      onSaved?.()
    } catch (err) {
      setError(err.response?.data?.error || 'تعذّر حفظ الاستبيان.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[55] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-onboarding-survey-title"
        initial={{ scale: 0.94, opacity: 0, y: 16 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="relative w-full max-w-lg max-h-[min(92vh,720px)] flex flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200/80"
        dir="rtl"
        onClick={ev => ev.stopPropagation()}
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        <div
          className="shrink-0 px-4 py-4 sm:px-5 border-b border-slate-100 flex items-start justify-between gap-3"
          style={{ background: 'linear-gradient(135deg, #1e0a3c, #2d1466)' }}
        >
          <div className="flex items-start gap-3 min-w-0">
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
              style={{
                background: 'linear-gradient(135deg, #7c3aed, #a855f7)',
                boxShadow: '0 4px 16px rgba(124,58,237,0.45)',
              }}
            >
              <ClipboardList size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 id="new-onboarding-survey-title" className="text-white font-black text-base leading-snug">
                استبيان تهيئة متجر جديد
              </h2>
              <p className="text-violet-200/95 text-xs mt-1 min-w-0">
                <StoreNameWithId
                  store={store}
                  nameClassName="text-violet-100 font-semibold"
                  idClassName="font-mono text-white/85 text-[11px]"
                />
              </p>
              <p className="text-amber-200/90 text-[11px] mt-2 leading-relaxed">
                ثلاثة أسئلة — مرر المؤشر على أيقونة المعلومات لإرشاد الموظف أثناء المكالمة.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/80 shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-4">
            {NEW_MERCHANT_ONBOARDING_QUESTIONS.map((q, i) => (
              <div
                key={q.id}
                className="rounded-xl border border-slate-100 bg-slate-50/90 p-3 sm:p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-[11px] font-bold text-violet-700">
                    سؤال {i + 1} — {q.section}
                  </p>
                  <span
                    className="inline-flex shrink-0 text-violet-600 hover:text-violet-800 cursor-help"
                    title={q.tooltip}
                  >
                    <Info size={18} strokeWidth={2} aria-hidden />
                    <span className="sr-only">{q.tooltip}</span>
                  </span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed mb-3">{q.text}</p>
                <StarRow value={ratings[i]} onChange={v => setRating(i, v)} />
              </div>
            ))}

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
                {error}
              </p>
            )}
          </div>

          <div className="shrink-0 flex flex-col gap-2 px-4 py-3 sm:px-5 border-t border-slate-100 bg-slate-50/90">
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white transition-colors"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={saving || !allStarsSet}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-black transition-colors"
              >
                {saving ? 'جارٍ الحفظ…' : 'تم'}
              </button>
            </div>
          </div>
        </form>
      </motion.div>
    </div>
  )
}
