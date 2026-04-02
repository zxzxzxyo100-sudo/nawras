import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Store, TrendingUp, Flame, Snowflake,
  ClipboardList, Users, LogOut, Baby, X, Kanban, Zap, BarChart2,
} from 'lucide-react'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { usePoints } from '../contexts/PointsContext'

const NAV = [
  { to: '/',              label: 'لوحة التحكم',       icon: LayoutDashboard, view: 'dashboard'    },
  { to: '/kanban',        label: 'Kanban',             icon: Kanban,          view: 'dashboard'    },
  { to: '/new',           label: 'المتاجر الجديدة',    icon: Store,           view: 'new'          },
  { to: '/incubation',    label: 'مسار الاحتضان',      icon: Baby,            view: 'incubation'   },
  { to: '/active',        label: 'نشط يشحن',           icon: TrendingUp,      view: 'active'       },
  { to: '/hot-inactive',  label: 'غير نشط ساخن',       icon: Flame,           view: 'hot_inactive' },
  { to: '/cold-inactive', label: 'غير نشط بارد',       icon: Snowflake,       view: 'cold_inactive'},
  { to: '/tasks',         label: 'المهام اليومية',      icon: ClipboardList,   view: 'tasks'        },
  { to: '/performance',   label: 'أدائي',              icon: BarChart2,       view: 'tasks'        },
  { to: '/users',         label: 'إدارة المستخدمين',    icon: Users,           view: 'users'        },
]

// تقسيم روابط التنقل لمجموعات
const NAV_GROUPS = [
  { label: 'الرئيسية',  keys: ['/', '/kanban'] },
  { label: 'المتاجر',   keys: ['/new', '/incubation', '/active', '/hot-inactive', '/cold-inactive'] },
  { label: 'الإدارة',   keys: ['/tasks', '/performance', '/users'] },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
  const { totalPoints, todayCalls } = usePoints()

  function handleLogout() { logout(); navigate('/login') }
  function handleNav()    { if (onClose) onClose() }

  const roleLabel = ROLES[user?.role]?.label ?? ''
  const initials  = user?.fullname?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'م'

  return (
    <aside
      className={`
        fixed right-0 top-0 h-full w-60 flex flex-col z-40
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
      `}
      style={{ background: 'linear-gradient(180deg, #0d0520 0%, #120828 50%, #0a0318 100%)' }}
    >
      {/* ── Logo ─────────────────────────────── */}
      <div className="px-5 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <span className="text-white font-black text-sm">ن</span>
          </div>
          <div>
            <p className="text-white font-black text-sm leading-tight">النورس</p>
            <p className="text-purple-400 text-[10px] font-medium">CRM System</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* ── Navigation ───────────────────────── */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {NAV_GROUPS.map(group => {
          const items = NAV.filter(n => group.keys.includes(n.to) && can(n.view))
          if (items.length === 0) return null
          return (
            <div key={group.label} className="mb-5">
              <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
                {group.label}
              </p>
              <div className="space-y-0.5">
                {items.map(item => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={handleNav}
                    className={({ isActive }) =>
                      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
                        isActive
                          ? 'text-white'
                          : 'text-white/40 hover:text-white/80 hover:bg-white/5'
                      }`
                    }
                    style={({ isActive }) => isActive
                      ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))', boxShadow: '0 0 20px rgba(139,92,246,0.15)' }
                      : {}
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          isActive
                            ? 'bg-violet-500 shadow-lg shadow-violet-500/30'
                            : 'bg-white/5 group-hover:bg-white/10'
                        }`}>
                          <item.icon size={14} className={isActive ? 'text-white' : 'text-white/50'} />
                        </div>
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className="mr-auto w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                        )}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── User ─────────────────────────────── */}
      <div className="p-4 border-t border-white/5 space-y-2">
        {/* شارة النقاط */}
        <NavLink
          to="/performance"
          onClick={handleNav}
          className="flex items-center gap-2 p-2.5 rounded-xl transition-all hover:bg-white/5"
          style={{ border: '1px solid rgba(245,158,11,0.2)', background: 'rgba(245,158,11,0.06)' }}
        >
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}
          >
            <Zap size={13} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-amber-400 text-[10px] font-medium">نقاطي</p>
            <p className="text-white text-xs font-black">{totalPoints} NRS</p>
          </div>
          <div className="text-[9px] text-white/30 text-center">
            <div className="text-amber-400 font-bold">{todayCalls}</div>
            <div>اليوم</div>
          </div>
        </NavLink>

        {/* بيانات المستخدم */}
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-bold truncate">{user?.fullname}</p>
            <p className="text-white/40 text-[10px] truncate">{roleLabel}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 text-white/40 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400 transition-all text-xs font-semibold"
        >
          <LogOut size={13} />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  )
}
