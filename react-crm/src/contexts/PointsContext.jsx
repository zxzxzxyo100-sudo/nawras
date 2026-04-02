import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getMyStats } from '../services/api'
import { useAuth } from './AuthContext'

const PointsContext = createContext(null)

export const DAILY_GOAL = 20   // هدف المكالمات اليومي

export function PointsProvider({ children }) {
  const { user } = useAuth()

  const [totalPoints, setTotalPoints] = useState(0)
  const [todayPoints, setTodayPoints] = useState(0)
  const [todayCalls,  setTodayCalls]  = useState(0)
  const [weekData,    setWeekData]    = useState([])
  const [recent,      setRecent]      = useState([])
  const [loading,     setLoading]     = useState(false)

  // عدد النقاط المُكتسبة للعرض الفوري (animation trigger)
  const [lastEarned, setLastEarned]   = useState(null)

  const load = useCallback(async () => {
    if (!user?.fullname) return
    setLoading(true)
    try {
      const res = await getMyStats(user.fullname)
      if (res.success) {
        setTotalPoints(res.total_points || 0)
        setTodayPoints(res.today_points || 0)
        setTodayCalls(res.today_calls  || 0)
        setWeekData(res.week_data      || [])
        setRecent(res.recent           || [])
      }
    } catch { /* ignore */ }
    setLoading(false)
  }, [user?.fullname])

  useEffect(() => { load() }, [load])

  // يُستدعى بعد حفظ مكالمة لتحديث النقاط فوراً
  function onCallSaved(pointsEarned = 10) {
    setTotalPoints(p => p + pointsEarned)
    setTodayPoints(p => p + pointsEarned)
    setTodayCalls(c  => c + 1)
    setLastEarned({ points: pointsEarned, at: Date.now() })
    // مزامنة كاملة بعد ثانية
    setTimeout(load, 1200)
  }

  const goalPct = Math.min(100, Math.round((todayCalls / DAILY_GOAL) * 100))

  return (
    <PointsContext.Provider value={{
      totalPoints, todayPoints, todayCalls,
      weekData, recent, loading,
      goalPct, lastEarned,
      onCallSaved, reload: load,
    }}>
      {children}
    </PointsContext.Provider>
  )
}

export const usePoints = () => useContext(PointsContext)
