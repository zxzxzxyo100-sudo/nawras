import { useMemo, useState } from 'react'
import { Baby, Phone, RefreshCw, Filter, AlertCircle } from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { parcelsInRangeDisplay } from '../utils/storeFields'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import { INC_DELAY_STAGE_OPTIONS, ALL_STAGE_KEYS } from '../constants/incubationDelayStages'

function isDoneIncubationPath(storeStates, storeId) {
  const st = storeStates?.[storeId]
  if (!st) return false
  if (st.inc_call3_at) return true
  const c = st.category
  return c === 'active' || c === 'active_shipping' || c === 'inactive'
}

function delayStageLabel(key) {
  return INC_DELAY_STAGE_OPTIONS.find(o => o.key === key)?.label || key || '—'
}

export default function IncubationCallDelay() {
  const {
    incubationPath, callLogs, storeStates, loading, error, reload,
  } = useStores()

  const baseStores = useMemo(() => {
    const seen = new Set()
    const out = []
    for (const s of [
      ...(incubationPath.call_1 || []),
      ...(incubationPath.call_2 || []),
      ...(incubationPath.call_3 || []),
      ...(incubationPath.between_calls || []),
    ]) {
      const id = s?.id
      if (id == null || seen.has(id)) continue
      seen.add(id)
      if (!isDoneIncubationPath(storeStates, id)) out.push(s)
    }
    return out
  }, [
    incubationPath.call_1,
    incubationPath.call_2,
    incubationPath.call_3,
    incubationPath.between_calls,
    storeStates,
  ])

  const [selectedStages, setSelectedStages] = useState(() => new Set(ALL_STAGE_KEYS))
  const [delayMin, setDelayMin] = useState('')
  const [delayMax, setDelayMax] = useState('')
  const [onlyDelayed, setOnlyDelayed] = useState(false)
  const [selected, setSelected] = useState(null)
  const [callStore, setCallStore] = useState(null)

  const filtered = useMemo(() => {
    const minN = delayMin === '' ? null : Number(delayMin)
    const maxN = delayMax === '' ? null : Number(delayMax)
    return baseStores.filter(s => {
      const stage = s._inc_stage_key || ''
      if (!selectedStages.has(stage)) return false
      const d = Number(s._delay_days) || 0
      if (onlyDelayed && d <= 0) return false
      if (minN != null && !Number.isNaN(minN) && d < minN) return false
      if (maxN != null && !Number.isNaN(maxN) && d > maxN) return false
      return true
    })
  }, [baseStores, selectedStages, delayMin, delayMax, onlyDelayed])

  function toggleStage(key) {
    setSelectedStages(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAllStages() {
    setSelectedStages(new Set(ALL_STAGE_KEYS))
  }

  const callTypeForModal = useMemo(() => {
    if (!callStore) return 'inc_call1'
    const st = storeStates[callStore.id]
    if (!st?.inc_call1_at) return 'inc_call1'
    if (!st?.inc_call2_at) return 'inc_call2'
    return 'inc_call3'
  }, [callStore, storeStates])

  const rowClass =
    'border-b border-slate-100 transition-all duration-300 cursor-pointer bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-amber-50/50'

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <AlertCircle size={24} className="text-amber-600" />
            تأخير المكالمة
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            مسار الاحتضان — تصفية حسب مرحلة المسار وأيام التأخير (جميع خانات المكالمات)
          </p>
        </div>
        <button
          type="button"
          onClick={reload}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="rounded-2xl border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
        البيانات مأخوذة من مسار الاحتضان (المكالمة الأولى / الثانية / الثالثة وبين المكالمات). يوم التأخير = عدد أيام التجاوز عن نافذة اليوم المحدّد (1 أو 3 أو 10) ضمن دورة 14 يومًا.
      </div>

      {/* تصفية */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-4">
        <div className="flex items-center gap-2 text-slate-800 font-semibold text-sm">
          <Filter size={16} className="text-violet-600" />
          التصفية
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-slate-600 mb-2">مراحل المكالمة</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={selectAllStages}
                className="text-[11px] px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100"
              >
                تحديد الكل
              </button>
            </div>
            <div className="mt-2 flex flex-col gap-1.5 max-h-48 overflow-y-auto">
              {INC_DELAY_STAGE_OPTIONS.map(opt => (
                <label
                  key={opt.key}
                  className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedStages.has(opt.key)}
                    onChange={() => toggleStage(opt.key)}
                    className="rounded border-slate-300"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-600">مدى أيام التأخير (ضمن المرحلة)</p>
            <div className="flex flex-wrap items-end gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">من (يوم)</span>
                <input
                  type="number"
                  min={0}
                  value={delayMin}
                  onChange={e => setDelayMin(e.target.value)}
                  placeholder="بدون حد أدنى"
                  className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-slate-500">إلى (يوم)</span>
                <input
                  type="number"
                  min={0}
                  value={delayMax}
                  onChange={e => setDelayMax(e.target.value)}
                  placeholder="بدون حد أقصى"
                  className="w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm tabular-nums"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyDelayed}
                onChange={e => setOnlyDelayed(e.target.checked)}
                className="rounded border-slate-300"
              />
              عرض المتأخرين فقط (أيام التأخير &gt; 0)
            </label>
          </div>
        </div>

        <p className="text-xs text-slate-500 tabular-nums">
          {filtered.length.toLocaleString('ar-SA')} متجر من {baseStores.length.toLocaleString('ar-SA')} (بعد التصفية)
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-slate-500">
          <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-violet-500" />
          جاري تحميل البيانات...
        </div>
      ) : (
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-amber-50/20 to-slate-100/90 p-2 sm:p-3 shadow-lg border border-slate-200/90">
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-x-auto shadow-inner">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/95 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
                  <th className="px-4 py-3 font-semibold">المتجر</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">يوم من 14</th>
                  <th className="px-4 py-3 font-semibold">مرحلة المسار</th>
                  <th className="px-4 py-3 font-semibold whitespace-nowrap">أيام التأخير</th>
                  <th className="px-4 py-3 font-semibold">المتبقي / النافذة التالية</th>
                  <th className="px-4 py-3 font-semibold">الطلبيات</th>
                  <th className="px-4 py-3 font-semibold">آخر شحنة</th>
                  <th className="px-4 py-3 font-semibold">التواصل</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-slate-500">
                      لا توجد متاجر تطابق التصفية الحالية
                    </td>
                  </tr>
                )}
                {filtered.map((s, i) => {
                  const parcels = parcelsInRangeDisplay(s)
                  const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0
                  const delayD = s._delay_days != null ? s._delay_days : '—'
                  return (
                    <tr key={s.id ?? i} onClick={() => setSelected(s)} className={rowClass}>
                      <td className="px-4 py-3 text-slate-700">
                        <div className="font-semibold text-slate-900">{s.name || '—'}</div>
                        <div className="text-xs text-slate-500 font-mono tabular-nums">{s.id}</div>
                      </td>
                      <td className="px-4 py-3 tabular-nums font-medium text-slate-800">
                        {s._cycle_day != null ? s._cycle_day : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 max-w-[12rem] leading-relaxed">
                        <span className="block text-[10px] text-violet-600 font-medium mb-0.5">
                          {delayStageLabel(s._inc_stage_key)}
                        </span>
                        {s._inc_phase || '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`tabular-nums font-semibold text-sm px-2 py-0.5 rounded-lg ${
                          Number(delayD) > 0
                            ? 'bg-amber-100 text-amber-900'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                        >
                          {delayD}
                          {delayD !== '—' ? ' يوم' : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[14rem]">
                        <span className="tabular-nums">{s._days_until_window != null ? `${s._days_until_window} يوم` : '—'}</span>
                        {s._next_window_hint ? (
                          <span className="block text-slate-500 mt-1">{s._next_window_hint}</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                          parcels > 0
                            ? 'bg-green-50 text-green-800 border-green-200'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                        >
                          {parcels}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {s.last_shipment_date && s.last_shipment_date !== 'لا يوجد'
                          ? s.last_shipment_date
                          : <span className="text-slate-400">لا يوجد</span>}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={e => { e.stopPropagation(); setCallStore(s) }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            hasCalls
                              ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                              : 'bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100'
                          }`}
                        >
                          <Phone size={12} />
                          {hasCalls ? 'متابعة' : 'تواصل'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} />
      )}

      {callStore && (
        <CallModal
          store={callStore}
          callType={callTypeForModal}
          onClose={() => setCallStore(null)}
          onSaved={reload}
        />
      )}
    </div>
  )
}
