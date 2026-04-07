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
import {
  deviationTicketMeetsUrgentShipmentThreshold,
  getDaysSinceShipFromDeviationTicket,
} from '../utils/deviationTicket'

const PrivateTicketsAlertContext = createContext(null)

const TICKET_TYPE_DEVIATION = 'deviation_alert'

/** تنبيهات التذاكر الخاصة؛ تذاكر الانحراف تفرض وضع «توقف عن كل شيء» */
export function PrivateTicketsAlertProvider({ children }) {
  const { user } = useAuth()
  const [openCount, setOpenCount] = useState(0)
  const [openMandatoryCount, setOpenMandatoryCount] = useState(0)
  const [pulseTick, setPulseTick] = useState(0)
  const [openDeviationTickets, setOpenDeviationTickets] = useState([])
  const [deviationOverlayPulse, setDeviationOverlayPulse] = useState(0)
  const lastOpenRef = useRef(null)
  const lastDeviationCountRef = useRef(null)

  const staffAlert = Boolean(user?.username && user?.role && user.role !== 'executive')

  const refresh = useCallback(async () => {
    if (!staffAlert || !user?.username) {
      lastOpenRef.current = null
      lastDeviationCountRef.current = null
      setOpenCount(0)
      setOpenMandatoryCount(0)
      setOpenDeviationTickets([])
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
      const deviations = open.filter(
        t => (t.ticket_type || 'general') === TICKET_TYPE_DEVIATION
      )
      /** قفل واجهة التنبيه فقط لتذاكر تحقق ≥ عتبة أيام منذ آخر شحنة */
      const urgentDeviations = deviations
        .filter(deviationTicketMeetsUrgentShipmentThreshold)
        .sort((a, b) => {
          const da = getDaysSinceShipFromDeviationTicket(a) ?? 0
          const db = getDaysSinceShipFromDeviationTicket(b) ?? 0
          return db - da
        })
      const devN = urgentDeviations.length

      const prev = lastOpenRef.current
      if (prev !== null && n > prev) {
        setPulseTick(t => t + 1)
      }
      lastOpenRef.current = n

      const prevDev = lastDeviationCountRef.current
      if (prevDev !== null && devN > prevDev) {
        setDeviationOverlayPulse(p => p + 1)
      }
      lastDeviationCountRef.current = devN

      setOpenCount(n)
      setOpenMandatoryCount(m)
      setOpenDeviationTickets(urgentDeviations)
    } catch {
      /* ignore */
    }
  }, [staffAlert, user?.username, user?.role])

  useEffect(() => {
    lastOpenRef.current = null
    lastDeviationCountRef.current = null
    void refresh()
  }, [user?.username, user?.role, refresh])

  useEffect(() => {
    if (!staffAlert) return
    const intervalMs = openDeviationTickets.length > 0 ? 5000 : 8000
    const id = setInterval(() => void refresh(), intervalMs)
    return () => clearInterval(id)
  }, [staffAlert, refresh, openDeviationTickets.length])

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

  const deviationLockdown = openDeviationTickets.length > 0
  const primaryDeviationTicket = openDeviationTickets[0] ?? null

  const value = useMemo(
    () => ({
      shouldAlert: staffAlert && openCount > 0,
      openCount,
      openMandatoryCount,
      pulseTick,
      refreshPrivateTicketsAlert: refresh,
      deviationLockdown,
      openDeviationTickets,
      primaryDeviationTicket,
      deviationOverlayPulse,
    }),
    [
      staffAlert,
      openCount,
      openMandatoryCount,
      pulseTick,
      refresh,
      deviationLockdown,
      openDeviationTickets,
      primaryDeviationTicket,
      deviationOverlayPulse,
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
      deviationLockdown: false,
      openDeviationTickets: [],
      primaryDeviationTicket: null,
      deviationOverlayPulse: 0,
    }
  }
  return ctx
}
