import { useState, useEffect, useMemo } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { format, parseISO, addDays, differenceInCalendarDays } from 'date-fns'
import { ar } from 'date-fns/locale'
import { TrendingUp, RefreshCw, UserCheck, Users, X, CheckCircle2, Shuffle, Filter, BadgeCheck, PhoneOff, Star } from 'lucide-react'
import StoreTable from '../components/StoreTable'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import ActiveStoreSurveyModal from '../components/ActiveStoreSurveyModal'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { assignStore, listUsers, markSurveyNoAnswer, getMyWorkflow } from '../services/api'
import { needsActiveSatisfactionSurvey } from '../constants/satisfactionSurvey'

const ACTIVE_SEGMENTS = new Set(['pending', 'completed', 'unreachable'])

export default function ActiveStores({ embeddedSegment, fromDailyTasks = false } = {}) {
  const params = useParams()
  const activeSegment = embeddedSegment ?? params.activeSegment
  const { stores, assignments, loading, reload, storeStates, shipmentsRangeMeta, surveyByStoreId, lastLoaded } =
    useStores()
  const { user } = useAuth()
  const [activeWf, setActiveWf] = useState(null)

  function parseDbDate(v) {
    if (v == null || v === '') return null
    const s = String(v).trim().replace(' ', 'T')
    const d = parseISO(s.length >= 19 ? s.slice(0, 19) : s)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const [selected, setSelected]           = useState(null)
  const [users, setUsers]                 = useState([])
  const [saving, setSaving]               = useState(false)
  const [selectedIds, setSelectedIds]     = useState(new Set())
  const [bulkUser, setBulkUser]           = useState('')
  const [successMsg, setSuccessMsg]       = useState('')
  // وضع التعيين: 'manual' | 'auto'
  const [assignMode, setAssignMode]       = useState('manual')
  // اليوزرات المحددة للتوزيع التلقائي
  const [autoUsers, setAutoUsers]         = useState(new Set())
  // فلتر التعيين: 'all' | 'assigned' | 'unassigned' | username
  const [assignFilter, setAssignFilter]   = useState('all')
  /** متجر نافذة الاستبيان (منفصل عن «المحدد» حتى يبقى الاستبيان مفتوحاً عند إغلاق الدرج) */
  const [surveyModalStore, setSurveyModalStore] = useState(null)
  const [callModalStore, setCallModalStore] = useState(null)
  const [workflowNoAnswerLoading, setWorkflowNoAnswerLoading] = useState(null)

  const isExecutive = user?.role === 'executive'
  const isActiveManager = user?.role === 'active_manager'

  function handleEliteCall(store) {
    const p = store?.phone?.replace(/\s/g, '')
    if (!p) return
    setCallModalStore(store)
  }

  async function handleWorkflowNoAnswer(store) {
    if (!user?.username) return
    setWorkflowNoAnswerLoading(store.id)
    try {
      await markSurveyNoAnswer({
        store_id: store.id,
        store_name: store.name,
        username: user.username,
      })
      await reload()
    } catch (e) {
      console.error(e)
    } finally {
      setWorkflowNoAnswerLoading(null)
    }
  }

  /** نشط قيد المكالمة — ليس «منجز» */
  const active = useMemo(() => {
    const base = stores.active_shipping || []
    const fromInc = (stores.incubating || []).filter(s => {
      const st = storeStates[s.id]
      const c = st?.category
      return c === 'active' || c === 'active_shipping' || c === 'active_pending_calls'
    })
    const seen = new Set(base.map(s => s.id))
    return [...base, ...fromInc.filter(s => !seen.has(s.id))]
  }, [stores.active_shipping, stores.incubating, storeStates])

  /** منجز — يُعاد تلقائياً إلى قيد المكالمة بعد 30 يوماً من آخر مكالمة */
  const completed = useMemo(() => {
    const base = stores.completed_merchants || []
    const fromInc = (stores.incubating || []).filter(s => {
      const c = storeStates[s.id]?.category
      return c === 'completed' || c === 'contacted'
    })
    const seen = new Set(base.map(s => s.id))
    return [...base, ...fromInc.filter(s => !seen.has(s.id))]
  }, [stores.completed_merchants, stores.incubating, storeStates])

  const unreachable = useMemo(() => {
    const base = stores.unreachable_merchants || []
    const fromInc = (stores.incubating || []).filter(s => storeStates[s.id]?.category === 'unreachable')
    const seen = new Set(base.map(s => s.id))
    return [...base, ...fromInc.filter(s => !seen.has(s.id))]
  }, [stores.unreachable_merchants, stores.incubating, storeStates])

  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(res => setUsers((res.data || []).filter(u => u.role === 'active_manager')))
      .catch(() => {})
  }, [isExecutive])

  useEffect(() => {
    if (!isActiveManager || !user?.username) {
      setActiveWf(null)
      return
    }
    getMyWorkflow(user.username, { queue: 'active' })
      .then(r => {
        if (r?.success) setActiveWf(r)
        else setActiveWf(null)
      })
      .catch(() => setActiveWf(null))
  }, [isActiveManager, user?.username, lastLoaded])

  // تعيين متجر واحد (dropdown في الجدول)
  async function handleAssignSingle(store, username) {
    setSaving(store.id)
    try {
      await assignStore({
        store_id:    store.id,
        store_name:  store.name,
        assigned_to: username,
        assigned_by: user?.fullname || user?.username || '',
      })
      await reload()
    } catch (e) { console.error(e) }
    finally { setSaving(null) }
  }

  // تعيين جماعي يدوي (كل المحددين → يوزر واحد)
  async function handleBulkAssign() {
    if (!bulkUser || selectedIds.size === 0) return
    setSaving(true)
    try {
      const storeMap = Object.fromEntries(active.map(s => [s.id, s]))
      await Promise.all(
        [...selectedIds].map(id =>
          assignStore({
            store_id:    id,
            store_name:  storeMap[id]?.name || '',
            assigned_to: bulkUser,
            assigned_by: user?.fullname || user?.username || '',
          })
        )
      )
      await reload()
      showSuccess(`تم تعيين ${selectedIds.size} متجر لـ "${users.find(u=>u.username===bulkUser)?.fullname || bulkUser}"`)
      clearSelection()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  // توزيع تلقائي (round-robin بين اليوزرات المحددة)
  async function handleAutoAssign() {
    const targets = [...autoUsers]
    if (targets.length === 0 || selectedIds.size === 0) return
    setSaving(true)
    try {
      const storeMap  = Object.fromEntries(active.map(s => [s.id, s]))
      const storeList = [...selectedIds]
      await Promise.all(
        storeList.map((id, idx) => {
          const assignee = targets[idx % targets.length]
          return assignStore({
            store_id:    id,
            store_name:  storeMap[id]?.name || '',
            assigned_to: assignee,
            assigned_by: user?.fullname || user?.username || '',
          })
        })
      )
      await reload()
      const perUser = Math.ceil(storeList.length / targets.length)
      showSuccess(`تم توزيع ${storeList.length} متجر على ${targets.length} مسؤول (~${perUser} لكل منهم)`)
      clearSelection()
    } catch (e) { console.error(e) }
    finally { setSaving(false) }
  }

  function toggleAutoUser(username) {
    const next = new Set(autoUsers)
    next.has(username) ? next.delete(username) : next.add(username)
    setAutoUsers(next)
  }

  function clearSelection() {
    setSelectedIds(new Set())
    setBulkUser('')
    setAutoUsers(new Set())
    setAssignMode('manual')
  }

  function showSuccess(msg) {
    setSuccessMsg(msg)
    setTimeout(() => setSuccessMsg(''), 4000)
  }

  const extraColumns = [
    {
      key: 'days_since_ship',
      label: 'أيام منذ آخر شحنة',
      render: s => {
        if (!s.last_shipment_date || s.last_shipment_date === 'لا يوجد')
          return <span className="text-red-400 text-xs">—</span>
        const days = Math.floor((new Date() - new Date(s.last_shipment_date)) / 86400000)
        return (
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            days <= 7 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {days} يوم
          </span>
        )
      },
    },
    ...(isExecutive ? [{
      key: 'assigned_to',
      label: 'المسؤول',
      render: s => {
        const current     = assignments[s.id]?.assigned_to || ''
        const isSavingRow = saving === s.id
        return (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <select
              value={current}
              disabled={!!isSavingRow || saving === true}
              onChange={e => handleAssignSingle(s, e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-700 focus:outline-none focus:border-blue-400 disabled:opacity-50 max-w-[130px]"
            >
              <option value="">— بدون تعيين —</option>
              {users.map(u => (
                <option key={u.username} value={u.username}>
                  {u.fullname || u.username}
                </option>
              ))}
            </select>
            {current && (
              <button
                onClick={() => handleAssignSingle(s, '')}
                disabled={!!saving}
                className="text-slate-300 hover:text-red-400 transition-colors disabled:opacity-50"
                title="إلغاء التعيين"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )
      },
    }] : [{
      key: 'assigned_to',
      label: 'المسؤول',
      render: s => {
        const current = assignments[s.id]?.assigned_to || ''
        return current
          ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">{current}</span>
          : <span className="text-xs text-slate-300">—</span>
      },
    }]),
  ]

  const completedExtraColumns = [
    {
      key: 'last_call_date',
      label: 'تاريخ المكالمة',
      render: s => {
        const raw = s.last_call_date || storeStates[s.id]?.last_call_date
        const d = parseDbDate(raw)
        return d ? (
          <span className="text-xs font-medium text-slate-800">{format(d, 'd MMMM yyyy', { locale: ar })}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )
      },
    },
    {
      key: 'revert_eta',
      label: 'العودة لقيد المكالمة',
      render: s => {
        const raw = s.last_call_date || storeStates[s.id]?.last_call_date
        const d = parseDbDate(raw)
        if (!d) return <span className="text-slate-400 text-xs">—</span>
        const revert = addDays(d, 30)
        const daysLeft = differenceInCalendarDays(revert, new Date())
        if (daysLeft <= 0) {
          return <span className="text-[11px] text-amber-700 font-medium">بانتظار المزامنة (Cron)</span>
        }
        return (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-lg bg-violet-50 text-violet-800 border border-violet-100">
            بعد {daysLeft.toLocaleString('ar-SA')} يومًا
          </span>
        )
      },
    },
    ...extraColumns,
  ]

  const unreachableExtraColumns = [
    {
      key: 'last_call_date',
      label: 'آخر محاولة اتصال',
      render: s => {
        const raw = s.last_call_date || storeStates[s.id]?.last_call_date
        const d = parseDbDate(raw)
        return d ? (
          <span className="text-xs font-medium text-slate-800">{format(d, 'd MMMM yyyy', { locale: ar })}</span>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        )
      },
    },
    ...extraColumns,
  ]

  const assignedCount   = active.filter(s => assignments[s.id]?.assigned_to).length
  const unassignedCount = active.length - assignedCount

  // تطبيق الفلتر
  const filteredActive = useMemo(() => {
    if (assignFilter === 'assigned')   return active.filter(s =>  assignments[s.id]?.assigned_to)
    if (assignFilter === 'unassigned') return active.filter(s => !assignments[s.id]?.assigned_to)
    if (assignFilter !== 'all')        return active.filter(s =>  assignments[s.id]?.assigned_to === assignFilter)
    return active
  }, [active, assignments, assignFilter])

  const isPendingTab = activeSegment === 'pending'
  const isCompletedTab = activeSegment === 'completed'
  const isUnreachableTab = activeSegment === 'unreachable'

  const pendingStoresForTable = useMemo(() => {
    if (!isPendingTab || !isActiveManager || !user?.username) return null
    if (!activeWf) return null
    if (activeWf.daily_quota?.quota_reached) return []
    const mine = filteredActive.filter(s => assignments[s.id]?.assigned_to === user.username)
    const wfIds = new Set(
      [...(activeWf.active_tasks || []), ...(activeWf.no_answer_tasks || [])].map(t => Number(t.store_id)),
    )
    if (wfIds.size === 0) return mine
    const scoped = mine.filter(s => wfIds.has(Number(s.id)))
    return scoped.length ? scoped : mine
  }, [isPendingTab, isActiveManager, user?.username, activeWf, filteredActive, assignments])

  const pendingDisplayStores =
    isPendingTab && isActiveManager
      ? (pendingStoresForTable === null ? filteredActive : pendingStoresForTable)
      : filteredActive

  const activeDailyQuota = isActiveManager && isPendingTab ? activeWf?.daily_quota : null

  const selectedDbCategory = selected
    ? (storeStates[selected.id]?.category || selected.category || '')
    : ''
  const selectedNeedsActiveSurvey =
    Boolean(selected)
    && needsActiveSatisfactionSurvey(selected.id, selectedDbCategory, surveyByStoreId)

  if (!embeddedSegment && !ACTIVE_SEGMENTS.has(activeSegment || '')) {
    return <Navigate to="/active/pending" replace />
  }

  return (
    <div className="space-y-4 lg:space-y-5" dir="rtl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
            {isPendingTab && (
              <>
                <TrendingUp size={22} className="text-green-600" />
                نشط يشحن — قيد المكالمة
              </>
            )}
            {isCompletedTab && (
              <>
                <BadgeCheck size={22} className="text-violet-600" />
                نشط يشحن — المتاجر المنجزة
              </>
            )}
            {isUnreachableTab && (
              <>
                <PhoneOff size={22} className="text-amber-600" />
                نشط يشحن — لم يتم الوصول للمتجر
              </>
            )}
          </h1>
          <p className="text-slate-600 text-sm mt-0.5 flex items-center gap-2 flex-wrap">
            {isPendingTab && (
              <>
                {active.length} متجر — عمود الطرود: آخر 30 يومًا
                {completed.length > 0 && (
                  <span className="text-violet-600 font-medium"> — إجمالي منجز: {completed.length}</span>
                )}
                {unreachable.length > 0 && (
                  <span className="text-amber-700 font-medium"> — لم يُصل للمتجر: {unreachable.length}</span>
                )}
              </>
            )}
            {isCompletedTab && (
              <span>{completed.length} متجر — العودة لقيد المكالمة بعد 30 يوماً من تاريخ المكالمة (Cron)</span>
            )}
            {isUnreachableTab && (
              <span>
                {unreachable.length} متجر — من مكالمة عامة («لم يرد»/«مشغول») أو زر «لم يرد» في المتابعة الدورية؛ يُنقل للمنجزة عند «تم الرد»
              </span>
            )}
            {isPendingTab && (stores.incubating || []).some(s => {
              const c = storeStates[s.id]?.category
              return c === 'active' || c === 'active_shipping' || c === 'active_pending_calls' || c === 'completed' || c === 'unreachable'
            }) && (
              <span className="text-emerald-600 text-xs"> (يشمل مُخرَّجين من الاحتضان)</span>
            )}
            {isPendingTab && isExecutive && assignedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
                <UserCheck size={11} />
                {assignedCount} معيّن
              </span>
            )}
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

      {/* رسالة نجاح */}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm font-medium">
          <CheckCircle2 size={16} />
          {successMsg}
        </div>
      )}

      {/* شريط الفلتر — قيد المكالمة فقط */}
      {isPendingTab && isExecutive && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
            <Filter size={13} />
            تصفية:
          </span>
          {[
            { key: 'all',        label: `الكل (${active.length})` },
            { key: 'assigned',   label: `معيّنة (${assignedCount})` },
            { key: 'unassigned', label: `غير معيّنة (${unassignedCount})` },
          ].map(f => (
            <button
              key={f.key}
              onClick={() => setAssignFilter(f.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                assignFilter === f.key
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          {/* فلتر لكل مسؤول */}
          {users.map(u => {
            const cnt = active.filter(s => assignments[s.id]?.assigned_to === u.username).length
            if (cnt === 0) return null
            return (
              <button
                key={u.username}
                onClick={() => setAssignFilter(assignFilter === u.username ? 'all' : u.username)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${
                  assignFilter === u.username
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-white border border-slate-200 text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {u.fullname || u.username} ({cnt})
              </button>
            )
          })}
        </div>
      )}

      {/* شريط التعيين الجماعي — قيد المكالمة فقط */}
      {isPendingTab && isExecutive && selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-3">

          {/* العنوان وعدد المحددين وزر الإغلاق */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-blue-700 font-medium text-sm">
              <Users size={16} />
              <span>تم تحديد <strong>{selectedIds.size}</strong> متجر</span>
            </div>
            <button onClick={clearSelection} className="text-slate-400 hover:text-slate-600">
              <X size={18} />
            </button>
          </div>

          {/* تبويب وضع التعيين */}
          <div className="flex gap-2">
            <button
              onClick={() => setAssignMode('manual')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                assignMode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-blue-200 text-blue-600 hover:bg-blue-50'
              }`}
            >
              <UserCheck size={13} />
              تعيين لشخص واحد
            </button>
            <button
              onClick={() => setAssignMode('auto')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                assignMode === 'auto'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white border border-blue-200 text-indigo-600 hover:bg-indigo-50'
              }`}
            >
              <Shuffle size={13} />
              توزيع تلقائي
            </button>
          </div>

          {/* وضع يدوي */}
          {assignMode === 'manual' && (
            <div className="flex items-center gap-2 flex-wrap">
              <select
                value={bulkUser}
                onChange={e => setBulkUser(e.target.value)}
                className="text-sm border border-blue-200 rounded-lg px-3 py-1.5 bg-white text-slate-700 focus:outline-none focus:border-blue-400 min-w-[170px]"
              >
                <option value="">اختر المسؤول...</option>
                {users.map(u => (
                  <option key={u.username} value={u.username}>
                    {u.fullname || u.username}
                  </option>
                ))}
              </select>
              <button
                onClick={handleBulkAssign}
                disabled={!bulkUser || saving === true}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <UserCheck size={14} />
                {saving === true ? 'جارٍ التعيين...' : 'تعيين'}
              </button>
            </div>
          )}

          {/* وضع تلقائي */}
          {assignMode === 'auto' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">اختر المسؤولين للتوزيع عليهم (بالتساوي):</p>
              <div className="flex flex-wrap gap-2">
                {users.map(u => {
                  const checked = autoUsers.has(u.username)
                  return (
                    <label
                      key={u.username}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer text-sm transition-colors ${
                        checked
                          ? 'bg-indigo-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAutoUser(u.username)}
                        className="hidden"
                      />
                      {u.fullname || u.username}
                    </label>
                  )
                })}
              </div>
              {autoUsers.size > 0 && (
                <div className="flex items-center gap-3 pt-1">
                  <p className="text-xs text-indigo-600 font-medium">
                    ~{Math.ceil(selectedIds.size / autoUsers.size)} متجر لكل مسؤول
                  </p>
                  <button
                    onClick={handleAutoAssign}
                    disabled={saving === true}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Shuffle size={14} />
                    {saving === true ? 'جارٍ التوزيع...' : 'توزيع'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isPendingTab && (
        <>
          <div className="rounded-2xl border border-emerald-200/70 bg-gradient-to-l from-emerald-50/90 to-white px-4 py-3 shadow-sm">
            <h2 className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <TrendingUp size={17} className="text-emerald-600 shrink-0" />
              المتاجر النشطة — قيد المكالمة
            </h2>
            <p className="text-[11px] text-emerald-800/80 mt-0.5">
              «تم الرد» يُنقل إلى «منجز»؛ «لم يرد» أو «مشغول» في المكالمة العامة، أو «لم يرد» من المتابعة الدورية، يُضاف إلى «لم يتم الوصول للمتجر». بعد 30 يوماً من «منجز» تُعاد تلقائياً إلى قيد المكالمة.
            </p>
            {activeDailyQuota && !activeDailyQuota.quota_reached && (
              <p className="text-[11px] font-semibold text-emerald-900 mt-2 tabular-nums">
                الحصة اليومية: {activeDailyQuota.count} / {activeDailyQuota.limit} — يُعرض طابورك كاملاً (المتاجر المعيّنة لك ضمن المتابعة الدورية).
              </p>
            )}
          </div>

          {activeDailyQuota?.quota_reached && (
            <div className="rounded-2xl border-2 border-emerald-400/80 bg-gradient-to-l from-emerald-50 to-white px-5 py-6 text-center shadow-md">
              <p className="text-lg font-black text-emerald-900">{activeDailyQuota.message_ar}</p>
              <p className="text-sm text-emerald-800/90 mt-2" dir="ltr">
                {activeDailyQuota.message_en}
              </p>
            </div>
          )}

          {selectedNeedsActiveSurvey && (
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-l from-violet-50/95 to-white px-4 py-3 sm:py-4 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-md">
                  <Star size={20} className="text-amber-300 fill-amber-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-violet-950">استبيان رضا العميل مطلوب</p>
                  <p className="text-xs text-violet-900/85 mt-0.5">
                    المتجر المحدد «{selected?.name}» لم يُكمل استبيان الرضا بعد. يمكنك تعبئته من هنا قبل أو بعد تسجيل المكالمة.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSurveyModalStore(selected)}
                className="shrink-0 w-full sm:w-auto px-4 py-2.5 rounded-xl text-sm font-black text-white shadow-lg transition-colors"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
                }}
              >
                فتح الاستبيان
              </button>
            </div>
          )}

          {!activeDailyQuota?.quota_reached && (
          <StoreTable
            variant="elite"
            stores={pendingDisplayStores}
            onSelectStore={setSelected}
            onRestoreStore={setSelected}
            extraColumns={extraColumns}
            emptyMsg="لا توجد متاجر ضمن قيد المكالمة"
            parcelsColumnSub={
              shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
                ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
                : undefined
            }
            selectable={isExecutive}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            eliteNeedsSurvey={s =>
              needsActiveSatisfactionSurvey(
                s.id,
                storeStates[s.id]?.category || s.category || '',
                surveyByStoreId,
              )}
            onEliteSurveyClick={store => setSurveyModalStore(store)}
            eliteWorkflowNoAnswer={s => (
              isActiveManager
              && assignments[s.id]?.assigned_to === user?.username
              && assignments[s.id]?.workflow_status !== 'no_answer'
            )}
            onEliteWorkflowNoAnswer={handleWorkflowNoAnswer}
            eliteWorkflowNoAnswerLoadingId={workflowNoAnswerLoading}
            onCallStore={handleEliteCall}
          />
          )}
        </>
      )}

      {isCompletedTab && (
        <>
          <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-l from-violet-50/90 to-white px-4 py-3 shadow-sm">
            <h2 className="text-sm font-bold text-violet-900 flex items-center gap-2">
              <BadgeCheck size={17} className="text-violet-600 shrink-0" />
              المتاجر المنجزة
            </h2>
            <p className="text-[11px] text-violet-800/80 mt-0.5">
              بعد 30 يوماً من تاريخ المكالمة تُعاد تلقائياً إلى «قيد المكالمة» (مهمة Cron: check-completed-merchants.php).
            </p>
          </div>
          <StoreTable
            variant="elite"
            stores={completed}
            onSelectStore={setSelected}
            onRestoreStore={setSelected}
            extraColumns={completedExtraColumns}
            emptyMsg="لا توجد متاجر منجزة — تظهر هنا بعد تسجيل مكالمة واختيار «تم الرد»"
            parcelsColumnSub={
              shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
                ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
                : undefined
            }
            selectable={false}
            onCallStore={handleEliteCall}
          />
        </>
      )}

      {isUnreachableTab && (
        <>
          <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-l from-amber-50/90 to-white px-4 py-3 shadow-sm">
            <h2 className="text-sm font-bold text-amber-900 flex items-center gap-2">
              <PhoneOff size={17} className="text-amber-600 shrink-0" />
              لم يتم الوصول للمتجر
            </h2>
            <p className="text-[11px] text-amber-900/80 mt-0.5">
              تُسجَّل هنا عند اختيار «لم يرد» أو «مشغول» في مكالمة عامة، أو عند زر «لم يرد» في المتابعة الدورية. عند «تم الرد» في مكالمة لاحقة يُنقل المتجر إلى «المتاجر المنجزة».
            </p>
          </div>
          <StoreTable
            variant="elite"
            stores={unreachable}
            onSelectStore={setSelected}
            onRestoreStore={setSelected}
            extraColumns={unreachableExtraColumns}
            emptyMsg="لا توجد متاجر — تظهر هنا عند «لم يرد» أو «مشغول» في مكالمة عامة أو عند «لم يرد» من المتابعة الدورية"
            parcelsColumnSub={
              shipmentsRangeMeta?.from && shipmentsRangeMeta?.to
                ? `من ${shipmentsRangeMeta.from} إلى ${shipmentsRangeMeta.to}`
                : undefined
            }
            selectable={false}
            onCallStore={handleEliteCall}
          />
        </>
      )}

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}

      {callModalStore && (
        <CallModal
          store={callModalStore}
          callType="general"
          fromDailyTasks={fromDailyTasks}
          onClose={() => setCallModalStore(null)}
          onSaved={async () => {
            await reload()
            setCallModalStore(null)
          }}
        />
      )}

      {surveyModalStore &&
        needsActiveSatisfactionSurvey(
          surveyModalStore.id,
          storeStates[surveyModalStore.id]?.category || surveyModalStore.category || '',
          surveyByStoreId,
        ) && (
        <ActiveStoreSurveyModal
          store={surveyModalStore}
          onClose={() => setSurveyModalStore(null)}
          onSaved={async () => {
            await reload()
            setSurveyModalStore(null)
            showSuccess('تم حفظ استبيان الرضا.')
          }}
        />
      )}
    </div>
  )
}
