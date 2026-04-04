import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getMyStats } from '../services/api'
import { useAuth } from './AuthContext'

const PointsContext = createContext(null)

export const DAILY_GOAL = 20   // هدف المكالمات اليومي

export function PointsProvider({ children }) {
  const { user, loading: authLoading } = useAuth()

  const [totalPoints, setTotalPoints] = useState(0)
  const [todayPoints, setTodayPoints] = useState(0)
  const [todayCalls,  setTodayCalls]  = useState(0)
  const [weekData,    setWeekData]    = useState([])
  const [recent,      setRecent]      = useState([])
  const [loading,     setLoading]     = useState(false)
  const [loadError,   setLoadError]   = useState(null)

  const [coinTrigger,  setCoinTrigger]  = useState(null)
  const [earnedPoints, setEarnedPoints] = useState(0)
  const [showJackpot,  setShowJackpot]  = useState(false)

  const userId = user?.fullname || user?.username || ''

  const load = useCallback(async () => {
    if (authLoading) return
    if (!userId) {
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const res = await getMyStats(userId)
      if (res && res.success) {
        setTotalPoints(res.total_points || 0)
        setTodayPoints(res.today_points || 0)
        setTodayCalls(res.today_calls  || 0)
        setWeekData(res.week_data      || [])
        setRecent(res.recent           || [])
      } else {
        setLoadError(res?.error || 'فشل تحميل النقاط')
      }
    } catch (e) {
      const st = e.response?.status
      const data = e.response?.data
      const apiErr = typeof data === 'object' && data?.error ? data.error : null
      let msg = 'تعذّر الاتصال بالخادم'
      if (apiErr) {
        msg = apiErr
      } else if (e.code === 'ERR_NETWORK' || e.message === 'Network Error') {
        msg = 'لا يوجد رد من الخادم. تأكد أن مجلد api-php موجود على نفس الموقع وأن الرابط يبدأ بـ /api-php/'
      } else if (st === 404) {
        msg = 'مسار API غير موجود (404) — تحقق من نشر مجلد api-php'
      } else if (st >= 500) {
        msg = `خطأ خادم (${st}) — غالباً قاعدة البيانات أو ملف PHP`
      }
      setLoadError(msg)
    }
    setLoading(false)
  }, [userId, authLoading])

  useEffect(() => { load() }, [load])

  function onCallSaved(pointsEarned = 10) {
    setTodayCalls(prev => {
      const next = prev + 1
      if (next >= DAILY_GOAL && prev < DAILY_GOAL) {
        setTimeout(() => setShowJackpot(true), 600)
      }
      return next
    })
    setTotalPoints(p => p + pointsEarned)
    setTodayPoints(p => p + pointsEarned)
    setEarnedPoints(pointsEarned)
    setCoinTrigger(Date.now())
    setTimeout(load, 1200)
  }

  const goalPct = Math.min(100, Math.round((todayCalls / DAILY_GOAL) * 100))

  return (
    <PointsContext.Provider value={{
      totalPoints, todayPoints, todayCalls,
      weekData, recent, loading, loadError,
      goalPct,
      coinTrigger, earnedPoints, showJackpot, setShowJackpot,
      onCallSaved, reload: load,
    }}>
      {children}
    </PointsContext.Provider>
  )
}

export const usePoints = () => useContext(PointsContext)
