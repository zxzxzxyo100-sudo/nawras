import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu, Package, FlaskConical } from 'lucide-react'
import Sidebar from './Sidebar'
import FloatingCallBar from './FloatingCallBar'
import { useAuth } from '../contexts/AuthContext'

// يظهر الشريط فقط في بناء البيئة التجريبية
const IS_STAGING = typeof __STAGING__ !== 'undefined' && __STAGING__

// الأدوار التي تستخدم زر الاتصال العائم (الموظفون المباشرون فقط)
const FLOATING_CALL_ROLES = ['inactive_manager', 'active_manager', 'incubation_officer']

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user } = useAuth()

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

      {/* Main content */}
      <div className="flex-1 flex flex-col lg:mr-60">
        {/* Mobile top header */}
        <header className="lg:hidden sticky top-0 z-20 bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200 transition-colors"
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
            className="sticky top-0 z-30 flex flex-col items-center justify-center py-1.5 text-center"
            style={{ background: 'repeating-linear-gradient(45deg, #991b1b, #991b1b 12px, #b91c1c 12px, #b91c1c 24px)' }}
          >
            <div className="flex items-center gap-2 text-xs font-black text-white">
              <FlaskConical size={13} />
              ⚠️ بيئة تجريبية — تستخدم قاعدة البيانات الحقيقية!
              <FlaskConical size={13} />
            </div>
            <p className="text-red-200 text-[10px] font-medium mt-0.5">
              أي حذف أو تعديل هنا سيؤثر على الموقع الرسمي — ستظهر رسالة تأكيد قبل كل إجراء
            </p>
          </div>
        )}

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>

      {/* زر الاتصال العائم — للموظفين فقط */}
      {FLOATING_CALL_ROLES.includes(user?.role) && <FloatingCallBar />}
    </div>
  )
}
