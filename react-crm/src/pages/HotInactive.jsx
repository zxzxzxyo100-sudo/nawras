import { useState, useMemo, useCallback, useEffect } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { Flame, RefreshCw, Phone, PhoneOff, Users } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import InactiveRowColorToolbar from '../components/InactiveRowColorToolbar'
import { useInactiveRowColors } from '../hooks/useInactiveRowColors'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { getMyWorkflow, markSurveyNoAnswer } from '../services/api'
import InactiveGoalCelebration, { InactiveGoalCounterBadge } from '../components/InactiveGoalCelebration'
import InactiveRestoredFollowupSection from '../components/InactiveRestoredFollowupSection'
import { formatCallOutcome } from '../constants/callOutcomes'
import {
  isRestoredCategory,
  isRestoredForRecoveryLists,
  isStillRestoringStore,
  isRecoveryCompletedByShipment,
} from '../constants/storeCategories'

const SEGMENTS = new Set(['all', 'restoring', 'restored'])

function dedupeById(list) {
  const seen = new Set()
  return list.filter(s => {
    const id = s?.id
    if (id == null || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function recoveryIdBadge(store, storeStates) {
  const st = storeStates[store.id]
  const cat = st?.category
  if (isRestoredCategory(cat) || isRecoveryCompletedByShipment(store, st)) {
    return (
      <span
        title="تمت الاستعادة"
        className="inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded-md border border-teal-200 bg-teal-50 px-1 text-[10px] font-semibold text-teal-800"
      >
        ✓
      </span>
    )
  }
  if (cat === 'restoring') {
    return (
      <span
        title="قيد الاستعادة"
        className="inline-flex h-5 min-w-[1.1rem] shrink-0 items-center justify-center rounded-md border border-cyan-200 bg-cyan-50 px-1 text-[10px] font-medium text-cyan-800"
      >
        ↻
      </span>
    )
  }
  return null
}

function aggregateUserStats(stores, storeStates, callLogs) {
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = Date.now() - 7 * 86400000
  const map = {}
  for (const s of stores) {
    const uid = (storeStates[s.id]?.updated_by || '').trim() || 'غير محدد'
    if (!map[uid]) {
      map[uid] = { label: uid, storeCount: 0, callsToday: 0, callsWeek: 0 }
    }
    map[uid].storeCount += 1
    const log = callLogs[s.id] || {}
    for (const c of Object.values(log)) {
      if (!c?.date) continue
      if (c.date.startsWith(today)) map[uid].callsToday += 1
      const t = new Date(c.date).getTime()
      if (!Number.isNaN(t) && t >= weekAgo) map[uid].callsWeek += 1
    }
  }
  return Object.values(map).sort((a, b) => b.storeCount - a.storeCount)
}

export default function HotInactive({ embeddedRecoverySegment, recoveryTasksHotQueue } = {}) {
  const { recoverySegment: recoverySegmentParam } = useParams()
  const recoverySegment = embeddedRecoverySegment ?? recoverySegmentParam
  const { user } = useAuth()
  const { stores, counts, callLogs, storeStates, assignments, loading, reload, lastLoaded } = useStores()
  /** undefined = لم يُجلب الطابور بعد؛ null = فشل الطلب؛ object = نجاح */
  const [inactiveWfSummary, setInactiveWfSummary] = useState(undefined)
  const [callModalStore, setCallModalStore] = useState(null)
  const [workflowNoAnswerLoading, setWorkflowNoAnswerLoading] = useState(null)
  const [goalBurstNonce, setGoalBurstNonce] = useState(0)

  useEffect(() => {
    if (user?.role !== 'inactive_manager' || !user?.username) {
      setInactiveWfSummary(null)
      return
    }
    getMyWorkflow(user.username, { queue: 'inactive' })
      .then(r => {
        if (r?.success) setInactiveWfSummary(r)
        else setInactiveWfSummary(null)
      })
      .catch(() => setInactiveWfSummary(null))
  }, [user?.role, user?.username, lastLoaded])
  const [selected, setSelected] = useState(null)
  const inactiveRowColors = useInactiveRowColors('hot')
  const [rowPaintMode, setRowPaintMode] = useState(false)
  const [rowColorKey, setRowColorKey] = useState('1')

  const handlePaintClick = useCallback(
    store => {
      inactiveRowColors.apply(store.id, rowColorKey)
    },
    [inactiveRowColors, rowColorKey]
  )

  function handleHotInactiveCall(store) {
    setCallModalStore(store)
  }

  async function handleInactiveWorkflowNoAnswer(store) {
    if (!user?.username) return
    setWorkflowNoAnswerLoading(store.id)
    try {
      await markSurveyNoAnswer({
        store_id: store.id,
        store_name: store.name,
        username: user.username,
        queue: 'inactive',
      })
      await reload()
      const r = await getMyWorkflow(user.username, { queue: 'inactive' })
      if (r?.success) setInactiveWfSummary(r)
    } catch (e) {
      console.error(e)
    } finally {
      setWorkflowNoAnswerLoading(null)
    }
  }

  const inactiveEliteWorkflowNoAnswer =
    user?.role === 'inactive_manager'
      ? s => {
          const a = assignments[s.id]
          return (
            a?.assigned_to === user?.username
            && a?.assignment_queue === 'inactive'
            && a?.workflow_status === 'active'
          )
        }
      : undefined

  const isAllTab = recoverySegment === 'all'
  const isRestoredTab = recoverySegment === 'restored'
  const isRecoveryTab = recoverySegment === 'restoring' || recoverySegment === 'restored'

  const hotInactive = stores.hot_inactive || []
  const coldInactive = stores.cold_inactive || []
  const activeShipping = stores.active_shipping || []
  const incubating = stores.incubating || []

  const filteredStores = useMemo(() => {
    const matchRestored = s => isRestoredForRecoveryLists(s, storeStates[s.id])
    const matchRestoring = s => isStillRestoringStore(s, storeStates[s.id])

    if (isAllTab) {
      /** صفحة المهام: طابور «ساخن» قبل بدء الاستعادة — الإنجاز = نقل المتجر إلى «قيد الاستعادة» */
      if (recoveryTasksHotQueue) {
        return hotInactive.filter(s => {
          const st = storeStates[s.id]
          const cat = st?.category
          if (cat === 'restoring') return false
          if (isRestoredCategory(cat) || isRecoveryCompletedByShipment(s, st)) return false
          return true
        })
      }
      return hotInactive.filter(() => true)
    }
    if (isRestoredTab) {
      /* + متاجر بقيت restoring في DB لكن الشحنة بعد restore_date (تظهر في نشط يشحن) */
      const inactiveRows = [
        ...hotInactive.filter(matchRestored),
        ...coldInactive.filter(matchRestored),
      ]
      const afterRecovery = [
        ...activeShipping.filter(matchRestored),
        ...incubating.filter(matchRestored),
      ]
      return dedupeById([...inactiveRows, ...afterRecovery])
    }
    /* جاري الاستعادة: كل القوائم — بما فيها نشط/احتضان إذا لم تكتمل الشحنة بعد */
    const hot = hotInactive.filter(matchRestoring)
    const cold = coldInactive.filter(matchRestoring)
    const activeR = activeShipping.filter(matchRestoring)
    const incR = incubating.filter(matchRestoring)
    return dedupeById([...hot, ...cold, ...activeR, ...incR])
  }, [hotInactive, coldInactive, activeShipping, incubating, storeStates, isAllTab, isRestoredTab, recoveryTasksHotQueue])

  /**
   * مسؤول الاستعادة: دفعة من طابور المهام؛ عند بلوغ الحصة اليومية يُرجع [].
   * صفحة المهام: نفس طابور الـ API — «نشط» + «لم يرد» (حتى ~{هدف 50} صفاً). عند «لم يرد» يبقى الصف
   * بحالة no_answer ولا يُضاعف التعيين في الخادم؛ الإكمال إلى completed يحرّر فتحة ويُستبدل متجراً.
   */
  const managerBatchStores = useMemo(() => {
    if (user?.role !== 'inactive_manager') return null
    if (inactiveWfSummary === undefined) return undefined
    if (inactiveWfSummary === null) return []
    if (inactiveWfSummary.daily_target_reached) return []

    const activeList = inactiveWfSummary.active_tasks || []
    const noAnsList = inactiveWfSummary.no_answer_tasks || []

    const queueRows = [...activeList, ...noAnsList]
    const wfIds = new Set(queueRows.map(t => Number(t.store_id)))

    if (wfIds.size === 0) {
      return recoveryTasksHotQueue ? [] : filteredStores
    }
    const scoped = filteredStores.filter(s => wfIds.has(Number(s.id)))
    if (scoped.length > 0) return scoped
    return recoveryTasksHotQueue ? [] : filteredStores
  }, [user?.role, inactiveWfSummary, filteredStores, recoveryTasksHotQueue])

  /**
   * صفحة المهام: لا تعرض جميع «ساخن» عندما managerBatchStores === null (كان يحدث عندما inactiveWfSummary
   * لم يُحمَّل بعد أو فشل الطلب — فيُعرض ~كل المتاجر ويبدو أن الإنجاز لا يزيل الصفوف).
   */
  const storesForTable = useMemo(() => {
    if (user?.role === 'inactive_manager' && recoveryTasksHotQueue) {
      if (inactiveWfSummary === undefined || inactiveWfSummary === null) return []
      return managerBatchStores ?? []
    }
    if (managerBatchStores === null || managerBatchStores === undefined) {
      return filteredStores
    }
    return managerBatchStores
  }, [user?.role, recoveryTasksHotQueue, inactiveWfSummary, managerBatchStores, filteredStores])

  const dq = inactiveWfSummary?.daily_quota
  const quotaCount =
    inactiveWfSummary?.daily_successful_contacts ?? dq?.count ?? 0
  const quotaLimit = inactiveWfSummary?.inactive_daily_target ?? dq?.limit ?? 50
  const quotaReached = Boolean(inactiveWfSummary?.daily_target_reached)

  const userStats = useMemo(
    () => aggregateUserStats(filteredStores, storeStates, callLogs),
    [filteredStores, storeStates, callLogs]
  )

  if (!embeddedRecoverySegment && !SEGMENTS.has(recoverySegment || '')) {
    return <Navigate to="/hot-inactive/all" replace />
  }

  const bucketColumn = isRecoveryTab
    ? [{
        key: 'list_bucket',
        label: 'المسار',
        render: s => {
          if (coldInactive.some(c => c.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-900 font-medium">غير نشط بارد</span>
          }
          if (hotInactive.some(c => c.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50/90 text-amber-900 font-medium">غير نشط ساخن</span>
          }
          if (activeShipping.some(x => x.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-900 font-medium">نشط يشحن (بعد الاستعادة)</span>
          }
          if (incubating.some(x => x.id === s.id)) {
            return <span className="text-[11px] px-2 py-0.5 rounded-lg border border-violet-200 bg-violet-50 text-violet-900 font-medium">مسار الاحتضان</span>
          }
          return <span className="text-xs text-slate-500">—</span>
        },
      }]
    : []

  const extraColumns = [
    ...bucketColumn,
    {
      key: 'inactive_days',
      label: 'أيام الانقطاع',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد') return '—'
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg border border-amber-200 bg-amber-50 text-amber-900">
            {days} يوم
          </span>
        )
      },
    },
    {
      key: 'last_call',
      label: 'نتيجة المكالمة',
      render: s => {
        const log = callLogs[s.id] || {}
        const entries = Object.values(log).filter(c => c?.date)
        if (!entries.length) return (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <PhoneOff size={11} className="opacity-70" /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const outcomeLabel = formatCallOutcome(latest.outcome)
        const noteText = latest.note?.trim()
        if (!outcomeLabel && !noteText) {
          return (
            <span className="flex items-center gap-1 text-xs text-slate-500">
              <PhoneOff size={11} className="opacity-70" /> لا يوجد
            </span>
          )
        }
        return (
          <div className="flex flex-col gap-0.5 min-w-0 max-w-[220px]">
            {outcomeLabel && (
              <span className="text-xs font-semibold text-violet-800">{outcomeLabel}</span>
            )}
            {noteText && (
              <span className="text-[11px] text-slate-600 leading-snug line-clamp-2">{noteText}</span>
            )}
          </div>
        )
      },
    },
    {
      key: 'last_call_date',
      label: 'آخر مكالمة',
      render: s => {
        const log = callLogs[s.id] || {}
        const entries = Object.values(log).filter(c => c?.date)
        if (!entries.length) return (
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <PhoneOff size={11} className="opacity-70" /> لا يوجد
          </span>
        )
        const latest = entries.sort((a, b) => b.date.localeCompare(a.date))[0]
        const today = new Date().toISOString().slice(0, 10)
        const isToday = latest.date?.startsWith(today)
        const dateLabel = isToday ? 'اليوم' : latest.date?.slice(0, 10) || '—'

        return (
          <span className={`flex items-center gap-1.5 text-xs font-medium ${isToday ? 'text-emerald-700' : 'text-slate-600'}`}>
            <Phone size={12} strokeWidth={2} className="text-violet-600 shrink-0 opacity-90" />
            {dateLabel}
            {latest.performed_by && (
              <span className="text-slate-500 font-normal">· {latest.performed_by}</span>
            )}
          </span>
        )
      },
    },
    {
      key: 'recovery',
      label: 'الاستعادة',
      render: s => {
        const dbCat = storeStates[s.id]?.category
        const dbUpdatedBy = storeStates[s.id]?.updated_by
        const st = storeStates[s.id]

        if (isRestoredCategory(dbCat)) return (
          <span className="text-[11px] border border-teal-200 bg-teal-50 text-teal-900 px-2 py-0.5 rounded-lg font-medium">تمت ✓</span>
        )
        if (isRecoveryCompletedByShipment(s, st)) return (
          <span className="text-[11px] border border-teal-200 bg-teal-50 text-teal-900 px-2 py-0.5 rounded-lg font-medium">تمت ✓</span>
        )
        if (dbCat === 'restoring') return (
          <div className="flex flex-col gap-1 max-w-[200px]">
            <span className="text-[11px] border border-cyan-200 bg-cyan-50 text-cyan-900 px-2 py-0.5 rounded-lg font-medium w-fit">قيد الاستعادة</span>
            {dbUpdatedBy && (
              <span className="text-[10px] text-slate-600">{dbUpdatedBy}</span>
            )}
            <span className="text-[10px] text-slate-500 leading-snug">تُحدَّث تلقائياً</span>
          </div>
        )
        if (dbCat === 'frozen') return (
          <span className="text-[11px] border border-slate-200 bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">مجمد</span>
        )
        return null
      },
    },
  ]

  const titleBlock = isAllTab
    ? { Icon: Flame, iconClass: 'text-amber-500', line: 'غير نشط ساخن' }
    : isRestoredTab
      ? { Icon: RefreshCw, iconClass: 'text-teal-600', line: 'تمت الاستعادة' }
      : { Icon: RefreshCw, iconClass: 'text-cyan-600', line: 'جاري الاستعادة' }
  const PageIcon = titleBlock.Icon

  /** تحت «تمت الاستعادة» مباشرة: عنوان الصفحة ثم «المتاجر غير النشطة المنجزة» ثم بقية الكتل. */
  const restoredInactiveFirst =
    isRestoredTab && user?.role === 'inactive_manager'

  const titleRow = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2 flex-wrap">
          <PageIcon size={24} className={titleBlock.iconClass} />
          {titleBlock.line}
        </h1>
        <p className="text-slate-600 text-sm mt-0.5">
          {filteredStores.length} متجر في هذا الفرع
          {isAllTab && ` — إجمالي غير نشط ساخن: ${counts.hot_inactive || 0}`}
          {recoverySegment === 'restoring' && ' — ساخن وبارد ونشط إن بقيت الحالة «قيد الاستعادة» في السجل'}
          {isRestoredTab && ' — يشمل من اكتملت شحنياً أو حالة recovered في السجل'}
        </p>
      </div>
      <button
        type="button"
        onClick={reload}
        disabled={loading}
        className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-60"
      >
        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        تحديث
      </button>
    </div>
  )

  const inactiveCelebrationBlock =
    user?.role === 'inactive_manager' && user?.username ? (
      <InactiveGoalCelebration
        username={user.username}
        successfulCount={quotaCount}
        target={quotaLimit}
        dailyTargetReached={quotaReached}
        burstNonce={goalBurstNonce}
      />
    ) : null

  const inactiveQuotaBanner =
    user?.role === 'inactive_manager' && inactiveWfSummary ? (
      <div
        className={`rounded-2xl border px-4 py-3 shadow-sm ${
          quotaReached
            ? 'border-emerald-300 bg-emerald-50/95 text-emerald-950'
            : 'border-amber-200/90 bg-amber-50/90 text-amber-950'
        }`}
      >
        <p className="font-black text-sm flex flex-wrap items-center gap-2">
          <span>اتصالات ناجحة اليوم (تم التواصل — مكالمة + استبيان):</span>
          <InactiveGoalCounterBadge
            successfulCount={quotaCount}
            target={quotaLimit}
            dailyTargetReached={quotaReached}
          />
        </p>
        {quotaReached ? (
          <p className="text-xs mt-1.5 text-emerald-800 leading-relaxed">
            أُنجز هدف اليوم ({quotaLimit} تم التواصل). لن يُضاف متجر جديد إلى طابور المهام حتى الغد. يمكنك متابعة «لم
            يرد» والمتاجر المنجزة أدناه.
          </p>
        ) : (
          <p className="text-xs mt-1 text-amber-900/85">
            الهدف {quotaLimit} «تم التواصل» يومياً؛ «لم يرد» لا يُحتسب ويُستبدل متجر من «غير نشط ساخن» للإبقاء على
            الطابور ممتلئاً ما دام الهدف غير مكتمل.
          </p>
        )}
      </div>
    ) : null

  const inactiveQuotaReachedBanner =
    user?.role === 'inactive_manager' && inactiveWfSummary?.daily_target_reached ? (
      <div className="rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-l from-emerald-50 to-white px-5 py-6 text-center shadow-md">
        <p className="text-lg font-black text-emerald-900">
          أحسنت — أكملت هدف «تم التواصل» اليوم ({quotaLimit} اتصالاً ناجحاً).
        </p>
        <p className="text-sm text-emerald-800/90 mt-2" dir="ltr">
          Daily goal reached: {quotaLimit} successful contacts (answered + survey).
        </p>
      </div>
    ) : null

  return (
    <div className="space-y-5" dir="rtl">
      {user?.role === 'inactive_manager' && !recoveryTasksHotQueue && (
        <InactiveRestoredFollowupSection
          underRestoredHeading={isRestoredTab}
          onFollowupGoalBurst={() => setGoalBurstNonce(n => n + 1)}
        />
      )}
      {restoredInactiveFirst ? (
        <>
          {titleRow}
          {inactiveCelebrationBlock}
          {inactiveQuotaBanner}
          {inactiveQuotaReachedBanner}
        </>
      ) : (
        <>
          {inactiveCelebrationBlock}
          {inactiveQuotaBanner}
          {inactiveQuotaReachedBanner}
          {titleRow}
        </>
      )}

      {/* إحصاءات حسب آخر من حدّث حالة المتجر في النظام */}
      {userStats.length > 0 && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 bg-white/80 flex items-center gap-2">
            <Users size={18} className="text-violet-600" />
            <h2 className="text-sm font-bold text-slate-800">إحصاءات حسب المسؤول (آخر تحديث للحالة)</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-right text-xs text-slate-500 border-b border-slate-200 bg-white">
                  <th className="px-4 py-2.5 font-semibold">المسؤول</th>
                  <th className="px-4 py-2.5 font-semibold">عدد المتاجر</th>
                  <th className="px-4 py-2.5 font-semibold">مكالمات اليوم</th>
                  <th className="px-4 py-2.5 font-semibold">مكالمات 7 أيام</th>
                </tr>
              </thead>
              <tbody>
                {userStats.map(row => (
                  <tr key={row.label} className="border-b border-slate-100 bg-white hover:bg-slate-50/80">
                    <td className="px-4 py-2.5 font-medium text-slate-800">{row.label}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">{row.storeCount}</td>
                    <td className="px-4 py-2.5 tabular-nums text-emerald-700 font-medium">{row.callsToday}</td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-600">{row.callsWeek}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!(user?.role === 'inactive_manager' && inactiveWfSummary?.daily_target_reached) && (
      <InactiveRowColorToolbar
        activeColorKey={rowColorKey}
        onSelectColorKey={setRowColorKey}
        paintMode={rowPaintMode}
        onTogglePaintMode={() => setRowPaintMode(p => !p)}
        onClearAll={inactiveRowColors.clearAll}
      />
      )}

      {!(user?.role === 'inactive_manager' && inactiveWfSummary?.daily_target_reached) && (
      <StoreTable
        variant="elite"
        stores={storesForTable}
        onSelectStore={setSelected}
        onRestoreStore={setSelected}
        renderIdBadge={s => recoveryIdBadge(s, storeStates)}
        extraColumns={extraColumns}
        rowTint={{
          getStyle: inactiveRowColors.styleFor,
          paintMode: rowPaintMode,
          onPaintClick: handlePaintClick,
        }}
        onCallStore={handleHotInactiveCall}
        eliteWorkflowNoAnswer={inactiveEliteWorkflowNoAnswer}
        onEliteWorkflowNoAnswer={user?.role === 'inactive_manager' ? handleInactiveWorkflowNoAnswer : undefined}
        eliteWorkflowNoAnswerLoadingId={workflowNoAnswerLoading}
        emptyMsg={
          isAllTab
            ? 'لا توجد متاجر في غير نشط ساخن'
            : isRestoredTab
              ? 'لا توجد متاجر بتمت الاستعادة'
              : 'لا توجد متاجر بحالة «قيد الاستعادة»'
        }
      />
      )}

      {selected && (
        <StoreDrawer
          store={selected}
          onClose={() => setSelected(null)}
          qvNeedsFreezeSource="inactive"
          taskCompletion={
            user?.role === 'inactive_manager'
              ? {
                  inactiveRecovery: true,
                  onInactiveGoalBurst: () => setGoalBurstNonce(n => n + 1),
                }
              : null
          }
          fromDailyTasks={Boolean(recoveryTasksHotQueue && user?.role === 'inactive_manager')}
          extraOnSaved={async () => {
            if (user?.role === 'inactive_manager' && user?.username) {
              try {
                const r = await getMyWorkflow(user.username, { queue: 'inactive' })
                if (r?.success) setInactiveWfSummary(r)
              } catch {
                /* ignore */
              }
            }
          }}
        />
      )}

      {callModalStore && (
        <CallModal
          store={callModalStore}
          callType="general"
          fromDailyTasks={Boolean(recoveryTasksHotQueue && user?.role === 'inactive_manager')}
          onClose={() => setCallModalStore(null)}
          onSaved={async () => {
            await reload()
            setCallModalStore(null)
            if (user?.role === 'inactive_manager' && user?.username) {
              try {
                const r = await getMyWorkflow(user.username, { queue: 'inactive' })
                if (r?.success) setInactiveWfSummary(r)
              } catch {
                /* ignore */
              }
            }
          }}
          taskCompletion={
            user?.role === 'inactive_manager'
              ? {
                  inactiveRecovery: true,
                  onInactiveGoalBurst: () => setGoalBurstNonce(n => n + 1),
                }
              : null
          }
        />
      )}
    </div>
  )
}
