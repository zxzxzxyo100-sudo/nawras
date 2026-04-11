import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, RefreshCw, Target, Users } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getExecutiveStaffGoals } from '../services/api'

const ROLE_ORDER = { active_manager: 0, inactive_manager: 1, incubation_manager: 2 }

export default function ExecutiveStaffPerformance() {
  const { user } = useAuth()
  const [rows, setRows] = useState([])
  const [targets, setTargets] = useState(null)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setErr('')
    setLoading(true)
    try {
      const r = await getExecutiveStaffGoals()
      if (!r?.success) {
        setErr(r?.error || 'تعذّر التحميل')
        setRows([])
        return
      }
      const list = Array.isArray(r.data) ? [...r.data] : []
      list.sort((a, b) => {
        const ra = ROLE_ORDER[a.role] ?? 9
        const rb = ROLE_ORDER[b.role] ?? 9
        if (ra !== rb) return ra - rb
        return String(a.username || '').localeCompare(String(b.username || ''), 'ar')
      })
      setRows(list)
      setTargets(r.targets || null)
      setNote(typeof r.note_ar === 'string' ? r.note_ar : '')
    } catch (e) {
      setErr(e?.message || 'خطأ في الشبكة')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user?.role === 'executive') load()
  }, [user?.role, load])

  if (user?.role !== 'executive') {
    return null
  }

  return (
    <div className="space-y-5 pb-8" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-violet-200/80 bg-gradient-to-l from-violet-50/90 to-white px-5 py-4 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-lg shadow-violet-600/25">
              <BarChart2 size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">أداء الفريق — أهداف اليوم</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                حسب طبيعة عمل كل موظف: نشط (منجز يومي)، استعادة (تم التواصل)، احتضان (إجمالي تراكمي لمكالمات المسار 1–3).
              </p>
              {note && <p className="text-xs text-slate-500 mt-2 max-w-3xl leading-relaxed">{note}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </motion.div>

      {targets && (
        <div className="flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
            <Target size={12} /> نشط: {targets.active_daily} / يوم
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
            استعادة: {targets.inactive_daily} / يوم
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1">
            احتضان: إجمالي تراكمي مقابل هدف {targets.incubation_daily}
          </span>
        </div>
      )}

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}

      {loading && rows.length === 0 && !err ? (
        <div className="flex justify-center py-20">
          <div className="h-10 w-10 rounded-full border-2 border-violet-200 border-t-violet-600 animate-spin" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <table className="min-w-full text-sm text-right">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/90">
                <th className="px-4 py-3 font-bold text-slate-700">الموظف</th>
                <th className="px-4 py-3 font-bold text-slate-700">الدور</th>
                <th className="px-4 py-3 font-bold text-slate-700">المؤشر</th>
                <th className="px-4 py-3 font-bold text-slate-700 w-48">التقدّم</th>
                <th className="px-4 py-3 font-bold text-slate-700 tabular-nums">الإنجاز / الهدف</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {rows.map(row => (
                <tr key={row.username} className="hover:bg-violet-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    <span className="flex items-center gap-2">
                      <Users size={14} className="text-violet-500 shrink-0" />
                      {row.fullname || row.username}
                    </span>
                    <span className="text-xs text-slate-400 font-mono mt-0.5 block">{row.username}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{row.role_label_ar}</td>
                  <td className="px-4 py-3 text-slate-600 text-xs">
                    {row.metric_key === 'active_completed_today' && 'متاجر منجزة (متابعة دورية) اليوم'}
                    {row.metric_key === 'inactive_success_today' && 'اتصالات ناجحة (تم التواصل) اليوم'}
                    {(row.metric_key === 'incubation_calls_total' || row.metric_key === 'incubation_calls_today') &&
                      'إجمالي مكالمات احتضان (1–3) — تراكمي'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-2.5 w-full max-w-[200px] rounded-full bg-slate-100 overflow-hidden mr-auto">
                      <div
                        className={`h-full rounded-full transition-all ${
                          row.goal_met ? 'bg-emerald-500' : 'bg-violet-500'
                        }`}
                        style={{ width: `${Math.min(100, row.pct)}%` }}
                      />
                    </div>
                  </td>
                  <td className="px-4 py-3 tabular-nums font-bold text-slate-900">
                    {row.done_today} / {row.target}
                    {row.goal_met && (
                      <span className="mr-2 text-emerald-600 text-xs font-black">✓ هدف</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && !loading && (
            <div className="py-12 text-center text-slate-500 text-sm">لا يوجد موظفون ضمن الأدوار المعروضة.</div>
          )}
        </div>
      )}
    </div>
  )
}
