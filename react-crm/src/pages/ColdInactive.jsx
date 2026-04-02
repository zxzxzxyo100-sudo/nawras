import { useState } from 'react'
import { Snowflake, RefreshCw, CheckCircle2 } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { setStoreStatus } from '../services/api'

export default function ColdInactive() {
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const [selected, setSelected]           = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  async function markAs(store, category) {
    setActionLoading(true)
    try {
      await setStoreStatus(store.id, category)
      await reload()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const coldInactive = stores.cold_inactive || []

  // انتقل من مسار الاحتضان (Q2: >48ساعة + 0 شحنات)
  const neverStarted = coldInactive.filter(s => s._never_started)
  const neverCount   = neverStarted.length

  const extraColumns = [
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
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">تمت الاستعادة ✓</span>
        )

        // قيد الاستعادة — زر تأكيد فقط (لا بادج ولا زر آخر)
        if (dbCat === 'restoring') return (
          <button
            onClick={e => { e.stopPropagation(); markAs(s, 'restored') }}
            className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors font-medium flex items-center gap-1"
          >
            <CheckCircle2 size={11} /> تأكيد الاستعادة
          </button>
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

      {actionLoading && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl flex items-center gap-3">
            <RefreshCw size={20} className="animate-spin text-orange-500" />
            <span className="text-sm font-medium text-slate-700">جاري التحديث...</span>
          </div>
        </div>
      )}
    </div>
  )
}
