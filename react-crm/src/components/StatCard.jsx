/**
 * trend (اختياري): { value: number, positiveIsGood?: boolean, label?: string }
 * value موجب = سهم لأعلى، سالب = سهم لأسفل. positiveIsGood يحدد لون الشارة (افتراضياً true).
 */
export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', onClick, trend }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-600',    text: 'text-blue-600',    bar: 'bg-blue-500'    },
    green:  { bg: 'bg-emerald-50', icon: 'bg-emerald-600', text: 'text-emerald-600', bar: 'bg-emerald-500' },
    amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-500',   text: 'text-amber-600',   bar: 'bg-amber-500'   },
    red:    { bg: 'bg-red-50',     icon: 'bg-red-600',     text: 'text-red-600',     bar: 'bg-red-500'     },
    purple: { bg: 'bg-purple-50',  icon: 'bg-purple-600',  text: 'text-purple-600',  bar: 'bg-purple-500'  },
  }
  const c = colors[color] || colors.blue
  const hasTrend = trend && Number.isFinite(trend.value)
  const trendUp = hasTrend && trend.value >= 0
  const trendGood = hasTrend ? (trend.positiveIsGood ?? true) === trendUp : true

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-3.5 lg:p-5 shadow-sm border border-slate-100 ${onClick ? 'cursor-pointer active:scale-95 hover:shadow-md hover:-translate-y-0.5' : ''} transition-all duration-200 relative overflow-hidden`}
    >
      <div className={`absolute top-0 right-0 left-0 h-1 ${c.bar}`} />
      <div className="flex items-start justify-between gap-2">
        <div className={`w-9 h-9 lg:w-11 lg:h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
          {Icon && <Icon size={17} className={c.text} />}
        </div>
        {hasTrend && (
          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
            trendGood ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {trendUp ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
        )}
      </div>
      <p className="text-2xl lg:text-3xl font-black text-slate-800 mt-3">{value?.toLocaleString('ar-SA') ?? '—'}</p>
      <p className="text-slate-500 text-xs lg:text-sm font-medium mt-1 leading-tight">{title}</p>
      {(subtitle || trend?.label) && (
        <p className="text-slate-400 text-[11px] mt-1 leading-tight">{subtitle || trend.label}</p>
      )}
    </div>
  )
}
