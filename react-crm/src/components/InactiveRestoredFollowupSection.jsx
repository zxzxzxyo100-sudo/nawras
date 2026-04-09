import { useState, useMemo, useCallback, useEffect } from 'react'
import { CheckCircle2, RefreshCw, Phone, Search, CheckCircle, PhoneOff, Filter } from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { getInactiveRestoredFollowupStores, getMyWorkflow } from '../services/api'
import StoreDrawer from './StoreDrawer'
import CallModal from './CallModal'
import StoreNameWithId from './StoreNameWithId'
import { totalShipments } from '../utils/storeFields'

function regDaysLabel(registeredAt) {
  if (!registeredAt) return '—'
  const t = new Date(registeredAt).getTime()
  if (Number.isNaN(t)) return '—'
  return `${Math.floor((Date.now() - t) / 86400000)} يوم`
}

function ymdInput(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function rowToStore(row) {
  return {
    id: row.id,
    name: row.name,
    registered_at: row.registered_at,
    total_shipments: row.total_shipments,
    last_shipment_date: row.last_shipment_date,
    status: row.status,
    _cycle_day: row._cycle_day,
    _days_since_reg: row._days_since_reg,
    _last_call_type: row.last_call_type,
  }
}

function mapWorkflowFollowupRow(r, storeStates, allStores) {
  const sid = Number(r.store_id)
  const st = storeStates[sid]
  const fromList = allStores.find(s => Number(s.id) === sid)
  const regRaw = st?.registration_date
  let registered_at = ''
  if (regRaw) {
    const ts = new Date(regRaw).getTime()
    registered_at = !Number.isNaN(ts) ? new Date(ts).toISOString().slice(0, 19).replace('T', ' ') : ''
  }
  const wfAt = r.workflow_updated_at || r.assigned_at
  const wfMs = wfAt ? new Date(wfAt).getTime() : NaN
  const cycle = Number.isNaN(wfMs) ? 1 : Math.min(90, Math.max(1, Math.floor((Date.now() - wfMs) / 86400000) + 1))
  const regTs = registered_at ? new Date(registered_at).getTime() : NaN
  const daysReg = !Number.isNaN(regTs) && regTs > 0 ? (Date.now() - regTs) / 86400000 : 0
  const name =
    (r.store_name && String(r.store_name).trim()) || st?.store_name || fromList?.name || `متجر ${sid}`
  const ws = r.workflow_status || ''
  return {
    id: sid,
    name,
    registered_at,
    _cycle_day: cycle,
    _days_since_reg: Math.round(daysReg * 100) / 100,
    assigned_to: r.assigned_to || '',
    assigned_at: r.assigned_at,
    workflow_updated_at: r.workflow_updated_at,
    followup_status: ws === 'completed' ? 'contacted' : 'no_answer',
    last_call_type: null,
    last_call_stage_label: ws === 'completed' ? 'تم التواصل (مهمة يومية)' : 'لم يرد (مهمة يومية)',
    last_call_at: null,
    total_shipments: fromList != null ? totalShipments(fromList) : 0,
    last_shipment_date: fromList?.last_shipment_date ?? null,
    status: fromList?.status ?? null,
  }
}

function applyClientFilters(rows, q, regFrom, regTo) {
  const needle = q.trim().toLowerCase()
  return rows.filter(row => {
    if (needle) {
      const name = (row.name || '').toLowerCase()
      const idStr = String(row.id)
      if (!name.includes(needle) && !idStr.includes(needle)) return false
    }
    if (regFrom && row.registered_at) {
      const d = String(row.registered_at).slice(0, 10)
      if (d && d < regFrom) return false
    }
    if (regTo && row.registered_at) {
      const d = String(row.registered_at).slice(0, 10)
      if (d && d > regTo) return false
    }
    return true
  })
}

/**
 * خانة «المتاجر غير النشطة المنجزة» — تحميل من get_my_workflow (طابور inactive) حتى يعمل بدون ملف PHP إضافي.
 */
export default function InactiveRestoredFollowupSection({ underRestoredHeading = false } = {}) {
  const { user } = useAuth()
  const { callLogs, reload: reloadStores, storeStates, allStores, lastLoaded } = useStores()

  const [tab, setTab] = useState('contacted')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contactedAll, setContactedAll] = useState([])
  const [noAnswerAll, setNoAnswerAll] = useState([])

  const [qInput, setQInput] = useState('')
  const [qApplied, setQApplied] = useState('')
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')

  const [selected, setSelected] = useState(null)
  const [callStore, setCallStore] = useState(null)

  const contacted = useMemo(
    () => applyClientFilters(contactedAll, qApplied, regFrom, regTo),
    [contactedAll, qApplied, regFrom, regTo]
  )
  const noAnswer = useMemo(
    () => applyClientFilters(noAnswerAll, qApplied, regFrom, regTo),
    [noAnswerAll, qApplied, regFrom, regTo]
  )

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const wf = await getMyWorkflow(user?.username ?? '', { queue: 'inactive' })
      if (wf?.success && Array.isArray(wf.inactive_followup_contacted)) {
        const c = (wf.inactive_followup_contacted || []).map(r =>
          mapWorkflowFollowupRow(r, storeStates, allStores)
        )
        const n = (wf.inactive_followup_no_answer || []).map(r =>
          mapWorkflowFollowupRow(r, storeStates, allStores)
        )
        setContactedAll(c)
        setNoAnswerAll(n)
        return
      }
      const res = await getInactiveRestoredFollowupStores({
        user_role: user?.role ?? '',
        username: user?.username ?? '',
        user_fullname: user?.fullname ?? '',
        q: '',
        reg_from: '',
        reg_to: '',
      })
      if (!res?.success) {
        throw new Error(res?.error || 'تعذّر التحميل')
      }
      setContactedAll(res.contacted || [])
      setNoAnswerAll(res.no_answer || [])
    } catch (e) {
      const msg = e?.response?.data?.error || e?.message || String(e)
      setError(msg)
      setContactedAll([])
      setNoAnswerAll([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username, user?.fullname, storeStates, allStores])

  useEffect(() => {
    if (user?.username) {
      load()
    }
  }, [user?.username, load, lastLoaded])

  const rows = useMemo(
    () => (tab === 'contacted' ? contacted : noAnswer),
    [tab, contacted, noAnswer]
  )

  const applyFilters = () => {
    setQApplied(qInput.trim())
  }

  const clearAllFilters = () => {
    setRegFrom('')
    setRegTo('')
    setQInput('')
    setQApplied('')
  }

  const setLast7Days = () => {
    const to = new Date()
    const from = new Date(to)
    from.setDate(from.getDate() - 7)
    setRegFrom(ymdInput(from))
    setRegTo(ymdInput(to))
  }

  const rowElite =
    'border-b border-slate-100 transition-all duration-300 cursor-pointer bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-teal-50/40 hover:shadow-[inset_0_0_0_1px_rgba(20,184,166,0.22),0_6px_24px_-12px_rgba(20,184,166,0.12)]'

  const onSavedCall = () => {
    reloadStores()
    load()
  }

  return (
    <div className="space-y-4" dir="rtl">
      <div className="rounded-2xl border border-teal-200/80 bg-gradient-to-l from-teal-50/90 to-white px-5 py-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            {underRestoredHeading && (
              <p className="text-xs font-semibold text-teal-800/90 mb-1">تمت الاستعادة</p>
            )}
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <CheckCircle2 size={22} className="text-teal-600 shrink-0" />
              المتاجر غير النشطة المنجزة
            </h2>
            <p className="text-slate-600 text-sm mt-1 leading-relaxed">
              تعيينات المهام اليومية لطابور غير النشط بعد اكتمال الاستعادة —{' '}
              <strong className="font-semibold text-teal-900">تم التواصل</strong> أو{' '}
              <strong className="font-semibold text-amber-900">لم يرد</strong>. يُحتسب نحو الحصة «تم التواصل» فقط؛ «لم يرد»
              هنا لا يُحتسب في الـ50. البيانات تُجلب من طابورك (نفس «المهام»).
            </p>
          </div>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="flex shrink-0 items-center justify-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-700 border border-teal-200 bg-white hover:bg-teal-50/80 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث القائمة
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setTab('contacted')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
            tab === 'contacted'
              ? 'bg-emerald-600 text-white border-emerald-600 shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <CheckCircle size={16} />
          تم التواصل
          <span className="tabular-nums opacity-90">({contacted.length.toLocaleString('ar-SA')})</span>
        </button>
        <button
          type="button"
          onClick={() => setTab('no_answer')}
          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold border transition-colors ${
            tab === 'no_answer'
              ? 'bg-amber-600 text-white border-amber-600 shadow-md'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
          }`}
        >
          <PhoneOff size={16} />
          لم يرد
          <span className="tabular-nums opacity-90">({noAnswer.length.toLocaleString('ar-SA')})</span>
        </button>
      </div>

      <div className="rounded-2xl border border-slate-200/90 bg-white/90 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold">
          <Filter size={16} className="text-teal-600" />
          بحث وتصفية حسب تاريخ التسجيل
        </div>
        <div className="flex flex-col lg:flex-row flex-wrap gap-3 items-stretch lg:items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">بحث بالاسم أو رقم المتجر</label>
            <div className="flex rounded-xl border border-slate-200 overflow-hidden bg-white">
              <input
                type="search"
                value={qInput}
                onChange={e => setQInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && applyFilters()}
                placeholder="اكتب للبحث…"
                className="flex-1 min-w-0 px-3 py-2 text-sm text-slate-800 outline-none"
              />
              <button
                type="button"
                onClick={applyFilters}
                className="px-3 py-2 bg-teal-600 text-white hover:bg-teal-700"
                title="بحث"
              >
                <Search size={18} />
              </button>
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">من تاريخ التسجيل</label>
            <input
              type="date"
              value={regFrom}
              onChange={e => setRegFrom(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">إلى تاريخ التسجيل</label>
            <input
              type="date"
              value={regTo}
              onChange={e => setRegTo(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={applyFilters}
              className="rounded-xl bg-slate-800 text-white text-sm font-semibold px-4 py-2 hover:bg-slate-900"
            >
              تطبيق التصفية
            </button>
            <button
              type="button"
              onClick={clearAllFilters}
              className="rounded-xl border border-slate-200 text-sm font-semibold px-4 py-2 text-slate-700 hover:bg-slate-50"
            >
              مسح
            </button>
            <button
              type="button"
              onClick={setLast7Days}
              className="rounded-xl border border-teal-200 text-sm font-semibold px-4 py-2 text-teal-800 bg-teal-50 hover:bg-teal-100"
            >
              آخر 7 أيام
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/30 to-slate-100/90 p-2 sm:p-3 shadow-lg border border-slate-200/90">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center text-slate-500">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-teal-500" />
            <div className="text-sm">جاري تحميل المتابعة…</div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-teal-50/25 to-slate-100/90 p-2 sm:p-3 shadow-lg shadow-slate-200/60 border border-slate-200/90"
          dir="rtl"
        >
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-x-auto shadow-inner">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/95 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
                  <th className="px-5 py-3.5 font-semibold">المتجر</th>
                  <th className="px-5 py-3.5 font-semibold whitespace-nowrap">يوم المتابعة</th>
                  <th className="px-5 py-3.5 font-semibold">مرحلة المكالمة</th>
                  <th className="px-5 py-3.5 font-semibold">أيام منذ التسجيل</th>
                  <th className="px-5 py-3.5 font-semibold">تاريخ التسجيل</th>
                  <th className="px-5 py-3.5 font-semibold">المسؤول</th>
                  <th className="px-5 py-3.5 font-semibold whitespace-nowrap">آخر تحديث</th>
                  <th className="px-5 py-3.5 font-semibold">الطلبيات</th>
                  <th className="px-5 py-3.5 font-semibold">التواصل</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                      لا توجد متاجر في هذا التبويب — إن لم تُكمل أي مهمة يومية بعد، ستبقى القائمة فارغة حتى يُسجَّل «تم
                      التواصل» أو «لم يرد» على التعيين.
                    </td>
                  </tr>
                )}
                {rows.map((s, i) => {
                  const storeObj = { ...rowToStore(s) }
                  const cat = storeStates[s.id]?.category
                  if (cat) storeObj.category = cat
                  const parcels = totalShipments(storeObj)
                  const hasCalls = callLogs[s.id] && Object.keys(callLogs[s.id]).length > 0
                  return (
                    <tr
                      key={`${s.id}-${i}`}
                      onClick={() => setSelected(storeObj)}
                      className={rowElite}
                    >
                      <td className="px-5 py-4 text-slate-700">
                        <StoreNameWithId
                          store={storeObj}
                          nameClassName="font-semibold text-slate-900"
                          idClassName="text-xs font-mono text-slate-600 font-semibold"
                        />
                      </td>
                      <td className="px-5 py-4 text-slate-800 tabular-nums font-medium">
                        {s._cycle_day != null ? s._cycle_day : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs leading-relaxed max-w-[14rem]">
                        {s.last_call_stage_label || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 tabular-nums">
                        {regDaysLabel(s.registered_at)}
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {s.registered_at ? String(s.registered_at).slice(0, 10) : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs">
                        {s.assigned_to || '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-600 text-xs whitespace-nowrap">
                        {s.workflow_updated_at
                          ? String(s.workflow_updated_at).replace('T', ' ').slice(0, 16)
                          : '—'}
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <span
                          className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                            parcels > 0
                              ? 'bg-green-50 text-green-800 border-green-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {parcels}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-slate-700">
                        <button
                          type="button"
                          onClick={e => {
                            e.stopPropagation()
                            setCallStore(storeObj)
                          }}
                          className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${
                            hasCalls
                              ? 'bg-green-50 text-green-800 border border-green-200 hover:bg-green-100'
                              : 'bg-teal-50 text-teal-800 border border-teal-200 hover:bg-teal-100'
                          }`}
                        >
                          <Phone size={12} />
                          {hasCalls ? 'متابعة' : 'تواصل'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-0 rounded-b-2xl px-4 py-3 border-t border-slate-200 bg-slate-50/80 text-xs text-slate-600">
            عرض {rows.length.toLocaleString('ar-SA')} متجر — التبويب:{' '}
            {tab === 'contacted' ? 'تم التواصل' : 'لم يرد'}
          </div>
        </div>
      )}

      {selected && (
        <StoreDrawer store={selected} onClose={() => setSelected(null)} qvNeedsFreezeSource="inactive" />
      )}

      {callStore && (
        <CallModal
          store={callStore}
          callType="general"
          inactiveRestoredFollowup
          onClose={() => setCallStore(null)}
          onSaved={onSavedCall}
        />
      )}
    </div>
  )
}
