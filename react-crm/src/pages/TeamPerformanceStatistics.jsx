import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { BarChart3, ListTree, Package, RefreshCw, Store } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import { getRegistrationMonthStats } from '../services/api'

/** تسميات مراحل المسار (_inc) — مطابقة لمنطق all-stores.php */
const INC_STAGE_LABELS_AR = {
  call_1: 'المكالمة الأولى — ضمن 48 ساعة من التسجيل',
  call_1_delayed: 'تأخير المكالمة الأولى (بعد 48 ساعة)',
  call_2: 'المكالمة الثانية — من يوم 3 (يشترط شحن)',
  call_3: 'المكالمة الثالثة — يوم 10 إلى 14',
  between_calls: 'بين المكالمات (انتظار النافذة التالية)',
  _unknown: 'مرحلة غير محددة في البيانات',
}

export default function TeamPerformanceStatistics() {
  const { user } = useAuth()
  const { storesMeta, loading: storesLoading, reload: reloadStores, lastLoaded } = useStores()
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

  const incStage = storesMeta?.inc_stage_counts && typeof storesMeta.inc_stage_counts === 'object'
    ? storesMeta.inc_stage_counts
    : null
  const split = storesMeta?.onboarding_bucket_split && typeof storesMeta.onboarding_bucket_split === 'object'
    ? storesMeta.onboarding_bucket_split
    : null
  const incStageRows = incStage
    ? Object.entries(incStage).sort(([a], [b]) => String(a).localeCompare(String(b), 'ar'))
    : []

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

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-slate-200/90 bg-white p-5 lg:p-6 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
              <ListTree size={20} strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">خريطة التصنيف — مسار التهيئة</h2>
              <p className="text-sm text-slate-600 mt-0.5">
                عدّاد حسب <span className="font-mono text-xs font-semibold">_inc</span>
                {' '}للمتاجر في خانتي «جديد قبل الشحن» و«تحت الاحتضان» فقط، وفق آخر تشغيل لـ all-stores.
              </p>
              {lastLoaded && (
                <p className="text-[11px] text-slate-400 mt-1">
                  آخر تحميل للمتاجر:{' '}
                  {lastLoaded.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={() => reloadStores()}
            disabled={storesLoading}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={storesLoading ? 'animate-spin' : ''} />
            تحديث المتاجر
          </button>
        </div>

        {split && (
          <div className="flex flex-wrap gap-3 mb-5">
            <div className="rounded-xl border border-sky-100 bg-sky-50/50 px-4 py-2 text-sm">
              <span className="text-slate-600">جديد — بانتظار أول شحنة: </span>
              <span className="font-black tabular-nums text-sky-900">
                {Number(split.new_registered ?? 0).toLocaleString('ar-SA')}
              </span>
            </div>
            <div className="rounded-xl border border-violet-100 bg-violet-50/50 px-4 py-2 text-sm">
              <span className="text-slate-600">تحت الاحتضان (بعد شحن): </span>
              <span className="font-black tabular-nums text-violet-900">
                {Number(split.incubating ?? 0).toLocaleString('ar-SA')}
              </span>
            </div>
          </div>
        )}

        {storesLoading && !incStageRows.length ? (
          <p className="text-sm text-slate-500">جارٍ تحميل بيانات التصنيف…</p>
        ) : incStageRows.length === 0 ? (
          <p className="text-sm text-slate-500">
            لا تتوفر أرقام مراحل بعد. افتح الصفحة بعد اكتمال تحميل المتاجر أو اضغط «تحديث المتاجر».
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-right text-xs font-bold text-slate-600 border-b border-slate-100">
                  <th className="px-4 py-2.5">المرحلة (_inc)</th>
                  <th className="px-4 py-2.5 w-28">العدد</th>
                </tr>
              </thead>
              <tbody>
                {incStageRows.map(([key, n]) => (
                  <tr key={key} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-slate-500 ml-2">{key}</span>
                      <span className="text-slate-800">
                        {INC_STAGE_LABELS_AR[key] || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-black tabular-nums text-slate-900">
                      {Number(n).toLocaleString('ar-SA')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
          لا يشمل الجدول متاجر «غير نشط ساخن/بارد» أو المنجزة؛ فقط من بقي في مسار التهيئة ضمن الخادم.
        </p>
      </motion.div>
    </div>
  )
}
