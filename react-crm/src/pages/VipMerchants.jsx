import { useState, useEffect, useMemo } from 'react'
import { Crown, RefreshCw, Search, ExternalLink, Calendar } from 'lucide-react'
import { getVipMerchantsMonthly } from '../services/api'
import StoreDrawer from '../components/StoreDrawer'
import StoreNameWithId from '../components/StoreNameWithId'

const DEFAULT_MONTHS = 2
const DEFAULT_THRESHOLD = 300

function formatMonthAr(ym) {
  const [y, m] = String(ym).split('-')
  if (!y || !m) return ym
  const d = new Date(Number(y), Number(m) - 1, 1)
  if (Number.isNaN(d.getTime())) return ym
  return d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' })
}

/** YYYY-MM للشهر الحالي حسب التوقيت المحلي */
function currentYM() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
/** YYYY-MM للشهر السابق */
function prevYM() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function VipMerchants() {
  const [data, setData] = useState([])
  const [months, setMonths] = useState([])
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD)
  const [fromMonth, setFromMonth] = useState(prevYM())
  const [toMonth, setToMonth] = useState(currentYM())
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [q, setQ] = useState('')
  const [selected, setSelected] = useState(null)

  const load = async () => {
    setLoading(true)
    setErr('')
    try {
      const res = await getVipMerchantsMonthly({ fromMonth, toMonth, threshold })
      if (res?.success) {
        setData(Array.isArray(res.data) ? res.data : [])
        setMonths(Array.isArray(res.months) ? res.months : [])
      } else {
        setErr(res?.error || 'تعذّر جلب البيانات')
        setData([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في الاتصال')
      setData([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [fromMonth, toMonth, threshold])

  const filtered = useMemo(() => {
    if (!q.trim()) return data
    const low = q.trim().toLowerCase()
    return data.filter(s =>
      String(s.name || '').toLowerCase().includes(low)
      || String(s.id || '').includes(low)
      || String(s.phone || '').includes(low)
    )
  }, [data, q])

  const grandMaxMonth = useMemo(() => {
    let max = 0
    data.forEach(s => { if (s.monthly_max > max) max = s.monthly_max })
    return max || threshold
  }, [data, threshold])

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
            يُعتبر التاجر VIP إذا تجاوز شهرٌ واحد ضمن النطاق المحدد عتبة{' '}
            <span className="font-semibold text-slate-700">{threshold}</span> طرد.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
            <Calendar size={13} />
            من شهر:
            <input
              type="month"
              value={fromMonth}
              max={toMonth}
              onChange={e => setFromMonth(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 outline-none"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
            إلى شهر:
            <input
              type="month"
              value={toMonth}
              min={fromMonth}
              onChange={e => setToMonth(e.target.value)}
              className="bg-transparent font-semibold text-slate-800 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => { setFromMonth(prevYM()); setToMonth(currentYM()) }}
            className="text-xs px-2.5 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          >
            الحالي + السابق
          </button>
          <label className="flex items-center gap-1.5 text-xs text-slate-600 bg-white border border-slate-200 rounded-xl px-3 py-2">
            العتبة:
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={e => setThreshold(Math.max(1, Number(e.target.value) || 0))}
              className="w-16 bg-transparent font-semibold text-slate-800 outline-none"
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {err && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 text-sm text-rose-800">
          {err}
        </div>
      )}

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900 flex items-center justify-between flex-wrap gap-3">
        <div>
          <strong>المؤشر:</strong> أعمدة الأشهر تُجلب شهراً بشهر من{' '}
          <code className="font-mono text-xs">/external-api/customers/orders-summary</code>؛ المتاجر النشطة فقط.
        </div>
        <div className="text-xs text-amber-800">
          نتائج: <strong>{data.length}</strong> تاجر — أعلى شهر:{' '}
          <strong className="tabular-nums">{grandMaxMonth.toLocaleString('en-US')}</strong>
        </div>
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
            {q.trim() ? `${filtered.length} من ${data.length}` : `${data.length} تاجر`}
          </span>
        </div>

        <div className="overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-xs font-semibold border-b border-slate-100">
                <th className="text-right px-4 py-3 sticky right-0 bg-slate-50 z-[1]">المتجر</th>
                <th className="text-right px-4 py-3">الهاتف</th>
                <th className="text-right px-4 py-3">أعلى شهر</th>
                <th className="text-right px-4 py-3">شهر الذروة</th>
                <th className="text-right px-4 py-3">أشهر فوق العتبة</th>
                <th className="text-right px-4 py-3">آخر شحنة</th>
                {months.map(ym => (
                  <th key={ym} className="text-center px-2 py-3 whitespace-nowrap text-[10px] font-mono text-slate-400">
                    {ym}
                  </th>
                ))}
                <th className="w-10 px-2" />
              </tr>
            </thead>
            <tbody>
              {loading && data.length === 0 ? (
                <tr><td colSpan={6 + months.length + 1} className="text-center py-16 text-slate-400">جارٍ التحميل…</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6 + months.length + 1} className="text-center py-16 text-slate-400">
                  {q.trim() ? 'لا نتائج للبحث' : `لا يوجد تجار تجاوزوا ${threshold} طرداً في أي شهر ضمن النطاق المحدد`}
                </td></tr>
              ) : (
                filtered.map(s => {
                  const monthly = s.monthly || {}
                  const maxMonthLabel = s.monthly_max_month ? formatMonthAr(s.monthly_max_month) : '—'
                  return (
                    <tr
                      key={s.id}
                      className="border-t border-slate-50 hover:bg-amber-50/40 cursor-pointer transition-colors"
                      onClick={() => setSelected(s)}
                    >
                      <td className="px-4 py-3.5 sticky right-0 bg-white z-[1] hover:bg-amber-50/40 min-w-[220px]">
                        <StoreNameWithId
                          store={s}
                          nameClassName="font-medium text-slate-800"
                          idClassName="font-mono text-xs text-slate-500 font-semibold"
                        />
                      </td>
                      <td className="px-4 py-3.5 text-xs font-mono text-slate-600" dir="ltr">{s.phone || '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center justify-center min-w-[48px] px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-bold tabular-nums">
                          {Number(s.monthly_max || 0).toLocaleString('en-US')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 text-xs">{maxMonthLabel}</td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-bold text-amber-700">{s.qualifying_months || 0}</span>
                      </td>
                      <td className="px-4 py-3.5 text-slate-500 text-xs">
                        {s.last_shipment_date && s.last_shipment_date !== 'لا يوجد'
                          ? new Date(s.last_shipment_date).toLocaleDateString('ar-SA')
                          : <span className="text-rose-400">لا يوجد</span>}
                      </td>
                      {months.map(ym => {
                        const v = Number(monthly[ym] || 0)
                        const over = v >= threshold
                        return (
                          <td key={ym} className="px-2 py-3.5 text-center">
                            <span className={`inline-flex items-center justify-center min-w-[36px] px-1.5 py-0.5 rounded text-xs font-mono tabular-nums ${
                              over ? 'bg-amber-100 text-amber-900 font-bold'
                              : v > 0 ? 'text-slate-600' : 'text-slate-300'
                            }`}>
                              {v > 0 ? v.toLocaleString('en-US') : '·'}
                            </span>
                          </td>
                        )
                      })}
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
