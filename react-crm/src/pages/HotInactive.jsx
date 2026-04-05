import { useState, useMemo, useCallback } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Flame, RefreshCw, Phone, PhoneOff, Users } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import InactiveRowColorToolbar from '../components/InactiveRowColorToolbar'
import { useInactiveRowColors } from '../hooks/useInactiveRowColors'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { formatCallOutcome } from '../constants/callOutcomes'
import {
  isRestoredCategory,
  isRestoredForRecoveryLists,
  isStillRestoringStore,
  isRecoveryCompletedByShipment,
} from '../constants/storeCategories'

const SEGMENTS = new Set(['all', 'restoring', 'restored'])

function dedupeById(list) {
  const seen = new Set()
  return list.filter(s => {
    const id = s?.id
    if (id == null || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function recoveryIdBadge(store, storeStates) {
  const st = storeStates[store.id]
  const cat = st?.category
  if (isRestoredCategory(cat) || isRecoveryCompletedByShipment(store, st)) {
    return (
      <span
        title="تمت الاستعادة"
        className="inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-1 text-[10px] font-semibold text-teal-800"
      >
        ✓
      </span>
    )
  }
  if (cat === 'restoring') {
    return (
      <span
        title="قيد الاستعادة"
        className="inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-1 text-[10px] font-medium text-cyan-800"
      >
        ↻
      </span>
    )
  }
  return null
}

function aggregateUserStats(stores, storeStates, callLogs) {
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = Date.now() - 7 * 86400000
  const map = {}
  for (const s of stores) {
    const uid = (storeStates[s.id]?.updated_by || '').trim() || 'غير محدد'
    if (!map[uid]) {
      map[uid] = { label: uid, storeCount: 0, callsToday: 0, callsWeek: 0 }
    }
    map[uid].storeCount += 1
    const log = callLogs[s.id] || {}
    for (const c of Object.values(log)) {
      if (!c?.date) continue
      if (c.date.startsWith(today)) map[uid].callsToday += 1
      const t = new Date(c.date).getTime()
      if (!Number.isNaN(t) && t >= weekAgo) map[uid].callsWeek += 1
    }
  }
  return Object.values(map).sort((a, b) => b.storeCount - a.storeCount)
}

export default function HotInactive() {
  const { recoverySegment } = useParams()
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const [selected, setSelected] = useState(null)
  const inactiveRowColors = useInactiveRowColors('hot')
  const [rowPaintMode, setRowPaintMode] = useState(false)
  const [rowColorKey, setRowColorKey] = useState('1')

  const handlePaintClick = useCallback(
    store => {
      inactiveRowColors.apply(store.id, rowColorKey)
    },
    [inactiveRowColors, rowColorKey]
  )

  if (!SEGMENTS.has(recoverySegment || '')) {
    return <Navigate to="/hot-inactive/all" replace />
  }

  const isAllTab = recoverySegment === 'all'
  const isRestoredTab = recoverySegment === 'restored'
  const isRecoveryTab = recoverySegment === 'restoring' || recoverySegment === 'restored'

  const hotInactive = stores.hot_inactive || []
  const coldInactive = stores.cold_inactive || []
  const activeShipping = stores.active_shipping || []
  const incubating = stores.incubating || []

  const filteredStores = useMemo(() => {
    const matchRestored = s => isRestoredForRecoveryLists(s, storeStates[s.id])
    const matchRestoring = s => isStillRestoringStore(s, storeStates[s.id])

    if (isAllTab) {
      return hotInactive.filter(() => true)
    }
    if (isRestoredTab) {
      /* + متاجر بقيت restoring في DB لكن الشحنة بعد restore_date (تظهر في نشط يشحن) */
      const inactiveRows = [
        ...hotInactive.filter(matchRestored),
        ...coldInactive.filter(matchRestored),
      ]
      const afterRecovery = [
        ...activeShipping.filter(matchRestored),
        ...incubating.filter(matchRestored),
      ]
      return dedupeById([...inactiveRows, ...afterRecovery])
    }
    /* جاري الاستعادة: كل القوائم — بما فيها نشط/احتضان إذا لم تكتمل الشحنة بعد */
    const hot = hotInactive.filter(matchRestoring)
    const cold = coldInactive.filter(matchRestoring)
    const activeR = activeShipping.filter(matchRestoring)
    const incR = incubating.filter(matchRestoring)
    return dedupeById([...hot, ...cold, ...activeR, ...incR])
  }, [hotInactive, coldInactive, activeShipping, incubating, storeStates, isAllTab, isRestoredTab])

  const userStats = useMemo(
    () => aggregateUserStats(filteredStores, storeStates, callLogs),
    [filteredStores, storeStates, callLogs]
  )

  const bucketColumn = isRecoveryTab
    ? [{
        key: 'list_bucket',
        label: 'المسار',
        render: s => {
          if (coldInactive.some(c => c.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 font-medium">غير نشط بارد</span>
          }
          if (hotInactive.some(c => c.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-900 font-medium">غير نشط ساخن</span>
          }
          if (activeShipping.some(x => x.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 font-medium">نشط يشحن (بعد الاستعادة)</span>
          }
          if (incubating.some(x => x.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 font-medium">مسار الاحتضان</span>
          }
          return <span className="text-xs text-slate-500">—</span>
        },
      }]
    : []

  const extraColumns = [
    ...bucketColumn,
    {
      key: 'inactive_days',
      label: 'أيام الانقطاع',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد') return '—'
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
            {days} يوم
          </span>
        )
      },
    },
    {
      key: 'last_call',
      label: 'نتيجة المكالمة',
      render: s => {
        const log = callLogs[s.id] || {}
        const entries = Object.values(log).filter(c => c?.date)
        if (!entries.length) return (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <PhoneOff size={11} className="opacity-70" /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const outcomeLabel = formatCallOutcome(latest.outcome)
        const noteText = latest.note?.trim()
        if (!outcomeLabel && !noteText) {
          return (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <PhoneOff size={11} className="opacity-70" /> لا يوجد
            </span>
          )
        }
        return (
          <div className="flex flex-col gap-0.5 min-w-0 max-w-[220px]">
            {outcomeLabel && (
              <span className="text-xs font-semibold text-violet-800">{outcomeLabel}</span>
            )}
            {noteText && (
              <span className="text-[11px] text-slate-600 leading-snug line-clamp-2">{noteText}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'last_call_date',
      label: 'آخر مكالمة',
      render: s => {
        const log = callLogs[s.id] || {}
        const entries = Object.values(log).filter(c => c?.date)
        if (!entries.length) return (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <PhoneOff size={11} className="opacity-70" /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const today = new Date().toISOString().slice(0, 10)
        const isToday = latest.date?.startsWith(today)
        const dateLabel = isToday ? 'اليوم' : latest.date?.slice(0, 10) || '—'

        return (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${isToday ? 'text-emerald-700' : 'text-slate-600'}`}>
            <Phone size={12} strokeWidth={2} className="text-violet-600 shrink-0 opacity-90" />
            {dateLabel}
            {latest.performed_by && (
              <span className="text-slate-500 font-normal">· {latest.performed_by}</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'recovery',
      label: 'الاستعادة',
      render: s => {
        const dbCat = storeStates[s.id]?.category
        const dbUpdatedBy = storeStates[s.id]?.updated_by
        const st = storeStates[s.id]

        if (isRestoredCategory(dbCat)) return (
          <span className="text-[11px] border border-teal-200 bg-teal-50 text-teal-900 px-2 py-0.5 rounded-lg font-medium">تمت ✓</span>
        )
        if (isRecoveryCompletedByShipment(s, st)) return (
          <span className="text-[11px] border border-teal-200 bg-teal-50 text-teal-900 px-2 py-0.5 rounded-lg font-medium">تمت ✓</span>
        )
        if (dbCat === 'restoring') return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <span className="text-[11px] border border-cyan-200 bg-cyan-50 text-cyan-900 px-2 py-0.5 rounded-lg font-medium w-fit">قيد الاستعادة</span>
            {dbUpdatedBy && (
              <span className="text-[10px] text-slate-600">{dbUpdatedBy}</span>
            )}
            <span className="text-[10px] text-slate-500 leading-snug">تُحدَّث تلقائياً</span>
          </div>
        )
        if (dbCat === 'frozen') return (
          <span className="text-[11px] border border-slate-200 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">مجمد</span>
        )
        return null
      },
    },
  ]

  const titleBlock = isAllTab
    ? { Icon: Flame, iconClass: 'text-amber-500', line: 'غير نشط ساخن' }
    : isRestoredTab
      ? { Icon: RefreshCw, iconClass: 'text-teal-600', line: 'تمت الاستعادة' }
      : { Icon: RefreshCw, iconClass: 'text-cyan-600', line: 'جاري الاستعادة' }
  const PageIcon = titleBlock.Icon

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <PageIcon size={24} className={titleBlock.iconClass} />
            {titleBlock.line}
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {filteredStores.length} متجر في هذا الفرع
            {isAllTab && ` — إجمالي غير نشط ساخن: ${counts.hot_inactive || 0}`}
            {recoverySegment === 'restoring' && ' — ساخن وبارد ونشط إن بقيت الحالة «قيد الاستعادة» في السجل'}
            {isRestoredTab && ' — يشمل من اكتملت شحنياً أو حالة recovered في السجل'}
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* إحصاءات حسب آخر من حدّث حالة المتجر في النظام */}
      {userStats.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white/80 flex items-center gap-2">
            <Users size={18} className="text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800">إحصاءات حسب المسؤول (آخر تحديث للحالة)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-200 bg-white">
                  <th className="px-4 py-2.5 font-semibold">المسؤول</th>
                  <th className="px-4 py-2.5 font-semibold">عدد المتاجر</th>
                  <th className="px-4 py-2.5 font-semibold">مكالمات اليوم</th>
                  <th className="px-4 py-2.5 font-semibold">مكالمات 7 أيام</th>
                </tr>
              </thead>
              <tbody>
                {userStats.map(row => (
                  <tr key={row.label} className="border-b border-slate-100 bg-white hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{row.storeCount}</td>
                    <td className="px-4 py-2.5 tabular-nums text-emerald-700 font-medium">{row.callsToday}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.callsWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <InactiveRowColorToolbar
        activeColorKey={rowColorKey}
        onSelectColorKey={setRowColorKey}
        paintMode={rowPaintMode}
        onTogglePaintMode={() => setRowPaintMode(p => !p)}
        onClearAll={inactiveRowColors.clearAll}
      />

      <StoreTable
        variant="elite"
        stores={filteredStores}
        onSelectStore={setSelected}
        onRestoreStore={setSelected}
        renderIdBadge={s => recoveryIdBadge(s, storeStates)}
        extraColumns={extraColumns}
        rowTint={{
          getStyle: inactiveRowColors.styleFor,
          paintMode: rowPaintMode,
          onPaintClick: handlePaintClick,
        }}
        emptyMsg={
          isAllTab
            ? 'لا توجد متاجر في غير نشط ساخن'
            : isRestoredTab
              ? 'لا توجد متاجر بتمت الاستعادة'
              : 'لا توجد متاجر بحالة «قيد الاستعادة»'
        }
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
