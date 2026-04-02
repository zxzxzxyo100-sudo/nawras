import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getAllStores, getStoreStates, getAllCallLogs, getAllRecoveryCalls } from '../services/api'
import { useAuth } from './AuthContext'

const StoresContext = createContext(null)

export function StoresProvider({ children }) {
  const { user } = useAuth()

  const [stores, setStores] = useState({
    incubating:      [],
    active_shipping: [],
    hot_inactive:    [],
    cold_inactive:   [],
  })
  const [incubationPath, setIncubationPath] = useState({
    new_48h: [], incubating: [],
  })
  const [incubationCounts, setIncubationCounts] = useState({
    new_48h: 0, incubating: 0, total: 0,
  })
  const [counts, setCounts]               = useState({
    incubating: 0, active_shipping: 0, hot_inactive: 0, cold_inactive: 0,
    total_active: 0, total: 0,
  })
  const [storeStates, setStoreStates]     = useState({})
  const [callLogs, setCallLogs]           = useState({})
  const [recoveryCalls, setRecoveryCalls] = useState({})
  const [loading, setLoading]             = useState(false)
  const [lastLoaded, setLastLoaded]       = useState(null)
  const [error, setError]                 = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [apiResult, statesRes, callsRes, rcallsRes] = await Promise.all([
        getAllStores(),
        getStoreStates(),
        getAllCallLogs(),
        getAllRecoveryCalls(),
      ])
      if (!apiResult.success) throw new Error('فشل جلب البيانات')

      const stateMap = {}
      ;(statesRes.data || []).forEach(s => { stateMap[s.store_id] = s })

      setStoreStates(stateMap)
      setCallLogs(callsRes.data || {})
      setRecoveryCalls(rcallsRes.data || {})
      setStores({
        incubating:      apiResult.data.incubating      || [],
        active_shipping: apiResult.data.active_shipping || [],
        hot_inactive:    apiResult.data.hot_inactive    || [],
        cold_inactive:   apiResult.data.cold_inactive   || [],
      })
      setCounts(apiResult.counts)

      // مسار الاحتضان: خانتان فقط (new_48h + incubating)
      // Q3 (graduated) → active_shipping مباشرةً من PHP
      // Q2 (never_started) → cold_inactive مباشرةً من PHP
      // جاري/تمت الاستعادة → تُدار في خانة غير النشطة عبر DB
      const rawPath = apiResult.incubation_path || {}
      const mergedPath = {
        new_48h:    rawPath.new_48h    || [],
        incubating: rawPath.incubating || [],
      }

      setIncubationPath(mergedPath)
      setIncubationCounts({
        new_48h:    mergedPath.new_48h.length,
        incubating: mergedPath.incubating.length,
        total:      (apiResult.incubation_counts?.total) || 0,
      })
      setLastLoaded(new Date())
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) load()
  }, [user, load])

  // قائمة مسطّحة بكل المتاجر مع الفئة
  const allStores = [
    ...stores.incubating.map(s =>      ({ ...s, category: storeStates[s.id]?.category || 'incubating'      })),
    ...stores.active_shipping.map(s => ({ ...s, category: storeStates[s.id]?.category || 'active_shipping' })),
    ...stores.hot_inactive.map(s =>    ({ ...s, category: storeStates[s.id]?.category || 'hot_inactive'    })),
    ...stores.cold_inactive.map(s =>   ({ ...s, category: storeStates[s.id]?.category || 'cold_inactive'   })),
  ]

  return (
    <StoresContext.Provider value={{
      stores, counts, allStores,
      incubationPath, incubationCounts,
      storeStates, callLogs, recoveryCalls,
      loading, error, lastLoaded, reload: load,
    }}>
      {children}
    </StoresContext.Provider>
  )
}

export const useStores = () => useContext(StoresContext)
