import { useState, useEffect } from 'react'
import { X, Phone, Lock, ArrowLeftRight, Package, Calendar, TrendingUp, History, Smartphone } from 'lucide-react'
import { setStoreStatus, getAuditLog } from '../services/api'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import CallModal from './CallModal'
import StoreNameWithId from './StoreNameWithId'
import CustomerSatisfactionModal from './CustomerSatisfactionModal'
import { needsActiveSatisfactionSurvey } from '../constants/satisfactionSurvey'
import { formatCallOutcome } from '../constants/callOutcomes'
import {
  isRecoveryCompletedByShipment,
  isRestoredForRecoveryLists,
} from '../constants/storeCategories'

const CATEGORY_LABELS = {
  incubating: { label: 'تحت الاحتضان', bg: 'bg-purple-100', text: 'text-purple-700' },
  active:     { label: 'نشط',         bg: 'bg-green-100',  text: 'text-green-700'  },
  active_pending_calls: { label: 'نشط قيد المكالمة', bg: 'bg-emerald-50', text: 'text-emerald-800' },
  completed:  { label: 'منجز',       bg: 'bg-violet-100', text: 'text-violet-800' },
  unreachable: { label: 'لم يتم الوصول', bg: 'bg-amber-100', text: 'text-amber-900' },
  inactive:   { label: 'غير نشط',     bg: 'bg-red-100',    text: 'text-red-700'    },
  frozen:     { label: 'مجمد',        bg: 'bg-slate-100',  text: 'text-slate-600'  },
  restoring:  { label: 'قيد الاستعادة', bg: 'bg-cyan-100', text: 'text-cyan-700'  },
  restored:   { label: 'تمت الاستعادة', bg: 'bg-teal-100',  text: 'text-teal-700'  },
  recovered:  { label: 'تم الاستعادة', bg: 'bg-teal-100',  text: 'text-teal-700'  },
}

