import { useState } from 'react'
import { Flame, RefreshCw, CheckCircle2, Phone, PhoneOff } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { setStoreStatus } from '../services/api'

export default function HotInactive() {
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]           = useState(null)
  const [actionLoading, setActionLoading] = useState(false)

  const hotInactive = stores.hot_inactive || []

  async function markAs(store, category) {
    setActionLoading(true)
    try {
      await setStoreStatus({
        store_id:   store.id,
        store_name: store.name,
        category,
        old_status: storeStates[store.id]?.category || 'hot_inactive',
        user:       user?.fullname,
        user_role:  user?.role,
      })
      await reload()
    } catch (err) {
      console.error(err)
    } finally {
      setActionLoading(false)
    }
  }

  const extraColumns = [
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
        const resultText = latest.note?.trim()
        return (
          <span className="text-[11px] text-slate-600 leading-snug line-clamp-2 max-w-[220px]">
            {resultText || 'لا يوجد'}
          </span>
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
        const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0

        if (dbCat === 'restored') return (
          <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full font-medium">تمت الاستعادة ✓</span>
        )
        if (dbCat === 'restoring') return (
          <div className="flex flex-col gap-1">
            <button
              onClick={e => { e.stopPropagation(); markAs(s, 'restored') }}
              className="text-xs px-2 py-1 rounded-lg bg-teal-50 text-teal-600 border border-teal-200 hover:bg-teal-100 transition-colors font-medium flex items-center gap-1"
            >
              <CheckCircle2 size={11} /> تأكيد الاستعادة
            </button>
            {dbUpdatedBy && (
              <span className="text-[10px] text-slate-400">{dbUpdatedBy}</span>
            )}
          </div>
        )
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
            <Flame size={24} className="text-amber-500" />
            غير نشط ساخن
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {counts.hot_inactive || 0} متجر — انقطع من 15 إلى 60 يوم
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <StoreTable
        stores={hotInactive}
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
