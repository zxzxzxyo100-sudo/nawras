import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Store, TrendingUp,
  Flame, Snowflake, ClipboardList, Users, LogOut, Package, Baby, X, Kanban,
} from 'lucide-react'
import { useAuth, ROLES } from '../contexts/AuthContext'

const NAV = [
  { to: '/',             label: 'لوحة التحكم',        icon: LayoutDashboard, view: 'dashboard'    },
  { to: '/kanban',       label: 'Kanban',              icon: Kanban,          view: 'dashboard'    },
  { to: '/new',          label: 'المتاجر الجديدة',     icon: Store,           view: 'new'          },
  { to: '/incubation',   label: 'مسار الاحتضان',       icon: Baby,            view: 'incubation'   },
  { to: '/active',       label: 'نشط يشحن',            icon: TrendingUp,      view: 'active'       },
  { to: '/hot-inactive', label: 'غير نشط ساخن',        icon: Flame,           view: 'hot_inactive' },
  { to: '/cold-inactive',label: 'غير نشط بارد',        icon: Snowflake,       view: 'cold_inactive'},
  { to: '/tasks',        label: 'المهام اليومية',       icon: ClipboardList,   view: 'tasks'        },
  { to: '/users',        label: 'إدارة المستخدمين',     icon: Users,           view: 'users'        },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  function handleNav() {
    // close sidebar on mobile after navigation
    if (onClose) onClose()
  }

  const roleLabel = ROLES[user?.role]?.label ?? ''

  return (
    <aside className={`
      fixed right-0 top-0 h-full w-64 bg-slate-900 flex flex-col z-40 shadow-2xl
      transition-transform duration-300 ease-in-out
      ${isOpen ? 'translate-x-0' : 'translate-x-full'}
      lg:translate-x-0
    `}>
      {/* Logo + close button on mobile */}
      <div className="p-6 border-b border-slate-700/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-lg">
              <Package size={20} className="text-white" />
            </div>
            <div>
              <div className="text-white font-bold text-lg leading-tight">نظام النورس</div>
              <div className="text-slate-400 text-xs">{roleLabel}</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="lg:hidden w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV.filter(item => can(item.view)).map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            onClick={handleNav}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-3.5 mx-3 my-0.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`
            }
          >
            <item.icon size={18} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* User + Logout */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
            {user?.fullname?.charAt(0) ?? 'م'}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-sm font-medium truncate">{user?.fullname}</div>
            <div className="text-slate-500 text-xs truncate">{user?.username}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-slate-700 text-slate-400 hover:bg-red-600/10 hover:border-red-500/50 hover:text-red-400 transition-all text-sm font-medium"
        >
          <LogOut size={16} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
