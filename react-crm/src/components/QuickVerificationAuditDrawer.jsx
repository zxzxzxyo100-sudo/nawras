import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  X,
  CheckCircle2,
  XCircle,
  Star,
  Loader2,
  ClipboardList,
  History,
  User,
  Calendar,
} from 'lucide-react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { getQuickVerificationAuditTimeline } from '../services/api'

const SUCCESS = '#28C76F'
const DANGER = '#EA5455'

function fmtServerAt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtTimeOnly(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })
}

function mapStatusBadge(row) {
  const cat = (row?.store_category || '').toLowerCase()
  const sk = row?.survey_kind || ''
  if (['hot_inactive', 'cold_inactive'].includes(cat) || cat === 'inactive') {
    return { label: 'غير نشط', className: 'bg-slate-200 text-slate-800 border-slate-300' }
  }
  if (sk === 'new_merchant_onboarding') {
    return { label: 'جديد — تهيئة', className: 'bg-indigo-100 text-indigo-900 border-indigo-200/80' }
  }
  if (sk === 'active_csat') {
    return { label: 'نشط — CSAT', className: 'bg-emerald-50 text-emerald-900 border-emerald-200/80' }
  }
  if (cat.includes('active') || cat === 'completed' || cat === 'active_pending_calls' || cat === 'active_shipping') {
    return { label: 'نشط', className: 'bg-emerald-50 text-emerald-900 border-emerald-200/80' }
  }
  if (cat === 'incubating') {
    return { label: 'قيد الاحتضان', className: 'bg-sky-50 text-sky-900 border-sky-200/80' }
  }
  if (cat) {
    return { label: cat, className: 'bg-slate-100 text-slate-700 border-slate-200' }
  }
  return { label: '—', className: 'bg-slate-100 text-slate-600 border-slate-200' }
}

function primaryScoreLabel(row) {
  if (row?.survey_kind === 'active_csat' && row.avg != null) {
    return { text: `متوسط ${row.avg} / 5`, sub: 'استبيان نجوم (6 محاور)' }
  }
  if (row?.survey_kind === 'new_merchant_onboarding') {
    return { text: 'استبيان تهيئة — نعم / لا', sub: 'ثلاثة محاور' }
  }
  return { text: '—', sub: '' }
}

function AnimatedStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-1 flex-row-reverse justify-end" aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <motion.span
          key={n}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: (n - 1) * 0.05 }}
        >
          <Star
            size={22}
            className={n <= v ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
            strokeWidth={n <= v ? 0 : 1.5}
          />
        </motion.span>
      ))}
    </div>
  )
}

const DIRECTOR_ACTIONS = [
  { value: '', label: 'اختر إجراءً…' },
  { value: 'tech_support', label: 'تحويل دعم فني' },
  { value: 'courier_followup', label: 'متابعة مندوب' },
  { value: 'accounts_review', label: 'مراجعة حسابات' },
  { value: 'save_only', label: 'حفظ' },
]

function loadDirectorPrefs(storeId) {
  try {
    const raw = localStorage.getItem(`qv_director_prefs_${storeId}`)
    if (!raw) return { action: '', comment: '' }
    return JSON.parse(raw)
  } catch {
    return { action: '', comment: '' }
  }
}

function saveDirectorPrefs(storeId, prefs) {
  try {
    localStorage.setItem(`qv_director_prefs_${storeId}`, JSON.stringify(prefs))
  } catch { /* */ }
}

/**
 * درج تدقيق احترافي — التحقق السريع (VITE_APP_STAGING فقط)
 */
