import { useState, useEffect, useMemo } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Menu, FlaskConical, Bell, ChevronLeft, LogOut, Settings, Ticket, AlertCircle } from 'lucide-react'
import Sidebar from './Sidebar'
import MobileBottomNav from './MobileBottomNav'
import FloatingCallBar from './FloatingCallBar'
import HeaderSearch from './HeaderSearch'
import StoreDrawer from './StoreDrawer'
import SettingsModal from './SettingsModal'
import { NawrasHeroImageLayer, NawrasTaglineStack } from './NawrasBrandBackdrop'
import { useAuth, ROLES } from '../contexts/AuthContext'
import { PrivateTicketsAlertProvider, usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'
import { labelForPath } from '../utils/breadcrumb'
import logo from '../assets/images/logo.png'

// يظهر الشريط فقط في بناء البيئة التجريبية
const IS_STAGING = typeof __STAGING__ !== 'undefined' && __STAGING__

// الأدوار التي تستخدم زر الاتصال العائم (الموظفون المباشرون فقط)
const FLOATING_CALL_ROLES = ['inactive_manager', 'active_manager', 'incubation_officer']

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [headerOpenStore, setHeaderOpenStore] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { openCount, openTickets } = usePrivateTicketsAlert()
  /** التحقيق السريع: عرض كامل ملتصق بحواف منطقة المحتوى (دون p-4 الافتراضية) */
  const isQuickVerification = pathname === '/quick-verification'
  const currentPageLabel = useMemo(() => labelForPath(pathname), [pathname])
  const roleLabel = ROLES[user?.role]?.label ?? ''
  const initials = user?.fullname?.split(' ').map(w => w[0]).join('').slice(0, 2) ?? 'م'

  function handleLogout() {
    setUserMenuOpen(false)
    logout()
    navigate('/login')
  }

  useEffect(() => {
    if (!sidebarOpen) return undefined
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [sidebarOpen])

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950" dir="rtl">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop overlay on mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col lg:mr-60 transition-shadow duration-300">
        {/* Mobile top header — زجاجي على التحقق السريع ليتماشى مع الهيدر البنفسجي */}
        <header
          className={
            isQuickVerification
              ? 'lg:hidden sticky top-0 z-20 relative overflow-hidden flex items-center justify-between border-b border-violet-200/35 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(75,0,130,0.12)] backdrop-blur-xl'
              : 'lg:hidden sticky top-0 z-20 relative overflow-hidden flex items-center justify-between border-b border-slate-200 px-4 py-3 shadow-sm'
          }
        >
          <NawrasHeroImageLayer
            opacity={isQuickVerification ? 0.14 : 0.12}
            footerCropPct={15}
            className={isQuickVerification ? 'mix-blend-soft-light' : ''}
          />
          <div
            className={
              isQuickVerification
                ? 'pointer-events-none absolute inset-0 bg-gradient-to-l from-violet-950/80 via-violet-900/55 to-violet-950/75'
                : 'pointer-events-none absolute inset-0 bg-gradient-to-l from-white/92 via-white/78 to-white/88'
            }
            aria-hidden
          />
          <button
            onClick={() => setSidebarOpen(true)}
            className={
              isQuickVerification
                ? 'flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100/80 text-violet-800 transition-colors hover:bg-violet-100'
                : 'flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200'
            }
          >
            <Menu size={20} />
          </button>
          <div className="relative z-10 flex min-w-0 flex-1 items-center justify-center gap-2 px-2">
            <img
              src={logo}
              alt="شعار النوارس"
              className="object-contain shrink-0"
              style={{
                height: '38px',
                width: 'auto',
                marginInlineEnd: '10px',
                filter: isQuickVerification
                  ? 'drop-shadow(0 0 6px rgba(255,255,255,0.25))'
                  : 'drop-shadow(0 0 8px rgba(0,0,0,0.1))',
              }}
            />
            <div className="min-w-0 text-center">
              <span
                className={`block font-bold text-base truncate ${
                  isQuickVerification ? 'text-white' : 'text-slate-800'
                }`}
              >
                نظام النورس
              </span>
              <NawrasTaglineStack
                light={isQuickVerification}
                compact
                className="mt-0.5 max-w-[14rem] mx-auto"
              />
            </div>
          </div>
          <div className="relative z-10 w-10 shrink-0" />
        </header>

        {/* شريط البيئة التجريبية */}
        {IS_STAGING && (
          <div
            className={
              isQuickVerification
                ? 'sticky top-0 z-30 relative overflow-hidden flex items-center justify-center gap-2 border-b border-violet-500/35 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl'
                : 'sticky top-0 z-30 relative overflow-hidden flex items-center justify-center gap-2 border-b border-violet-700/40 py-1 text-center backdrop-blur-md'
            }
          >
            <NawrasHeroImageLayer opacity={0.06} footerCropPct={18} className="mix-blend-overlay" />
            <div
              className={
                isQuickVerification
                  ? 'pointer-events-none absolute inset-0 bg-violet-950/72'
                  : 'pointer-events-none absolute inset-0 bg-violet-900/78'
              }
              aria-hidden
            />
            <FlaskConical size={11} className="relative z-10 text-violet-300" />
            <p className="relative z-10 text-violet-200 text-[10px] font-semibold">
              بيئة تجريبية — قاعدة بيانات مستقلة
            </p>
            <FlaskConical size={11} className="relative z-10 text-violet-300" />
          </div>
        )}

        {/* شريط علوي للشاشات الكبيرة — كل الصفحات ما عدا التحقيق السريع (له هيدر خاص) */}
        {!isQuickVerification && (
          <div className="relative z-20 hidden lg:flex items-center gap-4 overflow-visible border-b border-slate-200/90 dark:border-slate-800 bg-white/95 dark:bg-slate-900/95 px-6 py-2.5 shadow-sm backdrop-blur-md">
            <NawrasHeroImageLayer opacity={0.11} footerCropPct={15} />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-l from-slate-50/95 via-white/88 to-indigo-50/40"
              aria-hidden
            />

            {/* يمين: شعار + Breadcrumb */}
            <div className="relative z-10 flex min-w-0 items-center gap-3 shrink-0">
              <img
                src={logo}
                alt="شعار النوارس"
                className="object-contain shrink-0"
                style={{
                  height: '36px',
                  width: 'auto',
                  filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.1))',
                }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-medium">
                  <span>الرئيسية</span>
                  {currentPageLabel && currentPageLabel !== 'لوحة التحكم' && (
                    <>
                      <ChevronLeft size={12} className="shrink-0" />
                      <span className="text-slate-600 font-semibold truncate max-w-[220px]">{currentPageLabel}</span>
                    </>
                  )}
                </div>
                <p className="text-sm font-black text-slate-800 truncate">نظام النورس — CRM</p>
              </div>
            </div>

            {/* المنتصف: بحث */}
            <div className="relative z-10 flex-1 min-w-0 max-w-md mx-auto">
              <HeaderSearch onOpenStore={setHeaderOpenStore} />
            </div>

            {/* يسار: إشعارات + المستخدم */}
            <div className="relative z-10 flex items-center gap-2 shrink-0">
              <NawrasTaglineStack className="hidden xl:block max-w-[180px] me-1" />
              <div className="relative">
                <button
                  type="button"
                  title="الإشعارات"
                  onClick={() => setNotifOpen(o => !o)}
                  className="relative flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  <Bell size={17} />
                  {openCount > 0 && (
                    <span className="absolute -top-0.5 -end-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-black text-white">
                      {openCount > 9 ? '9+' : openCount}
                    </span>
                  )}
                </button>
                {notifOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setNotifOpen(false)} />
                    <div className="absolute end-0 top-full mt-2 z-20 w-80 max-w-[90vw] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)]">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100">الإشعارات</p>
                        {openCount > 0 && (
                          <span className="text-[10px] font-bold text-red-600">{openCount} مفتوحة</span>
                        )}
                      </div>
                      <div className="max-h-80 overflow-y-auto">
                        {openTickets.length === 0 ? (
                          <p className="px-3 py-6 text-center text-[11px] text-slate-400">لا توجد تذاكر خاصة مفتوحة حالياً</p>
                        ) : (
                          openTickets.map(t => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => {
                                setNotifOpen(false)
                                navigate('/')
                              }}
                              className="w-full flex items-start gap-2 px-3 py-2.5 text-start hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-b border-slate-50 dark:border-slate-800 last:border-b-0"
                            >
                              {Number(t.is_mandatory) === 1 ? (
                                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                              ) : (
                                <Ticket size={14} className="mt-0.5 shrink-0 text-violet-500" />
                              )}
                              <span className="min-w-0">
                                <span className="block text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{t.title}</span>
                                <span className="block text-[11px] text-slate-500 dark:text-slate-400 truncate">{t.body}</span>
                                <span className="block text-[10px] text-slate-400 mt-0.5">من: {t.created_by_username}</span>
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setUserMenuOpen(o => !o)}
                  className="flex items-center gap-2 rounded-xl px-1.5 py-1 hover:bg-slate-100 transition-colors"
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-white font-black text-[11px] shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                  >
                    {initials}
                  </div>
                  <div className="hidden xl:block text-start leading-tight">
                    <p className="text-xs font-bold text-slate-800 truncate max-w-[110px]">{user?.fullname}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[110px]">{roleLabel}</p>
                  </div>
                </button>
                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute end-0 top-full mt-2 z-20 w-52 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 py-1.5 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)]">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{user?.fullname}</p>
                        <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
                      </div>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={13} />
                        تسجيل الخروج
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setUserMenuOpen(false)
                          setSettingsOpen(true)
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors border-t border-slate-100 dark:border-slate-800"
                      >
                        <Settings size={13} />
                        الإعدادات
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {headerOpenStore && (
          <StoreDrawer store={headerOpenStore} onClose={() => setHeaderOpenStore(null)} />
        )}

        {settingsOpen && <SettingsModal onClose={() => setSettingsOpen(false)} />}

        <main
          className={`flex-1 overflow-auto pb-[calc(72px+env(safe-area-inset-bottom))] lg:pb-0 ${isQuickVerification ? 'p-0' : 'p-4 lg:p-6'}`}
        >
          <Outlet />
        </main>
      </div>

      {/* زر الاتصال العائم — للموظفين فقط */}
      {FLOATING_CALL_ROLES.includes(user?.role) && !sidebarOpen && <FloatingCallBar />}

      {/* شريط التنقّل السفلي للموبايل */}
      {!sidebarOpen && <MobileBottomNav />}
    </div>
  )
}

export default function Layout() {
  return (
    <PrivateTicketsAlertProvider>
      <LayoutInner />
    </PrivateTicketsAlertProvider>
  )
}
