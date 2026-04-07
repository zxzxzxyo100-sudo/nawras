import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Package, FlaskConical } from 'lucide-react'
import Sidebar from './Sidebar'
import FloatingCallBar from './FloatingCallBar'
import { NawrasHeroImageLayer, NawrasTaglineStack } from './NawrasBrandBackdrop'
import { useAuth } from '../contexts/AuthContext'
import { PrivateTicketsAlertProvider } from '../contexts/PrivateTicketsAlertContext'

// يظهر الشريط فقط في بناء البيئة التجريبية
const IS_STAGING = typeof __STAGING__ !== 'undefined' && __STAGING__

// الأدوار التي تستخدم زر الاتصال العائم (الموظفون المباشرون فقط)
const FLOATING_CALL_ROLES = ['inactive_manager', 'active_manager', 'incubation_officer']

function LayoutInner() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()
  /** التحقيق السريع: عرض كامل ملتصق بحواف منطقة المحتوى (دون p-4 الافتراضية) */
  const isQuickVerification = pathname === '/quick-verification'

  return (
    <div className="flex min-h-screen bg-slate-50" dir="rtl">
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
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
              <Package size={14} className="text-white" />
            </div>
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
          <div className="relative z-10 hidden lg:flex items-center justify-between gap-4 overflow-hidden border-b border-slate-200/90 bg-white/95 px-6 py-2.5 shadow-sm backdrop-blur-md">
            <NawrasHeroImageLayer opacity={0.11} footerCropPct={15} />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-l from-slate-50/95 via-white/88 to-indigo-50/40"
              aria-hidden
            />
            <div className="relative z-10 flex min-w-0 items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 shadow-md shadow-violet-500/25">
                <Package size={16} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-black text-slate-800">نظام النورس — CRM</p>
                <p className="text-[11px] text-slate-500">لوحة التحكم والمهام</p>
              </div>
            </div>
            <NawrasTaglineStack className="relative z-10 max-w-[min(100%,280px)] shrink-0" />
          </div>
        )}

        <main
          className={`flex-1 overflow-auto ${isQuickVerification ? 'p-0' : 'p-4 lg:p-6'}`}
        >
          <Outlet />
        </main>
      </div>

      {/* زر الاتصال العائم — للموظفين فقط */}
      {FLOATING_CALL_ROLES.includes(user?.role) && <FloatingCallBar />}
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
