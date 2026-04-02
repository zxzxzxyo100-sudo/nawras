export default function StatCard({ title, value, subtitle, icon: Icon, color = 'blue', onClick }) {
  const colors = {
    blue:   { bg: 'bg-blue-50',   icon: 'bg-blue-600',   text: 'text-blue-600',   bar: 'bg-blue-500'   },
    green:  { bg: 'bg-emerald-50',icon: 'bg-emerald-600',text: 'text-emerald-600',bar: 'bg-emerald-500' },
    amber:  { bg: 'bg-amber-50',  icon: 'bg-amber-500',  text: 'text-amber-600',  bar: 'bg-amber-500'  },
    red:    { bg: 'bg-red-50',    icon: 'bg-red-600',    text: 'text-red-600',    bar: 'bg-red-500'    },
    purple: { bg: 'bg-purple-50', icon: 'bg-purple-600', text: 'text-purple-600', bar: 'bg-purple-500' },
  }
  const c = colors[color] || colors.blue

  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-2xl p-5 shadow-sm border border-slate-100 ${onClick ? 'cursor-pointer hover:shadow-md hover:-translate-y-0.5' : ''} transition-all duration-200 relative overflow-hidden`}
    >
      <div className={`absolute top-0 right-0 left-0 h-1 ${c.bar}`} />
      <div className="flex items-start justify-between">
        <div>
          <p className="text-slate-500 text-sm font-medium mb-1">{title}</p>
          <p className="text-3xl font-bold text-slate-800">{value?.toLocaleString('ar-SA') ?? '—'}</p>
          {subtitle && <p className="text-slate-400 text-xs mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`w-11 h-11 rounded-xl ${c.icon} flex items-center justify-center shadow-md`}>
            <Icon size={20} className="text-white" />
          </div>
        )}
      </div>
    </div>
  )
}
