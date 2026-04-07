import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Menu, Package, FlaskConical } from 'lucide-react'
import Sidebar from './Sidebar'
import FloatingCallBar from './FloatingCallBar'
import { useAuth } from '../contexts/AuthContext'
import { PrivateTicketsAlertProvider } from '../contexts/PrivateTicketsAlertContext'

// يظهر الشريط فقط في بناء البيئة التجريبية
const IS_STAGING = typeof __STAGING__ !== 'undefined' && __STAGING__

// الأدوار التي تستخدم زر الاتصال العائم (الموظفون المباشرون فقط)
const FLOATING_CALL_ROLES = ['inactive_manager', 'active_manager', 'incubation_officer']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()
  const { pathname } = useLocation()
  /** التحقيق السريع: عرض كامل ملتصق بحواف منطقة المحتوى (دون p-4 الافتراضية) */
  const isQuickVerification = pathname === '/quick-verification'

  return (
    <PrivateTicketsAlertProvider>
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

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:mr-60">
        {/* Mobile top header — زجاجي على التحقق السريع ليتماشى مع الهيدر البنفسجي */}
        <header
          className={
            isQuickVerification
              ? 'lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-violet-200/35 bg-white/75 px-4 py-3 shadow-[0_8px_30px_-12px_rgba(75,0,130,0.12)] backdrop-blur-xl'
              : 'lg:hidden sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 shadow-sm'
          }
        >
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
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 flex items-center justify-center">
              <Package size={14} className="text-white" />
            </div>
            <span className="font-bold text-slate-800 text-base">نظام النورس</span>
          </div>
          {/* spacer to center the logo */}
          <div className="w-10" />
        </header>

        {/* شريط البيئة التجريبية */}
        {IS_STAGING && (
          <div
            className={
              isQuickVerification
                ? 'sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-violet-500/35 bg-violet-950/55 py-1.5 text-center shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-xl'
                : 'sticky top-0 z-30 flex items-center justify-center gap-2 border-b border-violet-700/40 bg-violet-900/80 py-1 text-center backdrop-blur-md'
            }
          >
            <FlaskConical size={11} className="text-violet-300" />
            <p className="text-violet-200 text-[10px] font-semibold">
              بيئة تجريبية — قاعدة بيانات مستقلة
            </p>
            <FlaskConical size={11} className="text-violet-300" />
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
    </PrivateTicketsAlertProvider>
  )
}
