import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-screen bg-slate-100" dir="rtl">
      <Sidebar />
      <main className="flex-1 mr-64 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
