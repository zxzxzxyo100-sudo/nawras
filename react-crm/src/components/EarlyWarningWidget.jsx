import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, TrendingDown, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { getEarlyWarning } from '../services/api'

function severityClass(dropPercent) {
  if (dropPercent >= 50) return { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-800'    }
  if (dropPercent >= 25) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' }
  return                        { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800'  }
}

export default function EarlyWarningWidget() {
  const [data,      setData]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState(null)
  const [expanded,  setExpanded]  = useState(true)
  const [showAll,   setShowAll]   = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getEarlyWarning()
      if (res?.success) setData(res)
      else setError('فشل جلب البيانات')
    } catch {
      setError('خطأ في الاتصال')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const warnings  = data?.warnings ?? []
  const visible   = showAll ? warnings : warnings.slice(0, 8)
  const hasMore   = warnings.length > 8

  // لا تُظهر الودجت إذا لم يكن هناك تحذيرات (بعد التحميل)
  if (!loading && !error && warnings.length === 0) return null

  return (
    <div className="rounded-2xl border border-amber-200/70 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden" dir="rtl">
      {/* رأس الودجت */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-l from-amber-50 to-white hover:from-amber-100/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} className="text-amber-600 shrink-0" />
          <span className="text-sm font-bold text-amber-900">إنذار مبكر — تراجع في الطلبات</span>
          {!loading && data && (
            <span className="inline-flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full bg-amber-600 text-white text-xs font-bold">
              {warnings.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] text-amber-700/60">
              {data.cached_today ? 'بيانات مؤقتة' : 'محدّث'}
              {' · '}أمس: {data.total_yesterday?.toLocaleString('ar-SA')}
              {' · '}اليوم: {data.total_today?.toLocaleString('ar-SA')}
            </span>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); load() }}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-amber-100 transition-colors"
            title="تحديث"
          >
            <RefreshCw size={13} className={`text-amber-600 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded ? <ChevronUp size={16} className="text-amber-600" /> : <ChevronDown size={16} className="text-amber-600" />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1">
          {loading && (
            <div className="flex items-center gap-2 py-6 justify-center text-sm text-slate-500">
              <RefreshCw size={14} className="animate-spin text-amber-500" />
              جارٍ تحليل البيانات...
            </div>
          )}

          {error && !loading && (
            <p className="text-sm text-red-600 py-3 text-center">{error}</p>
          )}

          {!loading && !error && warnings.length === 0 && (
            <p className="text-sm text-slate-500 py-3 text-center">لا توجد تحذيرات حالياً — جميع المتاجر مستقرة</p>
          )}

          {!loading && !error && warnings.length > 0 && (
            <>
              <p className="text-[11px] text-amber-700/70 mb-2 mt-1">
                متاجر لديها ≥{data?.threshold} طلب أمس وانخفضت اليوم •{' '}
                <span className="text-red-600">■</span> ≥50%{' '}
                <span className="text-orange-600">■</span> ≥25%{' '}
                <span className="text-amber-600">■</span> أقل
              </p>

              <div className="space-y-1.5">
                {visible.map(w => {
                  const s = severityClass(w.drop_percent)
                  return (
                    <div
                      key={w.store_id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${s.bg} ${s.border}`}
                    >
                      {/* اسم المتجر */}
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-semibold ${s.text} truncate block`}>
                          {w.store_name}
                          <span className="font-normal opacity-60 mr-1">#{w.store_id}</span>
                        </span>
                      </div>

                      {/* الأرقام */}
                      <div className="flex items-center gap-2 shrink-0 text-xs tabular-nums">
                        <span className="text-slate-500">أمس: <b className="text-slate-700">{w.yesterday_count}</b></span>
                        <TrendingDown size={12} className={s.text} />
                        <span className="text-slate-500">اليوم: <b className={s.text}>{w.today_count}</b></span>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full font-bold text-[11px] ${s.badge}`}>
                          ↓{w.drop_percent}%
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {hasMore && (
                <button
                  type="button"
                  onClick={() => setShowAll(s => !s)}
                  className="mt-2 w-full text-center text-xs text-amber-700 hover:text-amber-900 font-medium py-1"
                >
                  {showAll ? 'عرض أقل' : `عرض ${warnings.length - 8} إضافية...`}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
