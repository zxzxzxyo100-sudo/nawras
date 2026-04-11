import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, Package, RefreshCw, Store } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getRegistrationMonthStats } from '../services/api'

export default function TeamPerformanceStatistics() {
  const { user } = useAuth()
  const [stats, setStats] = useState({
    registered_this_month: null,
    shipped_among_registered: null,
    conversion_percent: null,
    month_label: null,
    cache_stale: null,
    hint: null,
  })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await getRegistrationMonthStats()
      if (r?.success) {
        setStats({
          registered_this_month:
            typeof r.registered_this_month === 'number' ? r.registered_this_month : null,
          shipped_among_registered:
            typeof r.shipped_among_registered === 'number' ? r.shipped_among_registered : null,
          conversion_percent:
            typeof r.conversion_percent === 'number' ? r.conversion_percent : null,
          month_label: typeof r.month_label === 'string' ? r.month_label : null,
          cache_stale: typeof r.cache_stale === 'boolean' ? r.cache_stale : null,
          hint: typeof r.hint === 'string' ? r.hint : null,
        })
      } else {
        setStats({
          registered_this_month: 0,
          shipped_among_registered: 0,
          conversion_percent: null,
          month_label: null,
          cache_stale: true,
          hint: typeof r?.hint === 'string' ? r.hint : null,
        })
      }
    } catch {
      setStats({
        registered_this_month: null,
        shipped_among_registered: null,
        conversion_percent: null,
        month_label: null,
        cache_stale: null,
        hint: null,
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

  const reg = stats.registered_this_month
  const ship = stats.shipped_among_registered
  const pct = stats.conversion_percent
  const showNumbers = reg != null && ship != null

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
                {' — '}عدد المتاجر <span className="font-semibold text-slate-800">المسجّلة هذا الشهر</span>
                {' '}ومنها من <span className="font-semibold text-slate-800">شحن</span>، ونسبة التحويل (شحن ÷ مسجّل).
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
        {stats.cache_stale && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3 mb-4">
            {stats.hint ||
              'البيانات من ذاكرة البحث؛ شغّل all-stores.php مرة لتحديث الحقول (تاريخ التسجيل والشحن).'}
          </p>
        )}

        <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/90 via-white to-emerald-50/40 p-5 lg:p-6">
          <div className="flex flex-wrap items-center gap-2 text-violet-800 mb-4">
            <Store size={20} />
            <span className="text-sm font-black">تسجيلات الشهر ونسبة الشحن</span>
            {stats.month_label && (
              <span className="text-xs font-semibold text-slate-500 mr-1">({stats.month_label})</span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-violet-100 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Store size={16} />
                <span className="text-xs font-bold">سُجّل هذا الشهر</span>
              </div>
              <p className="text-3xl font-black tabular-nums text-slate-900">
                {loading ? '…' : showNumbers ? Number(reg).toLocaleString('ar-SA') : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-100 bg-white/80 p-4">
              <div className="flex items-center gap-2 text-slate-600 mb-1">
                <Package size={16} />
                <span className="text-xs font-bold">منهم شحن</span>
              </div>
              <p className="text-3xl font-black tabular-nums text-emerald-800">
                {loading ? '…' : showNumbers ? Number(ship).toLocaleString('ar-SA') : '—'}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 md:col-span-1">
              <p className="text-xs font-bold text-slate-600 mb-1">نسبة التحويل</p>
              <p className="text-4xl font-black tabular-nums text-violet-700 leading-tight">
                {loading
                  ? '…'
                  : showNumbers && pct != null
                    ? `${Number(pct).toLocaleString('ar-SA')}%`
                    : showNumbers && reg === 0
                      ? '—'
                      : '—'}
              </p>
              <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
                {showNumbers && reg > 0
                  ? `مثال المعنى: ${Number(reg).toLocaleString('ar-SA')} مسجّل، ${Number(ship).toLocaleString('ar-SA')} شحن ≈ ${Number(pct).toLocaleString('ar-SA')}%.`
                  : 'عند عدم وجود تسجيلات في الشهر لا تُعرض نسبة.'}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-4 leading-relaxed border-t border-violet-100/80 pt-4">
            يُحتسب «شحن» إذا وُجدت شحنات (عدد الشحنات أكبر من صفر) أو تاريخ شحن فعلي في بيانات المتجر. الشهر
            حسب توقيت الرياض. المصدر: ذاكرة all-stores (يُنصح بتحديثها دورياً).
          </p>
        </div>
      </motion.div>
    </div>
  )
}
