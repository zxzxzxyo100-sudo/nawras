import { useState, useEffect, useCallback } from 'react'
import { AlertTriangle, TrendingDown, RefreshCw, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react'
import { getEarlyWarning } from '../services/api'

function severityClass(dropPercent) {
  if (dropPercent >= 50) return { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    badge: 'bg-red-100 text-red-800'    }
  if (dropPercent >= 25) return { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-800' }
  return                        { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  badge: 'bg-amber-100 text-amber-800'  }
}

export default function EarlyWarningWidget() {
  const [data,     setData]     = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState(null)
  const [expanded, setExpanded] = useState(true)
  const [showAll,  setShowAll]  = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getEarlyWarning()
      if (res?.success) setData(res)
      else setError('تعذّر جلب البيانات من الخادم')
    } catch (e) {
      setError('خطأ في الاتصال — تحقق من الاتصال بالإنترنت')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const warnings = data?.warnings ?? []
  const visible  = showAll ? warnings : warnings.slice(0, 8)
  const hasMore  = warnings.length > 8
  const hasWarnings = warnings.length > 0

  // لون رأس الودجت حسب الحالة
  const headerBg = loading
    ? 'from-slate-50 to-white'
    : error
      ? 'from-red-50 to-white'
      : hasWarnings
        ? 'from-amber-50 to-white'
        : 'from-emerald-50 to-white'

  const headerIcon = loading
    ? <RefreshCw size={18} className="text-slate-400 animate-spin shrink-0" />
    : error
      ? <AlertTriangle size={18} className="text-red-500 shrink-0" />
      : hasWarnings
        ? <AlertTriangle size={18} className="text-amber-600 shrink-0" />
        : <CheckCircle2 size={18} className="text-emerald-600 shrink-0" />

  const headerTitle = loading
    ? 'إنذار مبكر — جارٍ التحليل...'
    : error
      ? 'إنذار مبكر — خطأ في جلب البيانات'
      : hasWarnings
        ? `إنذار مبكر — ${warnings.length} متجر تراجعت طلباته`
        : 'إنذار مبكر — جميع المتاجر مستقرة'

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white/80 backdrop-blur-sm shadow-sm overflow-hidden" dir="rtl">
      {/* رأس الودجت */}
      <button
        type="button"
        onClick={() => setExpanded(e => !e)}
        className={`w-full flex items-center justify-between px-4 py-3 bg-gradient-to-l ${headerBg} hover:brightness-[0.97] transition-all`}
      >
        <div className="flex items-center gap-2">
          {headerIcon}
          <span className="text-sm font-bold text-slate-800">{headerTitle}</span>
        </div>
        <div className="flex items-center gap-2">
          {data && (
            <span className="text-[10px] text-slate-400 hidden sm:block">
              أمس: {data.total_yesterday?.toLocaleString('ar-SA')} طرد
              {' · '}اليوم: {data.total_today?.toLocaleString('ar-SA')} طرد
              {data.cached_today ? ' · (مؤقت)' : ''}
            </span>
          )}
          <button
            type="button"
            onClick={e => { e.stopPropagation(); load() }}
            disabled={loading}
            className="p-1 rounded-lg hover:bg-black/5 transition-colors"
            title="تحديث"
          >
            <RefreshCw size={13} className={`text-slate-400 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {expanded
            ? <ChevronUp   size={16} className="text-slate-400" />
            : <ChevronDown size={16} className="text-slate-400" />
          }
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-2">
          {loading && (
            <p className="text-xs text-slate-400 text-center py-4">
              جارٍ مقارنة بيانات اليوم بأمس — قد يستغرق حتى دقيقة...
            </p>
          )}

          {error && !loading && (
            <p className="text-sm text-red-600 py-3 text-center">{error}</p>
          )}

          {!loading && !error && !hasWarnings && (
            <p className="text-sm text-emerald-700 py-3 text-center font-medium">
              لا توجد تحذيرات — لا يوجد متجر تراجع بـ {data?.threshold}+ طلبات عن أمس
            </p>
          )}

          {!loading && !error && hasWarnings && (
            <>
              <p className="text-[11px] text-slate-500 mb-2">
                متاجر تراجعت بـ {data?.threshold}+ طلبات عن أمس ·{' '}
                <span className="text-red-600 font-semibold">■</span> ≥50%{' '}
                <span className="text-orange-500 font-semibold">■</span> ≥25%{' '}
                <span className="text-amber-500 font-semibold">■</span> أقل
              </p>

              <div className="space-y-1.5">
                {visible.map(w => {
                  const s = severityClass(w.drop_percent)
                  return (
                    <div
                      key={w.store_id}
                      className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2 ${s.bg} ${s.border}`}
                    >
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs font-semibold ${s.text} truncate block`}>
                          {w.store_name}
                          <span className="font-normal opacity-50 mr-1">#{w.store_id}</span>
                        </span>
                      </div>
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
                  className="mt-2 w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1"
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
