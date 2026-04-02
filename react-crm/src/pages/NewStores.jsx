import { useState } from 'react'
import { Store, RefreshCw } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'

export default function NewStores() {
  const { stores, callLogs, loading, reload } = useStores()
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Store size={24} className="text-purple-600" />
            المتاجر الجديدة
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">{incubating.length} متجر قيد الاحتضان</p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        stores={incubating}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر جديدة"
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
