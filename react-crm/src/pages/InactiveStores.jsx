import { useState } from 'react'
import { TrendingDown, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'

export default function InactiveStores() {
  const { stores, callLogs, storeStates, loading, reload } = useStores()
  const [selected, setSelected] = useState(null)

  const inactive = stores.inactive || []

  const extraColumns = [
    {
      key: 'recovery_status',
      label: 'حالة الاستعادة',
      render: s => {
        const dbState = storeStates[s.id]
        if (dbState?.category === 'restoring') return <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">قيد الاستعادة</span>
        if (dbState?.category === 'recovered') return <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">تم الاستعادة</span>
        if (dbState?.category === 'frozen')    return <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">مجمد</span>
        const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0
        return hasCalls
          ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">متابعة</span>
          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">لم يُتصل</span>
      },
    },
    {
      key: 'inactive_days',
      label: 'مدة الانقطاع',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد') return '—'
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return <span className="text-xs font-medium text-red-600">{days} يوم</span>
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingDown size={24} className="text-red-600" />
            المتاجر غير النشطة
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{inactive.length} متجر غير نشط</p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        stores={inactive}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر غير نشطة"
      />

      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} qvNeedsFreezeSource="inactive" />
      )}
    </div>
  )
}