export default function StoreDrawer({ store, onClose }) {
  const { user } = useAuth()
  const { callLogs, storeStates, surveyByStoreId, reload } = useStores()
  const [showCallModal, setShowCallModal]   = useState(false)
  const [showSurveyModal, setShowSurveyModal] = useState(false)
  /** لوحة يدوية: تجميد | رفع تجميد | بدء استعادة فقط */
  const [manualPanel, setManualPanel]       = useState(null) // 'freeze' | 'unfreeze' | 'restore' | null
  const [freezeReason, setFreezeReason]     = useState('')
  const [reason, setReason]                 = useState('')
  const [actionError, setActionError]       = useState('')
  const [saving, setSaving]                 = useState(false)
  const [auditLog, setAuditLog]             = useState([])
  const [loadingAudit, setLoadingAudit]     = useState(false)

  const storeLog = callLogs[store.id] || {}
  const dbState  = storeStates[store.id]
  const dbCategory = dbState?.category || store.category || 'incubating'
  const displayCategory =
    dbCategory === 'restoring' && dbState && isRecoveryCompletedByShipment(store, dbState)
      ? 'restored'
      : dbCategory
  const catInfo =
    CATEGORY_LABELS[displayCategory]
    || CATEGORY_LABELS[dbCategory]
    || CATEGORY_LABELS.incubating

  const merchantBucket = store._cat || store.bucket || ''
  const canStartRestore =
    (merchantBucket === 'hot_inactive' || merchantBucket === 'cold_inactive')
    && dbCategory !== 'frozen'
    && !isRestoredForRecoveryLists(store, dbState)
    && dbCategory !== 'restoring'

  function closeManualPanel() {
    setManualPanel(null)
    setFreezeReason('')
    setReason('')
    setActionError('')
  }

  useEffect(() => {
    setLoadingAudit(true)
    getAuditLog(store.id)
      .then(r => setAuditLog(r.data || []))
      .catch(() => {})
      .finally(() => setLoadingAudit(false))
  }, [store.id])

  async function submitFreeze() {
    setActionError('')
    if (!freezeReason.trim()) {
      setActionError('أدخل سبب التجميد.')
      return
    }
    setSaving(true)
    try {
      await setStoreStatus({
        store_id: store.id,
        store_name: store.name,
        category: 'frozen',
        state_reason: reason,
        freeze_reason: freezeReason.trim(),
        old_status: dbCategory,
        user: user?.fullname,
        user_role: user?.role,
      })
      reload()
      closeManualPanel()
    } catch (e) {
      setActionError(e.response?.data?.error || 'تعذّر حفظ التجميد.')
    }
    setSaving(false)
  }

  async function submitUnfreeze() {
    setActionError('')
    setSaving(true)
    try {
      await setStoreStatus({
        store_id: store.id,
        store_name: store.name,
        category: 'active_pending_calls',
        state_reason: reason,
        freeze_reason: '',
        old_status: dbCategory,
        user: user?.fullname,
        user_role: user?.role,
      })
      reload()
      closeManualPanel()
    } catch (e) {
      setActionError(e.response?.data?.error || 'تعذّر رفع التجميد.')
    }
    setSaving(false)
  }

  async function submitRestore() {
    setActionError('')
    setSaving(true)
    try {
      await setStoreStatus({
        store_id: store.id,
        store_name: store.name,
        category: 'restoring',
        state_reason: reason,
        old_status: dbCategory,
        merchant_bucket: merchantBucket,
        user: user?.fullname,
        user_role: user?.role,
      })
      reload()
      closeManualPanel()
    } catch (e) {
      setActionError(e.response?.data?.error || 'تعذّر بدء الاستعادة.')
    }
    setSaving(false)
  }

  const calls = Object.entries(storeLog).map(([type, data]) => ({ type, ...data }))
    .sort((a, b) => new Date(b.date) - new Date(a.date))

  function requestCallModal() {
    if (needsActiveSatisfactionSurvey(store.id, dbCategory, surveyByStoreId)) {
      setShowSurveyModal(true)
    } else {
      setShowCallModal(true)
    }
  }

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
              <h2 className="text-white font-bold text-lg min-w-0 flex items-center gap-2 flex-wrap">
                <StoreNameWithId
                  store={store}
                  nameClassName="text-white font-bold text-lg"
                  idClassName="text-xs font-mono font-bold bg-white/20 text-white px-2.5 py-1 rounded-lg tracking-wide"
                />
              </h2>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${catInfo.bg} ${catInfo.text}`}>
                {catInfo.label}
              </span>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* إجراءات يدوية: تجميد / رفع تجميد / بدء استعادة فقط — باقي الحالات آلياً */}
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              type="button"
              onClick={requestCallModal}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <Phone size={14} />
              تسجيل مكالمة
            </button>
            {dbCategory === 'frozen' ? (
              <button
                type="button"
                onClick={() => { setActionError(''); setManualPanel('unfreeze') }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600/90 hover:bg-emerald-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <ArrowLeftRight size={14} />
                رفع التجميد
              </button>
            ) : (
              <button
                type="button"
                onClick={() => { setActionError(''); setManualPanel('freeze') }}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Lock size={14} />
                تجميد
              </button>
            )}
            {canStartRestore && (
              <button
                type="button"
                onClick={() => { setActionError(''); setManualPanel('restore') }}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600/90 hover:bg-cyan-600 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <ArrowLeftRight size={14} />
                بدء الاستعادة
              </button>
            )}
          </div>
        </div>

        {manualPanel && (
          <div className="p-4 bg-amber-50 border-b border-amber-200">
            {manualPanel === 'freeze' && (
              <>
                <p className="text-sm font-medium text-amber-900 mb-1">تجميد المتجر</p>
                <p className="text-[11px] text-amber-800 mb-2">التحويلات الأخرى (احتضان، نشط، غير نشط، تخريج) تتم عبر المكالمات والشحن وقواعد النظام — لا يدوياً من هنا.</p>
                <textarea
                  placeholder="سبب التجميد (مطلوب)"
                  value={freezeReason}
                  onChange={e => setFreezeReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
                />
                <input
                  type="text"
                  placeholder="ملاحظة إضافية (اختياري)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
                />
              </>
            )}
            {manualPanel === 'unfreeze' && (
              <>
                <p className="text-sm font-medium text-amber-900 mb-1">رفع التجميد</p>
                <p className="text-[11px] text-amber-800 mb-2">يُعاد المتجر إلى «نشط» وفق السجل. تصنيف الشحن يُحدَّث آلياً لاحقاً.</p>
                <input
                  type="text"
                  placeholder="ملاحظة (اختياري)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
                />
              </>
            )}
            {manualPanel === 'restore' && (
              <>
                <p className="text-sm font-medium text-amber-900 mb-1">بدء الاستعادة</p>
                <p className="text-[11px] text-amber-800 mb-2">مسموح فقط لمتاجر «غير نشط ساخن» أو «غير نشط بارد». اكتمال «تمت الاستعادة» يُحسب آلياً عند الشحن بعد تاريخ البدء.</p>
                <input
                  type="text"
                  placeholder="ملاحظة (اختياري)"
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-amber-200 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 mb-2"
                />
              </>
            )}
            {actionError && (
              <p className="text-xs text-red-600 mb-2">{actionError}</p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={
                  manualPanel === 'freeze'
                    ? submitFreeze
                    : manualPanel === 'unfreeze'
                      ? submitUnfreeze
                      : submitRestore
                }
                disabled={saving}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400 text-white text-sm font-medium rounded-xl transition-colors"
              >
                {saving ? 'جارٍ...' : 'تأكيد'}
              </button>
              <button type="button" onClick={closeManualPanel} className="px-4 py-2 border border-amber-200 text-amber-800 text-sm rounded-xl hover:bg-amber-100/80">
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
                        c.outcome === 'busy' ? 'bg-amber-100 text-amber-700' :
                        c.outcome === 'callback' ? 'bg-blue-100 text-blue-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {formatCallOutcome(c.outcome) || '—'}
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

      {showSurveyModal && (
        <CustomerSatisfactionModal
          store={store}
          onClose={() => setShowSurveyModal(false)}
          onSaved={async () => {
            await reload()
            setShowSurveyModal(false)
            setShowCallModal(true)
            getAuditLog(store.id)
              .then(r => setAuditLog(r.data || []))
              .catch(() => {})
          }}
        />
      )}
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
