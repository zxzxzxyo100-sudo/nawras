import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, UserCheck, X } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { assignStore, listUsers } from '../services/api'

export default function ActiveStores() {
  const { stores, counts, assignments, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]     = useState(null)
  const [users, setUsers]           = useState([])
  const [saving, setSaving]         = useState(null) // store_id being saved

  const isExecutive = user?.role === 'executive'
  const active = stores.active_shipping || []

  // جلب مسؤولي المتاجر النشطة فقط (للـ dropdown)
  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(res => setUsers((res.users || []).filter(u => u.role === 'active_manager')))
      .catch(() => {})
  }, [isExecutive])

  async function handleAssign(store, username) {
    setSaving(store.id)
    try {
      await assignStore({
        store_id:    store.id,
        store_name:  store.name,
        assigned_to: username,
        assigned_by: user?.fullname || user?.username || '',
      })
      await reload()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(null)
    }
  }

  const extraColumns = [
    {
      key: 'days_since_ship',
      label: 'أيام منذ آخر شحنة',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد')
          return <span className="text-red-400 text-xs">—</span>
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            days <= 7 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {days} يوم
          </span>
        )
      },
    },
    {
      key: 'assigned_to',
      label: 'المسؤول',
      render: s => {
        const current = assignments[s.id]?.assigned_to || ''
        const isSaving = saving === s.id

        if (!isExecutive) {
          // باقي الأدوار: يرون من هو المسؤول فقط
          return current
            ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{current}</span>
            : <span className="text-xs text-slate-300">—</span>
        }

        // المدير التنفيذي: dropdown للتعيين
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <select
              value={current}
              disabled={isSaving}
              onChange={e => handleAssign(s, e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-50 max-w-[130px]"
            >
              <option value="">— بدون تعيين —</option>
              {users.map(u => (
                <option key={u.username} value={u.username}>
                  {u.fullname || u.username}
                </option>
              ))}
            </select>
            {current && (
              <button
                onClick={() => handleAssign(s, '')}
                disabled={isSaving}
                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
                title="إلغاء التعيين"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      },
    },
  ]

  // إحصائية التعيينات
  const assignedCount = active.filter(s => assignments[s.id]?.assigned_to).length

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={24} className="text-green-600" />
            نشط يشحن
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-2">
            {counts.active_shipping || 0} متجر — شحن خلال آخر 14 يوم
            {isExecutive && assignedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                <UserCheck size={11} />
                {assignedCount} معيّن
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
        stores={active}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر نشطة"
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
