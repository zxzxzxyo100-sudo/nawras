import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { X, Phone, Zap, Star } from 'lucide-react'
import { logCall, saveSurvey } from '../services/api'
import StoreNameWithId         from './StoreNameWithId'
import { useAuth }             from '../contexts/AuthContext'
import { useStores }           from '../contexts/StoresContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import {
  SATISFACTION_QUESTIONS,
  needsActiveSatisfactionSurvey,
} from '../constants/satisfactionSurvey'

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

const OUTCOMES = [
  { value: 'answered',  label: 'تم الرد',            emoji: '✅' },
  { value: 'no_answer', label: 'لم يرد',              emoji: '📵' },
  { value: 'busy',      label: 'مشغول',               emoji: '🔄' },
  { value: 'callback',  label: 'طلب معاودة الاتصال',  emoji: '📞' },
]

function storeHasShipped(store) {
  if (!store) return false
  const n = Number(store.total_shipments ?? 0)
  if (n > 0) return true
  const d = store.last_shipment_date
  return Boolean(d && d !== 'لا يوجد')
}

export default function CallModal({ store, callType = 'general', onClose, onSaved }) {
  const { user } = useAuth()
  const { storeStates, surveyByStoreId } = useStores()
  const { onCallSaved, todayCalls, goalPct } = usePoints()

  const [outcome, setOutcome] = useState('answered')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')
  const [ratings, setRatings] = useState(() => Array(6).fill(0))
  const [suggestions, setSuggestions] = useState('')

  const dbCategory = storeStates[store.id]?.category || store.category || ''
  const surveyNeeded = useMemo(
    () => callType === 'general' && needsActiveSatisfactionSurvey(store.id, dbCategory, surveyByStoreId),
    [callType, store.id, dbCategory, surveyByStoreId],
  )
  const allSurveyRated = ratings.every(r => r >= 1 && r <= 5)

  useEffect(() => {
    setOutcome('answered')
    setNote('')
    setError('')
    setRatings(Array(6).fill(0))
    setSuggestions('')
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
    if (surveyNeeded && !allSurveyRated) {
      setError('يرجى تقييم كل الأسئلة الستة من 1 إلى 5 قبل حفظ المكالمة.')
      setSaving(false)
      return
    }
    try {
      if (surveyNeeded) {
        await saveSurvey({
          store_id: store.id,
          store_name: store.name,
          answers: ratings,
          suggestions: suggestions.trim(),
          user: user?.fullname ?? '',
          user_role: user?.role ?? '',
        })
      }
      const payload = {
        store_id:       store.id,
        store_name:     store.name,
        call_type:      callType,
        outcome,
        note,
        performed_by:   user?.fullname || user?.username || '',
        performed_role: user?.role,
        registration_date: store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(store)
      }
      const res = await logCall(payload)

      const pts = res?.points_awarded || 10
      onCallSaved(pts)
      onSaved?.()

      // أغلق الـ Modal بعد لحظة قصيرة
      setTimeout(onClose, 400)
    } catch (e) {
      const msg =
        e?.response?.data?.error
        || (surveyNeeded ? 'تعذّر حفظ الاستبيان أو المكالمة.' : 'فشل حفظ المكالمة، حاول مرة أخرى')
      setError(msg)
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
        className={`bg-white rounded-3xl shadow-2xl w-full overflow-hidden flex flex-col max-h-[90vh] ${surveyNeeded ? 'max-w-lg' : 'max-w-md'}`}
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

          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2">نتيجة المكالمة</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(o => (
                <motion.button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  whileTap={{ scale: 0.96 }}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all flex items-center gap-2 justify-center ${
                    outcome === o.value
                      ? 'text-white border-transparent'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-violet-300'
                  }`}
                  style={outcome === o.value ? {
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    boxShadow: '0 4px 12px rgba(124,58,237,0.35)',
                  } : {}}
                >
                  <span>{o.emoji}</span>
                  {o.label}
                </motion.button>
              ))}
            </div>
          </div>

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
        <div className="flex gap-3 px-5 pb-5">
          <motion.button
            onClick={handleSave}
            disabled={saving || (surveyNeeded && !allSurveyRated)}
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
            onClick={onClose}
            className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors text-sm"
          >
            إلغاء
          </button>
        </div>
      </motion.div>
    </div>
  )
}
