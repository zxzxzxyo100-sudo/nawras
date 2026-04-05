import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import {
  getAllStores, getVipMerchants, getStoreStates, getAllCallLogs, getAllRecoveryCalls, getAssignments,
  getOrdersSummaryRange, getSurveys,
} from '../services/api'
import { useAuth } from './AuthContext'
import { totalShipments, isActiveMerchantStatus } from '../utils/storeFields'
import { VIP_MERCHANTS_COMING_SOON } from '../config/features'

const StoresContext = createContext(null)

export function StoresProvider({ children }) {
  const { user } = useAuth()

  const [stores, setStores] = useState({
    incubating:            [],
    active_shipping:        [],
    completed_merchants:    [],
    unreachable_merchants:  [],
    frozen_merchants:       [],
    hot_inactive:           [],
    cold_inactive:          [],
  })
  const [incubationPath, setIncubationPath] = useState({
    call_1: [], call_2: [], call_3: [], between_calls: [],
  })
  const [incubationCounts, setIncubationCounts] = useState({
    call_1: 0, call_2: 0, call_3: 0, between_calls: 0, total: 0,
  })
  const [counts, setCounts]               = useState({
    incubating: 0, active_shipping: 0, completed_merchants: 0, unreachable_merchants: 0, frozen_merchants: 0,
    hot_inactive: 0, cold_inactive: 0, total_active: 0, total: 0,
  })
  const [storeStates, setStoreStates]     = useState({})
  const [assignments, setAssignments]     = useState({})
  const [callLogs, setCallLogs]           = useState({})
  /** آخر استبيان رضا لكل متجر (store_id → صف من get_surveys) */
  const [surveyByStoreId, setSurveyByStoreId] = useState({})
  /** متاجر أُكمل لها استبيان التهيئة (مفتاح: store_id) — لا يعتمد على «آخر استبيان» فقط */
  const [newMerchantOnboardingDoneIds, setNewMerchantOnboardingDoneIds] = useState(() => new Set())
  const [recoveryCalls, setRecoveryCalls] = useState({})
  const [loading, setLoading]             = useState(false)
  const [lastLoaded, setLastLoaded]       = useState(null)
  const [error, setError]                 = useState(null)
  /** نطاق الطرود: التواريخ المعادة من orders-summary.php (واجهة Nawرس عبر الخادم) */
  const [shipmentsRangeMeta, setShipmentsRangeMeta] = useState({ from: null, to: null })
  /** كبار التجار: من vip-merchants.php (orders-summary كامل الصفحات) */
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

      const [apiResult, vipRes, statesRes, callsRes, surveysRes, rcallsRes, assignRes, rangeRes] = await Promise.all([
        getAllStores(),
        VIP_MERCHANTS_COMING_SOON
          ? Promise.resolve({ success: false, data: [] })
          : getVipMerchants().catch(() => ({ success: false, data: [] })),
        getStoreStates(),
        getAllCallLogs(),
        getSurveys().catch(() => ({ success: false, data: [] })),
        getAllRecoveryCalls(),
        getAssignments(),
        getOrdersSummaryRange(rangeFrom, rangeTo).catch(() => ({ success: false, data: [] })),
      ])
      if (!apiResult.success) throw new Error('فشل جلب البيانات')

      const rangeMap = {}
      let resolvedFrom = rangeFrom
      let resolvedTo = rangeTo
      const rangeRows = Array.isArray(rangeRes?.data)
        ? rangeRes.data
        : Array.isArray(rangeRes)
          ? rangeRes
          : null
      const rangeFailed = rangeRes != null && rangeRes.success === false
      if (!rangeFailed && Array.isArray(rangeRows)) {
        rangeRows.forEach(s => {
          const id = s.id ?? s.store_id
          if (id == null) return
          const n = totalShipments(s)
          rangeMap[id] = n
          rangeMap[String(id)] = n
          rangeMap[Number(id)] = n
        })
        const metaObj = rangeRes && typeof rangeRes === 'object' && !Array.isArray(rangeRes) ? rangeRes : null
        resolvedFrom = metaObj?.from != null && metaObj.from !== '' ? String(metaObj.from) : rangeFrom
        resolvedTo = metaObj?.to != null && metaObj.to !== '' ? String(metaObj.to) : rangeTo
        setShipmentsRangeMeta({ from: resolvedFrom, to: resolvedTo })
      } else {
        /* فشل orders-summary.php: نعرض نفس نطاق الطلب مع 0 طرود — لا نخفي تواريخ العمود */
        setShipmentsRangeMeta({ from: rangeFrom, to: rangeTo })
      }

      function mergeShipmentsInRange(arr) {
        return (arr || []).map(s => {
          const sid = s.id
          const inRange =
            rangeMap[sid] ??
            rangeMap[String(sid)] ??
            rangeMap[Number(sid)] ??
            0
          /* نسخ بدون الاعتماد على حقول قديمة بنفس الاسم من واجهة Nawris */
          const { shipments_in_range: _drop, ...rest } = s
          return {
            ...rest,
            shipments_in_range: inRange,
            shipments_range_from: resolvedFrom,
            shipments_range_to: resolvedTo,
          }
        })
      }

      let vipList = []
      if (!VIP_MERCHANTS_COMING_SOON) {
        if (vipRes?.success && Array.isArray(vipRes.data)) {
          vipList = vipRes.data
        } else if (Array.isArray(apiResult.vip_merchants) && apiResult.vip_merchants.length > 0) {
          vipList = apiResult.vip_merchants
        } else {
          const buckets = [
            ...(apiResult.data?.incubating || []),
            ...(apiResult.data?.active_shipping || []),
            ...(apiResult.data?.completed_merchants || []),
            ...(apiResult.data?.unreachable_merchants || []),
            ...(apiResult.data?.frozen_merchants || []),
            ...(apiResult.data?.hot_inactive || []),
            ...(apiResult.data?.cold_inactive || []),
          ]
          const seen = new Set()
          for (const s of buckets) {
            const sid = s?.id
            if (sid == null || seen.has(sid)) continue
            seen.add(sid)
            if (!isActiveMerchantStatus(s)) continue
            if (totalShipments(s) < 300) continue
            vipList.push(s)
          }
        }
      }
      setVipMerchants(mergeShipmentsInRange(vipList))

      const stateMap = {}
      ;(statesRes.data || []).forEach(s => { stateMap[s.store_id] = s })

      setStoreStates(stateMap)
      setAssignments(assignRes.data || {})
      setCallLogs(callsRes.data || {})
      const surveyMap = {}
      if (surveysRes?.success && Array.isArray(surveysRes.data)) {
        surveysRes.data.forEach(row => {
          const sid = row.store_id
          if (sid == null) return
          surveyMap[sid] = row
          surveyMap[String(sid)] = row
          surveyMap[Number(sid)] = row
        })
      }
      setSurveyByStoreId(surveyMap)
      const onboardingDone = new Set()
      if (surveysRes?.success) {
        const rawOnboarding = surveysRes?.new_merchant_onboarding_done_ids
        if (Array.isArray(rawOnboarding)) {
          rawOnboarding.forEach(id => {
            if (id == null) return
            onboardingDone.add(id)
            onboardingDone.add(String(id))
            onboardingDone.add(Number(id))
          })
        }
      }
      setNewMerchantOnboardingDoneIds(onboardingDone)
      setRecoveryCalls(rcallsRes.data || {})
      setStores({
        incubating:            mergeShipmentsInRange(apiResult.data.incubating),
        active_shipping:       mergeShipmentsInRange(apiResult.data.active_shipping),
        completed_merchants:     mergeShipmentsInRange(apiResult.data.completed_merchants || []),
        unreachable_merchants: mergeShipmentsInRange(apiResult.data.unreachable_merchants || []),
        frozen_merchants:      mergeShipmentsInRange(apiResult.data.frozen_merchants || []),
        hot_inactive:          mergeShipmentsInRange(apiResult.data.hot_inactive),
        cold_inactive:         mergeShipmentsInRange(apiResult.data.cold_inactive),
      })
      setCounts(apiResult.counts)

      // مسار الاحتضان: ثلاث مكالمات (call_1 / call_2 / call_3)
      const rawPath = apiResult.incubation_path || {}
      const mergedPath = {
        call_1: mergeShipmentsInRange(rawPath.call_1 ?? rawPath.new_48h ?? []),
        call_2: mergeShipmentsInRange(rawPath.call_2 ?? rawPath.incubating ?? []),
        call_3: mergeShipmentsInRange(rawPath.call_3 ?? []),
        between_calls: mergeShipmentsInRange(rawPath.between ?? []),
      }

      setIncubationPath(mergedPath)
      setIncubationCounts({
        call_1: mergedPath.call_1.length,
        call_2: mergedPath.call_2.length,
        call_3: mergedPath.call_3.length,
        between_calls: mergedPath.between_calls.length,
        total:
          apiResult.incubation_counts?.total
          ?? mergedPath.call_1.length + mergedPath.call_2.length + mergedPath.call_3.length
            + mergedPath.between_calls.length,
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

  // قائمة مسطّحة بكل المتاجر مع الفئة + خانة التقسيم (للتصفية في صفحة «المتاجر»)
  const allStores = [
    ...stores.incubating.map(s =>      ({ ...s, bucket: 'incubating',      category: storeStates[s.id]?.category || 'incubating'      })),
    ...stores.active_shipping.map(s => ({ ...s, bucket: 'active_shipping', category: storeStates[s.id]?.category || 'active_shipping' })),
    ...stores.completed_merchants.map(s => ({ ...s, bucket: 'completed_merchants', category: storeStates[s.id]?.category || 'completed' })),
    ...stores.unreachable_merchants.map(s => ({ ...s, bucket: 'unreachable_merchants', category: storeStates[s.id]?.category || 'unreachable' })),
    ...stores.frozen_merchants.map(s => ({ ...s, bucket: 'frozen_merchants', category: storeStates[s.id]?.category || 'frozen' })),
    ...stores.hot_inactive.map(s =>    ({ ...s, bucket: 'hot_inactive',    category: storeStates[s.id]?.category || 'hot_inactive'    })),
    ...stores.cold_inactive.map(s =>   ({ ...s, bucket: 'cold_inactive',   category: storeStates[s.id]?.category || 'cold_inactive'   })),
  ]

  return (
    <StoresContext.Provider value={{
      stores, counts, allStores,
      vipMerchants,
      incubationPath, incubationCounts,
      storeStates, assignments, callLogs, surveyByStoreId, newMerchantOnboardingDoneIds, recoveryCalls,
      shipmentsRangeMeta,
      loading, error, lastLoaded, reload: load,
    }}>
      {children}
    </StoresContext.Provider>
  )
}

export const useStores = () => useContext(StoresContext)
