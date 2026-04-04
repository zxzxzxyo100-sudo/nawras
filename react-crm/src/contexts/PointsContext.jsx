import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { useAuth } from './AuthContext'

const PointsContext = createContext(null)

export const DAILY_GOAL = 20   // هدف المكالمات اليومي

export function PointsProvider({ children }) {
  const { loading: authLoading } = useAuth()

  const [totalPoints, setTotalPoints] = useState(0)
  const [todayPoints, setTodayPoints] = useState(0)
  const [todayCalls,  setTodayCalls]  = useState(0)
  const [weekData,    setWeekData]    = useState([])
  const [recent,      setRecent]      = useState([])
  const [loading,     setLoading]     = useState(false)
  const [loadError,   setLoadError]   = useState(null)

  // ── حالة الأنيميشن (Global — تُعرض في App.jsx فوق كل شيء) ──────
  const [coinTrigger,  setCoinTrigger]  = useState(null)   // timestamp لتشغيل العملات
  const [earnedPoints, setEarnedPoints] = useState(0)      // نقاط هذه الجلسة
  const [showJackpot,  setShowJackpot]  = useState(false)  // 🎉 احتفال الهدف

  /** تعطيل NRS — لا نستدعي API ولا نحدّث الحالة */
  const load = useCallback(async () => {
    if (authLoading) return
    setTotalPoints(0)
    setTodayPoints(0)
    setTodayCalls(0)
    setWeekData([])
    setRecent([])
    setLoadError(null)
    setLoading(false)
  }, [authLoading])

  useEffect(() => { load() }, [load])

  function onCallSaved() {}

  const goalPct = Math.min(100, Math.round((todayCalls / DAILY_GOAL) * 100))

  return (
    <PointsContext.Provider value={{
      totalPoints, todayPoints, todayCalls,
      weekData, recent, loading, loadError,
      goalPct,
      // Animation state (يُستهلك في App.jsx)
      coinTrigger, earnedPoints, showJackpot, setShowJackpot,
      onCallSaved, reload: load,
    }}>
      {children}
    </PointsContext.Provider>
  )
}

export const usePoints = () => useContext(PointsContext)
