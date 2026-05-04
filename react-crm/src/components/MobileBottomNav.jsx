import { NavLink } from 'react-router-dom'
import { LayoutDashboard, ClipboardList, TrendingUp, Store, BadgeCheck } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

/**
 * شريط تنقّل سفلي للموبايل — يظهر فقط دون lg.
 * لا يستبدل Sidebar — يبقى Sidebar متاحاً عبر زر القائمة في الهيدر للوصول لكل الصفحات.
 * هنا فقط الإجراءات الأساسية (4–5 عناصر).
 */
const ITEMS = [
  { to: '/',                   label: 'الرئيسية',     icon: LayoutDashboard, view: 'dashboard' },
  { to: '/tasks',              label: 'المهام',        icon: ClipboardList,   view: 'tasks' },
  { to: '/active/pending',     label: 'النشطة',        icon: TrendingUp,      view: 'active' },
  { to: '/new',                label: 'المتاجر',       icon: Store,           view: 'new' },
  { to: '/quick-verification', label: 'التحقيق',      icon: BadgeCheck,      view: 'quick_verification' },
]

export default function MobileBottomNav() {
  const { user, can } = useAuth()
  if (!user) return null

  const visible = ITEMS.filter(i => (can ? can(i.view) : true))
  if (visible.length === 0) return null

  return (
    <nav
      dir="rtl"
      className="lg:hidden fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 shadow-[0_-4px_16px_-8px_rgba(15,23,42,0.18)] pb-[env(safe-area-inset-bottom)]"
      aria-label="التنقّل السفلي"
    >
      <ul className="flex items-stretch justify-around">
        {visible.map(item => {
          const Icon = item.icon
          return (
            <li key={item.to} className="flex-1 min-w-0">
              <NavLink
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 py-1.5 text-[10px] font-semibold transition-colors ${
                    isActive
                      ? 'text-violet-700'
                      : 'text-slate-500 hover:text-slate-800'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-7 items-center justify-center rounded-xl transition-colors ${
                        isActive ? 'bg-violet-100' : 'bg-transparent'
                      }`}
                    >
                      <Icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                    </span>
                    <span className="truncate max-w-full">{item.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
