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
    new_48h: [], incubating: [], never_started: [],
    graduated: [], restoring: [], restored: [],
  })
  const [incubationCounts, setIncubationCounts] = useState({
    new_48h: 0, incubating: 0, never_started: 0,
    graduated: 0, restoring: 0, restored: 0, total: 0,
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

      // مسار الاحتضان: دمج بيانات API مع حالة DB
      const rawPath = apiResult.incubation_path || {}
      const mergedPath = {
        new_48h:       rawPath.new_48h       || [],
        incubating:    rawPath.incubating    || [],
        never_started: rawPath.never_started || [],
        graduated:     rawPath.graduated     || [],
        restoring:     rawPath.restoring     || [],
        restored:      rawPath.restored      || [],
      }

      // نقل المتاجر التي وضعها الوكيل يدوياً في "restoring" عبر DB
      // تشمل الفحص في الفئات الأربع الأوتوماتيكية
      Object.entries(stateMap).forEach(([storeId, dbState]) => {
        if (dbState.category !== 'restoring') return
        ;['new_48h', 'incubating', 'never_started', 'graduated'].forEach(bucket => {
          const idx = mergedPath[bucket].findIndex(s => String(s.id) === String(storeId))
          if (idx !== -1) {
            const [store] = mergedPath[bucket].splice(idx, 1)
            store._inc = 'restoring'
            if (!mergedPath.restoring.find(s => s.id === store.id)) {
              mergedPath.restoring.push(store)
            }
          }
        })
      })

      setIncubationPath(mergedPath)
      setIncubationCounts({
        new_48h:       mergedPath.new_48h.length,
        incubating:    mergedPath.incubating.length,
        never_started: mergedPath.never_started.length,
        graduated:     mergedPath.graduated.length,
        restoring:     mergedPath.restoring.length,
        restored:      mergedPath.restored.length,
        total:         (apiResult.incubation_counts?.total) || 0,
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
