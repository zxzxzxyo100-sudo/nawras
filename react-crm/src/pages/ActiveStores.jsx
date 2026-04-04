import { useState, useEffect, useMemo } from 'react'
import { TrendingUp, RefreshCw, UserCheck, Users, X, CheckCircle2, Shuffle, Filter } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { assignStore, listUsers } from '../services/api'

export default function ActiveStores() {
  const { stores, counts, assignments, loading, reload, storeStates, shipmentsRangeMeta } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]           = useState(null)
  const [users, setUsers]                 = useState([])
  const [saving, setSaving]               = useState(false)
  const [selectedIds, setSelectedIds]     = useState(new Set())
  const [bulkUser, setBulkUser]           = useState('')
  const [successMsg, setSuccessMsg]       = useState('')
  // وضع التعيين: 'manual' | 'auto'
  const [assignMode, setAssignMode]       = useState('manual')
  // اليوزرات المحددة للتوزيع التلقائي
  const [autoUsers, setAutoUsers]         = useState(new Set())
  // فلتر التعيين: 'all' | 'assigned' | 'unassigned' | username
  const [assignFilter, setAssignFilter]   = useState('all')

  const isExecutive = user?.role === 'executive'

  /** متاجر أُخرجت يدوياً من مسار الاحتضان إلى «نشط» وتظهر هنا حتى لو بقيت في دفعة API الاحتضان */
  const active = useMemo(() => {
    const base = stores.active_shipping || []
    const fromInc = (stores.incubating || []).filter(s => {
      const st = storeStates[s.id]
      const c = st?.category
      return c === 'active' || c === 'active_shipping'
    })
    const seen = new Set(base.map(s => s.id))
    return [...base, ...fromInc.filter(s => !seen.has(s.id))]
  }, [stores.active_shipping, stores.incubating, storeStates])

  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(res => setUsers((res.data || []).filter(u => u.role === 'active_manager')))
      .catch(() => {})
  }, [isExecutive])

  // تعيين متجر واحد (dropdown في الجدول)
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
    } catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  // تعيين جماعي يدوي (كل المحددين → يوزر واحد)
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
      showSuccess(`تم تعيين ${selectedIds.size} متجر لـ "${users.find(u=>u.username===bulkUser)?.fullname || bulkUser}"`)
      clearSelection()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  // توزيع تلقائي (round-robin بين اليوزرات المحددة)
  async function handleAutoAssign() {
    const targets = [...autoUsers]
    if (targets.length === 0 || selectedIds.size === 0) return
    setSaving(true)
    try {
      const storeMap  = Object.fromEntries(active.map(s => [s.id, s]))
      const storeList = [...selectedIds]
      await Promise.all(
        storeList.map((id, idx) =>
          assignStore({
            store_id:    id,
            store_name:  storeMap[id]?.name || '',
            assigned_to: targets[idx % targets.length],   // round-robin
            assigned_by: user?.fullname || user?.username || '',
          })
        )
      )
      await reload()
      const perUser = Math.ceil(storeList.length / targets.length)
      showSuccess(`تم توزيع ${storeList.length} متجر على ${targets.length} مسؤول (~${perUser} لكل منهم)`)
      clearSelection()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  function toggleAutoUser(username) {
    const next = new Set(autoUsers)
    next.has(username) ? next.delete(username) : next.add(username)
    setAutoUsers(next)
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkUser('')
    setAutoUsers(new Set())
    setAssignMode('manual')
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
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
        const current     = assignments[s.id]?.assigned_to || ''
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

  const assignedCount   = active.filter(s => assignments[s.id]?.assigned_to).length
  const unassignedCount = active.length - assignedCount

  // تطبيق الفلتر
  const filteredActive = useMemo(() => {
    if (assignFilter === 'assigned')   return active.filter(s =>  assignments[s.id]?.assigned_to)
    if (assignFilter === 'unassigned') return active.filter(s => !assignments[s.id]?.assigned_to)
    if (assignFilter !== 'all')        return active.filter(s =>  assignments[s.id]?.assigned_to === assignFilter)
    return active
  }, [active, assignments, assignFilter])

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
            {active.length} متجر — شحن خلال آخر 14 يوم
            {(stores.incubating || []).some(s => {
              const c = storeStates[s.id]?.category
              return c === 'active' || c === 'active_shipping'
            }) && (
              <span className="text-emerald-600 text-xs"> (يشمل مُخرَّجين من الاحتضان)</span>
            )}
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

      {/* شريط الفلتر */}
      {isExecutive && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter size={13} />
            تصفية:
          </span>
          {[
            { key: 'all',        label: `الكل (${active.length})` },
            { key: 'assigned',   label: `معيّنة (${assignedCount})` },
            { key: 'unassigned', label: `غير معيّنة (${unassignedCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setAssignFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                assignFilter === f.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          {/* فلتر لكل مسؤول */}
          {users.map(u => {
            const cnt = active.filter(s => assignments[s.id]?.assigned_to === u.username).length
            if (cnt === 0) return null
            return (
              <button
                key={u.username}
                onClick={() => setAssignFilter(assignFilter === u.username ? 'all' : u.username)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  assignFilter === u.username
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {u.fullname || u.username} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* شريط التعيين الجماعي */}
      {isExecutive && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">

          {/* العنوان وعدد المحددين وزر الإغلاق */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
              <Users size={16} />
              <span>تم تحديد <strong>{selectedIds.size}</strong> متجر</span>
            </div>
            <button onClick={clearSelection} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {/* تبويب وضع التعيين */}
          <div className="flex gap-2">
            <button
              onClick={() => setAssignMode('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                assignMode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              <UserCheck size={13} />
              تعيين لشخص واحد
            </button>
            <button
              onClick={() => setAssignMode('auto')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                assignMode === 'auto'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-blue-200 text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Shuffle size={13} />
              توزيع تلقائي
            </button>
          </div>

          {/* وضع يدوي */}
          {assignMode === 'manual' && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bulkUser}
                onChange={e => setBulkUser(e.target.value)}
                className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 min-w-[170px]"
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
          )}

          {/* وضع تلقائي */}
          {assignMode === 'auto' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">اختر المسؤولين للتوزيع عليهم (بالتساوي):</p>
              <div className="flex flex-wrap gap-2">
                {users.map(u => {
                  const checked = autoUsers.has(u.username)
                  return (
                    <label
                      key={u.username}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAutoUser(u.username)}
                        className="hidden"
                      />
                      {u.fullname || u.username}
                    </label>
                  )
                })}
              </div>
              {autoUsers.size > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-xs text-indigo-600 font-medium">
                    ~{Math.ceil(selectedIds.size / autoUsers.size)} متجر لكل مسؤول
                  </p>
                  <button
                    onClick={handleAutoAssign}
                    disabled={saving === true}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Shuffle size={14} />
                    {saving === true ? 'جارٍ التوزيع...' : 'توزيع'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <StoreTable
        stores={filteredActive}
        onSelectStore={setSelected}
        extraColumns={extraColumns}
        emptyMsg="لا توجد متاجر نشطة"
        parcelsColumnSub={
          shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
            ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
            : undefined
        }
        selectable={isExecutive}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
