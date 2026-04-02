import { useState, useEffect } from 'react'
import { X, Phone, Lock, ArrowLeftRight, Package, Calendar, TrendingUp, History, Smartphone } from 'lucide-react'
import { setStoreStatus, getAuditLog } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import CallModal from './CallModal'

const CATEGORY_LABELS = {
  incubating: { label: 'احتضان',      bg: 'bg-purple-100', text: 'text-purple-700' },
  active:     { label: 'نشط',         bg: 'bg-green-100',  text: 'text-green-700'  },
  inactive:   { label: 'غير نشط',     bg: 'bg-red-100',    text: 'text-red-700'    },
  frozen:     { label: 'مجمد',        bg: 'bg-slate-100',  text: 'text-slate-600'  },
  restoring:  { label: 'قيد الاستعادة', bg: 'bg-cyan-100', text: 'text-cyan-700'  },
  recovered:  { label: 'تم الاستعادة', bg: 'bg-teal-100',  text: 'text-teal-700'  },
}

export default function StoreDrawer({ store, onClose }) {
  const { user } = useAuth()
  const { callLogs, storeStates, reload } = useStores()
  const [showCallModal, setShowCallModal]   = useState(false)
  const [showChangeStatus, setShowChangeStatus] = useState(false)
  const [newCategory, setNewCategory]       = useState('')
  const [reason, setReason]                 = useState('')
  const [saving, setSaving]                 = useState(false)
  const [auditLog, setAuditLog]             = useState([])
  const [loadingAudit, setLoadingAudit]     = useState(false)

  const storeLog = callLogs[store.id] || {}
  const dbState  = storeStates[store.id]
  const category = dbState?.category || store.category || 'incubating'
  const catInfo  = CATEGORY_LABELS[category] || CATEGORY_LABELS.incubating

  useEffect(() => {
    setLoadingAudit(true)
    getAuditLog(store.id)
      .then(r => setAuditLog(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingAudit(false))
  }, [store.id])

  async function handleStatusChange() {
    if (!newCategory) return
    setSaving(true)
    try {
      await setStoreStatus({
        store_id:    store.id,
        store_name:  store.name,
        category:    newCategory,
        state_reason: reason,
        old_status:  category,
        user:        user?.fullname,
        user_role:   user?.role,
      })
      reload()
      setShowChangeStatus(false)
    } catch { /* ignore */ }
    setSaving(false)
  }

  const calls = Object.entries(storeLog).map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed top-0 left-0 h-full w-full max-w-lg bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-lg">{store.name}</h2>
                <span className="text-xs font-mono font-bold bg-white/20 text-white px-2.5 py-1 rounded-lg tracking-wide">
                  #{store.id}
                </span>
              </div>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${catInfo.bg} ${catInfo.text}`}>
                {catInfo.label}
              </span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setShowCallModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Phone size={14} />
              تسجيل مكالمة
            </button>
            <button
              onClick={() => setShowChangeStatus(!showChangeStatus)}
              className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <ArrowLeftRight size={14} />
              تغيير الحالة
            </button>
            {category !== 'frozen' && (
              <button
                onClick={() => { setNewCategory('frozen'); setShowChangeStatus(true) }}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Lock size={14} />
                تجميد
              </button>
            )}
          </div>
        </div>

        {/* Change status panel */}
        {showChangeStatus && (
          <div className="p-4 bg-amber-50 border-b border-amber-200">
            <p className="text-sm font-medium text-amber-800 mb-2">تغيير حالة المتجر</p>
            <div className="flex gap-2 flex-wrap mb-2">
              {Object.entries(CATEGORY_LABELS).map(([val, info]) => (
                <button
                  key={val}
                  onClick={() => setNewCategory(val)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    newCategory === val
                      ? `${info.bg} ${info.text} border-current`
                      : 'bg-white text-slate-500 border-slate-200 hover:border-slate-400'
                  }`}
                >
                  {info.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="سبب التغيير (اختياري)"
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
            />
            <div className="flex gap-2">
              <button
                onClick={handleStatusChange}
                disabled={!newCategory || saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? 'جارٍ...' : 'تأكيد التغيير'}
              </button>
              <button onClick={() => setShowChangeStatus(false)} className="px-4 py-2 border border-amber-200 text-amber-700 text-sm rounded-xl hover:bg-amber-50">
                إلغاء
              </button>
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Store Info */}
          <div className="bg-slate-50 rounded-2xl p-4 grid grid-cols-2 gap-3">
            <InfoItem icon={Calendar} label="تاريخ التسجيل" value={store.registered_at ? new Date(store.registered_at).toLocaleDateString('ar-SA') : '—'} />
            <InfoItem icon={Package} label="إجمالي الطرود" value={parseInt(store.total_shipments) || 0} />
            <InfoItem icon={TrendingUp} label="آخر شحنة" value={store.last_shipment_date && store.last_shipment_date !== 'لا يوجد' ? new Date(store.last_shipment_date).toLocaleDateString('ar-SA') : 'لا يوجد'} />
            <InfoItem icon={History} label="أيام منذ التسجيل" value={store.registered_at ? Math.floor((new Date() - new Date(store.registered_at)) / 86400000) + ' يوم' : '—'} />
            {store.phone && (
              <div className="col-span-2">
                <InfoItem icon={Smartphone} label="رقم الهاتف" value={
                  <a href={`tel:${store.phone}`} className="text-blue-600 font-mono hover:underline" dir="ltr">
                    {store.phone}
                  </a>
                } />
              </div>
            )}
          </div>

          {/* Call Logs */}
          <div>
            <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
              <Phone size={16} className="text-green-600" />
              سجل المكالمات ({calls.length})
            </h3>
            {calls.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد مكالمات مسجلة</p>
            ) : (
              <div className="space-y-2">
                {calls.map((c, i) => (
                  <div key={i} className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-slate-700 capitalize">{c.type}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        c.outcome === 'answered' ? 'bg-green-100 text-green-700' :
                        c.outcome === 'no_answer' ? 'bg-red-100 text-red-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {c.outcome === 'answered' ? 'تم الرد' : c.outcome === 'no_answer' ? 'لم يرد' : c.outcome === 'busy' ? 'مشغول' : 'معاودة اتصال'}
                      </span>
                    </div>
                    {c.note && <p className="text-xs text-slate-500 mt-1">{c.note}</p>}
                    <p className="text-xs text-slate-400 mt-1">
                      {c.performed_by} • {c.date ? new Date(c.date).toLocaleString('ar-SA') : '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Audit Log */}
          <div>
            <h3 className="font-bold text-slate-700 flex items-center gap-2 mb-3">
              <History size={16} className="text-blue-600" />
              سجل التغييرات
            </h3>
            {loadingAudit ? (
              <p className="text-slate-400 text-sm text-center py-4">جارٍ التحميل...</p>
            ) : auditLog.length === 0 ? (
              <p className="text-slate-400 text-sm text-center py-4">لا توجد تغييرات مسجلة</p>
            ) : (
              <div className="space-y-2">
                {auditLog.map((entry, i) => (
                  <div key={i} className="flex gap-3 py-2 border-b border-slate-50 last:border-0">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-slate-700 font-medium">{entry.action_type}</p>
                      {entry.action_detail && <p className="text-xs text-slate-500">{entry.action_detail}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.performed_by} • {entry.created_at ? new Date(entry.created_at).toLocaleString('ar-SA') : '—'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCallModal && (
        <CallModal
          store={store}
          onClose={() => setShowCallModal(false)}
          onSaved={reload}
        />
      )}
    </>
  )
}

function InfoItem({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-7 h-7 rounded-lg bg-white flex items-center justify-center flex-shrink-0 shadow-sm">
        <Icon size={14} className="text-slate-500" />
      </div>
      <div>
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-medium text-slate-700">{value}</p>
      </div>
    </div>
  )
}
