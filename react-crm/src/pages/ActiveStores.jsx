import { useState } from 'react'
import { TrendingUp, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'

export default function ActiveStores() {
  const { stores, callLogs, loading, reload } = useStores()
  const [selected, setSelected] = useState(null)

  const active = stores.active || []

  const extraColumns = [
    {
      key: 'days_since_ship',
      label: 'أيام منذ آخر شحنة',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد') return <span className="text-red-400 text-xs">—</span>
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            days <= 7  ? 'bg-green-100 text-green-700' :
            days <= 14 ? 'bg-amber-100 text-amber-700' :
            'bg-red-100 text-red-600'
          }`}>
            {days} يوم
          </span>
        )
      },
    },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={24} className="text-green-600" />
            المتاجر النشطة
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{active.length} متجر نشط</p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        stores={active}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر نشطة"
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
