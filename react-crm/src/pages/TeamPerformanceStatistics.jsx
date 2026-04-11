import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart3, ArrowLeftRight, Activity, Snowflake, RefreshCw,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getDashboardTransitionStats } from '../services/api'

export default function TeamPerformanceStatistics() {
  const { user } = useAuth()
  const [transitionStats, setTransitionStats] = useState({
    newToIncubating: null,
    auditNewToInc: null,
    incubatingToActive: null,
    frozen: null,
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getDashboardTransitionStats()
      if (r?.success) {
        setTransitionStats({
          newToIncubating: typeof r.count === 'number' ? r.count : 0,
          auditNewToInc: typeof r.count_from_audit_logs === 'number' ? r.count_from_audit_logs : null,
          incubatingToActive: typeof r.incubating_to_active_pending_month === 'number'
            ? r.incubating_to_active_pending_month
            : null,
          frozen: typeof r.frozen_month === 'number' ? r.frozen_month : null,
        })
      } else {
        setTransitionStats({
          newToIncubating: 0,
          auditNewToInc: null,
          incubatingToActive: null,
          frozen: null,
        })
      }
    } catch {
      setTransitionStats({
        newToIncubating: 0,
        auditNewToInc: null,
        incubatingToActive: null,
        frozen: null,
      })
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

  const nInc = transitionStats.newToIncubating
  const nAct = transitionStats.incubatingToActive
  const combinedNewIncActive =
    (typeof nInc === 'number' ? nInc : 0) + (typeof nAct === 'number' ? nAct : 0)
  const showCombined =
    transitionStats.newToIncubating != null || transitionStats.incubatingToActive != null

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
              <BarChart3 size={22} strokeWidth={2.2} />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">الإحصائيات</h1>
              <p className="text-sm text-slate-600 mt-0.5">
                ضمن <span className="font-semibold">أداء الفريق</span>
                {' — '}مسار <span className="font-semibold text-slate-800">جديد → تحت الاحتضان → النشط</span>
                {' '}خلال الشهر الحالي (تقريب دخول الاحتضان وتخريج إلى نشط قيد المكالمة من السجل).
              </p>
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

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-sm"
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-emerald-50/40 p-4 lg:col-span-2">
            <div className="flex items-center gap-2 text-violet-800 mb-2">
              <ArrowLeftRight size={18} />
              <span className="text-sm font-black">جديد → تحت الاحتضان + النشط</span>
            </div>
            <p className="text-4xl font-black tabular-nums text-slate-900 leading-tight">
              {!showCombined ? '…' : Number(combinedNewIncActive).toLocaleString('ar-SA')}
            </p>
            <p className="text-xs font-semibold text-slate-600 mt-2">المجموع (الشهر الحالي)</p>
            <div className="mt-4 grid grid-cols-1 gap-3 border-t border-violet-100/80 pt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs text-slate-600">دخول تحت الاحتضان (48 ساعة)</span>
                <span className="text-lg font-bold tabular-nums text-violet-700">
                  {nInc == null ? '—' : Number(nInc).toLocaleString('ar-SA')}
                </span>
              </div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-xs text-slate-600">إلى النشط — قيد المكالمة</span>
                <span className="text-lg font-bold tabular-nums text-emerald-700">
                  {nAct == null ? '—' : Number(nAct).toLocaleString('ar-SA')}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
              الأول تقريب من التسجيل؛ الثاني من سجل التدقيق عند التخريج من الاحتضان إلى نشط قيد المكالمة.
            </p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-slate-100 bg-slate-50/40 p-4 flex-1">
              <div className="flex items-center gap-2 text-slate-600 mb-2">
                <Activity size={18} />
                <span className="text-xs font-bold">جديد → احتضان (سجل التدقيق)</span>
              </div>
              <p className="text-3xl font-black tabular-nums text-slate-900">
                {transitionStats.auditNewToInc == null ? '—' : Number(transitionStats.auditNewToInc).toLocaleString('ar-SA')}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">عند تسجيل الانتقال صراحة في السجل</p>
            </div>
            <div className="rounded-xl border border-amber-100 bg-amber-50/40 p-4 flex-1">
              <div className="flex items-center gap-2 text-amber-900 mb-2">
                <Snowflake size={18} />
                <span className="text-xs font-bold">انتقال إلى تجميد</span>
              </div>
              <p className="text-3xl font-black tabular-nums text-slate-900">
                {transitionStats.frozen == null ? '—' : Number(transitionStats.frozen).toLocaleString('ar-SA')}
              </p>
              <p className="text-xs text-slate-500 mt-1.5">متاجر جرى تجميدها خلال الشهر (سجل التدقيق)</p>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
