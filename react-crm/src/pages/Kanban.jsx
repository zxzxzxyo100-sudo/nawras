import { useState, useMemo } from 'react'
import {
  Baby, TrendingUp, Flame, Snowflake,
  Search, RefreshCw, Phone, Package,
  ChevronDown, ChevronUp, ExternalLink,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import StoreDrawer from '../components/StoreDrawer'

// ─── إعداد الأعمدة ────────────────────────────────────────────────────────────
const COLUMNS = [
  {
    key:      'incubating',
    label:    'متاجر جديدة',
    icon:     Baby,
    gradient: 'from-violet-600 to-purple-600',
    bg:       'bg-violet-50',
    border:   'border-violet-200',
    badge:    'bg-violet-100 text-violet-700',
    dot:      'bg-violet-500',
    ring:     'ring-violet-200',
  },
  {
    key:      'active_shipping',
    label:    'نشط يشحن',
    icon:     TrendingUp,
    gradient: 'from-emerald-500 to-green-600',
    bg:       'bg-emerald-50',
    border:   'border-emerald-200',
    badge:    'bg-emerald-100 text-emerald-700',
    dot:      'bg-emerald-500',
    ring:     'ring-emerald-200',
  },
  {
    key:      'hot_inactive',
    label:    'غير نشط ساخن',
    icon:     Flame,
    gradient: 'from-amber-500 to-orange-500',
    bg:       'bg-amber-50',
    border:   'border-amber-200',
    badge:    'bg-amber-100 text-amber-700',
    dot:      'bg-amber-500',
    ring:     'ring-amber-200',
  },
  {
    key:      'cold_inactive',
    label:    'غير نشط بارد',
    icon:     Snowflake,
    gradient: 'from-red-500 to-rose-600',
    bg:       'bg-red-50',
    border:   'border-red-200',
    badge:    'bg-red-100 text-red-700',
    dot:      'bg-red-500',
    ring:     'ring-red-200',
  },
]

const PREVIEW_SIZE = 20

// ─── بطاقة متجر ──────────────────────────────────────────────────────────────
function StoreCard({ store, col, storeStates, assignments, callLogs, onClick }) {
  const today       = new Date().toISOString().split('T')[0]
  const log         = callLogs[store.id] || {}
  const calledToday = Object.values(log).some(e => e?.date?.startsWith(today))

  const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
    ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
    : null

  const assignedTo  = assignments[store.id]?.assigned_to
  const dbCat       = storeStates[store.id]?.category

  const statusBadge = dbCat === 'restoring'
    ? { label: 'جاري الاستعادة', cls: 'bg-teal-100 text-teal-700' }
    : dbCat === 'restored'
    ? { label: 'تمت الاستعادة', cls: 'bg-teal-100 text-teal-700' }
    : dbCat === 'frozen'
    ? { label: 'مجمد', cls: 'bg-slate-200 text-slate-600' }
    : null

  return (
    <div
      onClick={() => onClick(store)}
      className={`
        group relative bg-white rounded-xl border ${col.border}
        p-3.5 shadow-sm cursor-pointer
        hover:shadow-md hover:-translate-y-0.5 hover:ring-2 ${col.ring}
        active:scale-95 transition-all duration-150
      `}
    >
      {/* colored left bar */}
      <div className={`absolute right-0 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b ${col.gradient}`} />

      {/* header */}
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-800 text-sm leading-tight truncate">{store.name}</p>
          <p className="text-slate-400 text-xs mt-0.5 font-mono">#{store.id}</p>
        </div>
        <ExternalLink
          size={13}
          className="text-slate-200 group-hover:text-slate-400 flex-shrink-0 mt-0.5 transition-colors"
        />
      </div>

      {/* shipment badge */}
      <div className="flex items-center gap-1.5 mb-2.5 flex-wrap">
        {daysSinceShip !== null ? (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            daysSinceShip <= 7   ? 'bg-green-100 text-green-700'  :
            daysSinceShip <= 14  ? 'bg-amber-100 text-amber-700'  :
            daysSinceShip <= 60  ? 'bg-orange-100 text-orange-700' :
                                   'bg-red-100 text-red-700'
          }`}>
            {daysSinceShip} يوم
          </span>
        ) : (
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-400">لا شحنة</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded-full ${col.badge} font-medium`}>
          {parseInt(store.total_shipments) || 0} طرد
        </span>
        {statusBadge && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge.cls}`}>
            {statusBadge.label}
          </span>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-50">
        <div className="flex items-center gap-1.5">
          {calledToday && (
            <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
              <Phone size={10} />
              تم التواصل
            </span>
          )}
          {store.phone && (
            <span className="text-xs text-slate-400 font-mono" dir="ltr">{store.phone}</span>
          )}
        </div>
        {assignedTo && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium truncate max-w-[80px]">
            {assignedTo}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── عمود Kanban ──────────────────────────────────────────────────────────────
function KanbanColumn({ col, stores, storeStates, assignments, callLogs, search, onSelect }) {
  const [showAll, setShowAll] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return stores
    const q = search.toLowerCase()
    return stores.filter(s =>
      s.name?.toLowerCase().includes(q) || String(s.id).includes(q)
    )
  }, [stores, search])

  const displayed = showAll ? filtered : filtered.slice(0, PREVIEW_SIZE)
  const hidden    = filtered.length - PREVIEW_SIZE

  return (
    <div className="flex flex-col min-w-[280px] lg:min-w-0 lg:flex-1 h-full">
      {/* Column Header */}
      <div className={`rounded-2xl bg-gradient-to-br ${col.gradient} p-4 mb-3 shadow-md`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center">
              <col.icon size={16} className="text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-tight">{col.label}</p>
              <p className="text-white/70 text-xs">{filtered.length} متجر</p>
            </div>
          </div>
          <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <span className="text-white font-black text-sm">{filtered.length}</span>
          </div>
        </div>
      </div>

      {/* Cards */}
      <div className="flex-1 space-y-2.5 overflow-y-auto pr-0.5" style={{ maxHeight: 'calc(100vh - 280px)' }}>
        {displayed.length === 0 ? (
          <div className={`rounded-2xl ${col.bg} border border-dashed ${col.border} p-8 text-center`}>
            <col.icon size={24} className="text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-xs">لا توجد متاجر</p>
          </div>
        ) : (
          displayed.map(store => (
            <StoreCard
              key={store.id}
              store={store}
              col={col}
              storeStates={storeStates}
              assignments={assignments}
              callLogs={callLogs}
              onClick={onSelect}
            />
          ))
        )}

        {/* Show more / less */}
        {!showAll && hidden > 0 && (
          <button
            onClick={() => setShowAll(true)}
            className={`w-full py-2.5 rounded-xl border ${col.border} ${col.bg} text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity`}
          >
            <ChevronDown size={13} />
            عرض {hidden} متجر إضافي
          </button>
        )}
        {showAll && filtered.length > PREVIEW_SIZE && (
          <button
            onClick={() => setShowAll(false)}
            className={`w-full py-2.5 rounded-xl border ${col.border} ${col.bg} text-xs font-medium flex items-center justify-center gap-1.5 hover:opacity-80 transition-opacity`}
          >
            <ChevronUp size={13} />
            طي القائمة
          </button>
        )}
      </div>
    </div>
  )
}

// ─── الصفحة الرئيسية ──────────────────────────────────────────────────────────
export default function Kanban() {
  const { stores, counts, storeStates, assignments, callLogs, loading, reload } = useStores()
  const { can } = useAuth()
  const [search, setSearch]   = useState('')
  const [selected, setSelected] = useState(null)

  const visibleCols = COLUMNS.filter(col => {
    const viewMap = {
      incubating:      'new',
      active_shipping: 'active',
      hot_inactive:    'hot_inactive',
      cold_inactive:   'cold_inactive',
    }
    return can(viewMap[col.key])
  })

  const totalShipments = Object.values(stores)
    .flat()
    .reduce((s, x) => s + (parseInt(x.total_shipments) || 0), 0)

  return (
    <div className="flex flex-col h-full gap-4 lg:gap-5">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-black text-slate-800 flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-md">
              <Package size={16} className="text-white" />
            </div>
            لوحة Kanban
          </h1>
          <p className="text-slate-400 text-xs mt-1 mr-10">
            {counts.total || 0} متجر إجمالي •{' '}
            {totalShipments.toLocaleString('ar-SA')} طرد
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Search */}
          <div className="relative">
            <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث..."
              className="pr-9 pl-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400 w-44 lg:w-56 shadow-sm"
            />
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="h-9 w-9 flex items-center justify-center bg-white border border-slate-200 rounded-xl text-slate-500 hover:bg-slate-50 shadow-sm disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Summary Pills */}
      <div className="flex items-center gap-2 flex-wrap">
        {COLUMNS.filter(c => can({ incubating:'new', active_shipping:'active', hot_inactive:'hot_inactive', cold_inactive:'cold_inactive' }[c.key])).map(col => (
          <div key={col.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${col.bg} border ${col.border} text-xs font-medium`}>
            <span className={`w-2 h-2 rounded-full ${col.dot}`} />
            <span className="text-slate-600">{col.label}</span>
            <span className="font-black text-slate-700">{(counts[col.key] || 0).toLocaleString('ar-SA')}</span>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-4 flex-1" style={{ minHeight: 0 }}>
        {visibleCols.map(col => (
          <KanbanColumn
            key={col.key}
            col={col}
            stores={stores[col.key] || []}
            storeStates={storeStates}
            assignments={assignments}
            callLogs={callLogs}
            search={search}
            onSelect={setSelected}
          />
        ))}
      </div>

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
