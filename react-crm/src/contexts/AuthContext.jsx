import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin, formatAuthError } from '../services/api'

const AuthContext = createContext(null)

export const ROLES = {
  /** مسار الاحتضان (incubation): التنفيذي + مسؤول المتاجر الجديدة */
  executive:          { label: 'المدير التنفيذي',       views: ['dashboard', 'quick_verification', 'new', 'active', 'hot_inactive', 'cold_inactive', 'incubation', 'users', 'vip_merchants', 'manager_analytics'] },
  /** بدون مسار الاحتضان — نشط يشحن + لوحة التحكم — التحقيق السريع للتنفيذي فقط */
  active_manager:     { label: 'مسؤول المتاجر النشطة',  views: ['dashboard', 'active'] },
  inactive_manager:   { label: 'مسؤول الاستعادة',        views: ['dashboard', 'hot_inactive', 'cold_inactive'] },
  /** موظف مبيعات / احتضان: متاجر جديدة + مسار الاحتضان — دون التحقيق السريع */
  incubation_manager: { label: 'مسؤول المتاجر', views: ['dashboard', 'new', 'incubation'] },
}

export function AuthProvider({ children }) {
  const [user, setUser]     = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('nawras_session')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        if (u && ROLES[u.role]) setUser(u)
      } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  async function login(username, password) {
    try {
      const res = await apiLogin(username, password)
      if (!res?.success) throw new Error(res?.error || 'بيانات غير صحيحة')
      localStorage.setItem('nawras_session', JSON.stringify(res.user))
      setUser(res.user)
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
    return ROLES[user.role]?.views.includes(view) ?? false
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, can, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
