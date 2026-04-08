import { useState, useMemo, useCallback, useEffect } from 'react'
import { Baby, RefreshCw, Phone, Search, CheckCircle, PhoneOff, Filter } from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { getIncubationFollowupStores } from '../services/api'
import StoreDrawer from '../components/StoreDrawer'
import CallModal from '../components/CallModal'
import StoreNameWithId from '../components/StoreNameWithId'
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

/** تحويل صف الـ API إلى كائن متجر للدرج / المكالمة */
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

function callTypeForStore(store) {
  const t = String(store?._last_call_type || '').trim()
  if (t === 'inc_call1' || t === 'inc_call2' || t === 'inc_call3') {
    return t
  }
  if (t === 'periodic_followup') {
    return 'periodic_followup'
  }
  return 'general'
}

export default function IncubationNewCompleted() {
  const { user } = useAuth()
  const { callLogs, reload: reloadStores } = useStores()

  const [tab, setTab] = useState('contacted')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [contacted, setContacted] = useState([])
  const [noAnswer, setNoAnswer] = useState([])

  const [qInput, setQInput] = useState('')
  const [qApplied, setQApplied] = useState('')
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')

  const [selected, setSelected] = useState(null)
  const [callStore, setCallStore] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await getIncubationFollowupStores({
        user_role: user?.role ?? '',
        username: user?.username ?? '',
        q: qApplied.trim(),
        reg_from: regFrom.trim(),
        reg_to: regTo.trim(),
      })
      if (!res?.success) {
        throw new Error(res?.error || 'تعذّر التحميل')
      }
      setContacted(res.contacted || [])
      setNoAnswer(res.no_answer || [])
    } catch (e) {
      setError(e?.message || String(e))
      setContacted([])
      setNoAnswer([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username, qApplied, regFrom, regTo])

  useEffect(() => {
    if (user?.username) {
      load()
    }
  }, [user?.username, qApplied, regFrom, regTo, load])

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
    'border-b border-slate-100 transition-all duration-300 cursor-pointer bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)] hover:bg-amber-50/50 hover:shadow-[inset_0_0_0_1px_rgba(234,179,8,0.28),0_6px_24px_-12px_rgba(234,179,8,0.18)]'

  const onSavedCall = () => {
    reloadStores()
    load()
  }

  return (
    <div className="space-y-5" dir="rtl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Baby size={24} className="text-indigo-500" />
            المتاجر الجديدة المنجزة
          </h1>
          <p className="text-slate-600 text-sm mt-0.5">
            متاجر ضمن دورة الاحتضان (14 يوماً) لها تعيين من «المهام اليومية» — تم التواصل أو لم يرد
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-slate-700 border border-white/40 bg-white/50 hover:bg-white/80 shadow-sm backdrop-blur-sm transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
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
          <Filter size={16} className="text-violet-600" />
          بحث وتصفية حسب التسجيل
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
                className="px-3 py-2 bg-violet-600 text-white hover:bg-violet-700"
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
              className="rounded-xl border border-violet-200 text-sm font-semibold px-4 py-2 text-violet-800 bg-violet-50 hover:bg-violet-100"
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
        <div className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg border border-slate-200/90">
          <div className="rounded-2xl border border-slate-200/90 bg-white p-16 text-center text-slate-500">
            <RefreshCw size={32} className="animate-spin mx-auto mb-3 text-violet-500" />
            <div className="text-sm">جاري تحميل البيانات...</div>
          </div>
        </div>
      ) : (
        <div
          className="rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg shadow-slate-200/60 border border-slate-200/90"
          dir="rtl"
        >
          <div className="rounded-2xl border border-slate-200/90 bg-white overflow-x-auto shadow-inner">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/95 text-slate-600 text-[11px] font-semibold border-b border-slate-200 text-right">
                  <th className="px-5 py-3.5 font-semibold">المتجر</th>
                  <th className="px-5 py-3.5 font-semibold whitespace-nowrap">يوم من 14</th>
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
                      لا توجد متاجر في هذا التبويب
                    </td>
                  </tr>
                )}
                {rows.map((s, i) => {
                  const storeObj = rowToStore(s)
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
                        {s.registered_at
                          ? String(s.registered_at).slice(0, 10)
                          : '—'}
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
                              : 'bg-violet-50 text-violet-800 border border-violet-200 hover:bg-violet-100'
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
        <StoreDrawer store={selected} onClose={() => setSelected(null)} />
      )}

      {callStore && (
        <CallModal
          store={callStore}
          callType={callTypeForStore(callStore)}
          onClose={() => setCallStore(null)}
          onSaved={onSavedCall}
        />
      )}
    </div>
  )
}
