import { useState } from 'react'
import { Snowflake, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'

export default function ColdInactive() {
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const [selected, setSelected] = useState(null)

  const coldInactive = stores.cold_inactive || []

  const extraColumns = [
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
      key: 'db_status',
      label: 'الحالة',
      render: s => {
        const dbCat = storeStates[s.id]?.category
        if (dbCat === 'frozen')    return <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">مجمد</span>
        if (dbCat === 'restoring') return <span className="text-xs bg-cyan-100 text-cyan-700 px-2 py-0.5 rounded-full">استعادة</span>
        const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0
        return hasCalls
          ? <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">متابعة</span>
          : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">لم يُتصل</span>
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
