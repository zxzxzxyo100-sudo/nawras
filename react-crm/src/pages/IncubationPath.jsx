import { useState, useMemo, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Baby, Clock, Filter, RefreshCw, Phone, PhoneCall, Layers,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { parcelsInRangeDisplay } from '../utils/storeFields'
import { filterStoresByToolbar } from '../utils/storeFilters'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import StoreFilterDrawer from '../components/StoreFilterDrawer'
import { ONBOARD_DAYS_AFTER_CALL1, ONBOARD_DAYS_AFTER_CALL2 } from '../constants/onboardingSchedule'

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
// مسار الاحتضان: دورة 14 يومًا — المكالمات في الأيام 1 و 3 و 10؛ الباقي في «بين المكالمات»
// ══════════════════════════════════════════════════════════════════
const TABS = [
  {
    key:   'call_1',
    label: 'المكالمة الأولى',
    icon:  Baby,
    color: 'blue',
    desc:  'يظهر المتجر هنا ما دامت المكالمة الأولى غير مسجّلة (أي يوم في الدورة قبل الترحيل أو التصنيف الآخر).',
    badge: () => (
      <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">مطلوبة</span>
    ),
  },
  {
    key:   'call_2',
    label: 'المكالمة الثانية',
    icon:  Clock,
    color: 'indigo',
    desc:  `تظهر المكالمة بعد ${ONBOARD_DAYS_AFTER_CALL1} يوماً من تسجيل المكالمة الأولى (تم) — حتى يُسجَّل الاتصال الثاني.`,
    badge: () => (
      <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">+{ONBOARD_DAYS_AFTER_CALL1} يوم</span>
    ),
  },
  {
    key:   'call_3',
    label: 'المكالمة الثالثة',
    icon:  PhoneCall,
    color: 'amber',
    desc:  `تظهر المكالمة بعد ${ONBOARD_DAYS_AFTER_CALL2} يوماً من تسجيل المكالمة الثانية (تم) — حتى التخريج.`,
    badge: () => (
      <span className="text-xs font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">+{ONBOARD_DAYS_AFTER_CALL2} يوم</span>
    ),
  },
  {
    key:   'between_calls',
    label: 'بين المكالمات',
    icon:  Layers,
    color: 'slate',
    desc:  'متاجر سجّلت المكالمة السابقة وتنتظر يوم 3 أو 10 فقط — بدون تأخير ولا غياب المكالمة الأولى.',
    badge: () => (
      <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">انتظار</span>
    ),
  },
]

/** مطابقة المسار /incubation/call-1 ↔ المفتاح الداخلي call_1 */
const ROUTE_TAB = {
  'call-1': 'call_1',
  'call-2': 'call_2',
  'call-3': 'call_3',
  'between-calls': 'between_calls',
}


// ── جدول المتاجر الداخلي ────────────────────────────────────────
function IncTable({ stores, tab, callLogs, onSelect, onCall, betweenMode = false }) {
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
              {betweenMode ? (
                <>
                  <th className="px-5 py-3.5 font-semibold whitespace-nowrap">يوم من 14</th>
                  <th className="px-5 py-3.5 font-semibold">المرحلة الحالية</th>
                  <th className="px-5 py-3.5 font-semibold">المتبقي للظهور</th>
                </>
              ) : (
                <>
                  <th className="px-5 py-3.5 font-semibold">أيام التسجيل</th>
                  <th className="px-5 py-3.5 font-semibold">الحالة</th>
                </>
              )}
              <th className="px-5 py-3.5 font-semibold">الطلبيات</th>
              <th className="px-5 py-3.5 font-semibold">آخر شحنة</th>
              <th className="px-5 py-3.5 font-semibold">التواصل</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={betweenMode ? 7 : 6} className="px-5 py-12 text-center text-slate-500">
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
              const cycleD = s._cycle_day != null ? s._cycle_day : '—'
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
                  {betweenMode ? (
                    <>
                      <td className="px-5 py-4 text-slate-800 tabular-nums font-medium">
                        {cycleD}
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs leading-relaxed max-w-[14rem]">
                        {s._inc_phase || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs leading-relaxed max-w-[16rem]">
                        <span className="tabular-nums font-medium">{s._days_until_window != null ? `${s._days_until_window} يوم` : '—'}</span>
                        {s._next_window_hint ? (
                          <span className="block text-slate-500 mt-1">{s._next_window_hint}</span>
                        ) : null}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-4 text-slate-700">
                        {days !== null ? (
                          hours < 48
                            ? <span className="text-blue-700 font-medium">{hours} ساعة</span>
                            : <span>{days} يوم</span>
                        ) : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        {tab.badge(s)}
                      </td>
                    </>
                  )}
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
/** يُستبعد من مسار الاحتضان بعد إكمال المكالمة الثالثة أو التخريج */
function isDoneIncubationPath(storeStates, storeId) {
  const st = storeStates?.[storeId]
  if (!st) return false
  if (st.inc_call3_at) return true
  const c = st.category
  return c === 'active' || c === 'active_shipping' || c === 'active_pending_calls' || c === 'completed' || c === 'unreachable' || c === 'frozen' || c === 'inactive'
}

export default function IncubationPath() {
  const { tabKey } = useParams()
  const navigate = useNavigate()
  const {
    incubationPath, callLogs, storeStates,
    loading, error, reload,
  } = useStores()

  const activeTab = ROUTE_TAB[tabKey] ?? 'call_1'

  useEffect(() => {
    if (!tabKey || !ROUTE_TAB[tabKey]) {
      navigate('/incubation/call-1', { replace: true })
    }
  }, [tabKey, navigate])

  const [selected, setSelected]   = useState(null)
  const [callStore, setCallStore] = useState(null)

  const filteredPath = useMemo(() => ({
    call_1: (incubationPath.call_1 || []).filter(s => !isDoneIncubationPath(storeStates, s.id)),
    call_2: (incubationPath.call_2 || []).filter(s => !isDoneIncubationPath(storeStates, s.id)),
    call_3: (incubationPath.call_3 || []).filter(s => !isDoneIncubationPath(storeStates, s.id)),
    between_calls: (incubationPath.between_calls || []).filter(s => !isDoneIncubationPath(storeStates, s.id)),
  }), [incubationPath, storeStates])

  const filteredCounts = useMemo(() => ({
    call_1: filteredPath.call_1.length,
    call_2: filteredPath.call_2.length,
    call_3: filteredPath.call_3.length,
    between_calls: filteredPath.between_calls.length,
    total: filteredPath.call_1.length + filteredPath.call_2.length + filteredPath.call_3.length
      + filteredPath.between_calls.length,
  }), [filteredPath])

  const tabStores = useMemo(
    () => filteredPath[activeTab] || [],
    [activeTab, filteredPath]
  )

  const currentTab = TABS.find(t => t.key === activeTab)

  const callTypeForModal = useMemo(() => {
    if (activeTab !== 'between_calls') {
      return activeTab === 'call_1' ? 'inc_call1'
        : activeTab === 'call_2' ? 'inc_call2'
          : 'inc_call3'
    }
    if (!callStore) return 'inc_call1'
    const st = storeStates[callStore.id]
    if (!st?.inc_call1_at) return 'inc_call1'
    if (!st?.inc_call2_at) return 'inc_call2'
    return 'inc_call3'
  }, [activeTab, callStore, storeStates])

  const tabDescClass = currentTab?.color === 'blue'
    ? 'bg-blue-50 text-blue-800 border-blue-200'
    : currentTab?.color === 'indigo'
      ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
      : currentTab?.color === 'slate'
        ? 'bg-slate-50 text-slate-800 border-slate-200'
        : 'bg-amber-50 text-amber-900 border-amber-200'

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
            {currentTab?.label} — {(filteredCounts[activeTab] ?? 0).toLocaleString('ar-SA')} متجر
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

      {/* ── وصف المرحلة (التنقّل من الشريط الجانبي) ── */}
      {currentTab && (
        <div className={`flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium border ${tabDescClass}`}>
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
          betweenMode={activeTab === 'between_calls'}
        />
      )}

      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} />
      )}

      {callStore && (
        <CallModal
          store={callStore}
          callType={callTypeForModal}
          onClose={() => setCallStore(null)}
          onSaved={reload}
        />
      )}

    </div>
  )
}
