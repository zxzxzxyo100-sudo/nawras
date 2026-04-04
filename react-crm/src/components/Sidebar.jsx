import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import {
  LayoutDashboard, Store, TrendingUp,
  ClipboardList, Users, LogOut, Baby, X, Kanban, BarChart2, Crown,
  ChevronDown, Circle, Layers,
} from 'lucide-react'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'

const NAV_ALL = [
  { to: '/',              label: 'لوحة التحكم',       icon: LayoutDashboard, view: 'dashboard'    },
  { to: '/kanban',        label: 'Kanban',             icon: Kanban,          view: 'dashboard'    },
  { to: '/new',           label: 'المتاجر',            icon: Store,           view: 'new'          },
  { to: '/active',        label: 'نشط يشحن',           icon: TrendingUp,      view: 'active'       },
  { to: '/vip',           label: 'كبار التجار',        icon: Crown,           view: 'vip_merchants' },
  { to: '/tasks',         label: 'المهام اليومية',      icon: ClipboardList,   view: 'tasks'        },
  { to: '/performance',   label: 'أدائي',              icon: BarChart2,       view: 'tasks'        },
  { to: '/users',         label: 'إدارة المستخدمين',    icon: Users,           view: 'users'        },
]

/** مسار الاحتضان — ثلاث مكالمات (نفس أسلوب القائمة الفرعية لـ «غير نشطة») */
const INCUBATION_SUB = [
  { to: '/incubation/call-1', label: 'المكالمة الأولى' },
  { to: '/incubation/call-2', label: 'المكالمة الثانية' },
  { to: '/incubation/call-3', label: 'المكالمة الثالثة' },
  { to: '/incubation/between-calls', label: 'بين المكالمات' },
]

/** ترتيب: ساخنة → باردة → جاري الاستعادة → تمت الاستعادة */
const INACTIVE_SUB = [
  { to: '/hot-inactive/all',       label: 'غير نشطة ساخنة', view: 'hot_inactive' },
  { to: '/cold-inactive',          label: 'غير نشطة باردة', view: 'cold_inactive' },
  { to: '/hot-inactive/restoring', label: 'جاري الاستعادة', viewAny: ['hot_inactive', 'cold_inactive'] },
  { to: '/hot-inactive/restored',  label: 'تمت الاستعادة',  viewAny: ['hot_inactive', 'cold_inactive'] },
]

function canInactiveSub(item, canFn) {
  if (item.viewAny?.length) return item.viewAny.some(v => canFn(v))
  return canFn(item.view)
}

/** المتاجر — جديدة (كل الخانات) وتحت الاحتضان */
const STORES_SUB = [
  { to: '/new', label: 'جديدة', match: 'all' },
  { to: '/new?bucket=incubating', label: 'تحت الاحتضان', match: 'incubating' },
]

