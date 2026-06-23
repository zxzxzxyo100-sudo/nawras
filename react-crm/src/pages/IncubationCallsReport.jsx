import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Baby, CalendarRange, Download, FileSpreadsheet, Phone, PhoneCall,
  RefreshCw, TrendingUp, Users,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getIncubationCallsReport } from '../services/api'
import { defaultCalendarMonthYmd, isValidYmdRange } from '../utils/statsDateRange'

// ── مساعدات ─────────────────────────────────────────────────────────────────

function fmtDateTime(raw) {
  if (!raw) return '—'
  const t = new Date(raw)
  if (!Number.isNaN(t.getTime()))
    return t.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
  return String(raw)
}

function csvEscape(s) {
  const t = String(s ?? '')
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`
  return t
}

const OUTCOME_LABEL = {
  answered:     'تم الرد',
  no_answer:    'لم يرد',
  busy:         'مشغول',
  callback:     'طلب معاودة',
  wrong_number: 'رقم خاطئ',
  '':           'غير محدد',
}
function outcomeLabel(o) { return OUTCOME_LABEL[o] ?? o }

const CALL_COLORS = {
  inc_call1: { bg: 'bg-blue-50',   ring: 'ring-blue-200',   text: 'text-blue-700',   icon: Baby,      iconColor: 'text-blue-500'  },
  inc_call2: { bg: 'bg-indigo-50', ring: 'ring-indigo-200', text: 'text-indigo-700', icon: Phone,     iconColor: 'text-indigo-500' },
  inc_call3: { bg: 'bg-amber-50',  ring: 'ring-amber-200',  text: 'text-amber-800',  icon: PhoneCall, iconColor: 'text-amber-500'  },
}

// ── بطاقة ملخص مكالمة ───────────────────────────────────────────────────────

function CallSummaryCard({ item, active, onClick }) {
  const c   = CALL_COLORS[item.call_type] || CALL_COLORS.inc_call1
  const Icon = c.icon
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-right rounded-2xl p-4 border-2 transition-all shadow-sm hover:shadow-md
        ${active
          ? `${c.bg} ${c.ring.replace('ring', 'border')} shadow-md`
          : 'bg-white border-slate-200 hover:border-slate-300'
        }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={`rounded-xl p-2.5 ${c.bg}`}>
          <Icon size={20} className={c.iconColor} />
        </div>
        <div className="flex-1 min-w-0">
          <div className={`text-xs font-bold mb-0.5 ${c.text}`}>{item.label}</div>
          <div className="text-2xl font-black text-slate-900 tabular-nums leading-none">
            {item.total.toLocaleString('ar-SA')}
          </div>
          <div className="text-xs text-slate-500 mt-1">مكالمة مسجّلة</div>
        </div>
      </div>
      <div className="mt-3 flex gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1 rounded-lg bg-green-50 border border-green-200 text-green-800 text-[11px] font-semibold px-2 py-0.5">
          تم الرد: {item.answered.toLocaleString('ar-SA')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 border border-red-200 text-red-800 text-[11px] font-semibold px-2 py-0.5">
          لم يرد: {item.no_answer.toLocaleString('ar-SA')}
        </span>
        <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold px-2 py-0.5">
          نسبة الرد: {item.answer_rate}%
        </span>
      </div>
    </button>
  )
}

// ── جدول الموظفين ────────────────────────────────────────────────────────────

function StaffTable({ staff }) {
  if (!staff || staff.length === 0)
    return <div className="text-slate-400 text-sm text-center py-8">لا توجد بيانات</div>
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
            <th className="px-4 py-3">الموظف</th>
            <th className="px-4 py-3 tabular-nums">الإجمالي</th>
            <th className="px-4 py-3 tabular-nums">تم الرد</th>
            <th className="px-4 py-3 tabular-nums">لم يرد</th>
            <th className="px-4 py-3 tabular-nums">نسبة الرد</th>
          </tr>
        </thead>
        <tbody>
          {staff.map((s, i) => (
            <tr
              key={s.name}
              className={`border-b border-slate-100 transition-colors ${i % 2 === 0 ? 'bg-white' : 'bg-slate-50/60'}`}
            >
              <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
              <td className="px-4 py-3 tabular-nums font-bold text-slate-900">{s.total.toLocaleString('ar-SA')}</td>
              <td className="px-4 py-3 tabular-nums text-green-700 font-semibold">{s.answered.toLocaleString('ar-SA')}</td>
              <td className="px-4 py-3 tabular-nums text-red-700 font-semibold">{s.no_answer.toLocaleString('ar-SA')}</td>
              <td className="px-4 py-3 tabular-nums">
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden max-w-[80px]">
                    <div
                      className="h-full bg-green-500 rounded-full transition-all"
                      style={{ width: `${Math.min(100, s.answer_rate)}%` }}
                    />
                  </div>
                  <span className="font-bold text-slate-700">{s.answer_rate}%</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── جدول النتائج ─────────────────────────────────────────────────────────────

function OutcomesTable({ outcomes }) {
  if (!outcomes || outcomes.length === 0)
    return <div className="text-slate-400 text-sm text-center py-4">لا توجد بيانات</div>
  return (
    <div className="space-y-1.5">
      {outcomes.map(o => (
        <div key={o.outcome} className="flex items-center justify-between gap-2 text-sm">
          <span className="text-slate-700">{outcomeLabel(o.outcome)}</span>
          <span className="tabular-nums font-bold text-slate-900">{o.count.toLocaleString('ar-SA')}</span>
        </div>
      ))}
    </div>
  )
}

// ── جدول التفاصيل ────────────────────────────────────────────────────────────

const TYPE_LABEL = { inc_call1: 'م. الأولى', inc_call2: 'م. الثانية', inc_call3: 'م. الثالثة' }

function DetailTable({ rows }) {
  if (!rows || rows.length === 0)
    return <div className="text-slate-400 text-sm text-center py-10">لا توجد سجلات في هذه الفترة</div>
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-inner">
      <table className="w-full text-sm" dir="rtl">
        <thead>
          <tr className="bg-slate-50 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
            <th className="px-4 py-3">التاريخ</th>
            <th className="px-4 py-3">المتجر</th>
            <th className="px-4 py-3">النوع</th>
            <th className="px-4 py-3">النتيجة</th>
            <th className="px-4 py-3">الموظف</th>
            <th className="px-4 py-3">ملاحظة</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id} className="border-b border-slate-100 hover:bg-amber-50/40 transition-colors">
              <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">{fmtDateTime(r.created_at)}</td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-800">{r.store_name || '—'}</div>
                <div className="text-xs text-slate-500 font-mono">{r.store_id}</div>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border
                  ${r.call_type === 'inc_call1' ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : r.call_type === 'inc_call2' ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                    : 'bg-amber-50 text-amber-800 border-amber-200'}`}
                >
                  {TYPE_LABEL[r.call_type] || r.call_type}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg border
                  ${r.outcome === 'answered' ? 'bg-green-50 text-green-800 border-green-200'
                    : r.outcome === 'no_answer' || r.outcome === 'busy' ? 'bg-red-50 text-red-800 border-red-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'}`}
                >
                  {outcomeLabel(r.outcome)}
                </span>
              </td>
              <td className="px-4 py-3 text-slate-700 text-xs">{r.performed_by || '—'}</td>
              <td className="px-4 py-3 text-slate-500 text-xs max-w-[200px] truncate" title={r.note}>{r.note || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════════════════════════════

export default function IncubationCallsReport() {
  const { user } = useAuth()
  const initRange = defaultCalendarMonthYmd()
  const [fromDate, setFromDate] = useState(initRange.from)
  const [toDate,   setToDate]   = useState(initRange.to)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [data,     setData]     = useState(null)
  const [activeTab, setActiveTab] = useState('inc_call1')

  const fetchReport = useCallback(async (from, to) => {
    setLoading(true)
    setError('')
    if (!isValidYmdRange(from, to)) {
      setError('حدّد تاريخاً صحيحاً: من ≤ إلى.')
      setLoading(false)
      return
    }
    try {
      const r = await getIncubationCallsReport({ from, to })
      if (!r?.success) {
        setError(r?.error || 'تعذّر تحميل التقرير.')
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

  function setThisMonth() {
    const { from, to } = defaultCalendarMonthYmd()
    setFromDate(from)
    setToDate(to)
    fetchReport(from, to)
  }

  const summary = useMemo(() => (Array.isArray(data?.summary) ? data.summary : []), [data])
  const rows    = useMemo(() => (Array.isArray(data?.rows)    ? data.rows    : []), [data])

  const activeItem = useMemo(
    () => summary.find(s => s.call_type === activeTab) ?? null,
    [summary, activeTab]
  )

  const filteredRows = useMemo(
    () => rows.filter(r => r.call_type === activeTab),
    [rows, activeTab]
  )

  // ── تحميل CSV ──────────────────────────────────────────────────────────────
  function downloadCsv() {
    if (!rows.length) return
    const headers = ['التاريخ', 'رقم المتجر', 'اسم المتجر', 'نوع المكالمة', 'النتيجة', 'الموظف', 'ملاحظة']
    const lines = ['\uFEFF' + headers.join(',')]
    for (const r of rows) {
      lines.push([
        csvEscape(fmtDateTime(r.created_at)),
        csvEscape(r.store_id),
        csvEscape(r.store_name),
        csvEscape(TYPE_LABEL[r.call_type] || r.call_type),
        csvEscape(outcomeLabel(r.outcome)),
        csvEscape(r.performed_by),
        csvEscape(r.note),
      ].join(','))
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `incubation-calls-${fromDate}-${toDate}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (user?.role !== 'executive') return null

  return (
    <div className="space-y-5 pb-8" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ── رأس الصفحة ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-violet-200/80 bg-gradient-to-l from-violet-50/90 to-white px-5 py-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
              <Baby size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">تقرير مكالمات الاحتضان</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                إحصائيات المكالمة <span className="font-semibold">الأولى</span> و<span className="font-semibold">الثانية</span> و<span className="font-semibold">الثالثة</span> — عدد المكالمات، نسبة الرد، وأداء الموظفين خلال الفترة المختارة.
              </p>
            </div>
          </div>

          {/* ── فلتر التاريخ ─────────────────────────────────────────────── */}
          <div className="flex flex-col items-stretch sm:items-end gap-2 w-full sm:w-auto min-w-[min(100%,320px)]">
            <div className="flex flex-wrap items-center gap-2 justify-end">
              <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                <CalendarRange size={14} /> من
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
              />
              <span className="text-xs font-semibold text-slate-500">إلى</span>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 shadow-sm focus:ring-2 focus:ring-violet-300 focus:border-violet-400 outline-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={setThisMonth}
                className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
              >
                هذا الشهر
              </button>
              <button
                type="button"
                onClick={() => fetchReport(fromDate, toDate)}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                تحديث
              </button>
              <button
                type="button"
                onClick={downloadCsv}
                disabled={!rows.length}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-40"
              >
                <Download size={13} />
                CSV
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── خطأ ────────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm">
          {error}
        </div>
      )}

      {/* ── بطاقات الملخص ──────────────────────────────────────────────────── */}
      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-16 text-center text-slate-500">
          <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-violet-500" />
          <div className="text-sm">جاري تحميل البيانات...</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {summary.map(item => (
              <CallSummaryCard
                key={item.call_type}
                item={item}
                active={activeTab === item.call_type}
                onClick={() => setActiveTab(item.call_type)}
              />
            ))}
          </div>

          {/* ── تفصيل المكالمة المختارة ──────────────────────────────────── */}
          {activeItem && (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* عنوان القسم */}
              <div className="flex items-center gap-2 px-1">
                <Users size={16} className="text-violet-500" />
                <span className="font-bold text-slate-800">
                  أداء الموظفين — {activeItem.label}
                </span>
                <span className="text-xs text-slate-500">
                  ({activeItem.total.toLocaleString('ar-SA')} مكالمة إجمالاً)
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* جدول الموظفين */}
                <div className="lg:col-span-2 rounded-3xl bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-100/80 p-2 sm:p-3 shadow-lg border border-slate-200/80">
                  <StaffTable staff={activeItem.staff} />
                </div>

                {/* توزيع النتائج */}
                <div className="rounded-2xl bg-white border border-slate-200 shadow-sm p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp size={15} className="text-violet-500" />
                    <span className="text-sm font-bold text-slate-800">توزيع النتائج</span>
                  </div>
                  <OutcomesTable outcomes={activeItem.outcomes} />
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between text-sm font-bold">
                      <span className="text-slate-600">نسبة الرد الإجمالية</span>
                      <span className="text-green-700">{activeItem.answer_rate}%</span>
                    </div>
                    <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, activeItem.answer_rate)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* سجلات التفاصيل */}
              <div className="flex items-center gap-2 px-1 mt-2">
                <FileSpreadsheet size={15} className="text-slate-500" />
                <span className="font-bold text-slate-700 text-sm">
                  السجلات التفصيلية — {activeItem.label}
                </span>
                <span className="text-xs text-slate-400">
                  (آخر {filteredRows.length} إدخال)
                </span>
              </div>
              <div className="rounded-3xl bg-gradient-to-br from-slate-50 via-violet-50/20 to-slate-100/80 p-2 sm:p-3 shadow-lg border border-slate-200/80">
                <DetailTable rows={filteredRows} />
              </div>
            </motion.div>
          )}
        </>
      )}
    </div>
  )
}
