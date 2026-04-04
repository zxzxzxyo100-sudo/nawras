import { useState, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Flame, RefreshCw, Phone, PhoneOff, Users } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { formatCallOutcome } from '../constants/callOutcomes'

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

  if (!SEGMENTS.has(recoverySegment || '')) {
    return <Navigate to="/hot-inactive/all" replace />
  }

  const isAllTab = recoverySegment === 'all'
  const isRestoredTab = recoverySegment === 'restored'
  const isRecoveryTab = recoverySegment === 'restoring' || recoverySegment === 'restored'

  const hotInactive = stores.hot_inactive || []
  const coldInactive = stores.cold_inactive || []

  const filteredStores = useMemo(() => {
    const cat = id => storeStates[id]?.category
    if (isAllTab) {
      return hotInactive.filter(() => true)
    }
    if (isRestoredTab) {
      const hot = hotInactive.filter(s => cat(s.id) === 'restored')
      const cold = coldInactive.filter(s => cat(s.id) === 'restored')
      return dedupeById([...hot, ...cold])
    }
    /* جاري الاستعادة: ساخن + بارد بحالة restoring */
    const hot = hotInactive.filter(s => cat(s.id) === 'restoring')
    const cold = coldInactive.filter(s => cat(s.id) === 'restoring')
    return dedupeById([...hot, ...cold])
  }, [hotInactive, coldInactive, storeStates, isAllTab, isRestoredTab])

  const userStats = useMemo(
    () => aggregateUserStats(filteredStores, storeStates, callLogs),
    [filteredStores, storeStates, callLogs]
  )

  const bucketColumn = isRecoveryTab
    ? [{
        key: 'list_bucket',
        label: 'المسار',
        render: s => (
          coldInactive.some(c => c.id === s.id)
            ? <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-medium">غير نشط بارد</span>
            : <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-medium">غير نشط ساخن</span>
        ),
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
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
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
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <PhoneOff size={11} /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const outcomeLabel = formatCallOutcome(latest.outcome)
        const noteText = latest.note?.trim()
        if (!outcomeLabel && !noteText) {
          return (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <PhoneOff size={11} /> لا يوجد
            </span>
          )
        }
        return (
          <div className="flex flex-col gap-0.5 min-w-0 max-w-[220px]">
            {outcomeLabel && (
              <span className="text-xs font-semibold text-violet-700">{outcomeLabel}</span>
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
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <PhoneOff size={11} /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const today = new Date().toISOString().slice(0, 10)
        const isToday = latest.date?.startsWith(today)
        const dateLabel = isToday ? 'اليوم' : latest.date?.slice(0, 10) || '—'

        return (
          <span className={`flex items-center gap-1 text-xs font-medium ${isToday ? 'text-green-600' : 'text-slate-500'}`}>
            <Phone size={10} />
            {dateLabel}
            {latest.performed_by && (
              <span className="text-slate-400 font-normal">· {latest.performed_by}</span>
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

        if (dbCat === 'restored') return (
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">تمت الاستعادة ✓</span>
        )
        if (dbCat === 'restoring') return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-medium w-fit">قيد الاستعادة</span>
            {dbUpdatedBy && (
              <span className="text-[10px] text-slate-500">{dbUpdatedBy}</span>
            )}
            <span className="text-[10px] text-slate-400 leading-snug">تمت الاستعادة تُحدَّث تلقائياً — لا يمكن اختيارها يدوياً</span>
          </div>
        )
        if (dbCat === 'frozen') return (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">مجمد</span>
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
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <PageIcon size={24} className={titleBlock.iconClass} />
            {titleBlock.line}
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {filteredStores.length} متجر في هذا الفرع
            {isAllTab && ` — إجمالي غير نشط ساخن: ${counts.hot_inactive || 0}`}
            {recoverySegment === 'restoring' && ' — يشمل الساخن والبارد بحالة «قيد الاستعادة»'}
            {isRestoredTab && ' — يشمل الساخن والبارد بتمت الاستعادة'}
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
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

      <StoreTable
        stores={filteredStores}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
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