function StoresNavGroup({ can, onClose }) {
  const location = useLocation()
  const isStoresSection = location.pathname === '/new'
  const [open, setOpen] = useState(isStoresSection)

  useEffect(() => {
    if (isStoresSection) setOpen(true)
  }, [isStoresSection])

  const bucket = new URLSearchParams(location.search).get('bucket')
  const isIncubatingView = bucket === 'incubating'

  if (!can('new')) return null

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-right ${
          isStoresSection ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}
        style={isStoresSection ? {
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))',
          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
        } : {}}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isStoresSection ? 'bg-violet-500 shadow-lg shadow-violet-500/30' : 'bg-white/5'
        }`}>
          <Store size={14} className={isStoresSection ? 'text-white' : 'text-white/50'} />
        </div>
        <span className="flex-1 truncate">المتاجر</span>
        <ChevronDown size={14} className={`text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mr-2 mt-0.5 pr-2 border-r border-white/10 space-y-0.5">
          {STORES_SUB.map(sub => {
            const active = sub.match === 'incubating'
              ? isStoresSection && isIncubatingView
              : isStoresSection && !isIncubatingView
            return (
              <NavLink
                key={sub.to}
                to={sub.to}
                onClick={() => { if (onClose) onClose() }}
                className={
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                    active ? 'text-amber-300 bg-white/10' : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                  }`
                }
              >
                <Circle size={6} className={active ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                <span>{sub.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** ترتيب عناصر مجموعة المتاجر — «مسار الاحتضان» و«غير نشطة» قوائم فرعية */
const STORE_NAV_ORDER = [
  '__stores_group__', '__incubation_group__', '/active', '__inactive_group__', '/vip',
]

function IncubationNavGroup({ can, onClose }) {
  const location = useLocation()
  const isIncubationSection = location.pathname.startsWith('/incubation')
  const [open, setOpen] = useState(isIncubationSection)

  useEffect(() => {
    if (isIncubationSection) setOpen(true)
  }, [isIncubationSection])

  if (!can('incubation')) return null

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-right ${
          isIncubationSection ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}
        style={isIncubationSection ? {
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))',
          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
        } : {}}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isIncubationSection ? 'bg-violet-500 shadow-lg shadow-violet-500/30' : 'bg-white/5'
        }`}>
          <Baby size={14} className={isIncubationSection ? 'text-white' : 'text-white/50'} />
        </div>
        <span className="flex-1 truncate">مسار الاحتضان</span>
        <ChevronDown size={14} className={`text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mr-2 mt-0.5 pr-2 border-r border-white/10 space-y-0.5">
          {INCUBATION_SUB.map(sub => (
            <NavLink
              key={sub.to}
              to={sub.to}
              end
              onClick={() => { if (onClose) onClose() }}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-amber-300 bg-white/10' : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Circle size={6} className={isActive ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                  <span>{sub.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

function InactiveNavGroup({ can, onClose }) {
  const location = useLocation()
  const isInactiveSection =
    location.pathname.startsWith('/hot-inactive') || location.pathname.startsWith('/cold-inactive')
  const [open, setOpen] = useState(isInactiveSection)

  useEffect(() => {
    if (isInactiveSection) setOpen(true)
  }, [isInactiveSection])

  const links = INACTIVE_SUB.filter(item => canInactiveSub(item, can))
  if (links.length === 0) return null

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-right ${
          isInactiveSection ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}
        style={isInactiveSection ? {
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))',
          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
        } : {}}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isInactiveSection ? 'bg-violet-500 shadow-lg shadow-violet-500/30' : 'bg-white/5'
        }`}>
          <Layers size={14} className={isInactiveSection ? 'text-white' : 'text-white/50'} />
        </div>
        <span className="flex-1 truncate">غير نشطة</span>
        <ChevronDown size={14} className={`text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mr-2 mt-0.5 pr-2 border-r border-white/10 space-y-0.5">
          {links.map(sub => (
            <NavLink
              key={sub.to}
              to={sub.to}
              end={sub.to === '/cold-inactive'}
              onClick={() => { if (onClose) onClose() }}
              className={({ isActive }) =>
                `flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-amber-300 bg-white/10' : 'text-white/35 hover:text-white/70 hover:bg-white/5'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Circle size={6} className={isActive ? 'text-amber-400 fill-amber-400' : 'text-white/20'} />
                  <span>{sub.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  )
}

const NAV = DISABLE_POINTS_AND_PERFORMANCE
  ? NAV_ALL.filter(n => n.to !== '/performance')
  : NAV_ALL

// تقسيم روابط التنقل لمجموعات
const NAV_GROUPS = [
  { label: 'الرئيسية',  keys: ['/', '/kanban'] },
  { label: 'المتاجر',   keys: ['__store_section__'] },
  {
    label: 'الإدارة',
    keys: DISABLE_POINTS_AND_PERFORMANCE
      ? ['/tasks', '/users']
      : ['/tasks', '/performance', '/users'],
  },
]

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, can } = useAuth()
  const navigate = useNavigate()
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
          if (group.keys.includes('__store_section__')) {
            const blocks = STORE_NAV_ORDER.map(key => {
              if (key === '__stores_group__') {
                return <StoresNavGroup key="stores" can={can} onClose={onClose} />
              }
              if (key === '__incubation_group__') {
                return <IncubationNavGroup key="incubation" can={can} onClose={onClose} />
              }
              if (key === '__inactive_group__') {
                return <InactiveNavGroup key="inactive" can={can} onClose={onClose} />
              }
              const item = NAV.find(n => n.to === key)
              if (!item || !can(item.view)) return null
              return (
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
              )
            })
            if (!blocks.some(Boolean)) return null
            return (
              <div key={group.label} className="mb-5">
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {blocks}
                </div>
              </div>
            )
          }

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
