import { useState } from 'react'
import { Snowflake, RefreshCw, Phone, PhoneOff } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { formatCallOutcome } from '../constants/callOutcomes'

export default function ColdInactive() {
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const [selected, setSelected] = useState(null)

  const coldInactive = stores.cold_inactive || []

  // انتقل من مسار الاحتضان (Q2: >48ساعة + 0 شحنات)
  const neverStarted = coldInactive.filter(s => s._never_started)
  const neverCount   = neverStarted.length

  const extraColumns = [
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
      key: 'origin',
      label: 'المصدر',
      render: s => s._never_started
        ? (
          <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">
            لم تبدأ ({Math.floor(s._days ?? 0)} يوم)
          </span>
        )
        : null,
    },
    {
      key: 'last_ship',
      label: 'آخر شحنة',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد')
          return <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">لم يشحن أبداً</span>
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">
            {days} يوم
          </span>
        )
      },
    },
    {
      key: 'recovery',
      label: 'الاستعادة',
      render: s => {
        const dbCat = storeStates[s.id]?.category

        // تمت الاستعادة — حالة نهائية
        if (dbCat === 'restored') return (
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">غير نشط · تمت الاستعادة ✓</span>
        )

        if (dbCat === 'restoring') return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <span className="text-xs bg-cyan-100 text-cyan-800 px-2 py-0.5 rounded-full font-medium w-fit">قيد الاستعادة</span>
            <span className="text-[10px] text-slate-400 leading-snug">تمت الاستعادة تُحدَّث تلقائياً</span>
          </div>
        )

        // مجمد
        if (dbCat === 'frozen') return (
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">مجمد</span>
        )

        // لا حالة مخصصة — العمود فارغ
        return null
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Snowflake size={24} className="text-blue-500" />
            غير نشط بارد
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {counts.cold_inactive || 0} متجر — انقطع أكثر من 60 يوم أو لم يشحن أبداً
            {neverCount > 0 && (
              <span className="mr-2 text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                {neverCount} من الاحتضان (لم تبدأ)
              </span>
            )}
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        stores={coldInactive}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر في هذه الفئة"
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
