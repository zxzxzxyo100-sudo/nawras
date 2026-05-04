import { Plus } from 'lucide-react'

/**
 * زر إجراء عائم للموبايل (FAB) — يظهر فقط دون lg.
 * مرفوع فوق MobileBottomNav (bottom: 80px تقريباً).
 *
 * Props:
 *  - icon: أيقونة Lucide (افتراضي Plus)
 *  - onClick: handler
 *  - label: aria/title
 *  - color: 'violet' | 'emerald' | 'blue' | 'amber' (افتراضي violet)
 *  - hide: لإخفاء مشروط
 */
const COLORS = {
  violet:  'bg-violet-600 hover:bg-violet-700 shadow-violet-600/40',
  emerald: 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/40',
  blue:    'bg-blue-600 hover:bg-blue-700 shadow-blue-600/40',
  amber:   'bg-amber-500 hover:bg-amber-600 shadow-amber-500/40',
}

export default function MobileFab({ icon: Icon = Plus, onClick, label = 'إجراء سريع', color = 'violet', hide = false }) {
  if (hide) return null
  const palette = COLORS[color] || COLORS.violet
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`lg:hidden fixed z-40 bottom-[calc(72px+env(safe-area-inset-bottom))] left-4 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-2xl transition-all active:scale-95 ${palette}`}
    >
      <Icon size={24} strokeWidth={2.4} />
    </button>
  )
}
