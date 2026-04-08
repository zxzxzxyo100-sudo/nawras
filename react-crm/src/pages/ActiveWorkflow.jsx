import { useState, useEffect, useCallback, useMemo } from 'react'
import { ClipboardList, RefreshCw, Users, AlertTriangle, Loader2, Phone, PhoneOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import StoreDrawer from '../components/StoreDrawer'
import ActiveStoreSurveyModal from '../components/ActiveStoreSurveyModal'
import StoreNameWithId from '../components/StoreNameWithId'
import {
  getMyWorkflow,
  fillAllActiveQueues,
  listAllNoAnswerWorkflow,
  markSurveyNoAnswer,
  markActiveWorkflowContacted,
} from '../services/api'

/** منع تكرار نفس store_id في الجدول إن عاد من الـ API */
function dedupeWorkflowRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows
  const seen = new Set()
  return rows.filter((r) => {
    const id = r?.store_id != null ? String(r.store_id) : ''
    if (!id || seen.has(id)) return false
    seen.add(id)
    return true
  })
}

function findStoreInContext(stores, storeStates, id) {
  const all = [
    ...(stores.active_shipping || []),
    ...(stores.incubating || []),
    ...(stores.completed_merchants || []),
    ...(stores.unreachable_merchants || []),
  ]
  const hit = all.find(s => String(s.id) === String(id))
  if (hit) return hit
  const st = storeStates[id]
  return {
    id,
    name: st?.store_name || `متجر ${id}`,
    phone: '',
    category: st?.category,
  }
}

