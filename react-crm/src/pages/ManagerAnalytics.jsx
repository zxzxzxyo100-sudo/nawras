import { useState, useEffect, useMemo, useCallback } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  ReferenceLine,
} from 'recharts'
import {
  BarChart3, TrendingUp, TrendingDown, Minus, RefreshCw, ShieldAlert, Loader2, CheckCircle2, Circle,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getManagerAnalytics } from '../services/api'

function csatColorClass(v) {
  if (v == null || Number.isNaN(v)) return 'text-slate-500'
  if (v > 4.5) return 'text-emerald-600'
  if (v >= 3.0) return 'text-amber-600'
  return 'text-red-600'
}

function csatBgClass(v) {
  if (v == null || Number.isNaN(v)) return 'from-slate-500/10 to-slate-600/5'
  if (v > 4.5) return 'from-emerald-500/15 to-emerald-600/5'
  if (v >= 3.0) return 'from-amber-500/15 to-amber-600/5'
  return 'from-red-500/15 to-red-600/5'
}

function TrendDelta({ current, previous, suffix = '', isPercent = false }) {
  if (current == null || previous == null) {
    return <span className="text-xs text-slate-400">لا بيانات كافية</span>
  }
  const d = current - previous
  if (Math.abs(d) < 0.0001) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Minus size={12} /> بدون تغيير
      </span>
    )
  }
  const up = d > 0
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-bold ${up ? 'text-emerald-600' : 'text-rose-600'}`}>
      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
      {up ? '+' : ''}
      {isPercent ? d.toFixed(2) : d.toFixed(3)}
      {suffix}
      <span className="text-slate-400 font-normal">مقارنة بالأمس</span>
    </span>
  )
}

export default function ManagerAnalytics() {
  const { user, can } = useAuth()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [period, setPeriod] = useState('yearly')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!user || user.role !== 'executive') return
    setLoading(true)
    setError('')
    try {
      const res = await getManagerAnalytics({
        year,
        period,
        user_role: user.role,
      })
      if (!res.success) throw new Error(res.error || 'فشل التحميل')
      setData(res)
    } catch (e) {
      setError(e.response?.data?.error || e.message || 'خطأ')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [user, year, period])

  useEffect(() => {
    load()
  }, [load])

  if (!can('manager_analytics')) {
    return <Navigate to="/" replace />
  }

  const kpis = data?.kpis
  const months = data?.months ?? []
  const quarters = data?.quarters ?? []

  const chartData = useMemo(() => {
    if (period === 'quarterly' && quarters.length) {
      return quarters.map(q => ({
        name: q.label,
        conversion: q.conversion_rate,
        recovery: q.recovery_rate,
        csat: q.csat_avg,
      }))
    }
    return months.map(m => ({
      name: m.month_label,
      conversion: m.conversion_rate,
      recovery: m.recovery_rate,
      csat: m.csat_avg,
    }))
  }, [months, quarters, period])

  const csatTrendData = useMemo(
    () => months.map(m => ({ name: m.month_label, csat: m.csat_avg })),
    [months],
  )

  const years = useMemo(() => {
    const y = new Date().getFullYear()
    return [y - 1, y, y + 1]
  }, [])

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-10" dir="rtl">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 flex items-center justify-center shadow-lg">
            <BarChart3 size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 flex items-center gap-2">
              تحليلات المدير
              <ShieldAlert size={18} className="text-violet-500" title="مدير تنفيذي فقط" />
            </h1>
            <p className="text-sm text-slate-600 mt-0.5">
              مؤشرات الأداء والرضا — بيانات من الاستبيانات وNawris (قد يستغرق التحميل عدة ثوانٍ).
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            {years.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={period}
            onChange={e => setPeriod(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-800"
          >
            <option value="yearly">شهري (السنة)</option>
            <option value="quarterly">ربعي</option>
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm">{error}</div>
      )}

      {loading && !data ? (
        <div className="flex justify-center py-24 text-slate-500">
          <Loader2 size={36} className="animate-spin" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-2xl border border-slate-200/80 p-5 bg-gradient-to-br from-slate-50 to-white shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">معدل التحويل اليومي</p>
              <p className="text-3xl font-black text-slate-900 mt-1 tabular-nums">
                {kpis?.daily_conversion_rate != null ? `${kpis.daily_conversion_rate}%` : '—'}
              </p>
              <TrendDelta
                current={kpis?.daily_conversion_rate}
                previous={kpis?.daily_conversion_rate_yesterday}
                suffix="%"
                isPercent
              />
              <p className="text-[11px] text-slate-500 mt-2">
                تسجيلات اليوم: {kpis?.registrations_today ?? 0}
              </p>
            </div>

            <div
              className={`rounded-2xl border border-slate-200/80 p-5 bg-gradient-to-br ${csatBgClass(kpis?.daily_csat)} shadow-sm`}
            >
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">CSAT اليومي</p>
              <p className={`text-3xl font-black mt-1 tabular-nums ${csatColorClass(kpis?.daily_csat)}`}>
                {kpis?.daily_csat != null ? kpis.daily_csat.toFixed(2) : '—'}
                <span className="text-base font-bold text-slate-400 mr-1">/5</span>
              </p>
              <TrendDelta current={kpis?.daily_csat} previous={kpis?.daily_csat_yesterday} />
            </div>

            <div className="rounded-2xl border border-violet-200/80 p-5 bg-gradient-to-br from-violet-50 to-white shadow-sm">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">معدل الاستعادة (الشهر الحالي)</p>
              <p className="text-3xl font-black text-violet-800 mt-1 tabular-nums">
                {kpis?.monthly_recovery_rate != null ? `${kpis.monthly_recovery_rate}%` : '—'}
              </p>
              <p className="text-[11px] text-slate-600 mt-2">
                مجمّدون في النظام: {kpis?.frozen_stores_total ?? 0} — نشط شحن هذا الشهر: {kpis?.frozen_reactivated_this_month ?? 0}
              </p>
            </div>
          </div>

          {Array.isArray(data?.inactive_recovery_daily) && data.inactive_recovery_daily.length > 0 && (
            <div className="rounded-2xl border border-amber-200/90 bg-gradient-to-br from-amber-50/80 to-white p-4 lg:p-6 shadow-sm">
              <h2 className="text-sm font-black text-slate-800 mb-1 flex items-center gap-2">
                مسؤولو الاستعادة — هدف الاتصالات اليومي
                <span className="text-xs font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                  {data.inactive_daily_target ?? 50} / يوم
                </span>
              </h2>
              <p className="text-xs text-slate-600 mb-4">
                علامة صح عند بلوغ هدف اليوم (مزامنة من الخادم).
              </p>
              <ul className="flex flex-wrap gap-3">
                {data.inactive_recovery_daily.map(row => (
                  <li
                    key={row.username}
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm"
                  >
                    {row.daily_goal_met ? (
                      <CheckCircle2 size={18} className="text-emerald-600 shrink-0" aria-hidden />
                    ) : (
                      <Circle size={18} className="text-slate-300 shrink-0" aria-hidden />
                    )}
                    <span className="font-semibold text-slate-800">{row.fullname || row.username}</span>
                    <span className="text-xs text-slate-500 tabular-nums">
                      ({row.successful_contacts ?? 0}/{data.inactive_daily_target ?? 50})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-800 mb-4">مقارنة الأداء الشهرية — التحويل % vs الاستعادة %</h2>
            <div className="h-80 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" domain={[0, 100]} tick={{ fontSize: 11 }} label={{ value: '%', position: 'insideLeft' }} />
                  <Tooltip
                    contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: 12 }}
                    formatter={(value, name) => [
                      value != null ? `${Number(value).toFixed(1)}%` : '—',
                      name === 'conversion' ? 'تحويل' : 'استعادة',
                    ]}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="conversion" name="conversion" fill="#8b5cf6" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  <Line yAxisId="left" type="monotone" dataKey="recovery" name="recovery" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-4 lg:p-6 shadow-sm">
            <h2 className="text-sm font-black text-slate-800 mb-1">اتجاه CSAT الشهري</h2>
            <p className="text-xs text-slate-500 mb-4">متوسط 1–5 — أخضر فوق 4.5، أصفر 3–4.4، أحمر تحت 3</p>
            <div className="h-72 w-full" dir="ltr">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={csatTrendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis domain={[1, 5]} tick={{ fontSize: 11 }} />
                  <ReferenceLine y={4.5} stroke="#10b981" strokeDasharray="4 4" />
                  <ReferenceLine y={3} stroke="#f59e0b" strokeDasharray="4 4" />
                  <Tooltip
                    contentStyle={{ direction: 'rtl', textAlign: 'right', borderRadius: 12 }}
                    formatter={v => [v != null ? Number(v).toFixed(2) : '—', 'CSAT']}
                  />
                  <Line
                    type="monotone"
                    dataKey="csat"
                    stroke="#6366f1"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {data?.notes && (
            <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3 text-[11px] text-slate-600 space-y-1">
              <p><strong>التحويل:</strong> {data.notes.conversion}</p>
              <p><strong>الاستعادة:</strong> {data.notes.recovery}</p>
              <p><strong>CSAT:</strong> {data.notes.csat}</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
