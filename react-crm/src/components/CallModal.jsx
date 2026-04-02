import { useState } from 'react'
import { X, Phone } from 'lucide-react'
import { logCall } from '../services/api'
import { useAuth } from '../contexts/AuthContext'

const OUTCOMES = [
  { value: 'answered',    label: 'تم الرد' },
  { value: 'no_answer',   label: 'لم يرد' },
  { value: 'busy',        label: 'مشغول' },
  { value: 'callback',    label: 'طلب معاودة الاتصال' },
]

export default function CallModal({ store, callType = 'general', onClose, onSaved }) {
  const { user } = useAuth()
  const [outcome, setOutcome] = useState('answered')
  const [note, setNote]       = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      await logCall({
        store_id:   store.id,
        store_name: store.name,
        call_type:  callType,
        outcome,
        note,
        performed_by:   user?.fullname,
        performed_role: user?.role,
      })
      onSaved?.()
      onClose()
    } catch (err) {
      setError('فشل حفظ المكالمة، حاول مرة أخرى')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center">
              <Phone size={18} className="text-green-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">تسجيل مكالمة</h3>
              <p className="text-slate-500 text-xs">{store.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">نتيجة المكالمة</label>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(o => (
                <button
                  key={o.value}
                  onClick={() => setOutcome(o.value)}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${
                    outcome === o.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-blue-300'
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">ملاحظات (اختياري)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="اكتب ملاحظاتك هنا..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-sm resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-bold rounded-xl transition-colors"
          >
            {saving ? 'جارٍ الحفظ...' : 'حفظ المكالمة'}
          </button>
          <button
            onClick={onClose}
            className="px-5 py-3 border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl font-medium transition-colors"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  )
}
