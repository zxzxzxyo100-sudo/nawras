import { useState, useEffect, useMemo } from 'react'
import { Lock, RefreshCw, X } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { assignStore, listUsers } from '../services/api'

export default function FrozenStores({ embedded = false } = {}) {
  const { stores, assignments, loading, reload, storeStates, shipmentsRangeMeta } = useStores()
  const { user } = useAuth()
  const [selected, setSelected] = useState(null)
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(false)

  const isExecutive = user?.role === 'executive'

  const frozenList = useMemo(() => {
    const base = stores.frozen_merchants || []
    const incPool = [...(stores.incubating || []), ...(stores.new_registered || [])]
    const fromInc = incPool.filter(s => storeStates[s.id]?.category === 'frozen')
    const seen = new Set(base.map(s => s.id))
    return [...base, ...fromInc.filter(s => !seen.has(s.id))]
  }, [stores.frozen_merchants, stores.incubating, stores.new_registered, storeStates])

  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(res => setUsers((res.data || []).filter(u => u.role === 'active_manager')))
      .catch(() => {})
  }, [isExecutive])

  async function handleAssignSingle(store, username) {
    setSaving(store.id)
    try {
      await assignStore({
        store_id: store.id,
        store_name: store.name,
        assigned_to: username,
        assigned_by: user?.fullname || user?.username || '',
      })
      await reload()
    } catch (e) { console.error(e) }
    finally { setSaving(null) }
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
        const current = assignments[s.id]?.assigned_to || ''
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
                type="button"
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

  const frozenExtraColumns = [
    {
      key: 'freeze_reason',
      label: 'سبب التجميد',
      render: s => {
        const r = (s.freeze_reason || storeStates[s.id]?.freeze_reason || '').trim()
        return r ? (
          <span className="text-xs text-slate-700 max-w-[220px] truncate block" title={r}>{r}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )
      },
    },
    ...extraColumns,
  ]

  const tableBlock = (
      <StoreTable
        variant="elite"
        stores={frozenList}
        onSelectStore={setSelected}
        onRestoreStore={setSelected}
        extraColumns={frozenExtraColumns}
        emptyMsg="لا توجد متاجر مجمدة — تُضاف عند اختيار «تجميد» من بطاقة المتجر"
        parcelsColumnSub={
          shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
            ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
            : undefined
        }
        selectable={false}
      />
  )

  if (embedded) {
    return (
      <div className="space-y-4" dir="rtl">
        {tableBlock}
        {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
      </div>
    )
  }

  return (
    <div className="space-y-4 lg:space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/40">
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Lock size={22} className="text-slate-600" />
            المتاجر المجمدة
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            {frozenList.length} متجر — يُرفع التجميد من بطاقة المتجر؛ لا تُدرَج هذه القائمة ضمن «نشط يشحن» أو «غير نشطة».
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-l from-slate-100/90 to-white px-4 py-3 shadow-sm">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Lock size={17} className="text-slate-600 shrink-0" />
          قائمة التجميد
        </h2>
        <p className="text-[11px] text-slate-700/90 mt-0.5">
          متاجر تم إيقاف المتابعة معها مؤقتاً؛ تبقى هنا حتى يُختار «رفع تجميد» وتعود للمسار المناسب حسب الشحن.
        </p>
      </div>

      {tableBlock}

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
