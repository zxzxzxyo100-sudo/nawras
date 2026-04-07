import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Ticket, Loader2, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react'
import {
  getExecutivePrivateTickets,
  createExecutivePrivateTicket,
  completeExecutivePrivateTicket,
  listUsers,
} from '../services/api'
import { usePrivateTicketsAlert } from '../contexts/PrivateTicketsAlertContext'

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
}

export default function ExecutivePrivateTicketsSection({ user, reloadKey = 0 }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)
  const [completeId, setCompleteId] = useState(null)
  const [staffList, setStaffList] = useState([])
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [assignee, setAssignee] = useState('')
  const [mandatory, setMandatory] = useState(true)

  const isExecutive = user?.role === 'executive'
  const { shouldAlert: ticketCardAlert, refreshPrivateTicketsAlert } = usePrivateTicketsAlert()

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
        setTickets(Array.isArray(res.tickets) ? res.tickets : [])
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
  }, [load, reloadKey])

  useEffect(() => {
    void refreshPrivateTicketsAlert()
  }, [reloadKey, refreshPrivateTicketsAlert])

  useEffect(() => {
    if (!isExecutive) return
    listUsers()
      .then(r => {
        if (r?.success && Array.isArray(r.data)) {
          setStaffList(r.data.filter(u => u.username !== user?.username))
        }
      })
      .catch(() => setStaffList([]))
  }, [isExecutive, user?.username])

  async function handleCreate(e) {
    e.preventDefault()
    if (!title.trim() || !body.trim() || !assignee) return
    setSaving(true)
    setErr('')
    try {
      const res = await createExecutivePrivateTicket({
        user_role: 'executive',
        username: user.username,
        title: title.trim(),
        body: body.trim(),
        assignee_username: assignee,
        is_mandatory: mandatory,
      })
      if (res?.success) {
        setTitle('')
        setBody('')
        setAssignee('')
        setMandatory(true)
        await load()
      } else {
        setErr(res?.error || 'تعذّر الإنشاء')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'خطأ')
    } finally {
      setSaving(false)
    }
  }

  async function handleComplete(id) {
    setCompleteId(id)
    setErr('')
    try {
      const res = await completeExecutivePrivateTicket({
        user_role: user.role,
        username: user.username,
        id,
      })
      if (res?.success) await load()
      else setErr(res?.error || 'تعذّر التحديث')
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || 'خطأ')
    } finally {
      setCompleteId(null)
    }
  }

  const openCount = tickets.filter(t => t.status === 'open').length
  const openMandatory = tickets.filter(t => t.status === 'open' && Number(t.is_mandatory) === 1).length

  const staffFrostPulse = !isExecutive && ticketCardAlert

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={{ duration: 0.45, delay: 0.12 }}
      className={`relative rounded-3xl overflow-hidden shadow-[0_20px_50px_-20px_rgba(76,29,149,0.35)] ${
        staffFrostPulse
          ? 'animate-private-ticket-frost border-2 border-cyan-100/35'
          : 'border border-violet-400/25'
      }`}
      style={{ background: 'linear-gradient(145deg, #1a0d35 0%, #251043 45%, #12082a 100%)' }}
    >
      <div className="absolute top-0 right-0 w-72 h-72 bg-fuchsia-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-16 left-0 w-56 h-56 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative p-5 lg:p-6 text-right">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400/30 to-fuchsia-500/20 border border-white/15 flex items-center justify-center flex-shrink-0 shadow-lg">
              <Ticket size={24} className="text-amber-200" strokeWidth={2.2} aria-hidden />
            </div>
            <div>
              <h2 className="text-lg font-black text-white tracking-tight">تذاكر خاصة</h2>
              <p className="text-violet-200/75 text-xs mt-1 max-w-xl leading-relaxed">
                مهام يعيّنها المدير التنفيذي لموظف محدد؛ يمكن جعلها <span className="text-amber-200 font-bold">إجبارية</span>.
                تظهر هنا لكل موظف في لوحة التحكم بنفس أسلوب العرض.
              </p>
            </div>
          </div>
          {!isExecutive && openMandatory > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-500/15 px-3 py-1.5 text-xs font-black text-amber-100">
              <AlertCircle size={14} />
              {openMandatory.toLocaleString('ar-SA')} إجبارية مفتوحة
            </span>
          )}
          {isExecutive && (
            <span className="text-xs font-medium text-white/45">
              مفتوحة: {openCount.toLocaleString('ar-SA')} — إجمالي المعروض: {tickets.length.toLocaleString('ar-SA')}
            </span>
          )}
        </div>

        {err && (
          <p className="text-rose-300 text-sm mb-3 flex items-center gap-2 justify-end">
            <AlertCircle size={16} /> {err}
          </p>
        )}

        {isExecutive && (
          <form
            onSubmit={handleCreate}
            className="mb-6 rounded-2xl border border-white/10 bg-black/25 backdrop-blur-sm p-4 space-y-3"
          >
            <p className="text-xs font-bold text-violet-200/90 flex items-center gap-2">
              <UserPlus size={14} /> إنشاء تذكرة وتعيينها
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-white/50 mb-1">الموظف المكلّف</label>
                <select
                  required
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/10 text-white text-sm px-3 py-2.5 outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                >
                  <option value="">— اختر الموظف —</option>
                  {staffList.map(u => (
                    <option key={u.id} value={u.username}>
                      {u.fullname || u.username} ({u.username})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-white/50 mb-1">عنوان المهمة</label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="عنوان واضح"
                  className="w-full rounded-xl border border-white/15 bg-white/10 text-white text-sm px-3 py-2.5 placeholder:text-white/30 outline-none focus:ring-2 focus:ring-fuchsia-500/40"
                />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold text-white/50 mb-1">التفاصيل</label>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={3}
                placeholder="ما المطلوب تنفيذه…"
                className="w-full rounded-xl border border-white/15 bg-white/10 text-white text-sm px-3 py-2.5 placeholder:text-white/30 outline-none focus:ring-2 focus:ring-fuchsia-500/40 resize-y min-h-[88px]"
              />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-amber-100/95 cursor-pointer">
                <input
                  type="checkbox"
                  checked={mandatory}
                  onChange={e => setMandatory(e.target.checked)}
                  className="rounded border-white/30 text-amber-500 focus:ring-amber-400"
                />
                <span className="font-bold">إجبارية على الموظف</span>
              </label>
              <button
                type="submit"
                disabled={saving || !title.trim() || !body.trim() || !assignee}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-l from-fuchsia-600 to-violet-600 hover:brightness-110 disabled:opacity-45 text-white text-sm font-black shadow-lg shadow-fuchsia-900/40 transition"
              >
                {saving ? 'جارٍ الإرسال…' : 'إنشاء التذكرة'}
              </button>
            </div>
          </form>
        )}

        {loading && tickets.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-14 text-violet-200/70">
            <Loader2 size={22} className="animate-spin" />
            جارٍ تحميل التذاكر…
          </div>
        ) : tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 py-10 text-center text-violet-300/80 text-sm">
            لا توجد تذاكر خاصة حالياً.
          </div>
        ) : (
          <ul className="space-y-2.5">
            {tickets.map(t => {
              const done = t.status === 'done'
              const mand = Number(t.is_mandatory) === 1
              const canComplete =
                !done && (isExecutive || t.assignee_username === user?.username)
              return (
                <li
                  key={t.id}
                  className={`rounded-2xl border px-4 py-3.5 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 ${
                    done
                      ? 'border-white/10 bg-white/[0.04]'
                      : mand
                        ? 'border-amber-400/35 bg-gradient-to-l from-amber-500/10 to-transparent'
                        : 'border-white/15 bg-white/[0.06]'
                  }`}
                >
                  <div className="min-w-0 flex-1 text-right">
                    <div className="flex flex-wrap items-center gap-2 justify-end mb-1">
                      {mand && (
                        <span className="text-[10px] font-black uppercase tracking-wide px-2 py-0.5 rounded-md bg-amber-500/25 text-amber-100 border border-amber-400/30">
                          إجبارية
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                          done ? 'bg-emerald-500/20 text-emerald-200' : 'bg-violet-500/25 text-violet-100'
                        }`}
                      >
                        {done ? 'مُنجزة' : 'مفتوحة'}
                      </span>
                    </div>
                    <p className="font-black text-white text-sm leading-snug">{t.title}</p>
                    <p className="text-white/75 text-sm mt-1.5 whitespace-pre-wrap leading-relaxed">{t.body}</p>
                    <p className="text-[11px] text-white/40 mt-2">
                      {isExecutive && (
                        <>
                          إلى: <span className="text-fuchsia-200 font-semibold">{t.assignee_fullname || t.assignee_username}</span>
                          {' · '}
                        </>
                      )}
                      من: {t.created_by_username}
                      {' · '}
                      {t.created_at
                        ? new Date(t.created_at).toLocaleString('ar-SA', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })
                        : ''}
                    </p>
                  </div>
                  {canComplete && (
                    <button
                      type="button"
                      onClick={() => handleComplete(t.id)}
                      disabled={completeId === t.id}
                      className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-400/40 text-emerald-100 text-xs font-black px-4 py-2.5 transition disabled:opacity-50"
                    >
                      {completeId === t.id ? (
                        <Loader2 size={16} className="animate-spin" />
                      ) : (
                        <CheckCircle2 size={16} />
                      )}
                      تم التنفيذ
                    </button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </motion.section>
  )
}
