import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, BarChart3, Download, FileSpreadsheet, Printer, RefreshCw,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getRegistrationMonthStats } from '../services/api'

function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

/** عرض تاريخ/وقت مقروء (ISO أو نص الخادم) */
function formatDisplayDateTime(raw) {
  if (raw == null || raw === '' || raw === 'لا يوجد') return null
  const t = new Date(raw)
  if (!Number.isNaN(t.getTime())) {
    return t.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
  }
  return String(raw)
}

/** إجمالي الطرود من ذاكرة البحث — للعرض فقط */
function formatParcelTotal(v) {
  const n = Number(v)
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('ar-SA')
}

export default function ConversionRateReport() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await getRegistrationMonthStats({ detail: true })
      if (r?.success) {
        setData(r)
      } else {
        setData(null)
        setError(r?.hint || 'تعذر جلب التقرير')
      }
    } catch (e) {
      setData(null)
      setError(e?.message || 'خطأ في الشبكة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'executive') load()
  }, [user?.role, load])

  const rows = useMemo(() => (Array.isArray(data?.report_rows) ? data.report_rows : []), [data])

  function downloadCsv() {
    if (!data || rows.length === 0) return
    const headers = [
      'رقم المتجر',
      'اسم المتجر',
      'الهاتف',
      'تاريخ التسجيل',
      'آخر شحنة',
      'إجمالي الطرود',
      'يُحسب شحن (تاريخ آخر شحنة)',
    ]
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push([
        csvEscape(r.store_id),
        csvEscape(r.name),
        csvEscape(r.phone),
        csvEscape(r.registered_at),
        csvEscape(r.last_shipment_date),
        csvEscape(r.total_shipments),
        csvEscape(r.shipped_by_last_date ? 'نعم' : 'لا'),
      ].join(','))
    }
    const bom = '\uFEFF'
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `تقرير-نسبة-التحويل-${data.month_label || 'month'}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function printPage() {
    window.print()
  }

  if (user?.role !== 'executive') {
    return null
  }

  const reg = data?.registered_this_month
  const ship = data?.shipped_among_registered
  const pct = data?.conversion_percent
  const monthLabel = data?.month_label || '—'

  return (
    <div className="space-y-5 pb-10" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-violet-200/80 bg-gradient-to-l from-violet-50/90 to-white px-5 py-4 shadow-sm print:shadow-none print:border-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25 print:hidden">
              <FileSpreadsheet size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">تقرير نسبة التحويل</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                متاجر سُجّلت خلال الشهر <span className="font-semibold text-slate-800">{monthLabel}</span>
                {' — '}الشحن يُحسب بـ <span className="font-semibold">تاريخ آخر شحنة</span> فقط.
              </p>
              {data?.generated_at && (
                <p className="text-[11px] text-slate-400 mt-1">
                  توليد التقرير: {new Date(data.generated_at).toLocaleString('ar-SA')}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2 print:hidden">
            <Link
              to="/staff-performance/stats"
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <BarChart3 size={14} />
              الإحصائيات
            </Link>
            <button
              type="button"
              onClick={() => load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
            <button
              type="button"
              onClick={downloadCsv}
              disabled={loading || rows.length === 0}
              className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-100 disabled:opacity-50"
            >
              <Download size={14} />
              تصدير CSV
            </button>
            <button
              type="button"
              onClick={printPage}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Printer size={14} />
              طباعة
            </button>
          </div>
        </div>
      </motion.div>

      {data?.cache_stale && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 print:hidden">
          {data.hint || 'حدّث ذاكرة المتاجر بتشغيل all-stores.php.'}
        </p>
      )}

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-sm print:shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">مسجّلون هذا الشهر</p>
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {loading ? '…' : typeof reg === 'number' ? reg.toLocaleString('ar-SA') : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">شحن (بتاريخ آخر شحنة)</p>
            <p className="text-2xl font-black tabular-nums text-emerald-800">
              {loading ? '…' : typeof ship === 'number' ? ship.toLocaleString('ar-SA') : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">نسبة التحويل</p>
            <p className="text-2xl font-black tabular-nums text-violet-700">
              {loading ? '…' : pct != null ? `${Number(pct).toLocaleString('ar-SA')}%` : '—'}
            </p>
          </div>
        </div>

        {data?.rule && (
          <p className="text-xs text-slate-500 mb-4 border-b border-slate-100 pb-4">{data.rule}</p>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">جارٍ تحميل التفاصيل…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">لا توجد صفوف في التقرير لهذا الشهر أو الذاكرة قديمة.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-1 print:overflow-visible">
            <table className="w-full text-sm text-right min-w-[720px]">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100">
                  <th className="px-3 py-2.5 whitespace-nowrap">رقم المتجر</th>
                  <th className="px-3 py-2.5 min-w-[140px]">اسم المتجر</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">الهاتف</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">تاريخ التسجيل</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">آخر شحنة</th>
                  <th className="px-3 py-2.5 whitespace-nowrap min-w-[5.5rem]" title="مرجعي من API — لا يُدخل في نسبة التحويل">
                    إجمالي طرود <span className="text-slate-400 font-normal">(مرجعي)</span>
                  </th>
                  <th className="px-3 py-2.5 whitespace-nowrap">شحن (تاريخ)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.store_id}-${i}`}
                    className="border-b border-slate-50 hover:bg-slate-50/50 print:bg-white"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{r.store_id ?? '—'}</td>
                    <td className="px-3 py-2 text-slate-800 max-w-[220px] truncate" title={r.name}>
                      {r.name || '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-600 whitespace-nowrap">{r.phone || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap" title={r.registered_at || ''}>
                      {formatDisplayDateTime(r.registered_at) ?? (r.registered_at || '—')}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {r.last_shipment_date && r.last_shipment_date !== 'لا يوجد'
                        ? (
                            <span title={r.last_shipment_date}>
                              {formatDisplayDateTime(r.last_shipment_date) ?? r.last_shipment_date}
                            </span>
                          )
                        : <span className="text-red-600">لا يوجد</span>}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-slate-800 font-medium min-w-[4rem] text-center">
                      {formatParcelTotal(r.total_shipments)}
                    </td>
                    <td className="px-3 py-2">
                      {r.shipped_by_last_date ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">نعم</span>
                      ) : (
                        <span className="text-xs font-medium text-slate-500">لا</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed border-t border-slate-100 pt-3">
          عمود «إجمالي طرود» يعرض رقماً مرجعياً من بيانات المتجر؛ نسبة التحويل تعتمد فقط على عمود «شحن (تاريخ)»
          بوجود تاريخ آخر شحنة صالح، بغض النظر عن عدد الطرود المعروض.
        </p>
        <p className="text-[11px] text-slate-400 mt-4 print:hidden">
          <Link to="/staff-performance/stats" className="inline-flex items-center gap-1 text-violet-600 font-semibold hover:underline">
            <ArrowRight size={12} className="rotate-180" />
            العودة إلى ملخص الإحصائيات
          </Link>
        </p>
      </div>
    </div>
  )
}
