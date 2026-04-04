import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  getAllStores, getStoreStates, getAllCallLogs, getAllRecoveryCalls, getAssignments,
  getOrdersSummaryRange,
} from '../services/api'
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
  const [assignments, setAssignments]     = useState({})
  const [callLogs, setCallLogs]           = useState({})
  const [recoveryCalls, setRecoveryCalls] = useState({})
  const [loading, setLoading]             = useState(false)
  const [lastLoaded, setLastLoaded]       = useState(null)
  const [error, setError]                 = useState(null)
  /** نطاق تاريخ طُلبت له أعداد الطرود (آخر 30 يومًا — بدون تقييد 14 يوم) */
  const [shipmentsRangeMeta, setShipmentsRangeMeta] = useState({ from: null, to: null })
  /** كبار التجار: من الخادم (نشط يشحن + total_shipments ≥ 300 + status = active) */
  const [vipMerchants, setVipMerchants] = useState([])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const toDate = new Date()
      const fromDate = new Date()
      const SHIPMENTS_RANGE_DAYS = 30
      fromDate.setDate(fromDate.getDate() - (SHIPMENTS_RANGE_DAYS - 1))
      const rangeTo = toDate.toISOString().slice(0, 10)
      const rangeFrom = fromDate.toISOString().slice(0, 10)

      const [apiResult, statesRes, callsRes, rcallsRes, assignRes, rangeRes] = await Promise.all([
        getAllStores(),
        getStoreStates(),
        getAllCallLogs(),
        getAllRecoveryCalls(),
        getAssignments(),
        getOrdersSummaryRange(rangeFrom, rangeTo).catch(() => ({ success: false, data: [] })),
      ])
      if (!apiResult.success) throw new Error('فشل جلب البيانات')

      const rangeMap = {}
      if (rangeRes?.success && Array.isArray(rangeRes.data)) {
        rangeRes.data.forEach(s => {
          const id = s.id
          rangeMap[id] = parseInt(s.total_shipments, 10) || 0
          rangeMap[String(id)] = rangeMap[id]
        })
        setShipmentsRangeMeta({ from: rangeFrom, to: rangeTo })
      } else {
        setShipmentsRangeMeta({ from: null, to: null })
      }

      function mergeShipmentsInRange(arr) {
        return (arr || []).map(s => ({
          ...s,
          shipments_in_range: rangeMap[s.id] ?? rangeMap[String(s.id)] ?? 0,
          shipments_range_from: rangeFrom,
          shipments_range_to: rangeTo,
        }))
      }

      let vipList = []
      if (Array.isArray(apiResult.vip_merchants)) {
        vipList = apiResult.vip_merchants
      } else {
        // خادم قديم بلا مفتاح vip_merchants — نفس المنطق: نشط يشحن + ≥300 + status نشط
        vipList = (apiResult.data?.active_shipping || []).filter(s => {
          if (s.status != null && s.status !== '' && s.status !== 'active') return false
          return (parseInt(s.total_shipments, 10) || 0) >= 300
        })
      }
      setVipMerchants(mergeShipmentsInRange(vipList))

      const stateMap = {}
      ;(statesRes.data || []).forEach(s => { stateMap[s.store_id] = s })

      setStoreStates(stateMap)
      setAssignments(assignRes.data || {})
      setCallLogs(callsRes.data || {})
      setRecoveryCalls(rcallsRes.data || {})
      setStores({
        incubating:      mergeShipmentsInRange(apiResult.data.incubating),
        active_shipping: mergeShipmentsInRange(apiResult.data.active_shipping),
        hot_inactive:    mergeShipmentsInRange(apiResult.data.hot_inactive),
        cold_inactive:   mergeShipmentsInRange(apiResult.data.cold_inactive),
      })
      setCounts(apiResult.counts)

      // مسار الاحتضان: خانتان فقط (new_48h + incubating)
      // Q3 (graduated) → active_shipping مباشرةً من PHP
      // Q2 (never_started) → cold_inactive مباشرةً من PHP
      // جاري/تمت الاستعادة → تُدار في خانة غير النشطة عبر DB
      const rawPath = apiResult.incubation_path || {}
      const mergedPath = {
        new_48h:    mergeShipmentsInRange(rawPath.new_48h    || []),
        incubating: mergeShipmentsInRange(rawPath.incubating || []),
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
      vipMerchants,
      incubationPath, incubationCounts,
      storeStates, assignments, callLogs, recoveryCalls,
      shipmentsRangeMeta,
      loading, error, lastLoaded, reload: load,
    }}>
      {children}
    </StoresContext.Provider>
  )
}

export const useStores = () => useContext(StoresContext)
