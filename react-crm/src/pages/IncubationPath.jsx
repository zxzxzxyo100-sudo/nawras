import { useState, useMemo } from 'react'
import {
  Baby, Clock, RefreshCw, Search, Phone,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { parcelsInRangeDisplay } from '../utils/storeFields'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'

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

// ══════════════════════════════════════════════════════════════════
// مسار الاحتضان: خانتان حصريتان فقط
// Q4 جديدة  : age ≤ 48h                       (مراقبة)
// Q1 احتضان : 48h < age ≤ 14d  AND ships > 0
//
// Q3 (نجاح >14يوم + شحن)   → active_shipping مباشرةً
// Q2 (>48ساعة + 0 شحنات)   → cold_inactive
// جاري/تمت الاستعادة       → خانة غير النشطة
// ══════════════════════════════════════════════════════════════════
const TABS = [
  {
    key:   'new_48h',
    label: 'جديدة',
    icon:  Baby,
    color: 'blue',
    desc:  'سُجّل منذ أقل من 48 ساعة — فترة المراقبة',
    badge: () => (
      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">جديد</span>
    ),
  },
  {
    key:   'incubating',
    label: 'تحت الاحتضان',
    icon:  Clock,
    color: 'indigo',
    desc:  'Q1 — أقل من 14 يوم من التسجيل وشحنت طلبية على الأقل',
    badge: () => (
      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">يشحن ✓</span>
    ),
  },
]

const COLOR_CLASSES = {
  blue:   { active: 'bg-blue-600 text-white shadow-blue-600/20',     count: 'bg-blue-50 text-blue-600 border-blue-200'      },
  indigo: { active: 'bg-indigo-600 text-white shadow-indigo-600/20', count: 'bg-indigo-50 text-indigo-600 border-indigo-200' },
}


// ── جدول المتاجر الداخلي ────────────────────────────────────────
function IncTable({ stores, tab, callLogs, onSelect, onCall }) {
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((s, i) => {
              const hours   = regHours(s)
              const days    = regDays(s)
              const sdays   = shipDays(s)
              const parcels = parcelsInRangeDisplay(s)
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
                      parcels > 0
                        ? 'bg-green-100 text-green-700'
                        : 'bg-slate-100 text-slate-500'
                    }`}>
                      {parcels}
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
/** يُستبعد من مسار الاحتضان عند تخريج يدوي إلى «نشط» (حفظ في store_states) */
function isGraduatedToActive(storeStates, storeId) {
  const st = storeStates?.[storeId]
  const c = st?.category
  return c === 'active' || c === 'active_shipping'
}

export default function IncubationPath() {
  const {
    incubationPath, incubationCounts, callLogs, storeStates,
    loading, error, reload,
  } = useStores()

  const [activeTab, setActiveTab] = useState('new_48h')
  const [selected, setSelected]   = useState(null)
  const [callStore, setCallStore] = useState(null)

  const filteredPath = useMemo(() => ({
    new_48h: (incubationPath.new_48h || []).filter(s => !isGraduatedToActive(storeStates, s.id)),
    incubating: (incubationPath.incubating || []).filter(s => !isGraduatedToActive(storeStates, s.id)),
  }), [incubationPath, storeStates])

  const filteredCounts = useMemo(() => ({
    new_48h: filteredPath.new_48h.length,
    incubating: filteredPath.incubating.length,
    total: filteredPath.new_48h.length + filteredPath.incubating.length,
  }), [filteredPath])

  // كل تبويب له فئة مستقلة حصرية (بعد استبعاد المُخرَّجين يدوياً إلى نشط)
  const tabStores = useMemo(
    () => filteredPath[activeTab] || [],
    [activeTab, filteredPath]
  )
  const tabCount = useMemo(
    () => filteredCounts[activeTab] || 0,
    [activeTab, filteredCounts]
  )

  const currentTab = TABS.find(t => t.key === activeTab)

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
            {filteredCounts.total || 0} متجر في مسار الاحتضان
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
          const count = filteredCounts[tab.key] || 0
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

    </div>
  )
}
