import { createContext, useContext, useState, useEffect } from 'react'
import { login as apiLogin } from '../services/api'

const AuthContext = createContext(null)

export const ROLES = {
  executive:          { label: 'المدير التنفيذي',       views: ['dashboard', 'new', 'active', 'hot_inactive', 'cold_inactive', 'incubation', 'tasks', 'users'] },
  active_manager:     { label: 'مسؤول المتاجر النشطة',  views: ['dashboard', 'active', 'tasks'] },
  inactive_manager:   { label: 'مسؤول الاستعادة',        views: ['dashboard', 'hot_inactive', 'cold_inactive', 'tasks'] },
  incubation_manager: { label: 'مسؤول المتاجر الجديدة', views: ['dashboard', 'new', 'incubation', 'tasks'] },
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
    const res = await apiLogin(username, password)
    if (!res.success) throw new Error(res.error || 'بيانات غير صحيحة')
    localStorage.setItem('nawras_session', JSON.stringify(res.user))
    setUser(res.user)
    return res.user
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
