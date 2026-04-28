import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect, useCallback } from 'react'
import {
  LayoutDashboard, Store, TrendingUp,
  Users, LogOut, Baby, X, BarChart2, Crown,
  ChevronDown, Circle, Layers, Lock, BadgeCheck, Package, ClipboardList,
} from 'lucide-react'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import { IS_STAGING_OR_DEV } from '../config/envFlags'
import { NawrasHeroImageLayer, NawrasTaglineStack } from './NawrasBrandBackdrop'

const NAV_ALL = [
  { to: '/',              label: 'لوحة التحكم',       icon: LayoutDashboard, view: 'dashboard'    },
  { to: '/tasks',         label: 'المهام',            icon: ClipboardList,   view: 'tasks'        },
  { to: '/active/pending', label: 'قيد المتابعة',     icon: TrendingUp,      view: 'active'       },
  { to: '/quick-verification', label: 'التحقيق السريع', icon: BadgeCheck,   view: 'quick_verification' },
  { to: '/new',           label: 'المتاجر',            icon: Store,           view: 'new'          },
  { to: '/vip',           label: 'كبار التجار',        icon: Crown,           view: 'vip_merchants' },
  { to: '/performance',   label: 'أدائي',              icon: BarChart2,       view: 'dashboard'    },
  { to: '/users',         label: 'إدارة المستخدمين',    icon: Users,           view: 'users'        },
  { to: '/analytics/logistics', label: 'تحليلات اللوجستيات', icon: Package,   view: 'dashboard' },
]

/** المتاجر — كل المتاجر ثم جديدة (48 ساعة) ثم تحت الاحتضان — مستقلة عن مسار الاحتضان */
const STORES_SUB = [
  { to: '/new', label: 'كل المتاجر', kind: 'all' },
  { to: '/new?view=new48', label: 'جديدة', kind: 'new48' },
  { to: '/new?bucket=incubating', label: 'تحت الاحتضان', kind: 'new_inc' },
]

/** نشط يشحن — قيد المكالمة / المنجزة (مثل مسار الاحتضان) */
const ACTIVE_SUB = [
  { to: '/active/pending', label: 'قيد المتابعة', kind: 'pending' },
  { to: '/active/completed', label: 'المتاجر المنجزة', kind: 'completed' },
  { to: '/active/unreachable', label: 'لم يتم الوصول للمتجر', kind: 'unreachable' },
]

/** مسار الاحتضان — أسفل المتاجر */
const INCUBATION_SUB = [
  { to: '/incubation/between-calls', label: 'بين المكالمات', kind: 'between' },
  { to: '/incubation/call-delay', label: 'تأخير المكالمة', kind: 'delay' },
  { to: '/incubation/call-1', label: 'المكالمة الأولى', kind: 'call1' },
  { to: '/incubation/call-2', label: 'المكالمة الثانية', kind: 'call2' },
  { to: '/incubation/call-3', label: 'المكالمة الثالثة', kind: 'call3' },
  { to: '/incubation/new-completed', label: 'المتاجر الجديدة المنجزة', kind: 'new_completed' },
]

/** ترتيب: ساخنة → باردة → جاري الاستعادة → تمت الاستعادة */
const INACTIVE_SUB = [
  { to: '/hot-inactive/all',       label: 'غير نشطة ساخنة', view: 'hot_inactive' },
  { to: '/cold-inactive',          label: 'غير نشطة باردة', view: 'cold_inactive' },
  { to: '/hot-inactive/restoring', label: 'جاري الاستعادة', viewAny: ['hot_inactive', 'cold_inactive'] },
  { to: '/hot-inactive/restored',  label: 'تمت الاستعادة — المنجزة',  viewAny: ['hot_inactive', 'cold_inactive'] },
]

function canInactiveSub(item, canFn) {
  if (item.viewAny?.length) return item.viewAny.some(v => canFn(v))
  return canFn(item.view)
}

function storesSubLinkActive(kind, pathname, search) {
  if (pathname !== '/new') return false
  const view = new URLSearchParams(search).get('view')
  const bucket = new URLSearchParams(search).get('bucket')
  switch (kind) {
    case 'all':
      return bucket !== 'incubating' && view !== 'new48'
    case 'new48':
      return view === 'new48'
    case 'new_inc':
      return bucket === 'incubating'
    default:
      return false
  }
}

