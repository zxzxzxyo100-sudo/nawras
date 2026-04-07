import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  ClipboardList,
  Loader2,
  CheckCircle2,
  Package,
  Bell,
  CalendarClock,
  TrendingDown,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import {
  getExecutivePrivateTickets,
  completeExecutivePrivateTicket,
  getOrdersSummaryRange,
} from '../services/api'
import { usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'
import { totalShipments } from '../utils/storeFields'
import { buildWhatsAppUrl } from '../utils/deviationTicket'
import {
  getRollingTwoWeekShipmentWindows,
  DEVIATION_MIN_FIRST_WEEK_SHIPMENTS,
} from '../utils/deviationShipmentRadar'

const DEVIATION = 'deviation_alert'

function parseMeta(ticket) {
  if (!ticket?.meta_json) return {}
  try {
    return typeof ticket.meta_json === 'string' ? JSON.parse(ticket.meta_json) : ticket.meta_json
  } catch {
    return {}
  }
}

function buildCountMapFromSummary(res) {
  const m = new Map()
  const rows = Array.isArray(res?.data) ? res.data : []
  for (const s of rows) {
    const id = s.id ?? s.store_id
    if (id == null) continue
    const n = totalShipments(s)
    const name = (s.name || s.store_name || '').trim()
    const phone = s.phone != null ? String(s.phone) : ''
    m.set(Number(id), { n, name, phone })
    m.set(String(id), { n, name, phone })
  }
  return m
}

export default function DeviationTickets() {
  const { user } = useAuth()
  const { stores, storeStates, allStores, loading: storesLoading, reload: reloadStores } = useStores()
  const { refreshPrivateTicketsAlert } = usePrivateTicketsAlert()
  const [tickets, setTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(true)
  const [radarRows, setRadarRows] = useState([])
  const [loadingRadar, setLoadingRadar] = useState(true)
  const [radarWindows, setRadarWindows] = useState(null)
  const [err, setErr] = useState('')
  const [radarErr, setRadarErr] = useState('')
  const [completingId, setCompletingId] = useState(null)

  const isExecutive = user?.role === 'executive'

  const frozenIds = useMemo(() => {
    const ids = new Set()
    for (const s of stores.frozen_merchants || []) {
      if (s?.id != null) ids.add(Number(s.id))
    }
    for (const s of stores.incubating || []) {
      if (storeStates[s.id]?.category === 'frozen' && s?.id != null) ids.add(Number(s.id))
    }
    return ids
  }, [stores.frozen_merchants, stores.incubating, storeStates])

  const frozenIdsRef = useRef(frozenIds)
  useEffect(() => {
    frozenIdsRef.current = frozenIds
  }, [frozenIds])

  const phoneByStoreId = useMemo(() => {
    const m = new Map()
    for (const s of allStores || []) {
      if (s?.id == null) continue
      const p = s.phone != null ? String(s.phone).trim() : ''
      if (p) m.set(Number(s.id), p)
    }
    return m
  }, [allStores])

  const phoneByStoreIdRef = useRef(phoneByStoreId)
  useEffect(() => {
    phoneByStoreIdRef.current = phoneByStoreId
  }, [phoneByStoreId])

  const loadTickets = useCallback(async () => {
    if (!user?.username) {
      setLoadingTickets(false)
      return
    }
    setErr('')
    setLoadingTickets(true)
    try {
      const res = await getExecutivePrivateTickets({
        username: user.username,
        user_role: user.role || '',
      })
      if (res?.success) {
        const list = Array.isArray(res.tickets) ? res.tickets : []
        const only = list.filter(t => (t.ticket_type || 'general') === DEVIATION)
        only.sort((a, b) => {
          const ao = a.status === 'open' ? 0 : 1
          const bo = b.status === 'open' ? 0 : 1
          if (ao !== bo) return ao - bo
          const ta = new Date(a.created_at || 0).getTime()
          const tb = new Date(b.created_at || 0).getTime()
          return tb - ta
        })
        setTickets(only)
      } else {
        setErr(res?.error || 'تعذّر تحميل التذاكر')
        setTickets([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'خطأ')
      setTickets([])
    } finally {
      setLoadingTickets(false)
    }
  }, [user?.username, user?.role])

  const loadRadar = useCallback(async () => {
    setRadarErr('')
    setLoadingRadar(true)
    try {
      const w = getRollingTwoWeekShipmentWindows()
      setRadarWindows(w)
      const [r1, r2] = await Promise.all([
        getOrdersSummaryRange(w.week1.from, w.week1.to),
        getOrdersSummaryRange(w.week2.from, w.week2.to),
      ])
      if (r1?.success === false || r2?.success === false) {
        setRadarErr('تعذّر جلب ملخص الشحنات للفترتين.')
        setRadarRows([])
        return
      }
      const map1 = buildCountMapFromSummary(r1)
      const map2 = buildCountMapFromSummary(r2)
      const ids = new Set()
      for (const k of map1.keys()) {
        if (typeof k === 'number') ids.add(k)
      }
      for (const k of map2.keys()) {
        if (typeof k === 'number') ids.add(k)
      }

      const frozen = frozenIdsRef.current
      const phones = phoneByStoreIdRef.current
      const rows = []
      for (const id of ids) {
        if (frozen.has(id)) continue
        const a = map1.get(id) || { n: 0, name: '', phone: '' }
        const b = map2.get(id) || { n: 0, name: '', phone: '' }
        const week1 = a.n
        const week2 = b.n
        const name = a.name || b.name || `متجر ${id}`
        let phone = a.phone || b.phone || phones.get(id) || ''
        if (week1 < DEVIATION_MIN_FIRST_WEEK_SHIPMENTS) continue
        if (week2 >= week1) continue
        rows.push({
          id,
          name,
          phone,
          week1,
          week2,
          drop: week1 - week2,
        })
      }
      rows.sort((x, y) => y.drop - x.drop)
      setRadarRows(rows)
    } catch (e) {
      setRadarErr(e?.response?.data?.error || e.message || 'خطأ في رادار الشحنات')
      setRadarRows([])
    } finally {
      setLoadingRadar(false)
    }
  }, [])

  useEffect(() => {
    void loadTickets()
  }, [loadTickets])

  /** لا نحسب الرادار قبل جلب تصنيف المتاجر حتى نستبعد المجمدة بدقة */
  useEffect(() => {
    if (storesLoading) return
    void loadRadar()
  }, [storesLoading, loadRadar])

  const refreshAll = useCallback(async () => {
    await reloadStores()
    await loadTickets()
    await new Promise(resolve => {
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    })
    await loadRadar()
  }, [reloadStores, loadTickets, loadRadar])

  const openCount = useMemo(() => tickets.filter(t => t.status === 'open').length, [tickets])
  const isSunday = new Date().getDay() === 0
  const showExecRadarAlert = isExecutive && radarRows.length > 0 && !loadingRadar

  async function handleComplete(id) {
    setCompletingId(id)
    setErr('')
    try {
      const res = await completeExecutivePrivateTicket({
        user_role: user.role,
        username: user.username,
        id,
      })
      if (res?.success) {
        await loadTickets()
        await refreshPrivateTicketsAlert()
      } else {
        setErr(res?.error || 'تعذّر التحديث')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'خطأ')
    } finally {
      setCompletingId(null)
    }
  }

  return (
    <div className="space-y-4 lg:space-y-5" dir="rtl">
      {showExecRadarAlert && (
        <div className="flex flex-wrap items-start gap-3 rounded-2xl border border-amber-300/80 bg-gradient-to-l from-amber-50 to-orange-50/90 px-4 py-3 shadow-sm ring-1 ring-amber-200/60">
          <Bell className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-black text-amber-950">تنبيه للمدير التنفيذي</p>
            <p className="mt-1 leading-relaxed text-amber-900/95">
              يوجد{' '}
              <span className="font-black tabular-nums">{radarRows.length.toLocaleString('ar-SA')}</span> متجراً
              انخفضت شحناته بين الأسبوعين (آخر 14 يوماً) ضمن الشروط — راجع جدول «رادار الشحنات» أدناه.
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 rounded-2xl border border-white/25 bg-white/45 px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/40 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-2 text-xl font-bold text-slate-800 lg:text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-400/30">
              <AlertTriangle className="text-red-600" size={22} aria-hidden />
            </span>
            تذاكر الانحراف
            {isSunday && (
              <span className="inline-flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-[11px] font-bold text-violet-900">
                <CalendarClock size={12} />
                يوم مراجعة أسبوعية (أحد)
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            رادار الشحنات: آخر أسبوعين حتى اليوم (أسبوع مقابل أسبوع)، دون المجمدة. يظهر المتجر إذا كان لديه{' '}
            <span className="font-bold text-slate-800">
              {DEVIATION_MIN_FIRST_WEEK_SHIPMENTS.toLocaleString('ar-SA')}+
            </span>{' '}
            شحنة في الأسبوع الأقدم ثم انخفاض في الأسبوع الأحدث.
          </p>
          <p className="mt-1 text-xs font-semibold text-red-800/90">
            تذاكر مسجّلة — مفتوحة: {openCount.toLocaleString('ar-SA')} — إجمالي:{' '}
            {tickets.length.toLocaleString('ar-SA')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => refreshAll()}
          disabled={loadingTickets || loadingRadar}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loadingTickets || loadingRadar ? 'animate-spin' : ''} />
          تحديث القوائم
        </button>
      </div>

      {/* ——— رادار الشحنات ——— */}
      <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-l from-slate-100/90 to-white px-4 py-3 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <TrendingDown size={17} className="shrink-0 text-red-600" />
          رادار الشحنات (أسبوع مقابل أسبوع)
        </h2>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-700/90">
          البيانات من <code className="rounded bg-slate-200/80 px-1">orders-summary</code> لنفس نطاق التواريخ لكل
          فترة. تُستبعد المتاجر المجمدة بالكامل. النافذة متحركة (آخر 14 يوماً إلى اليوم) وتتحدّث عند «تحديث القوائم»
          أو إعادة فتح الصفحة — يُنصح بمراجعة دورية يوم الأحد.
        </p>
        {radarWindows && (
          <p className="mt-2 text-[11px] font-semibold text-slate-800">
            الأسبوع الأقدم: {radarWindows.week1.from} ← {radarWindows.week1.to} — الأسبوع الأحدث:{' '}
            {radarWindows.week2.from} ← {radarWindows.week2.to} — حتى {radarWindows.asOf}
          </p>
        )}
      </div>

      {radarErr && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{radarErr}</div>
      )}

      {loadingRadar && radarRows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-12 text-slate-500">
          <Loader2 className="animate-spin" size={22} />
          جارٍ حساب رادار الشحنات…
        </div>
      ) : radarRows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-emerald-200/80 bg-emerald-50/40 py-10 text-center text-sm text-slate-600">
          لا يوجد متجر يلبي شرط الانخفاض (بعد {DEVIATION_MIN_FIRST_WEEK_SHIPMENTS.toLocaleString('ar-SA')} شحنة في
          الأسبوع الأول) ضمن آخر أسبوعين — أو لا توجد بيانات بعد.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-red-200/60 bg-white shadow-sm">
          <table className="w-full min-w-[760px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-red-50/90 text-[11px] font-bold uppercase tracking-wide text-slate-700">
                <th className="px-3 py-3">المتجر</th>
                <th className="px-3 py-3">المعرّف</th>
                <th className="px-3 py-3">شحنات الأسبوع الأقدم</th>
                <th className="px-3 py-3">شحنات الأسبوع الأحدث</th>
                <th className="px-3 py-3">الانخفاض</th>
                <th className="px-3 py-3 text-center">واتساب</th>
              </tr>
            </thead>
            <tbody>
              {radarRows.map(row => {
                const wa = buildWhatsAppUrl(row.phone)
                return (
                  <tr key={row.id} className="border-b border-slate-100 bg-white hover:bg-red-50/30">
                    <td className="max-w-[200px] px-3 py-3 font-semibold text-slate-900">{row.name}</td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">{row.id}</td>
                    <td className="px-3 py-3 tabular-nums">{row.week1.toLocaleString('ar-SA')}</td>
                    <td className="px-3 py-3 tabular-nums text-amber-900">{row.week2.toLocaleString('ar-SA')}</td>
                    <td className="px-3 py-3">
                      <span className="inline-flex rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-black text-red-800">
                        −{row.drop.toLocaleString('ar-SA')}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center">
                      {wa ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                        >
                          <MessageCircle size={13} />
                          واتساب
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ——— التذاكر المسجّلة ——— */}
      <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-l from-slate-100/90 to-white px-4 py-3 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Package size={17} className="shrink-0 text-slate-600" />
          تذاكر الانحراف المسجّلة (من التعيين)
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-700/90">
          {isExecutive
            ? 'تذاكر أُنشئت عند تعيين متجر من «نشط يشحن» أو «المجمدة».'
            : 'التذاكر المسندة إليك من التعيين.'}
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}

      {loadingTickets && tickets.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-10 text-slate-500">
          <Loader2 className="animate-spin" size={20} />
          جارٍ تحميل التذاكر…
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 py-10 text-center text-sm text-slate-500">
          لا توجد تذاكر انحراف مسجّلة من التعيين.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200/90 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-right text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wide text-slate-600">
                <th className="px-3 py-3">المتجر</th>
                <th className="px-3 py-3">المعرّف</th>
                {isExecutive && <th className="px-3 py-3">المسؤول</th>}
                <th className="px-3 py-3">أيام منذ الشحنة</th>
                <th className="px-3 py-3">الحالة</th>
                <th className="px-3 py-3">التاريخ</th>
                <th className="px-3 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map(t => {
                const meta = parseMeta(t)
                const days = meta?.radar?.days_since_ship
                const wa = meta?.whatsapp_url || ''
                const done = t.status === 'done'
                const canComplete =
                  !done && (isExecutive || t.assignee_username === user?.username)
                return (
                  <tr
                    key={t.id}
                    className={`border-b border-slate-100 transition-colors ${
                      done ? 'bg-slate-50/80' : 'bg-white hover:bg-red-50/40'
                    }`}
                  >
                    <td className="max-w-[220px] px-3 py-3 font-semibold text-slate-900">
                      <span className="line-clamp-2" title={t.title}>
                        {meta?.store_name || t.title?.replace(/^🚨\s*تذكرة انحراف عاجلة:\s*/i, '') || '—'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 font-mono text-xs text-slate-600">
                      {t.store_id ?? meta?.store_id ?? '—'}
                    </td>
                    {isExecutive && (
                      <td className="px-3 py-3 text-xs text-slate-700">
                        {t.assignee_fullname || t.assignee_username || '—'}
                      </td>
                    )}
                    <td className="px-3 py-3">
                      {days != null && days !== '' ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            Number(days) > 14
                              ? 'bg-red-100 text-red-800'
                              : Number(days) > 7
                                ? 'bg-amber-100 text-amber-900'
                                : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {days} يوم
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${
                          done ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {done ? 'مُنجزة' : 'مفتوحة'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-600">
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString('ar-SA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : '—'}
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 text-[11px] font-bold text-emerald-900 hover:bg-emerald-100"
                          >
                            <MessageCircle size={13} />
                            واتساب
                          </a>
                        ) : null}
                        <Link
                          to="/tasks"
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1.5 text-[11px] font-bold text-indigo-900 hover:bg-indigo-100"
                        >
                          <ClipboardList size={13} />
                          مهام
                        </Link>
                        {canComplete && (
                          <button
                            type="button"
                            onClick={() => handleComplete(t.id)}
                            disabled={completingId === t.id}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-bold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
                          >
                            {completingId === t.id ? (
                              <Loader2 size={13} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={13} className="text-emerald-600" />
                            )}
                            تم التنفيذ
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