export default function ActiveWorkflow() {
  const { user } = useAuth()
  const { stores, storeStates, reload, loading: storesLoading } = useStores()
  const [wf, setWf] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [filling, setFilling] = useState(false)
  const [execNoAnswer, setExecNoAnswer] = useState([])
  const [noAnswerRowLoading, setNoAnswerRowLoading] = useState(null)
  const [contactedLoading, setContactedLoading] = useState(null)
  const [selected, setSelected] = useState(null)
  const [surveyModalStore, setSurveyModalStore] = useState(null)
  const [workflowStatusForDrawer, setWorkflowStatusForDrawer] = useState(null)

  const username = user?.username ?? ''
  const isExecutive = user?.role === 'executive'

  const loadWf = useCallback(async () => {
    if (!username) return
    setErr('')
    setLoading(true)
    try {
      const res = await getMyWorkflow(username)
      if (res.success) {
        setWf(res)
      } else {
        setErr(res.error || 'فشل التحميل')
      }
    } catch (e) {
      setErr(e.response?.data?.error || 'فشل التحميل')
    } finally {
      setLoading(false)
    }
  }, [username])

  useEffect(() => {
    loadWf()
  }, [loadWf])

  useEffect(() => {
    if (!isExecutive) return
    listAllNoAnswerWorkflow('executive')
      .then(r => {
        if (r.success && Array.isArray(r.data)) setExecNoAnswer(r.data)
      })
      .catch(() => {})
  }, [isExecutive, wf])

  async function handleFillAll() {
    if (!isExecutive) return
    setFilling(true)
    setErr('')
    try {
      const r = await fillAllActiveQueues({
        user_role: 'executive',
        assigned_by: user?.fullname || username,
      })
      if (!r.success) throw new Error(r.error || '')
      await reload()
      await loadWf()
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'فشل التعبئة')
    } finally {
      setFilling(false)
    }
  }

  function openDrawer(row, workflowStatus) {
    const st = findStoreInContext(stores, storeStates, row.store_id)
    setSelected(st)
    setWorkflowStatusForDrawer(workflowStatus)
  }

  async function handleNoAnswerActiveRow(row) {
    if (!username) return
    setNoAnswerRowLoading(row.store_id)
    setErr('')
    try {
      await markSurveyNoAnswer({
        store_id: row.store_id,
        store_name: row.store_name || '',
        username,
        queue: 'active',
      })
      await reload()
      await loadWf()
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'تعذّر تسجيل عدم الرد')
    } finally {
      setNoAnswerRowLoading(null)
    }
  }

  async function handleActiveContacted(row) {
    if (!username) return
    setContactedLoading(row.store_id)
    setErr('')
    const sid = String(row.store_id)
    try {
      await markActiveWorkflowContacted({
        store_id: row.store_id,
        store_name: row.store_name || '',
        username,
      })
      setWf((prev) => {
        if (!prev?.success) return prev
        const nextActive = (prev.active_tasks || []).filter((r) => String(r.store_id) !== sid)
        const nextNoAns = (prev.no_answer_tasks || []).filter((r) => String(r.store_id) !== sid)
        return {
          ...prev,
          active_tasks: nextActive,
          no_answer_tasks: nextNoAns,
          active_count: nextActive.length,
          no_answer_count: nextNoAns.length,
        }
      })
      await reload()
      await loadWf()
    } catch (e) {
      setErr(e.response?.data?.error || e.message || 'تعذّر تسجيل تم التواصل')
    } finally {
      setContactedLoading(null)
    }
  }

  const target = wf?.target ?? 50

  const activeRows = useMemo(() => {
    const rows = dedupeWorkflowRows(wf?.active_tasks ?? [])
    const delayedRank = (r) => {
      const v = r?.is_delayed
      if (v === true || v === 1 || v === '1') return 1
      return 0
    }
    return [...rows].sort((a, b) => {
      const da = delayedRank(a)
      const db = delayedRank(b)
      if (da !== db) return db - da
      const ta = new Date(a.assigned_at || 0).getTime()
      const tb = new Date(b.assigned_at || 0).getTime()
      if (ta !== tb) return ta - tb
      return String(a.store_id).localeCompare(String(b.store_id))
    })
  }, [wf])
  const noAnswerRows = useMemo(() => dedupeWorkflowRows(wf?.no_answer_tasks ?? []), [wf])

  return (
    <div className="space-y-5 max-w-6xl mx-auto" dir="rtl">
      <div className="rounded-2xl border border-violet-200/80 bg-gradient-to-l from-violet-50/95 to-white px-5 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-xl bg-violet-600 flex items-center justify-center shrink-0 shadow-md">
              <Users size={22} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900">المتابعة الدورية — طابور المتاجر النشطة</h1>
              <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                حتى {target} متجراً في الطابور؛ المتأخّرات تُثبَّت أعلى القائمة. «اتصل» يسجّل تم التواصل وينقل المتجر إلى «المتاجر المنجزة» ويُحلّ مكانه فوراً.
                «لم يرد» يُسجَّل كعدم وصول (نفس تبويب «لم يتم الوصول للمتجر» في نشط يشحن) مع إحلال من المجمع.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => { reload(); loadWf() }}
              disabled={storesLoading || loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={storesLoading || loading ? 'animate-spin' : ''} />
              تحديث
            </button>
            {isExecutive && (
              <button
                type="button"
                onClick={handleFillAll}
                disabled={filling}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50"
              >
                {filling ? <Loader2 size={14} className="animate-spin" /> : null}
                تعبئة الطوابير (كل المسؤولين)
              </button>
            )}
          </div>
        </div>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3 flex items-center gap-2">
          <AlertTriangle size={16} />
          {err}
        </div>
      )}

      {loading && !wf ? (
        <div className="flex justify-center py-16 text-slate-500">
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : (
        <>
          <section className="rounded-2xl border border-emerald-200/70 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-emerald-100 bg-emerald-50/80 flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-sm font-black text-emerald-900 flex items-center gap-2">
                <ClipboardList size={18} className="text-emerald-600" />
                المهام النشطة
              </h2>
              <span className="text-xs font-bold text-emerald-800 bg-emerald-100/80 px-2.5 py-1 rounded-full">
                {wf?.active_count ?? 0} / {target}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-xs">
                    <th className="text-right px-4 py-2">المتجر</th>
                    <th className="text-right px-4 py-2 w-40">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-8 text-center text-slate-400 text-sm">
                        لا توجد مهام في الطابور — {isExecutive ? 'استخدم «تعبئة الطوابير» أو انتظر المجمع.' : 'اطلب من المدير تعبئة الطابور إن وُجدت متاجر مؤهلة.'}
                      </td>
                    </tr>
                  ) : (
                    activeRows.map(row => (
                      <tr key={row.store_id} className="border-b border-slate-50 hover:bg-slate-50/50">
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <StoreNameWithId
                              store={findStoreInContext(stores, storeStates, row.store_id)}
                              nameClassName="font-semibold text-slate-800"
                              idClassName="font-mono text-xs text-slate-500"
                            />
                            {(() => {
                              const v = row?.is_delayed
                              const delayed = v === true || v === 1 || v === '1'
                              return delayed ? (
                                <span className="text-[10px] font-black text-rose-800 bg-rose-100 border border-rose-200/80 px-2 py-0.5 rounded-md shrink-0">
                                  متأخر — يحتاج تم الرد
                                </span>
                              ) : null
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleActiveContacted(row)}
                              disabled={contactedLoading === row.store_id || noAnswerRowLoading === row.store_id}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                              title="تسجيل تم التواصل وإحلال المتجر في الطابور"
                            >
                              <Phone size={14} />
                              {contactedLoading === row.store_id ? 'جارٍ…' : 'اتصل'}
                            </button>
                            {(() => {
                              const st = findStoreInContext(stores, storeStates, row.store_id)
                              const tel = st?.phone
                              return (
                                <a
                                  href={tel ? `tel:${tel}` : undefined}
                                  aria-disabled={!tel}
                                  onClick={e => { if (!tel) e.preventDefault() }}
                                  className={`text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 border border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100 ${!tel ? 'pointer-events-none opacity-40' : ''}`}
                                >
                                  اتصال هاتفي
                                </a>
                              )
                            })()}
                            <button
                              type="button"
                              onClick={() => handleNoAnswerActiveRow(row)}
                              disabled={noAnswerRowLoading === row.store_id || contactedLoading === row.store_id}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg inline-flex items-center gap-1 border-2 border-orange-400 bg-orange-50 text-orange-950 hover:bg-orange-100 disabled:opacity-50"
                            >
                              <PhoneOff size={14} />
                              {noAnswerRowLoading === row.store_id ? 'جارٍ…' : 'عدم الرد'}
                            </button>
                            <button
                              type="button"
                              onClick={() => openDrawer(row, 'active')}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              تفاصيل
                            </button>
                            <button
                              type="button"
                              onClick={() => setSurveyModalStore(findStoreInContext(stores, storeStates, row.store_id))}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                            >
                              استبيان
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-amber-200/80 bg-white shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-amber-100 bg-amber-50/80 flex items-center justify-between">
              <h2 className="text-sm font-black text-amber-950 flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                لم يتم الرد
              </h2>
              <span className="text-xs font-bold text-amber-900 bg-amber-100/80 px-2.5 py-1 rounded-full">
                {wf?.no_answer_count ?? 0}
              </span>
            </div>
            <p className="text-[11px] text-amber-900/85 px-4 py-2 bg-amber-50/50 border-b border-amber-100/80">
              لا يمكنك تجميد هذه المتاجر من حسابك؛ المدير يتابع القائمة أدناه ويمكنه التجميد أو إكمال الاستبيان.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-xs">
                    <th className="text-right px-4 py-2">المتجر</th>
                    <th className="text-right px-4 py-2 w-40">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {noAnswerRows.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-slate-400 text-sm">
                        لا توجد حالات عدم رد
                      </td>
                    </tr>
                  ) : (
                    noAnswerRows.map(row => (
                      <tr key={row.store_id} className="border-b border-slate-50 hover:bg-amber-50/30">
                        <td className="px-4 py-3">
                          <StoreNameWithId
                            store={findStoreInContext(stores, storeStates, row.store_id)}
                            nameClassName="font-semibold text-slate-800"
                            idClassName="font-mono text-xs text-slate-500"
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => openDrawer(row, 'no_answer')}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                            >
                              تفاصيل
                            </button>
                            <button
                              type="button"
                              onClick={() => setSurveyModalStore(findStoreInContext(stores, storeStates, row.store_id))}
                              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
                            >
                              إكمال الاستبيان
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {isExecutive && execNoAnswer.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <h2 className="text-sm font-black text-slate-800">كل حالات عدم الرد (النظام)</h2>
              </div>
              <ul className="divide-y divide-slate-100 max-h-64 overflow-y-auto">
                {execNoAnswer.map(row => (
                  <li key={`${row.store_id}-${row.assigned_to}`} className="px-4 py-2 text-xs flex justify-between gap-2">
                    <span className="font-mono text-slate-600">{row.store_id}</span>
                    <span className="text-slate-800">{row.store_name}</span>
                    <span className="text-violet-700 font-medium">{row.assigned_to}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      {selected && (
        <StoreDrawer
          store={selected}
          onClose={() => { setSelected(null); setWorkflowStatusForDrawer(null) }}
          workflowAssignmentStatus={workflowStatusForDrawer}
        />
      )}

      {surveyModalStore && username && (
        <ActiveStoreSurveyModal
          store={surveyModalStore}
          workflowMode
          username={username}
          onClose={() => setSurveyModalStore(null)}
          onSaved={async () => {
            await reload()
            await loadWf()
            setSurveyModalStore(null)
          }}
        />
      )}
    </div>
  )
}
