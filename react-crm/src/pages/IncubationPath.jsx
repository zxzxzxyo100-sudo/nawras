import { useState, useMemo } from 'react'
import {
  Baby, Clock, Flame, XCircle, RefreshCw,
  CheckCircle2, TrendingUp, Search, Phone,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import { setStoreStatus } from '../services/api'

// ── مساعد: أيام منذ التسجيل ───────────────────────────────────────
function regDays(s) {
  if (!s?.registered_at) return null
  return Math.floor((Date.now() - new Date(s.registered_at)) / 86400000)
}
function regHours(s) {
  if (!s?.registered_at) return null
  return Math.floor((Date.now() - new Date(s.registered_at)) / 3600000)
}
function shipDays(s) {
  if (!s?.last_shipment_date || s.last_shipment_date === 'لا يوجد') return null
  return Math.floor((Date.now() - new Date(s.last_shipment_date)) / 86400000)
}

// ── إعداد التبويبات ──────────────────────────────────────────────
const TABS = [
  {
    key: 'new_48h',
    label: 'جديدة',
    icon: Baby,
    color: 'blue',
    desc: 'سُجّل منذ أقل من 48 ساعة',
    badge: () => (
      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">جديد</span>
    ),
  },
  {
    key: 'under_14',  // يجمع incubating + watching
    label: 'تحت الاحتضان',
    icon: Clock,
    color: 'indigo',
    desc: 'أقل من 14 يوم من التسجيل',
    badge: s => s._inc === 'incubating'
      ? <span className="text-xs font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">يشحن</span>
      : <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">لم يشحن</span>,
  },
  {
    key: 'hot_14_20',
    label: 'ساخنة 14-20',
    icon: Flame,
    color: 'amber',
    desc: '14-20 يوماً دون شحن — نافذة استعادة حرجة',
    badge: () => (
      <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">ساخنة</span>
    ),
  },
  {
    key: 'inactive',
    label: 'غير نشطة',
    icon: XCircle,
    color: 'red',
    desc: 'تجاوزت 20 يوماً دون شحن أي طلبية',
    badge: () => (
      <span className="text-xs font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">غير نشطة</span>
    ),
  },
  {
    key: 'restoring',
    label: 'جاري الاستعادة',
    icon: TrendingUp,
    color: 'orange',
    desc: 'بدأت في تجهيز طلبية (يُضبط يدوياً)',
    badge: () => (
      <span className="text-xs font-bold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">جاري</span>
    ),
  },
  {
    key: 'restored',
    label: 'تمت الاستعادة',
    icon: CheckCircle2,
    color: 'emerald',
    desc: 'شحنت أول طلبية فعلية بعد يوم 14',
    badge: () => (
      <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">مستعادة</span>
    ),
  },
]

const COLOR_CLASSES = {
  blue:    { active: 'bg-blue-600 text-white shadow-blue-600/20',    count: 'bg-blue-50 text-blue-600 border-blue-200'    },
  indigo:  { active: 'bg-indigo-600 text-white shadow-indigo-600/20', count: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
  amber:   { active: 'bg-amber-500 text-white shadow-amber-500/20',  count: 'bg-amber-50 text-amber-600 border-amber-200'  },
  red:     { active: 'bg-red-600 text-white shadow-red-600/20',      count: 'bg-red-50 text-red-600 border-red-200'        },
  orange:  { active: 'bg-orange-500 text-white shadow-orange-500/20',count: 'bg-orange-50 text-orange-600 border-orange-200' },
  emerald: { active: 'bg-emerald-600 text-white shadow-emerald-600/20', count: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
}

// ── وضع مراقبة / استعادة ────────────────────────────────────────
function ActionBadge({ store, onMarkRestoring, onMarkRestored }) {
  const isHot      = store._inc === 'hot_14_20'
  const isInactive = store._inc === 'inactive'
  const isRestoring = store._inc === 'restoring'

  if (!isHot && !isInactive && !isRestoring) return null
  return (
    <div className="flex gap-1.5">
      {(isHot || isInactive) && (
        <button
          onClick={e => { e.stopPropagation(); onMarkRestoring(store) }}
          className="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors font-medium"
        >
          جاري الاستعادة
        </button>
      )}
      {isRestoring && (
        <button
          onClick={e => { e.stopPropagation(); onMarkRestored(store) }}
          className="text-xs px-2 py-1 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200 hover:bg-emerald-100 transition-colors font-medium"
        >
          تمت الاستعادة
        </button>
      )}
    </div>
  )
}

// ── جدول المتاجر الداخلي ────────────────────────────────────────
function IncTable({ stores, tab, callLogs, onSelect, onCall, onMarkRestoring, onMarkRestored }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    if (!q.trim()) return stores
    const low = q.toLowerCase()
    return stores.filter(s =>
      String(s.name || '').toLowerCase().includes(low) ||
      String(s.id || '').toLowerCase().includes(low) ||
      String(s.phone || '').toLowerCase().includes(low)
    )
  }, [stores, q])

  if (!stores.length) {
    return (
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
        <div className="text-5xl mb-3">📭</div>
        <div className="text-sm">لا توجد متاجر في هذه الفئة</div>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      {/* شريط البحث */}
      <div className="p-4 border-b border-slate-100">
        <div className="relative max-w-xs">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="بحث باسم أو رقم..."
            className="w-full pr-9 pl-3 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50"
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr className="text-right">
              <th className="px-4 py-3 text-slate-500 font-medium">المتجر</th>
              <th className="px-4 py-3 text-slate-500 font-medium">أيام التسجيل</th>
              <th className="px-4 py-3 text-slate-500 font-medium">الطلبيات</th>
              <th className="px-4 py-3 text-slate-500 font-medium">آخر شحنة</th>
              <th className="px-4 py-3 text-slate-500 font-medium">الحالة</th>
              <th className="px-4 py-3 text-slate-500 font-medium">التواصل</th>
              <th className="px-4 py-3 text-slate-500 font-medium">إجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((s, i) => {
              const hours   = regHours(s)
              const days    = regDays(s)
              const sdays   = shipDays(s)
              const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0
              return (
                <tr
                  key={s.id ?? i}
                  onClick={() => onSelect(s)}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-800">{s.name || '—'}</div>
                    <div className="text-xs text-slate-400 mt-0.5">{s.id}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {days !== null ? (
                      hours < 48
                        ? <span className="text-blue-600 font-medium">{hours} ساعة</span>
                        : <span>{days} يوم</span>
                    ) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      (s.total_shipments ?? 0) > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {s.total_shipments ?? 0}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {s.last_shipment_date && s.last_shipment_date !== 'لا يوجد'
                      ? sdays !== null ? `${sdays} يوم` : s.last_shipment_date
                      : <span className="text-slate-400">لا يوجد</span>}
                  </td>
                  <td className="px-4 py-3">
                    {tab.badge(s)}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={e => { e.stopPropagation(); onCall(s) }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        hasCalls
                          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
                          : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                      }`}
                    >
                      <Phone size={12} />
                      {hasCalls ? 'متابعة' : 'تواصل'}
                    </button>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <ActionBadge
                      store={s}
                      onMarkRestoring={onMarkRestoring}
                      onMarkRestored={onMarkRestored}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400 bg-slate-50/50">
        {filtered.length} من {stores.length} متجر
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ═══════════════════════════════════════════════════════════════════
export default function IncubationPath() {
  const {
    incubationPath, incubationCounts, callLogs,
    loading, error, reload,
  } = useStores()

  const [activeTab, setActiveTab]   = useState('new_48h')
  const [selected, setSelected]     = useState(null)
  const [callStore, setCallStore]   = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  // دمج incubating + watching في تبويب "تحت الاحتضان"
  const tabStores = useMemo(() => {
    if (activeTab === 'under_14') {
      return [...(incubationPath.incubating || []), ...(incubationPath.watching || [])]
    }
    return incubationPath[activeTab] || []
  }, [activeTab, incubationPath])

  const tabCount = useMemo(() => {
    if (activeTab === 'under_14') {
      return (incubationCounts.incubating || 0) + (incubationCounts.watching || 0)
    }
    return incubationCounts[activeTab] || 0
  }, [activeTab, incubationCounts])

  const currentTab = TABS.find(t => t.key === activeTab)

  // ── تحديث حالة DB ─────────────────────────────────────────────
  async function markAs(store, category) {
    setActionLoading(true)
    try {
      await setStoreStatus(store.id, category)
      await reload()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* ── رأس الصفحة ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Baby size={24} className="text-indigo-500" />
            مسار الاحتضان
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {incubationCounts.total || 0} متجر في مسار الاحتضان
          </p>
        </div>
        <button
          onClick={reload}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* ── تبويبات ── */}
      <div className="flex flex-wrap gap-2">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key
          const count = tab.key === 'under_14'
            ? (incubationCounts.incubating || 0) + (incubationCounts.watching || 0)
            : (incubationCounts[tab.key] || 0)
          const cc = COLOR_CLASSES[tab.color]

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm ${
                isActive
                  ? `${cc.active} shadow-lg`
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full border ${
                isActive ? 'bg-white/20 text-white border-white/30' : cc.count
              }`}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── وصف التبويب الحالي ── */}
      {currentTab && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium bg-${currentTab.color === 'blue' ? 'blue' : currentTab.color}-50 text-${currentTab.color === 'blue' ? 'blue' : currentTab.color}-700 border border-${currentTab.color === 'blue' ? 'blue' : currentTab.color}-200`}>
          <currentTab.icon size={16} />
          {currentTab.desc}
        </div>
      )}

      {/* ── خطأ ── */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {/* ── جدول البيانات ── */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-16 text-center text-slate-400">
          <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-blue-400" />
          <div className="text-sm">جاري تحميل البيانات...</div>
        </div>
      ) : (
        <IncTable
          stores={tabStores}
          tab={currentTab || TABS[0]}
          callLogs={callLogs}
          onSelect={setSelected}
          onCall={setCallStore}
          onMarkRestoring={s => markAs(s, 'restoring')}
          onMarkRestored={s => markAs(s, 'restored')}
        />
      )}

      {/* ── نافذة تفاصيل المتجر ── */}
      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} />
      )}

      {/* ── نافذة تسجيل مكالمة ── */}
      {callStore && (
        <CallModal store={callStore} onClose={() => setCallStore(null)} />
      )}

      {/* ── مؤشر تحميل الإجراء ── */}
      {actionLoading && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex items-center gap-3">
            <RefreshCw size={20} className="animate-spin text-blue-500" />
            <span className="text-sm font-medium text-slate-700">جاري التحديث...</span>
          </div>
        </div>
      )}
    </div>
  )
}
