import { useState } from 'react'
import { X, Star } from 'lucide-react'
import { saveSurvey } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { SATISFACTION_QUESTIONS } from '../constants/satisfactionSurvey'
import StoreNameWithId from './StoreNameWithId'

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
            size={26}
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
 * استبيان رضا العميل — متاجر نشط يشحن (قبل تسجيل مكالمة عامة عند الحاجة)
 */
export default function CustomerSatisfactionModal({ store, onClose, onSaved }) {
  const { user } = useAuth()
  const [ratings, setRatings] = useState(() => Array(6).fill(0))
  const [suggestions, setSuggestions] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const allRated = ratings.every(r => r >= 1 && r <= 5)

  function setRating(i, v) {
    setRatings(prev => {
      const next = [...prev]
      next[i] = v
      return next
    })
  }

  async function submit() {
    setError('')
    if (!allRated) {
      setError('يرجى تقييم كل الأسئلة الستة من 1 إلى 5.')
      return
    }
    setSaving(true)
    try {
      await saveSurvey({
        store_id: store.id,
        store_name: store.name,
        answers: ratings,
        suggestions: suggestions.trim(),
        user: user?.fullname ?? '',
        user_role: user?.role ?? '',
      })
      await onSaved?.()
    } catch (e) {
      setError(e.response?.data?.error || 'تعذّر حفظ الاستبيان.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div
        className="fixed inset-x-4 top-[4vh] max-h-[92vh] overflow-hidden rounded-2xl z-[61] shadow-2xl flex flex-col bg-white max-w-lg mx-auto"
        dir="rtl"
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-gradient-to-l from-violet-900 to-slate-900 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-white font-bold text-base leading-snug">استبيان رضا العميل</h2>
            <p className="text-violet-200/90 text-xs mt-1 min-w-0">
              <StoreNameWithId store={store} nameClassName="text-violet-100" idClassName="font-mono text-white/85" />
            </p>
            <p className="text-amber-200/90 text-[11px] mt-2 leading-relaxed">
              عبّي التقييم لكل بند قبل تسجيل المكالمة في «نشط يشحن — قيد المكالمة» — المقترحات اختيارية.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          {SATISFACTION_QUESTIONS.map((q, i) => (
            <div key={q.id} className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
              <p className="text-[10px] font-bold text-violet-700 mb-1">
                س{i + 1} — {q.short}
              </p>
              <p className="text-sm text-slate-800 leading-relaxed mb-3">{q.text}</p>
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
              rows={5}
              placeholder="اختياري — أي ملاحظة يذكرها التاجر تُحفظ مع سجل النظام."
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-y min-h-[120px]"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="px-4 py-3 border-t border-slate-100 flex gap-2 bg-slate-50">
          <button
            type="button"
            onClick={submit}
            disabled={saving || !allRated}
            className="flex-1 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ الاستبيان ومتابعة'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm font-medium hover:bg-white"
          >
            إلغاء
          </button>
        </div>
      </div>
    </>
  )
}
