import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CalendarRange, Download, FileSpreadsheet, RefreshCw, Repeat2 } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getRecoveryReport } from '../services/api'
import { defaultCalendarMonthYmd, isValidYmdRange } from '../utils/statsDateRange'

function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function fmtDateTime(raw) {
  if (!raw) return '—'
  const t = new Date(raw)
  if (!Number.isNaN(t.getTime())) return t.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
  return String(raw)
}

export default function RecoveryReport() {
  const { user } = useAuth()
  const initRange = defaultCalendarMonthYmd()
  const [fromDate, setFromDate] = useState(initRange.from)
  const [toDate, setToDate] = useState(initRange.to)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState(null)

  const fetchReport = useCallback(async (from, to) => {
    setLoading(true)
    setError('')
    if (!isValidYmdRange(from, to)) {
      setError('حدّد تاريخاً صحيحاً: من ≤ إلى.')
      setLoading(false)
      return
    }
    try {
      const r = await getRecoveryReport({ from, to })
      if (!r?.success) {
        setError(r?.error || 'تعذّر تحميل تقرير الاستعادة.')
        setData(null)
      } else {
        setData(r)
      }
    } catch (e) {
      setError(e?.message || 'خطأ في الشبكة')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'executive') return
    fetchReport(fromDate, toDate)
  }, [user?.role, fetchReport, fromDate, toDate])

  const rows = useMemo(() => (Array.isArray(data?.rows) ? data.rows : []), [data])

  function setThisMonth() {
    const { from, to } = defaultCalendarMonthYmd()
    setFromDate(from)
    setToDate(to)
    fetchReport(from, to)
  }

  function downloadCsv() {
    if (!rows.length) return
    const headers = [
      'رقم المتجر',
      'اسم المتجر',
      'بدأ الاستعادة',
      'بواسطة',
      'تمت الاستعادة',
      'وقت الاستعادة',
      'بواسطة',
    ]
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push([
        csvEscape(r.store_id),
        csvEscape(r.store_name),
        csvEscape(r.started_at),
        csvEscape(r.started_by),
        csvEscape(r.restored ? 'نعم' : 'لا'),
        csvEscape(r.restored_at || ''),
        csvEscape(r.restored_by || ''),
      ].join(','))
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `تقرير-الاستعادة-${data?.from || fromDate}-${data?.to || toDate}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  if (user?.role !== 'executive') return null

  return (
    <div className="space-y-5 pb-10" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-teal-200/80 bg-gradient-to-l from-teal-50/90 to-white px-5 py-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-600 text-white shadow-lg shadow-teal-600/25">
              <FileSpreadsheet size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">تقرير الاستعادة</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                صفحة مستقلة تعرض عدد المتاجر التي بدأت الاستعادة، وعدد ما تمت استعادته، مع نسبة الاستعادة وتفاصيل كل متجر.
              </p>
              {data?.note_ar && <p className="text-xs text-slate-500 mt-2">{data.note_ar}</p>}
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full max-w-xl">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <CalendarRange size={14} />
                من
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 tabular-nums"
              />
              <span className="text-xs font-semibold text-slate-500">إلى</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 tabular-nums"
              />
              <button
                type="button"
                onClick={() => fetchReport(fromDate, toDate)}
                className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-teal-700"
              >
                تطبيق
              </button>
              <button
                type="button"
                onClick={setThisMonth}
                className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-1.5 text-xs font-semibold text-teal-900"
              >
                الشهر الحالي
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Link
                to="/staff-performance/stats"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                الإحصائيات
              </Link>
              <button
                type="button"
                onClick={() => fetchReport(fromDate, toDate)}
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
            </div>
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-cyan-100 bg-cyan-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">بدأت الاستعادة</p>
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {loading ? '…' : Number(data?.started_count || 0).toLocaleString('ar-SA')}
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">تمت الاستعادة</p>
            <p className="text-2xl font-black tabular-nums text-emerald-800">
              {loading ? '…' : Number(data?.restored_count || 0).toLocaleString('ar-SA')}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">نسبة الاستعادة</p>
            <p className="text-2xl font-black tabular-nums text-teal-700">
              {loading ? '…' : `${Number(data?.recovery_rate_pct || 0).toLocaleString('ar-SA')}%`}
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-slate-500 text-sm">جارٍ تحميل تقرير الاستعادة…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">لا توجد متاجر بدأت الاستعادة ضمن الفترة المحددة.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm text-right min-w-[760px]">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100">
                  <th className="px-3 py-2.5">رقم المتجر</th>
                  <th className="px-3 py-2.5">اسم المتجر</th>
                  <th className="px-3 py-2.5">بدء الاستعادة</th>
                  <th className="px-3 py-2.5">بواسطة</th>
                  <th className="px-3 py-2.5">تمت الاستعادة</th>
                  <th className="px-3 py-2.5">وقت الاستعادة</th>
                  <th className="px-3 py-2.5">بواسطة</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={`${r.store_id}-${i}`} className="border-b border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{r.store_id}</td>
                    <td className="px-3 py-2 text-slate-800">{r.store_name || '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-700">{fmtDateTime(r.started_at)}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.started_by || '—'}</td>
                    <td className="px-3 py-2">
                      {r.restored ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-bold text-emerald-700">
                          <Repeat2 size={12} />
                          نعم
                        </span>
                      ) : (
                        <span className="text-xs text-slate-500">لا</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-700">{r.restored ? fmtDateTime(r.restored_at) : '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-600">{r.restored_by || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-4">
          هذا تقرير تفصيلي للمتاجر وليس نسبة فقط. يعتمد على سجل التدقيق `audit_logs` ضمن الفترة المختارة.
        </p>
        <p className="text-[11px] text-slate-400 mt-3 flex gap-4">
          <Link to="/staff-performance/stats" className="inline-flex items-center gap-1 text-violet-600 font-semibold hover:underline">
            <ArrowRight size={12} className="rotate-180" />
            العودة إلى الإحصائيات
          </Link>
          <Link to="/staff-performance" className="inline-flex items-center gap-1 text-teal-700 font-semibold hover:underline">
            <ArrowRight size={12} className="rotate-180" />
            أهداف اليوم
          </Link>
        </p>
      </div>
    </div>
  )
}
