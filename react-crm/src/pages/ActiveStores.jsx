import { useState, useEffect } from 'react'
import { TrendingUp, RefreshCw, UserCheck, Users, X, CheckCircle2 } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { assignStore, listUsers } from '../services/api'

export default function ActiveStores() {
  const { stores, counts, assignments, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]       = useState(null)
  const [users, setUsers]             = useState([])
  const [saving, setSaving]           = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [bulkUser, setBulkUser]       = useState('')
  const [successMsg, setSuccessMsg]   = useState('')

  const isExecutive = user?.role === 'executive'
  const active = stores.active_shipping || []

  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(res => setUsers((res.data || []).filter(u => u.role === 'active_manager')))
      .catch(() => {})
  }, [isExecutive])

  // تعيين متجر واحد (من الـ dropdown في الجدول)
  async function handleAssignSingle(store, username) {
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

  // تعيين جماعي
  async function handleBulkAssign() {
    if (!bulkUser || selectedIds.size === 0) return
    setSaving(true)
    try {
      const storeMap = Object.fromEntries(active.map(s => [s.id, s]))
      await Promise.all(
        [...selectedIds].map(id =>
          assignStore({
            store_id:    id,
            store_name:  storeMap[id]?.name || '',
            assigned_to: bulkUser,
            assigned_by: user?.fullname || user?.username || '',
          })
        )
      )
      await reload()
      setSuccessMsg(`تم تعيين ${selectedIds.size} متجر بنجاح`)
      setSelectedIds(new Set())
      setBulkUser('')
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  // إلغاء التحديد الجماعي
  function clearSelection() {
    setSelectedIds(new Set())
    setBulkUser('')
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
    ...(isExecutive ? [{
      key: 'assigned_to',
      label: 'المسؤول',
      render: s => {
        const current    = assignments[s.id]?.assigned_to || ''
        const isSavingRow = saving === s.id
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <select
              value={current}
              disabled={!!isSavingRow || saving === true}
              onChange={e => handleAssignSingle(s, e.target.value)}
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
                onClick={() => handleAssignSingle(s, '')}
                disabled={!!saving}
                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
                title="إلغاء التعيين"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      },
    }] : [{
      key: 'assigned_to',
      label: 'المسؤول',
      render: s => {
        const current = assignments[s.id]?.assigned_to || ''
        return current
          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{current}</span>
          : <span className="text-xs text-slate-300">—</span>
      },
    }]),
  ]

  const assignedCount = active.filter(s => assignments[s.id]?.assigned_to).length

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <TrendingUp size={22} className="text-green-600" />
            نشط يشحن
          </h1>
          <p className="text-slate-500 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
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

      {/* رسالة نجاح */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* شريط التعيين الجماعي */}
      {isExecutive && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-xl flex-wrap">
          <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
            <Users size={16} />
            <span>تم تحديد {selectedIds.size} متجر</span>
          </div>
          <div className="flex items-center gap-2 flex-1 flex-wrap">
            <select
              value={bulkUser}
              onChange={e => setBulkUser(e.target.value)}
              className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 min-w-[160px]"
            >
              <option value="">اختر المسؤول...</option>
              {users.map(u => (
                <option key={u.username} value={u.username}>
                  {u.fullname || u.username}
                </option>
              ))}
            </select>
            <button
              onClick={handleBulkAssign}
              disabled={!bulkUser || saving === true}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              <UserCheck size={14} />
              {saving === true ? 'جارٍ التعيين...' : 'تعيين'}
            </button>
          </div>
          <button
            onClick={clearSelection}
            className="text-slate-400 hover:text-slate-600 transition-colors"
            title="إلغاء التحديد"
          >
            <X size={18} />
          </button>
        </div>
      )}

      <StoreTable
        stores={active}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر نشطة"
        selectable={isExecutive}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
