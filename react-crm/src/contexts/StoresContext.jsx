import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { getAllStores, getStoreStates, getAllCallLogs, getAllRecoveryCalls } from '../services/api'
import { useAuth } from './AuthContext'

const StoresContext = createContext(null)

export function StoresProvider({ children }) {
  const { user } = useAuth()
  const [stores, setStores]         = useState({ incubating: [], active: [], inactive: [] })
  const [counts, setCounts]         = useState({ incubating: 0, active: 0, inactive: 0, total: 0 })
  const [storeStates, setStoreStates] = useState({})
  const [callLogs, setCallLogs]     = useState({})
  const [recoveryCalls, setRecoveryCalls] = useState({})
  const [loading, setLoading]       = useState(false)
  const [lastLoaded, setLastLoaded] = useState(null)
  const [error, setError]           = useState(null)

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

      // merge API data with DB overrides
      const mergedStores = {
        incubating: apiResult.data.incubating || [],
        active:     apiResult.data.active     || [],
        inactive:   apiResult.data.inactive   || [],
      }

      // build state map keyed by store id
      const stateMap = {}
      ;(statesRes.data || []).forEach(s => { stateMap[s.store_id] = s })

      setStoreStates(stateMap)
      setCallLogs(callsRes.data || {})
      setRecoveryCalls(rcallsRes.data || {})
      setStores(mergedStores)
      setCounts(apiResult.counts)
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

  // flat list of all stores with category set
  const allStores = [
    ...stores.incubating.map(s => ({ ...s, category: storeStates[s.id]?.category || 'incubating' })),
    ...stores.active.map(s =>     ({ ...s, category: storeStates[s.id]?.category || 'active'     })),
    ...stores.inactive.map(s =>   ({ ...s, category: storeStates[s.id]?.category || 'inactive'   })),
  ]

  return (
    <StoresContext.Provider value={{
      stores, counts, allStores,
      storeStates, callLogs, recoveryCalls,
      loading, error, lastLoaded, reload: load,
    }}>
      {children}
    </StoresContext.Provider>
  )
}

export const useStores = () => useContext(StoresContext)