export default function QuickVerificationAuditDrawer({ row, onClose }) {
  const [tab, setTab] = useState('survey')
  const [timeline, setTimeline] = useState([])
  const [latestCallNote, setLatestCallNote] = useState(null)
  const [tlLoading, setTlLoading] = useState(true)
  const [tlErr, setTlErr] = useState('')
  const [directorAction, setDirectorAction] = useState('')
  const [directorComment, setDirectorComment] = useState('')

  const storeId = row?.store_id
  const badge = useMemo(() => mapStatusBadge(row), [row])
  const scoreLbl = useMemo(() => primaryScoreLabel(row), [row])

  const radarData = useMemo(() => {
    if (!row?.questions?.length) return []
    return row.questions.map(q => ({
      subject: q.label.length > 12 ? `${q.label.slice(0, 11)}…` : q.label,
      score: q.value,
      fullMark: 5,
    }))
  }, [row])

  const loadTimeline = useCallback(async () => {
    if (storeId == null) return
    setTlLoading(true)
    setTlErr('')
    try {
      const d = await getQuickVerificationAuditTimeline(storeId)
      if (d?.success) {
        setTimeline(Array.isArray(d.events) ? d.events : [])
        setLatestCallNote(d.latest_call_note || null)
      } else {
        setTimeline([])
        setLatestCallNote(null)
        setTlErr(d?.error || 'تعذّر تحميل الجدول الزمني.')
      }
    } catch (e) {
      setTimeline([])
      setLatestCallNote(null)
      setTlErr(e?.response?.data?.error || e?.message || 'خطأ')
    } finally {
      setTlLoading(false)
    }
  }, [storeId])

  useEffect(() => {
    void loadTimeline()
  }, [loadTimeline])

  useEffect(() => {
    if (storeId != null) {
      const p = loadDirectorPrefs(storeId)
      setDirectorAction(p.action || '')
      setDirectorComment(p.comment || '')
    }
  }, [storeId])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!row) return null

  return (
    <motion.div
      className="fixed inset-0 z-[600] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
        <button
          type="button"
          className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]"
          aria-label="إغلاق"
          onClick={onClose}
        />
        <motion.aside
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          className="relative h-full w-full max-w-[520px] flex flex-col bg-[#f1f5f9] shadow-2xl border-r border-slate-200/80"
        >
          {/* Header */}
          <div className="shrink-0 bg-white border-b border-slate-200 px-5 py-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-lg font-black text-slate-900 leading-tight truncate">{row.store_name}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-black text-slate-800 tabular-nums">
                    كود: #{row.store_id}
                  </span>
                  <span className={`inline-flex rounded-lg border px-2.5 py-1 text-xs font-bold ${badge.className}`}>
                    الحالة: {badge.label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
              >
                <X size={22} />
              </button>
            </div>

            {/* Primary info */}
            <div className="mt-4 grid grid-cols-1 gap-3 rounded-xl bg-slate-50 border border-slate-200/80 p-3 text-sm">
              <div className="flex items-center gap-2 text-slate-700">
                <User size={16} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800">الموظف:</span>
                <span className="truncate">{row.staff_fullname || row.staff_username || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Calendar size={16} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800">وقت الاستبيان:</span>
                <span className="tabular-nums">{fmtServerAt(row.created_at)}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ClipboardList size={16} className="text-slate-400 shrink-0" />
                <span className="font-bold text-slate-800">المؤشر:</span>
                <span style={{ color: row.survey_kind === 'active_csat' && row.tier === 'green' ? SUCCESS : undefined }}>
                  {scoreLbl.text}
                </span>
                {scoreLbl.sub && <span className="text-xs text-slate-500">({scoreLbl.sub})</span>}
              </div>
            </div>

            {/* Tabs */}
            <div className="mt-4 flex rounded-xl bg-slate-100 p-1 border border-slate-200/80">
              <button
                type="button"
                onClick={() => setTab('survey')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  tab === 'survey' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardList size={16} />
                استبيان المكالمة
              </button>
              <button
                type="button"
                onClick={() => setTab('timeline')}
                className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-bold transition-colors ${
                  tab === 'timeline' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <History size={16} />
                الجدول الزمني
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4">
            {tab === 'survey' && (
              <div className="space-y-5">
                {row.survey_kind === 'new_merchant_onboarding' && Array.isArray(row.answers) && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wide">أسئلة التهيئة (نعم / لا)</p>
                    {row.answers.map((a, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className={`rounded-2xl border p-4 shadow-sm ${
                          a.yes ? 'bg-white border-emerald-200' : 'bg-white border-rose-200'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-slate-800 leading-snug">{a.label}</p>
                            <p className="text-[11px] text-slate-400 mt-2 tabular-nums">{fmtServerAt(row.created_at)}</p>
                          </div>
                          <div className="shrink-0">
                            {a.yes ? (
                              <CheckCircle2 size={36} style={{ color: SUCCESS }} strokeWidth={2.2} />
                            ) : (
                              <XCircle size={36} style={{ color: DANGER }} strokeWidth={2.2} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}

                {row.survey_kind === 'active_csat' && row.questions && (
                  <div className="space-y-3">
                    <p className="text-xs font-black text-slate-500 uppercase tracking-wide">تقييم النجوم (1–5)</p>
                    {radarData.length > 0 && (
                      <div className="h-[220px] w-full rounded-2xl bg-white border border-slate-200 p-2 shadow-sm" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} margin={{ top: 12, right: 12, bottom: 12, left: 12 }}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#475569' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                            <Radar
                              name="التقييم"
                              dataKey="score"
                              stroke="#6366f1"
                              fill="#6366f1"
                              fillOpacity={0.28}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                    {row.questions.map((q, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className={`rounded-2xl border p-4 bg-white shadow-sm ${
                          q.risk === 'high'
                            ? 'border-rose-200'
                            : q.risk === 'mid'
                              ? 'border-amber-200'
                              : 'border-emerald-100'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className="text-sm font-bold text-slate-800">{q.label}</span>
                          <AnimatedStars value={q.value} />
                        </div>
                        <p className="text-[11px] text-slate-400 mt-2 tabular-nums">{fmtServerAt(row.created_at)}</p>
                      </motion.div>
                    ))}
                  </div>
                )}

                {(row.suggestions || '').trim() !== '' && (
                  <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 shadow-sm">
                    <p className="text-xs font-black text-violet-900 mb-2">صوت المتجر (مقترحات مسجّلة)</p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{(row.suggestions || '').trim()}</p>
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-black text-slate-700 mb-2">ملاحظات الموظف (المكالمة)</p>
                  {latestCallNote?.text ? (
                    <>
                      <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">{latestCallNote.text}</p>
                      <p className="text-[11px] text-slate-400 mt-2">
                        {latestCallNote.by ? `${latestCallNote.by} — ` : ''}
                        {fmtServerAt(latestCallNote.at)}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">لا توجد ملاحظة موظف في سجل المكالمات لهذا المتجر.</p>
                  )}
                </div>
              </div>
            )}

            {tab === 'timeline' && (
              <div>
                {tlLoading ? (
                  <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
                    <Loader2 className="animate-spin" size={22} />
                    جارٍ تحميل الجدول الزمني…
                  </div>
                ) : tlErr ? (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-100 rounded-xl px-3 py-2">{tlErr}</p>
                ) : timeline.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-12">لا أحداث مسجّلة لهذا المتجر بعد.</p>
                ) : (
                  <ul className="relative border-r-2 border-slate-200 pr-6 space-y-6 mr-2">
                    {timeline.map((ev, idx) => {
                      const tone =
                        ev.tone === 'success' ? SUCCESS : ev.tone === 'danger' ? DANGER : '#64748b'
                      return (
                        <li key={`${ev.at}-${idx}`} className="relative">
                          <span
                            className="absolute -right-[9px] top-1.5 h-3 w-3 rounded-full border-2 border-white shadow"
                            style={{ background: tone }}
                          />
                          <p className="text-[11px] font-bold tabular-nums text-slate-500 mb-1">
                            {fmtTimeOnly(ev.at)} — {fmtServerAt(ev.at)}
                          </p>
                          <p className="text-sm font-black text-slate-900">{ev.label}</p>
                          {ev.sub ? <p className="text-xs text-slate-500">{ev.sub}</p> : null}
                          <p className="text-sm text-slate-700 mt-1 leading-relaxed">{ev.detail}</p>
                          {ev.actor ? (
                            <p className="text-xs text-slate-400 mt-1">بواسطة: {ev.actor}</p>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>

          {/* Director resolution */}
          <div className="shrink-0 border-t border-slate-200 bg-white px-5 py-4 shadow-[0_-8px_24px_rgba(15,23,42,0.06)]">
            <p className="text-xs font-black text-slate-600 mb-2">قرار المدير التنفيذي</p>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">إجراء مطلوب</label>
            <select
              value={directorAction}
              onChange={e => {
                const v = e.target.value
                setDirectorAction(v)
                if (storeId != null) {
                  saveDirectorPrefs(storeId, { action: v, comment: directorComment.trim() })
                }
              }}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 font-medium mb-3 focus:outline-none focus:ring-2 focus:ring-slate-300"
            >
              {DIRECTOR_ACTIONS.map(o => (
                <option key={o.value || 'x'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">ملاحظة داخلية (لا تُعرض للموظفين)</label>
            <textarea
              value={directorComment}
              onChange={e => setDirectorComment(e.target.value)}
              onBlur={() => {
                if (storeId != null) {
                  saveDirectorPrefs(storeId, { action: directorAction, comment: directorComment.trim() })
                }
              }}
              rows={3}
              placeholder="تعليقك الخاص للمتابعة…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300 resize-y min-h-[72px]"
            />
            <button
              type="button"
              onClick={() => {
                if (storeId != null) {
                  saveDirectorPrefs(storeId, { action: directorAction, comment: directorComment.trim() })
                }
              }}
              className="mt-3 w-full rounded-xl py-2.5 text-sm font-black text-white shadow-md transition-opacity hover:opacity-95"
              style={{ background: '#1e293b' }}
            >
              حفظ التفضيلات محلياً
            </button>
          </div>
        </motion.aside>
    </motion.div>
  )
}
