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
  const [loadError,   setLoadError]   = useState(null)

  // ── حالة الأنيميشن (Global — تُعرض في App.jsx فوق كل شيء) ──────
  const [coinTrigger,  setCoinTrigger]  = useState(null)   // timestamp لتشغيل العملات
  const [earnedPoints, setEarnedPoints] = useState(0)      // نقاط هذه الجلسة
  const [showJackpot,  setShowJackpot]  = useState(false)  // 🎉 احتفال الهدف

  // المعرّف الفريد: fullname أولاً، وإلا username
  const userId = user?.fullname || user?.username || ''

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMyStats(userId)
      if (res.success) {
        setTotalPoints(res.total_points || 0)
        setTodayPoints(res.today_points || 0)
        setTodayCalls(res.today_calls  || 0)
        setWeekData(res.week_data      || [])
        setRecent(res.recent           || [])
      } else {
        setLoadError(res.error || 'فشل تحميل النقاط')
      }
    } catch (e) {
      setLoadError('تعذّر الاتصال بالخادم')
    }
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  // يُستدعى بعد حفظ مكالمة — يُحدّث الحالة ويُطلق الأنيميشن
  function onCallSaved(pointsEarned = 10) {
    setTodayCalls(prev => {
      const next = prev + 1
      // هل أكمل الهدف للتو؟
      if (next >= DAILY_GOAL && prev < DAILY_GOAL) {
        // أطلق الاحتفال بعد لحظة حتى تظهر العملات أولاً
        setTimeout(() => setShowJackpot(true), 600)
      }
      return next
    })
    setTotalPoints(p => p + pointsEarned)
    setTodayPoints(p => p + pointsEarned)

    // أطلق أنيميشن العملات
    setEarnedPoints(pointsEarned)
    setCoinTrigger(Date.now())

    // مزامنة كاملة من الـ API بعد ثانية
    setTimeout(load, 1200)
  }

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
