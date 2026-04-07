import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useAuth } from './AuthContext'
import { getExecutivePrivateTickets } from '../services/api'

const PrivateTicketsAlertContext = createContext(null)
/** تنبيهات التذاكر الخاصة العامة فقط */
export function PrivateTicketsAlertProvider({ children }) {
  const { user } = useAuth()
  const [openCount, setOpenCount] = useState(0)
  const [openMandatoryCount, setOpenMandatoryCount] = useState(0)
  const [pulseTick, setPulseTick] = useState(0)
  const lastOpenRef = useRef(null)

  const staffAlert = Boolean(user?.username && user?.role && user.role !== 'executive')

  const refresh = useCallback(async () => {
    if (!staffAlert || !user?.username) {
      lastOpenRef.current = null
      setOpenCount(0)
      setOpenMandatoryCount(0)
      return
    }
    try {
      const res = await getExecutivePrivateTickets({
        username: user.username,
        user_role: user.role || '',
      })
      if (!res?.success) return
      const list = Array.isArray(res.tickets) ? res.tickets : []
      const open = list.filter(t => t.status === 'open')
      const n = open.length
      const m = open.filter(t => Number(t.is_mandatory) === 1).length

      const prev = lastOpenRef.current
      if (prev !== null && n > prev) {
        setPulseTick(t => t + 1)
      }
      lastOpenRef.current = n

      setOpenCount(n)
      setOpenMandatoryCount(m)
    } catch {
      /* ignore */
    }
  }, [staffAlert, user?.username, user?.role])

  useEffect(() => {
    lastOpenRef.current = null
    void refresh()
  }, [user?.username, user?.role, refresh])

  useEffect(() => {
    if (!staffAlert) return
    const id = setInterval(() => void refresh(), 8000)
    return () => clearInterval(id)
  }, [staffAlert, refresh])

  useEffect(() => {
    if (!staffAlert) return
    const onVis = () => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVis)
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('focus', onFocus)
    }
  }, [staffAlert, refresh])

  const value = useMemo(
    () => ({
      shouldAlert: staffAlert && openCount > 0,
      openCount,
      openMandatoryCount,
      pulseTick,
      refreshPrivateTicketsAlert: refresh,
    }),
    [
      staffAlert,
      openCount,
      openMandatoryCount,
      pulseTick,
      refresh,
    ]
  )

  return (
    <PrivateTicketsAlertContext.Provider value={value}>
      {children}
    </PrivateTicketsAlertContext.Provider>
  )
}

export function usePrivateTicketsAlert() {
  const ctx = useContext(PrivateTicketsAlertContext)
  if (!ctx) {
    return {
      shouldAlert: false,
      openCount: 0,
      openMandatoryCount: 0,
      pulseTick: 0,
      refreshPrivateTicketsAlert: async () => {},
    }
  }
  return ctx
}