function activeSubLinkActive(kind, pathname) {
  switch (kind) {
    case 'pending':
      return pathname === '/active/pending' || pathname === '/active'
    case 'completed':
      return pathname === '/active/completed'
    case 'unreachable':
      return pathname === '/active/unreachable'
    default:
      return false
  }
}

function incubationSubLinkActive(kind, pathname) {
  switch (kind) {
    case 'between':
      return pathname.startsWith('/incubation/between-calls')
    case 'delay':
      return pathname.startsWith('/incubation/call-delay')
    case 'call1':
      return pathname.startsWith('/incubation/call-1')
    case 'call2':
      return pathname.startsWith('/incubation/call-2')
    case 'call3':
      return pathname.startsWith('/incubation/call-3')
    case 'new_completed':
      return pathname.startsWith('/incubation/new-completed')
    default:
      return false
  }
}

/** مجموعة المتاجر — فوق مسار الاحتضان */
function StoresNavGroup({ can, onClose }) {
  const { user } = useAuth()
  const location = useLocation()
  const { pathname, search } = location
  const isStoresSection = pathname === '/new'
  const [open, setOpen] = useState(isStoresSection)

  useEffect(() => {
    if (isStoresSection) setOpen(true)
  }, [isStoresSection])

  /** مسؤول المتاجر (احتضان): التجريب/التطوير — التركيز على المهام اليومية دون تكرار «المتاجر» */
  if (IS_STAGING_OR_DEV && user?.role === 'incubation_manager') return null

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
            const active = storesSubLinkActive(sub.kind, pathname, search)
            return (
              <NavLink
                key={sub.kind}
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

/** نشط يشحن — أسفل مسار الاحتضان */
function ActiveNavGroup({ can, onClose }) {
  const location = useLocation()
  const pathname = location.pathname
  const isActiveSection = pathname.startsWith('/active')
  const [open, setOpen] = useState(isActiveSection)

  useEffect(() => {
    if (isActiveSection) setOpen(true)
  }, [isActiveSection])

  if (!can('active')) return null

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-right ${
          isActiveSection ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}
        style={isActiveSection ? {
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))',
          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
        } : {}}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isActiveSection ? 'bg-violet-500 shadow-lg shadow-violet-500/30' : 'bg-white/5'
        }`}>
          <TrendingUp size={14} className={isActiveSection ? 'text-white' : 'text-white/50'} />
        </div>
        <span className="flex-1 truncate">نشط يشحن</span>
        <ChevronDown size={14} className={`text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mr-2 mt-0.5 pr-2 border-r border-white/10 space-y-0.5">
          {ACTIVE_SUB.map(sub => {
            const subActive = activeSubLinkActive(sub.kind, pathname)
            return (
              <NavLink
                key={sub.kind}
                to={sub.to}
                onClick={() => { if (onClose) onClose() }}
                className={
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                    subActive ? 'text-cyan-300 bg-white/10' : 'text-cyan-200/40 hover:text-cyan-200/85 hover:bg-white/5'
                  }`
                }
              >
                <Circle size={6} className={subActive ? 'text-cyan-400 fill-cyan-400' : 'text-white/20'} />
                <span>{sub.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** مسار الاحتضان — أسفل المتاجر */
function IncubationNavGroup({ can, onClose }) {
  const location = useLocation()
  const pathname = location.pathname
  const isIncubationSection = pathname.startsWith('/incubation')
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
          {INCUBATION_SUB.map(sub => {
            const active = incubationSubLinkActive(sub.kind, pathname)
            return (
              <NavLink
                key={sub.kind}
                to={sub.to}
                end={sub.kind === 'between' || sub.kind === 'delay' || sub.kind.startsWith('call')}
                onClick={() => { if (onClose) onClose() }}
                className={
                  `flex items-center gap-2 px-3 py-2 rounded-lg text-[11px] font-semibold transition-colors ${
                    active ? 'text-cyan-300 bg-white/10' : 'text-cyan-200/40 hover:text-cyan-200/85 hover:bg-white/5'
                  }`
                }
              >
                <Circle size={6} className={active ? 'text-cyan-400 fill-cyan-400' : 'text-white/20'} />
                <span>{sub.label}</span>
              </NavLink>
            )
          })}
        </div>
      )}
    </div>
  )
}

/** رابط مستقل — ليس ضمن «نشط يشحن» ولا «غير نشطة» */
function FrozenNavLink({ can, onClose }) {
  const location = useLocation()
  if (!can('active')) return null
  const isFrozen = location.pathname === '/frozen'
  return (
    <NavLink
      to="/frozen"
      onClick={() => { if (onClose) onClose() }}
      className={
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group ${
          isFrozen ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`
      }
      style={isFrozen ? {
        background: 'linear-gradient(135deg, rgba(71,85,105,0.45), rgba(51,65,85,0.2))',
        boxShadow: '0 0 20px rgba(100,116,139,0.2)',
      } : {}}
    >
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
        isFrozen ? 'bg-slate-500 shadow-lg shadow-slate-500/25' : 'bg-white/5 group-hover:bg-white/10'
      }`}>
        <Lock size={14} className={isFrozen ? 'text-white' : 'text-white/50'} />
      </div>
      <span className="flex-1 truncate">المتاجر المجمدة</span>
      {isFrozen && (
        <div className="mr-auto w-1.5 h-1.5 rounded-full bg-slate-300 flex-shrink-0" />
      )}
    </NavLink>
  )
}

const STORE_NAV_ORDER = [
  '__stores_group__',
  '__incubation_group__',
  '__active_group__',
  '__frozen_link__',
  '__inactive_group__',
  '/vip',
]

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
  { label: 'الرئيسية',  keys: ['/', '/tasks', '/quick-verification'] },
  { label: 'المتاجر',   keys: ['__store_section__'] },
  {
    label: 'الإدارة',
    keys: DISABLE_POINTS_AND_PERFORMANCE
      ? ['/users', '__staff_performance_group__']
      : ['/performance', '/users', '__staff_performance_group__'],
  },
]

/** أداء الفريق — أهداف اليوم + الإحصائيات */
const STAFF_PERFORMANCE_SUB = [
  { to: '/staff-performance', label: 'أهداف اليوم', kind: 'goals' },
  { to: '/staff-performance/stats', label: 'الإحصائيات', kind: 'stats' },
  { to: '/staff-performance/recovery-report', label: 'تقرير الاستعادة', kind: 'recovery' },
  { to: '/staff-performance/conversion-report', label: 'تقرير نسبة التحويل', kind: 'conversion' },
  { to: '/staff-performance/satisfaction-report', label: 'تقرير معدل الرضا', kind: 'satisfaction' },
]

function staffPerfSubActive(kind, pathname) {
  if (kind === 'goals') {
    return pathname === '/staff-performance' || pathname === '/staff-performance/'
  }
  if (kind === 'stats') return pathname.startsWith('/staff-performance/stats')
  if (kind === 'recovery') return pathname.startsWith('/staff-performance/recovery-report')
  if (kind === 'conversion') return pathname.startsWith('/staff-performance/conversion-report')
  if (kind === 'satisfaction') return pathname.startsWith('/staff-performance/satisfaction-report')
  return false
}

function StaffPerformanceNavGroup({ can, onClose }) {
  const location = useLocation()
  const pathname = location.pathname
  const isSection = pathname.startsWith('/staff-performance')
  const [open, setOpen] = useState(isSection)

  useEffect(() => {
    if (isSection) setOpen(true)
  }, [isSection])

  if (!can('staff_performance')) return null

  return (
    <div className="mb-0.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 text-right ${
          isSection ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'
        }`}
        style={isSection ? {
          background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))',
          boxShadow: '0 0 20px rgba(139,92,246,0.15)',
        } : {}}
      >
        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
          isSection ? 'bg-violet-500 shadow-lg shadow-violet-500/30' : 'bg-white/5'
        }`}>
          <Users size={14} className={isSection ? 'text-white' : 'text-white/50'} />
        </div>
        <span className="flex-1 truncate">أداء الفريق</span>
        <ChevronDown size={14} className={`text-white/50 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="mr-2 mt-0.5 pr-2 border-r border-white/10 space-y-0.5">
          {STAFF_PERFORMANCE_SUB.map(sub => {
            const active = staffPerfSubActive(sub.kind, pathname)
            return (
              <NavLink
                key={sub.kind}
                to={sub.to}
                end={sub.kind === 'goals'}
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

/** مسؤول المتاجر النشطة: لوحة جانبية مبسّطة — لوحة التحكم + أدائي (إن وُجد) */
function navGroupsForUser(role) {
  if (role === 'active_manager') {
    return [
      { label: 'الرئيسية', keys: ['/', '/tasks', '/active/pending'] },
      ...(DISABLE_POINTS_AND_PERFORMANCE
        ? []
        : [{ label: 'الإدارة', keys: ['/performance'] }]),
    ]
  }
  return NAV_GROUPS
}

export default function Sidebar({ isOpen, onClose }) {
  const { user, logout, can } = useAuth()
  const { shouldAlert: privateTicketNavAlert } = usePrivateTicketsAlert()
  const navigate = useNavigate()
  function handleLogout() { logout(); navigate('/login') }
  function handleNav()    { if (onClose) onClose() }

  const roleLabel = ROLES[user?.role]?.label ?? ''
  const initials  = user?.fullname?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'م'

  return (
    <aside
      className={`
        fixed right-0 top-0 h-full w-[82vw] max-w-[320px] lg:w-60 flex flex-col z-40
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:translate-x-0
        overflow-hidden
      `}
    >
      <NawrasHeroImageLayer opacity={0.1} footerCropPct={16} className="mix-blend-soft-light" />
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#0d0520]/98 via-[#120828]/97 to-[#0a0318]/98 lg:from-[#0d0520]/94 lg:via-[#120828]/92 lg:to-[#0a0318]/96"
        aria-hidden
      />
      {/* ── Logo ─────────────────────────────── */}
      <div className="relative z-10 px-5 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center shadow-lg"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
          >
            <span className="text-white font-black text-sm">ن</span>
          </div>
          <div className="min-w-0">
            <p className="text-white font-black text-sm leading-tight">النورس</p>
            <p className="text-purple-400 text-[10px] font-medium">CRM System</p>
            <NawrasTaglineStack light compact className="mt-2 border-t border-white/10 pt-2" />
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
      <nav className="relative z-10 flex-1 overflow-y-auto py-4 px-3">
        {navGroupsForUser(user?.role).map(group => {
          if (group.keys.includes('__store_section__')) {
            const blocks = STORE_NAV_ORDER.map(key => {
              if (key === '__stores_group__') {
                return <StoresNavGroup key="stores" can={can} onClose={onClose} />
              }
              if (key === '__incubation_group__') {
                return <IncubationNavGroup key="incubation" can={can} onClose={onClose} />
              }
              if (key === '__active_group__') {
                return <ActiveNavGroup key="active" can={can} onClose={onClose} />
              }
              if (key === '__frozen_link__') {
                return <FrozenNavLink key="frozen" can={can} onClose={onClose} />
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

          if (group.keys.some(k => k === '__staff_performance_group__')) {
            const ordered = []
            for (const key of group.keys) {
              if (key === '__staff_performance_group__') {
                if (can('staff_performance')) ordered.push({ kind: 'staff_perf' })
                continue
              }
              const navItem = NAV.find(n => n.to === key)
              if (navItem && can(navItem.view)) ordered.push({ kind: 'link', item: navItem })
            }
            if (ordered.length === 0) return null
            return (
              <div key={group.label} className="mb-5">
                <p className="text-white/20 text-[10px] font-bold uppercase tracking-widest px-3 mb-2">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {ordered.map(entry => {
                    if (entry.kind === 'staff_perf') {
                      return <StaffPerformanceNavGroup key="staff-performance" can={can} onClose={onClose} />
                    }
                    const item = entry.item
                    const frostDash = item.to === '/' && privateTicketNavAlert
                    return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={handleNav}
                    className={({ isActive }) => {
                      const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group'
                      if (frostDash) {
                        if (isActive) {
                          return `${base} text-cyan-50 border border-white/30 bg-white/[0.14] backdrop-blur-md shadow-[0_0_26px_rgba(200,245,255,0.22)] ring-1 ring-cyan-100/35`
                        }
                        return `${base} text-cyan-100/95 border border-white/22 bg-white/[0.08] backdrop-blur-sm shadow-[0_0_20px_rgba(220,250,255,0.14)] ring-1 ring-white/15 hover:bg-white/[0.12]`
                      }
                      return `${base} ${isActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`
                    }}
                    style={({ isActive }) => {
                      if (frostDash) return {}
                      return isActive
                        ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))', boxShadow: '0 0 20px rgba(139,92,246,0.15)' }
                        : {}
                    }}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          frostDash
                            ? isActive
                              ? 'bg-cyan-400/25 shadow-[0_0_14px_rgba(200,255,255,0.35)] border border-white/20'
                              : 'bg-white/15 border border-white/15'
                            : isActive
                              ? 'bg-violet-500 shadow-lg shadow-violet-500/30'
                              : 'bg-white/5 group-hover:bg-white/10'
                        }`}>
                          <item.icon size={14} className={frostDash ? 'text-cyan-100' : (isActive ? 'text-white' : 'text-white/50')} />
                        </div>
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className={`mr-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${frostDash ? 'bg-cyan-200 shadow-[0_0_8px_rgba(200,255,255,0.75)]' : 'bg-violet-400'}`} />
                        )}
                      </>
                    )}
                  </NavLink>
                    )
                  })}
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
                {items.map(item => {
                  const frostDash = item.to === '/' && privateTicketNavAlert
                  return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    onClick={handleNav}
                    className={({ isActive }) => {
                      const base = 'flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-150 group'
                      if (frostDash) {
                        if (isActive) {
                          return `${base} text-cyan-50 border border-white/30 bg-white/[0.14] backdrop-blur-md shadow-[0_0_26px_rgba(200,245,255,0.22)] ring-1 ring-cyan-100/35`
                        }
                        return `${base} text-cyan-100/95 border border-white/22 bg-white/[0.08] backdrop-blur-sm shadow-[0_0_20px_rgba(220,250,255,0.14)] ring-1 ring-white/15 hover:bg-white/[0.12]`
                      }
                      return `${base} ${isActive ? 'text-white' : 'text-white/40 hover:text-white/80 hover:bg-white/5'}`
                    }}
                    style={({ isActive }) => {
                      if (frostDash) return {}
                      return isActive
                        ? { background: 'linear-gradient(135deg, rgba(124,58,237,0.3), rgba(168,85,247,0.15))', boxShadow: '0 0 20px rgba(139,92,246,0.15)' }
                        : {}
                    }}
                  >
                    {({ isActive }) => (
                      <>
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                          frostDash
                            ? isActive
                              ? 'bg-cyan-400/25 shadow-[0_0_14px_rgba(200,255,255,0.35)] border border-white/20'
                              : 'bg-white/15 border border-white/15'
                            : isActive
                              ? 'bg-violet-500 shadow-lg shadow-violet-500/30'
                              : 'bg-white/5 group-hover:bg-white/10'
                        }`}>
                          <item.icon size={14} className={frostDash ? 'text-cyan-100' : (isActive ? 'text-white' : 'text-white/50')} />
                        </div>
                        <span className="truncate">{item.label}</span>
                        {isActive && (
                          <div className={`mr-auto w-1.5 h-1.5 rounded-full flex-shrink-0 ${frostDash ? 'bg-cyan-200 shadow-[0_0_8px_rgba(200,255,255,0.75)]' : 'bg-violet-400'}`} />
                        )}
                      </>
                    )}
                  </NavLink>
                  )
                })}
              </div>
            </div>
          )
        })}
      </nav>

      {/* ── User ─────────────────────────────── */}
      <div className="relative z-10 p-4 border-t border-white/5 space-y-2">
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
        {typeof __BUILD_ID__ !== 'undefined' && __BUILD_ID__ ? (
          <p className="text-white/30 text-[9px] text-center leading-tight px-1" title="يتحدّد عند كل npm run build:staging — إن لم يتغيَر بعد الرفع فالمتصفح أو السيرفر يعرض نسخة قديمة">
            واجهة: {__BUILD_ID__}
          </p>
        ) : null}
      </div>
    </aside>
  )
}
