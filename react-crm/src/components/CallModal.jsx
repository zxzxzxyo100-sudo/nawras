import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Phone, Zap } from 'lucide-react'
import { logCall }             from '../services/api'
import { useAuth }             from '../contexts/AuthContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'

const OUTCOMES = [
  { value: 'answered',  label: 'تم الرد',            emoji: '✅' },
  { value: 'no_answer', label: 'لم يرد',              emoji: '📵' },
  { value: 'busy',      label: 'مشغول',               emoji: '🔄' },
  { value: 'callback',  label: 'طلب معاودة الاتصال',  emoji: '📞' },
]

export default function CallModal({ store, callType = 'general', onClose, onSaved }) {
  const { user }                              = useAuth()
  const { onCallSaved, todayCalls, goalPct }  = usePoints()

  const [outcome, setOutcome] = useState('answered')
  const [note,    setNote]    = useState('')
  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await logCall({
        store_id:       store.id,
        store_name:     store.name,
        call_type:      callType,
        outcome,
        note,
        performed_by:   user?.fullname,
        performed_role: user?.role,
      })

      const pts = res?.points_awarded || 10

      // يُطلق الأنيميشن عبر Context (يظهر حتى بعد إغلاق الـ Modal)
      onCallSaved(pts)
      onSaved?.()

      // أغلق الـ Modal بعد لحظة قصيرة
      setTimeout(onClose, 400)
    } catch {
      setError('فشل حفظ المكالمة، حاول مرة أخرى')
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
        className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
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
                <p className="text-purple-300 text-xs truncate max-w-[180px]">{store.name}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white/60 hover:text-white transition-colors"
            >
              <X size={15} />
            </button>
          </div>

          {/* شريط تقدم الهدف */}
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
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
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
            disabled={saving}
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
              : <><Phone size={15} /> حفظ المكالمة 🪙</>
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
