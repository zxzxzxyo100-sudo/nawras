import { useState, useMemo } from 'react'
import {
  Baby, Clock, Filter, RefreshCw, Phone,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { parcelsInRangeDisplay } from '../utils/storeFields'
import { filterStoresByToolbar } from '../utils/storeFilters'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import StoreFilterDrawer from '../components/StoreFilterDrawer'

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
  const [nameQuery, setNameQuery] = useState('')
  const [namePickedStoreId, setNamePickedStoreId] = useState(null)
  const [idQuery, setIdQuery] = useState('')
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')
  const [shipFrom, setShipFrom] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)

  const filterPayload = useMemo(
    () => ({
      nameQuery,
      namePickedStoreId,
      idQuery,
      regFrom,
      regTo,
      shipFrom,
      shipTo,
    }),
    [nameQuery, namePickedStoreId, idQuery, regFrom, regTo, shipFrom, shipTo]
  )

  const filtered = useMemo(
    () => filterStoresByToolbar(stores, filterPayload),
    [stores, filterPayload]
  )

  function clearFilters() {
    setNameQuery('')
    setNamePickedStoreId(null)
    setIdQuery('')
    setRegFrom('')
    setRegTo('')
    setShipFrom('')
    setShipTo('')
  }

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        nameQuery.trim()
        || namePickedStoreId != null
        || idQuery.trim()
        || regFrom
        || regTo
        || shipFrom
        || shipTo
      ),
    [nameQuery, namePickedStoreId, idQuery, regFrom, regTo, shipFrom, shipTo]
  )

  if (!stores.length) {
    return (
      <div
        className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg shadow-slate-200/60 border border-slate-200/90"
        dir="rtl"
      >
        <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center text-slate-500">
          <div className="text-5xl mb-3">📭</div>
          <div className="text-sm">لا توجد متاجر في هذه الفئة</div>
        </div>
      </div>
    )
  }

  const rowElite =
    'border-b border-slate-100 transition-all duration-300 cursor-pointer bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-amber-50/50 hover:shadow-[inset_0_0_0_1px_rgba(234,179,8,0.28),0_6px_24px_-12px_rgba(234,179,8,0.18)]'

  return (
    <div
      className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg shadow-slate-200/60 border border-slate-200/90"
      dir="rtl"
    >
      <div className="p-4 md:p-5 backdrop-blur-md bg-white/85 border border-slate-200/80 rounded-2xl mb-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFilterOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl border-2 border-blue-500 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-700"
          >
            <Filter size={18} strokeWidth={2.5} className="shrink-0" />
            تصفية
            {hasActiveFilters && (
              <span className="flex h-2 w-2 rounded-full bg-amber-300 ring-2 ring-white" title="تصفية نشطة" />
            )}
          </button>
          <span className="tabular-nums text-sm font-medium text-slate-700">
            {filtered.length.toLocaleString('ar-SA')} من {stores.length.toLocaleString('ar-SA')} متجر
          </span>
        </div>
      </div>

      <StoreFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        isElite
        nameQuery={nameQuery}
        namePickedStoreId={namePickedStoreId}
        onNamePickedStoreIdChange={setNamePickedStoreId}
        idQuery={idQuery}
        regFrom={regFrom}
        regTo={regTo}
        shipFrom={shipFrom}
        shipTo={shipTo}
        onNameChange={setNameQuery}
        onIdChange={setIdQuery}
        onRegFromChange={setRegFrom}
        onRegToChange={setRegTo}
        onShipFromChange={setShipFrom}
        onShipToChange={setShipTo}
        onClear={clearFilters}
      />

      <div className="rounded-2xl border border-slate-200/90 bg-white overflow-x-auto shadow-inner">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50/95 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
              <th className="px-5 py-3.5 font-semibold">المتجر</th>
              <th className="px-5 py-3.5 font-semibold">أيام التسجيل</th>
              <th className="px-5 py-3.5 font-semibold">الطلبيات</th>
              <th className="px-5 py-3.5 font-semibold">آخر شحنة</th>
              <th className="px-5 py-3.5 font-semibold">الحالة</th>
              <th className="px-5 py-3.5 font-semibold">التواصل</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-12 text-center text-slate-500">
                  لا توجد نتائج تطابق التصفية الحالية
                </td>
              </tr>
            )}
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
                  className={rowElite}
                >
                  <td className="px-5 py-4 text-slate-700">
                    <div className="font-semibold text-slate-900">{s.name || '—'}</div>
                    <div className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">{s.id}</div>
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {days !== null ? (
                      hours < 48
                        ? <span className="text-blue-700 font-medium">{hours} ساعة</span>
                        : <span>{days} يوم</span>
                    ) : '—'}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                      parcels > 0
                        ? 'bg-green-50 text-green-800 border-green-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    }`}>
                      {parcels}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-slate-600 text-xs">
                    {s.last_shipment_date && s.last_shipment_date !== 'لا يوجد'
                      ? sdays !== null ? `${sdays} يوم` : s.last_shipment_date
                      : <span className="text-slate-400">لا يوجد</span>}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    {tab.badge(s)}
                  </td>
                  <td className="px-5 py-4 text-slate-700">
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); onCall(s) }}
                      className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                        hasCalls
                          ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                          : 'bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100'
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
      <div className="mt-0 rounded-b-2xl px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
        عرض {filtered.length.toLocaleString('ar-SA')} من أصل {stores.length.toLocaleString('ar-SA')} متجر
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
    <div className="space-y-5" dir="rtl">
      {/* ── رأس الصفحة ── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Baby size={24} className="text-indigo-500" />
            مسار الاحتضان
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {filteredCounts.total || 0} متجر في مسار الاحتضان
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50"
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
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg border border-slate-200/90">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center text-slate-500">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-violet-500" />
            <div className="text-sm">جاري تحميل البيانات...</div>
          </div>
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
