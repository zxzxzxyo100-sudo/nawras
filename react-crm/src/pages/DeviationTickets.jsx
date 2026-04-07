import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  RefreshCw,
  MessageCircle,
  ClipboardList,
  Loader2,
  CheckCircle2,
  Package,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import {
  getExecutivePrivateTickets,
  completeExecutivePrivateTicket,
} from '../services/api'
import { usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'

const DEVIATION = 'deviation_alert'

function parseMeta(ticket) {
  if (!ticket?.meta_json) return {}
  try {
    return typeof ticket.meta_json === 'string' ? JSON.parse(ticket.meta_json) : ticket.meta_json
  } catch {
    return {}
  }
}

export default function DeviationTickets() {
  const { user } = useAuth()
  const { refreshPrivateTicketsAlert } = usePrivateTicketsAlert()
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [completingId, setCompletingId] = useState(null)

  const isExecutive = user?.role === 'executive'

  const load = useCallback(async () => {
    if (!user?.username) return
    setErr('')
    setLoading(true)
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
        setErr(res?.error || 'تعذّر التحميل')
        setTickets([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'خطأ')
      setTickets([])
    } finally {
      setLoading(false)
    }
  }, [user?.username, user?.role])

  useEffect(() => {
    void load()
  }, [load])

  const openCount = useMemo(() => tickets.filter(t => t.status === 'open').length, [tickets])

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
        await load()
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
      <div className="flex flex-col gap-4 rounded-2xl border border-white/25 bg-white/45 px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-slate-200/40 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-800 lg:text-2xl">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-500/15 ring-1 ring-red-400/30">
              <AlertTriangle className="text-red-600" size={22} aria-hidden />
            </span>
            تذاكر الانحراف
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            متابعات للمتاجر التي تراجع فيها نشاط الشحنات — تُنشأ تلقائياً عند تعيين متجر من «نشط يشحن» أو
            «المجمدة».
          </p>
          <p className="mt-1 text-xs font-semibold text-red-800/90">
            مفتوحة: {openCount.toLocaleString('ar-SA')} — إجمالي المعروض: {tickets.length.toLocaleString('ar-SA')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex shrink-0 items-center justify-center gap-2 rounded-xl border border-white/40 bg-white/50 px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/80 disabled:opacity-60"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      <div className="rounded-2xl border border-slate-300/80 bg-gradient-to-l from-slate-100/90 to-white px-4 py-3 shadow-sm">
        <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
          <Package size={17} className="shrink-0 text-slate-600" />
          قائمة المتاجر والتذاكر
        </h2>
        <p className="mt-0.5 text-[11px] leading-relaxed text-slate-700/90">
          {isExecutive
            ? 'عرض كل تذاكر الانحراف مع المسؤول عن المتابعة. استخدم واتساب أو المهام للتنفيذ السريع.'
            : 'تذاكر الانحراف المسندة إليك — ركّز على المفتوحة وأكملها بعد المكالمة.'}
        </p>
      </div>

      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}

      {loading && tickets.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader2 className="animate-spin" size={22} />
          جارٍ تحميل تذاكر الانحراف…
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 py-14 text-center text-slate-500">
          لا توجد تذاكر انحراف مسجّلة حالياً.
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
