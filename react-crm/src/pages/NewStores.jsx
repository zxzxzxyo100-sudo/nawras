import { useState } from 'react'
import { Store, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'

export default function NewStores() {
  const { stores, callLogs, loading, reload, shipmentsRangeMeta } = useStores()
  const [selected, setSelected] = useState(null)

  const incubating = stores.incubating || []

  const extraColumns = [
    {
      key: 'days_old',
      label: 'عمر المتجر',
      render: s => {
        if (!s.registered_at) return '—'
        const days = Math.floor((new Date() - new Date(s.registered_at)) / 86400000)
        return <span className="text-xs font-medium">{days} يوم</span>
      },
    },
    {
      key: 'call_status',
      label: 'حالة المتابعة',
      render: s => {
        const log = callLogs[s.id] || {}
        if (log.day0) return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">تم التواصل</span>
        return <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">تحتاج مكالمة</span>
      },
    },
  ]

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store size={24} className="text-purple-600" />
            المتاجر الجديدة
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">{incubating.length} متجر قيد الاحتضان</p>
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

      <StoreTable
        variant="elite"
        stores={incubating}
        onSelectStore={setSelected}
        onRestoreStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر جديدة"
        parcelsColumnSub={
          shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
            ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
            : undefined
        }
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
