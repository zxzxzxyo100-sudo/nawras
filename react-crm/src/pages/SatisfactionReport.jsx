import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowRight, BarChart3, CalendarRange, Download, HeartHandshake, Printer, RefreshCw, Phone,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getSatisfactionStats } from '../services/api'
import { defaultCalendarMonthYmd, isValidYmdRange } from '../utils/statsDateRange'

function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

function formatDisplayDateTime(raw) {
  if (raw == null || raw === '') return null
  const t = new Date(raw)
  if (!Number.isNaN(t.getTime())) {
    return t.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
  }
  return String(raw)
}

const SCORE_LABEL_AR = {
  up: 'إيجابي (≥4)',
  mid: 'متوسط (3–3.9)',
  down: 'ضعيف (<3)',
}

export default function SatisfactionReport() {
  const { user } = useAuth()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const initRange = defaultCalendarMonthYmd()
  const [dateFrom, setDateFrom] = useState(initRange.from)
  const [dateTo, setDateTo] = useState(initRange.to)

  const fetchReport = useCallback(async (from, to) => {
    setLoading(true)
    setError(null)
    if (!isValidYmdRange(from, to)) {
      setError('حدّد تاريخاً من وإلى بشكل صحيح (من ≤ إلى).')
      setLoading(false)
      return
    }
    try {
      const r = await getSatisfactionStats({ detail: true, from, to })
      if (r?.success) {
        setData(r)
      } else {
        setData(null)
        setError(r?.hint || r?.error || 'تعذر جلب التقرير')
      }
    } catch (e) {
      setData(null)
      setError(e?.message || 'خطأ في الشبكة')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role !== 'executive') return
    const { from, to } = defaultCalendarMonthYmd()
    setDateFrom(from)
    setDateTo(to)
    fetchReport(from, to)
  }, [user?.role, fetchReport])

  const rows = useMemo(() => (Array.isArray(data?.csat_report_rows) ? data.csat_report_rows : []), [data])

  function downloadCsv() {
    if (!data || rows.length === 0) return
    const headers = [
      'معرّف الاستبيان',
      'رقم المتجر',
      'تاريخ الإرسال',
      'متوسط 1–5',
      'التصنيف',
      'المُدخل',
      'q1',
      'q2',
      'q3',
      'q4',
      'q5',
      'q6',
    ]
    const lines = [headers.join(',')]
    for (const r of rows) {
      lines.push([
        csvEscape(r.survey_id),
        csvEscape(r.store_id),
        csvEscape(r.created_at),
        csvEscape(r.avg_1_to_5),
        csvEscape(r.satisfaction_score),
        csvEscape(r.performed_by),
        csvEscape(r.q1_delivery),
        csvEscape(r.q2_collection),
        csvEscape(r.q3_support),
        csvEscape(r.q4_app),
        csvEscape(r.q5_payments),
        csvEscape(r.q6_returns),
      ].join(','))
    }
    const bom = '\uFEFF'
    const blob = new Blob([bom + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    const safeLabel = (data.month_label || 'period').replace(/[/\\?%*:|"<>]/g, '-')
    a.download = `تقرير-الرضا-${safeLabel}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  function printPage() {
    window.print()
  }

  if (user?.role !== 'executive') {
    return null
  }

  const monthLabel = data?.month_label || '—'
  const calls = data?.calls_logged
  const csatN = data?.csat_surveys
  const avg = data?.csat_avg_1_to_5
  const satPct = data?.csat_satisfaction_percent
  const posPct = data?.csat_positive_percent
  const cov = data?.survey_coverage_percent
  const counts = data?.csat_score_counts
  const onbN = data?.onboarding_surveys
  const onbAvg = data?.onboarding_avg_1_to_5
  const onbPct = data?.onboarding_satisfaction_percent

  return (
    <div className="space-y-5 pb-10" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-rose-200/80 bg-gradient-to-l from-rose-50/90 to-white px-5 py-4 shadow-sm print:shadow-none print:border-0"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white shadow-lg shadow-rose-600/25 print:hidden">
              <HeartHandshake size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">تقرير معدل الرضا</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                مكالمات مسجّلة في الفترة <span className="font-semibold text-slate-800">{monthLabel}</span>
                {' — '}واستبيانات رضا العملاء (نشط) مع متوسط التقييم 1–5 ونسبة الإيجابية.
                {' '}التغطية = استبيانات CSAT ÷ المكالمات. الفترة بتوقيت الرياض.
              </p>
              {data?.generated_at && (
                <p className="text-[11px] text-slate-400 mt-1">
                  توليد التقرير: {new Date(data.generated_at).toLocaleString('ar-SA')}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-2 print:hidden w-full max-w-xl">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <CalendarRange size={14} />
                من
              </span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 tabular-nums"
              />
              <span className="text-xs font-semibold text-slate-500">إلى</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-800 tabular-nums"
              />
              <button
                type="button"
                onClick={() => fetchReport(dateFrom, dateTo)}
                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
              >
                تطبيق
              </button>
              <button
                type="button"
                onClick={() => {
                  const { from, to } = defaultCalendarMonthYmd()
                  setDateFrom(from)
                  setDateTo(to)
                  fetchReport(from, to)
                }}
                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-xs font-semibold text-rose-900"
              >
                الشهر الحالي
              </button>
            </div>
            <div className="flex flex-wrap gap-2 justify-end">
              <Link
                to="/staff-performance/stats"
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                <BarChart3 size={14} />
                الإحصائيات
              </Link>
              <button
                type="button"
                onClick={() => fetchReport(dateFrom, dateTo)}
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
        </div>
      </motion.div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-xl px-4 py-3">{error}</p>
      )}

      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-sm print:shadow-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1">
              <Phone size={14} className="text-slate-500" />
              مكالمات مسجّلة
            </p>
            <p className="text-2xl font-black tabular-nums text-slate-900">
              {loading ? '…' : typeof calls === 'number' ? calls.toLocaleString('ar-SA') : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">من سجلّ المكالمات (كل الأنواع) في الفترة</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">استبيانات رضا (نشط)</p>
            <p className="text-2xl font-black tabular-nums text-rose-900">
              {loading ? '…' : typeof csatN === 'number' ? csatN.toLocaleString('ar-SA') : '—'}
            </p>
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">متوسط التقييم (1–5)</p>
            <p className="text-2xl font-black tabular-nums text-violet-800">
              {loading ? '…' : avg != null ? avg.toLocaleString('ar-SA', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">
              متوسط وسيط لكل استبيان (متوسط الستة أسئلة)
            </p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">نسبة الرضا (مقياس 100)</p>
            <p className="text-2xl font-black tabular-nums text-emerald-800">
              {loading ? '…' : satPct != null ? `${satPct.toLocaleString('ar-SA')}%` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">متوسط 1–5 معادَل إلى 100 (×20)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-amber-100 bg-amber-50/30 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">نسبة الاستبيانات الإيجابية</p>
            <p className="text-xl font-black tabular-nums text-amber-900">
              {loading ? '…' : posPct != null ? `${posPct.toLocaleString('ar-SA')}%` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">حيث متوسط الستة أسئلة ≥ 4 (تصنيف الخادم: up)</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/30 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">تغطية الاستبيان</p>
            <p className="text-xl font-black tabular-nums text-sky-900">
              {loading ? '…' : cov != null ? `${cov.toLocaleString('ar-SA')}%` : '—'}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">استبيانات CSAT ÷ المكالمات (إن وُجدت مكالمات)</p>
          </div>
          <div className="rounded-xl border border-fuchsia-100 bg-fuchsia-50/30 p-4">
            <p className="text-xs font-bold text-slate-600 mb-1">تهيئة متجر جديد (منفصل)</p>
            <p className="text-sm font-bold text-fuchsia-950">
              {loading
                ? '…'
                : `${typeof onbN === 'number' ? onbN.toLocaleString('ar-SA') : '—'} استبيان`}
            </p>
            <p className="text-lg font-black tabular-nums text-fuchsia-900 mt-0.5">
              متوسط {onbAvg != null ? onbAvg.toLocaleString('ar-SA') : '—'} / 5
              {onbPct != null ? ` ≈ ${onbPct.toLocaleString('ar-SA')}%` : ''}
            </p>
            <p className="text-[10px] text-slate-500 mt-1">أول ثلاثة أسئلة فقط — مسار مختلف عن CSAT النشط</p>
          </div>
        </div>

        {counts && (counts.up > 0 || counts.mid > 0 || counts.down > 0) && (
          <div className="flex flex-wrap gap-3 mb-6 text-sm">
            <span className="rounded-lg bg-emerald-50 px-3 py-1 border border-emerald-100">
              إيجابي: <strong className="tabular-nums">{Number(counts.up).toLocaleString('ar-SA')}</strong>
            </span>
            <span className="rounded-lg bg-amber-50 px-3 py-1 border border-amber-100">
              متوسط: <strong className="tabular-nums">{Number(counts.mid).toLocaleString('ar-SA')}</strong>
            </span>
            <span className="rounded-lg bg-red-50 px-3 py-1 border border-red-100">
              ضعيف: <strong className="tabular-nums">{Number(counts.down).toLocaleString('ar-SA')}</strong>
            </span>
          </div>
        )}

        {data?.rule && (
          <p className="text-xs text-slate-500 mb-4 border-b border-slate-100 pb-4">{data.rule}</p>
        )}

        {loading ? (
          <p className="text-slate-500 text-sm">جارٍ التحميل…</p>
        ) : rows.length === 0 ? (
          <p className="text-slate-500 text-sm">لا توجد صفوف تفصيلية لاستبيانات النشط في هذه الفترة.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100 -mx-1 print:overflow-visible">
            <table className="w-full text-sm text-right min-w-[800px]">
              <thead>
                <tr className="bg-slate-50 text-xs font-bold text-slate-600 border-b border-slate-100">
                  <th className="px-3 py-2.5 whitespace-nowrap">المتجر</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">التاريخ</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">متوسط</th>
                  <th className="px-3 py-2.5 whitespace-nowrap">التصنيف</th>
                  <th className="px-3 py-2.5 min-w-[100px]">المُدخل</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={`${r.survey_id}-${i}`}
                    className="border-b border-slate-50 hover:bg-slate-50/50 print:bg-white"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-slate-800">{r.store_id ?? '—'}</td>
                    <td className="px-3 py-2 text-xs text-slate-700 whitespace-nowrap">
                      {formatDisplayDateTime(r.created_at) ?? r.created_at ?? '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums font-bold text-slate-900">{r.avg_1_to_5 ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">
                      {r.satisfaction_score
                        ? (SCORE_LABEL_AR[r.satisfaction_score] || r.satisfaction_score)
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 truncate max-w-[140px]" title={r.performed_by}>
                      {r.performed_by || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed border-t border-slate-100 pt-3">
          لا تُحتسب ملاحظات «متجر غير نشط» النصية ضمن متوسط الرضا. استبيان تهيئة المتجر الجديد يُعرض ملخصاً منفرداً
          أعلاه.
        </p>
        <p className="text-[11px] text-slate-400 mt-4 print:hidden">
          <Link to="/staff-performance/conversion-report" className="inline-flex items-center gap-1 text-violet-600 font-semibold hover:underline">
            <ArrowRight size={12} className="rotate-180" />
            تقرير نسبة التحويل
          </Link>
        </p>
      </div>
    </div>
  )
}
