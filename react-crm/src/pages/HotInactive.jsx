import { useState } from 'react'
import { Flame, RefreshCw, TrendingUp, CheckCircle2, RotateCcw, AlertTriangle } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { setStoreStatus, resetCategory } from '../services/api'

export default function HotInactive() {
  const { stores, counts, callLogs, storeStates, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]           = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [confirmReset, setConfirmReset]   = useState(false)
  const [resetMsg, setResetMsg]           = useState('')

  const hotInactive = stores.hot_inactive || []

  // عدد المتاجر التي لها حالة مخصصة في DB
  const withCustomState = hotInactive.filter(s => storeStates[s.id]?.category).length

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

  async function handleResetAll() {
    setActionLoading(true)
    setConfirmReset(false)
    try {
      const ids = hotInactive.map(s => s.id)
      const res = await resetCategory(ids, user?.fullname, user?.role, 'إعادة تعيين جماعي من صفحة الساخن')
      setResetMsg(`تم إعادة تعيين ${res.affected} متجر بنجاح`)
      await reload()
    } catch (err) {
      console.error(err)
      setResetMsg('حدث خطأ أثناء إعادة التعيين')
    } finally {
      setActionLoading(false)
      setTimeout(() => setResetMsg(''), 4000)
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
        return (
          <div className="flex items-center gap-1.5">
            <button
              onClick={e => { e.stopPropagation(); markAs(s, 'restoring') }}
              className="text-xs px-2 py-1 rounded-lg bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100 transition-colors font-medium flex items-center gap-1"
            >
              <TrendingUp size={11} /> جاري الاستعادة
            </button>
            {hasCalls && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">تواصل ✓</span>}
          </div>
        )
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
            {withCustomState > 0 && (
              <span className="mr-2 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                {withCustomState} لديهم حالة مخصصة
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* زر إعادة التعيين الجماعي */}
          {withCustomState > 0 && (
            <button
              onClick={() => setConfirmReset(true)}
              disabled={actionLoading}
              className="flex items-center gap-2 px-4 py-2 bg-red-50 border border-red-200 rounded-xl text-sm font-medium text-red-600 hover:bg-red-100 transition-colors shadow-sm disabled:opacity-50"
            >
              <RotateCcw size={14} />
              إعادة تعيين الكل ({withCustomState})
            </button>
          )}
          <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {/* رسالة نجاح الإعادة */}
      {resetMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
          <CheckCircle2 size={16} />
          {resetMsg}
        </div>
      )}

      {/* نافذة تأكيد إعادة التعيين */}
      {confirmReset && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-bold text-slate-800">تأكيد إعادة التعيين</p>
                <p className="text-xs text-slate-500 mt-0.5">هذا الإجراء لا يمكن التراجع عنه</p>
              </div>
            </div>
            <p className="text-sm text-slate-600 mb-5">
              سيتم حذف جميع حالات الاستعادة ({withCustomState} متجر) وإعادتهم إلى الحالة الافتراضية "غير نشطة". سيُسجَّل هذا الإجراء في سجل التغييرات.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleResetAll}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-xl transition-colors"
              >
                نعم، إعادة التعيين
              </button>
              <button
                onClick={() => setConfirmReset(false)}
                className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

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
