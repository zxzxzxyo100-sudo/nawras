import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, formatAuthError } from '../services/api'

const AuthContext = createContext(null)

export const ROLES = {
  /** مسار الاحتضان (incubation): التنفيذي + مسؤول المتاجر الجديدة */
  executive:          { label: 'المدير التنفيذي',       views: ['dashboard', 'quick_verification', 'new', 'active', 'hot_inactive', 'cold_inactive', 'incubation', 'users', 'vip_merchants', 'staff_performance'] },
  /** بدون مسار الاحتضان — نشط يشحن + لوحة التحكم — التحقيق السريع للتنفيذي فقط */
  active_manager:     { label: 'مسؤول المتاجر النشطة',  views: ['dashboard', 'active', 'tasks'] },
  inactive_manager:   { label: 'مسؤول الاستعادة',        views: ['dashboard', 'hot_inactive', 'cold_inactive', 'tasks'] },
  /** موظف مبيعات / احتضان: متاجر جديدة + مسار الاحتضان — دون التحقيق السريع */
  incubation_manager: { label: 'مسؤول المتاجر', views: ['dashboard', 'new', 'incubation', 'tasks'] },
  data_collector:     { label: 'جامع بيانات', views: ['dashboard', 'lead_management'] },
  admin:              { label: 'مدير النظام', views: ['dashboard', 'users', 'lead_management'] },
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('nawras_session')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        const roleRaw = typeof u?.role === 'string' ? u.role.trim() : u?.role
        const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : roleRaw
        if (u && role && ROLES[role]) setUser({ ...u, role })
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  async function login(username, password) {
    try {
      const res = await apiLogin(username, password)
      if (!res?.success) throw new Error(res?.error || 'بيانات غير صحيحة')
      const ru = res.user
      const roleRaw = typeof ru?.role === 'string' ? ru.role.trim() : ru?.role
      const role = typeof roleRaw === 'string' ? roleRaw.toLowerCase() : roleRaw
      const normalized = ru && role ? { ...ru, role } : ru
      localStorage.setItem('nawras_session', JSON.stringify(normalized))
      setUser(normalized)
      return res.user
    } catch (err) {
      const e = err instanceof Error ? err : new Error(String(err))
      throw new Error(formatAuthError(e))
    }
  }

  function logout() {
    localStorage.removeItem('nawras_session')
    setUser(null)
  }

  function can(view) {
    if (!user) return false
    const r = typeof user.role === 'string' ? user.role.trim().toLowerCase() : user.role
    return ROLES[r]?.views.includes(view) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, can, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
