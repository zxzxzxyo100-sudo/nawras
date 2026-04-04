import { useState, useEffect, useMemo } from 'react'
import { Crown, RefreshCw, Search, TrendingUp, TrendingDown, Minus, ExternalLink } from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { getOrdersSummaryRange } from '../services/api'
import StoreDrawer from '../components/StoreDrawer'
import { totalShipments } from '../utils/storeFields'

const VIP_MIN = 300

/** عدد الأيام شاملاً بين تاريخين (YYYY-MM-DD) */
function inclusiveDaySpan(fromStr, toStr) {
  const a = new Date(`${fromStr}T12:00:00`)
  const b = new Date(`${toStr}T12:00:00`)
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 1
  return Math.max(1, Math.round((b - a) / 86400000) + 1)
}

function shipmentTrend(current, previous) {
  const c = Number(current) || 0
  const p = Number(previous) || 0
  if (c > p) return 'up'
  if (c < p) return 'down'
  return 'same'
}

export default function VipMerchants() {
  const { vipMerchants, loading, reload, shipmentsRangeMeta, lastLoaded } = useStores()
  const [selected, setSelected] = useState(null)
  const [q, setQ] = useState('')
  const [prevMap, setPrevMap] = useState({})
  const [prevLabel, setPrevLabel] = useState('')
  const [loadingPrev, setLoadingPrev] = useState(false)

  const vipStores = useMemo(() => {
    const list = vipMerchants || []
    return [...list].sort((a, b) => totalShipments(b) - totalShipments(a))
  }, [vipMerchants])

  useEffect(() => {
    if (!shipmentsRangeMeta?.from) return
    let cancelled = false
    ;(async () => {
      setLoadingPrev(true)
      try {
        const span = inclusiveDaySpan(shipmentsRangeMeta.from, shipmentsRangeMeta.to)
        const prevTo = new Date(`${shipmentsRangeMeta.from}T12:00:00`)
        prevTo.setDate(prevTo.getDate() - 1)
        const prevFrom = new Date(prevTo)
        prevFrom.setDate(prevFrom.getDate() - (span - 1))
        const f = prevFrom.toISOString().slice(0, 10)
        const t = prevTo.toISOString().slice(0, 10)
        const res = await getOrdersSummaryRange(f, t)
        if (cancelled) return
        const m = {}
        if (res?.success && Array.isArray(res.data)) {
          res.data.forEach(s => {
            const n = parseInt(s.total_shipments, 10) || 0
            m[s.id] = n
            m[String(s.id)] = n
          })
        }
        setPrevMap(m)
        setPrevLabel(`مقارنة الطرود: النطاق الحالي مقابل ${f} — ${t}`)
      } catch {
        if (!cancelled) {
          setPrevMap({})
          setPrevLabel('')
        }
      } finally {
        if (!cancelled) setLoadingPrev(false)
      }
    })()
    return () => { cancelled = true }
  }, [shipmentsRangeMeta?.from, shipmentsRangeMeta?.to, lastLoaded])

  const filtered = useMemo(() => {
    if (!q.trim()) return vipStores
    const low = q.trim().toLowerCase()
    return vipStores.filter(
      s =>
        String(s.name || '').toLowerCase().includes(low) ||
        String(s.id || '').includes(low) ||
        String(s.phone || '').includes(low)
    )
  }, [vipStores, q])

  const hasSearch = Boolean(q.trim())
  const emptyBecauseSearch = hasSearch && vipStores.length > 0 && filtered.length === 0
  const emptyNoVip = !loading && vipStores.length === 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Crown size={26} className="text-amber-500" />
            كبار التجار
            <span className="text-sm font-normal text-slate-500">(VIP)</span>
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            يظهر التاجر عندما يكون الحساب <span className="font-semibold text-slate-700">نشطًا (status = active)</span> وإجمالي الطرود{' '}
            <span className="font-semibold text-slate-700">total_shipments ≥ {VIP_MIN}</span>
            — يشمل التجار الكبار حتى لو تصنيفهم الحالي «غير نشط» بسبب آخر شحنة؛ مستثنى من في الاحتضان فقط. للمدير التنفيذي فقط.
          </p>
          {shipmentsRangeMeta?.from && shipmentsRangeMeta?.to && (
            <p className="text-xs text-emerald-700 mt-1" dir="ltr">
              نطاق الطرود الحالي (للمؤشر): {shipmentsRangeMeta.from} ← {shipmentsRangeMeta.to}
            </p>
          )}
          {prevLabel && (
            <p className="text-xs text-slate-500 mt-0.5">{prevLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => reload()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
        <strong>المؤشر:</strong> بجانب طردات النطاق الحالي — سهم أخضر إذا زادت الطرود عن{' '}
        <strong>الفترة السابقة</strong> (نفس طول النطاق الحالي مباشرةً قبل بدايته)، وأحمر إذا نقصت، ورمادي عند التساوي.
        {loadingPrev && <span className="mr-2 text-amber-700"> جارٍ جلب الفترة السابقة…</span>}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="بحث بالاسم أو الرقم أو الهاتف…"
              className="w-full pr-9 pl-3 py-2.5 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-400/30"
            />
          </div>
          <span className="text-sm text-slate-500 whitespace-nowrap">
            {hasSearch ? `${filtered.length} من ${vipStores.length}` : `${vipStores.length} تاجر`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <th className="text-right px-4 py-3">رقم المتجر</th>
                <th className="text-right px-4 py-3">اسم المتجر</th>
                <th className="text-right px-4 py-3">الهاتف</th>
                <th className="text-right px-4 py-3">إجمالي الطرود (total_shipments)</th>
                <th className="text-right px-4 py-3">طرود النطاق الحالي</th>
                <th className="text-right px-4 py-3">الاتجاه</th>
                <th className="text-right px-4 py-3">آخر شحنة</th>
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {loading && vipStores.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">جارٍ التحميل…</td>
                </tr>
              ) : emptyBecauseSearch ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    لا نتائج للبحث — جرّب كلمات أخرى
                  </td>
                </tr>
              ) : emptyNoVip ? (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400">
                    لا يوجد تجار نشطين يطابقون الشرط (حالة نشط، ≥ {VIP_MIN} طرد)
                  </td>
                </tr>
              ) : (
                filtered.map(s => {
                  const cur = s.shipments_in_range !== undefined && s.shipments_in_range !== null
                    ? s.shipments_in_range
                    : 0
                  const prev = prevMap[s.id] ?? prevMap[String(s.id)] ?? 0
                  const tr = shipmentTrend(cur, prev)
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-slate-50 hover:bg-amber-50/40 cursor-pointer transition-colors"
                      onClick={() => setSelected(s)}
                    >
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{s.id}</span>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-800">{s.name}</td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-600" dir="ltr">{s.phone || '—'}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">{totalShipments(s)}</td>
                      <td className="px-4 py-3.5">
                        <span className="font-semibold text-slate-800">{cur}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-1.5">
                          {tr === 'up' && (
                            <span className="inline-flex items-center gap-0.5 text-emerald-600" title="زيادة عن الفترة السابقة">
                              <TrendingUp size={18} strokeWidth={2.5} />
                            </span>
                          )}
                          {tr === 'down' && (
                            <span className="inline-flex items-center gap-0.5 text-red-600" title="انخفاض عن الفترة السابقة">
                              <TrendingDown size={18} strokeWidth={2.5} />
                            </span>
                          )}
                          {tr === 'same' && (
                            <span className="inline-flex text-slate-400" title="بدون تغيير">
                              <Minus size={16} />
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 tabular-nums" dir="ltr">
                            ({cur} vs {prev})
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500">
                        {s.last_shipment_date && s.last_shipment_date !== 'لا يوجد'
                          ? new Date(s.last_shipment_date).toLocaleDateString('ar-SA')
                          : <span className="text-red-400 text-xs">لا يوجد</span>}
                      </td>
                      <td className="px-2 py-3.5" onClick={e => e.stopPropagation()}>
                        <button type="button" onClick={() => setSelected(s)} className="p-1 text-slate-300 hover:text-amber-600">
                          <ExternalLink size={14} />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
