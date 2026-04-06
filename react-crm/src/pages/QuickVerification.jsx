import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  TrendingUp,
  Timer,
  AlertTriangle,
  X,
  CheckCircle2,
  Store,
  Flame,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getQuickVerificationBourse, postQuickVerificationResolveAudit } from '../services/api'
import { QV_MISSED_INC_TAG } from '../utils/merchantOfficerQueue'

/** بنفسجي موحّد مع هوية الشريط الجانبي — واجهة التحقيق السريع فقط */
const QA_PURPLE = '#4B0082'

function rowMatchesQuery(row, q) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const id = String(row.store_id ?? '')
  const name = (row.store_name || '').toLowerCase()
  const staff = (row.staff_username || row.staff_fullname || '').toLowerCase()
  const fr = String(row.freeze_reason || '').toLowerCase()
  return id.includes(s) || name.includes(s) || staff.includes(s) || fr.includes(s)
}

function isSatisfied(row) {
  if (row.survey_kind === 'freeze_alert') return false
  return row.arrow === 'up'
}

/** غير راضٍ أو محايد — يظهر في مركز الأزمات */
function isCrisis(row) {
  return !isSatisfied(row)
}

function satisfactionPercent(row) {
  if (row.survey_kind === 'freeze_alert') return 0
  if (row.survey_kind === 'new_merchant_onboarding') {
    const ans = row.answers || []
    const yes = ans.filter(a => a.yes).length
    return Math.round((yes / Math.max(1, ans.length)) * 100)
  }
  const avg = Number(row.avg) || 0
  return Math.min(100, Math.round((avg / 5) * 100))
}

/** شريط علوي بلون موحّد #4B0082 — عنوان أبيض + الرضا العالمي */
function QuickAuditTopNav({ growth, resolution, globalSat, loading }) {
  const n = Math.min(100, Math.max(0, Number(globalSat) || 0))
  const sat = loading ? null : n === 100 ? '100' : String(n).padStart(2, '0')
  return (
    <header
      className="relative w-full overflow-hidden border-b border-black/20 shadow-[0_12px_40px_-12px_rgba(75,0,130,0.5),inset_0_1px_0_rgba(255,255,255,0.08)]"
      style={{ fontFamily: "'Cairo', sans-serif", backgroundColor: QA_PURPLE }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: 'repeating-linear-gradient(90deg, #fff 0px, #fff 1px, transparent 1px, transparent 8px)',
        }}
      />
      <div className="relative flex w-full min-w-0 flex-col items-stretch gap-6 px-4 py-5 sm:px-8 lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:py-4 lg:pl-10 lg:pr-12">
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-white/80">Executive</p>
          <div className="mt-1 flex flex-col items-end gap-0.5 sm:flex-row sm:items-baseline sm:justify-end sm:gap-3">
            <h1 className="text-2xl font-black leading-tight text-white sm:text-3xl md:text-[1.85rem]">التحقيق السريع</h1>
            <span className="text-sm font-semibold text-white/80 md:text-base">Quick Audit</span>
          </div>
          <p className="mt-2 max-w-xl text-xs font-medium leading-relaxed text-white/85 md:text-sm">
            مركز الأزمات — عرض غير الراضين فقط.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
              <TrendingUp size={14} className="shrink-0 text-white" strokeWidth={2.2} />
              النمو {loading ? '—' : `${growth}%`}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm backdrop-blur-md">
              <Timer size={14} className="shrink-0 text-white" strokeWidth={2.2} />
              سرعة الحل {loading ? '—' : `${resolution}%`}
            </span>
          </div>
        </div>

        <div className="flex w-full shrink-0 justify-center lg:w-auto lg:justify-end">
          <div className="flex min-w-[min(100%,280px)] flex-col gap-2 rounded-2xl border border-white/25 bg-white/10 px-6 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] backdrop-blur-md sm:min-w-[300px] sm:flex-row sm:items-center sm:gap-6 sm:px-8 sm:py-5">
            <div className="text-center sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/90">الرضا العالمي</p>
              <p className="mt-0.5 text-[11px] font-semibold text-white/75">Global Satisfaction</p>
            </div>
            <div
              className="flex items-center justify-center gap-1 rounded-xl border border-white/30 bg-black/20 px-3 py-2"
              aria-live="polite"
            >
              {loading ? (
                <span className="text-4xl font-black tabular-nums text-white sm:text-5xl">—</span>
              ) : (
                sat.split('').map((ch, i) => (
                  <span
                    key={`${i}-${ch}`}
                    className="flex h-[2.5rem] w-[1.65rem] items-center justify-center rounded-md border border-white/25 bg-white/10 text-2xl font-black tabular-nums text-white sm:h-[2.85rem] sm:w-[1.85rem] sm:text-3xl"
                  >
                    {ch}
                  </span>
                ))
              )}
              {!loading ? (
                <span className="mr-1 text-3xl font-black text-white sm:text-4xl">%</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

function MerchantLogo({ name, storeId }) {
  const ch = (name || String(storeId) || '?').trim().slice(0, 1)
  return (
    <div className="relative flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-[#4B0082]/20 bg-gradient-to-br from-white to-violet-50/90 shadow-inner">
      <span className="text-xl font-black text-[#4B0082]">{ch}</span>
      <span className="absolute -bottom-0.5 -left-0.5 flex h-6 w-6 items-center justify-center rounded-md border border-[#4B0082]/25 bg-white/95 shadow-sm backdrop-blur-sm">
        <Store size={12} className="text-[#4B0082]" strokeWidth={2} />
      </span>
    </div>
  )
}

function CrisisCard({ row, onOpen, layoutId }) {
  const kindLabel =
    row.survey_kind === 'freeze_alert'
      ? 'تجميد'
      : row.survey_kind === 'new_merchant_onboarding'
        ? 'تهيئة'
        : 'CSAT نشط'
  const displayName = row.store_name || `متجر #${row.store_id}`
  const headerBadge =
    row.survey_kind === 'freeze_alert' ? 'تجميد — تحقيق' : 'غير راضٍ'

  return (
    <motion.button
      type="button"
      layout
      layoutId={layoutId}
      onClick={() => onOpen(row)}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      className="group flex aspect-square max-h-[220px] w-full flex-col overflow-hidden rounded-2xl border border-[#4B0082]/20 bg-white text-right shadow-[0_12px_36px_-16px_rgba(75,0,130,0.14),0_4px_20px_-8px_rgba(15,23,42,0.06)] transition hover:border-[#4B0082]/45 hover:shadow-[0_18px_44px_-14px_rgba(75,0,130,0.2)]"
    >
      <div
        className="flex w-full min-h-[3rem] shrink-0 items-center justify-between gap-2 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]"
        style={{ backgroundColor: QA_PURPLE }}
      >
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-black leading-tight text-white">{displayName}</span>
        <span className="shrink-0 rounded-md border border-white/25 bg-white/15 px-2 py-0.5 text-[10px] font-black text-white backdrop-blur-sm">
          {headerBadge}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-3.5">
        <div className="mb-1 flex items-start justify-between gap-2">
          <MerchantLogo name={row.store_name} storeId={row.store_id} />
          <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-200/90 bg-rose-50 px-2 py-0.5 text-[9px] font-black text-rose-800">
            <Flame size={11} className="text-rose-600" />
            أولوية عالية
          </span>
        </div>
        <p className="text-[11px] font-semibold tabular-nums text-slate-600">
          #{row.store_id} · {kindLabel}
        </p>
        <div className="mt-auto flex items-center justify-end border-t border-[#4B0082]/10 pt-2.5">
          <span className="text-[10px] font-bold text-[#4B0082] opacity-0 transition group-hover:opacity-100">تفاصيل ←</span>
        </div>
      </div>
    </motion.button>
  )
}

function SolvedRow({ row, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="flex w-full items-center gap-4 border-b border-emerald-100/80 bg-emerald-50/10 px-4 py-4 text-right transition hover:bg-emerald-50/40"
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-white text-sm font-black text-emerald-800">
        {(row.store_name || '?').trim().slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-bold text-slate-900">{row.store_name}</p>
        <p className="text-[11px] text-slate-500">#{row.store_id}</p>
        {row.executive_notes ? (
          <p className="mt-1 line-clamp-1 text-[11px] text-[#4B0082]">تعليمات المدير: {row.executive_notes}</p>
        ) : null}
      </div>
      <CheckCircle2 className="shrink-0 text-emerald-600" size={22} />
    </button>
  )
}

function DetailDrawer({
  row,
  open,
  onClose,
  onResolve,
  resolveBusy,
  canResolve,
  executiveNotes,
  onExecutiveNotesChange,
  qvMissedInc,
  onToggleQvMissedInc,
}) {
  if (!row) return null
  const freezeAlert = row.survey_kind === 'freeze_alert'
  const onboarding = row.survey_kind === 'new_merchant_onboarding'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-slate-900/30 backdrop-blur-[2px]"
            aria-label="إغلاق"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="qv-drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l-2 border-[#4B0082]/45 bg-white/95 shadow-[-16px_0_56px_-16px_rgba(75,0,130,0.22)] backdrop-blur-xl"
          >
            <div
              className="flex items-center justify-between gap-3 border-b border-[#4B0082]/15 px-5 py-4 backdrop-blur-sm"
              style={{ background: `linear-gradient(to left, rgba(75, 0, 130, 0.08), rgba(255,255,255,0.98))` }}
            >
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-black uppercase tracking-wider text-[#4B0082]">تفاصيل</p>
                <p id="qv-drawer-title" className="truncate text-lg font-black text-violet-950">
                  {row.store_name || `متجر #${row.store_id}`}
                </p>
                <p className="text-[12px] font-semibold text-slate-500">#{row.store_id}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#4B0082]/25 bg-[#4B0082]/8 text-[#4B0082] transition hover:bg-[#4B0082]/12"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              {freezeAlert ? (
                <>
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#4B0082]">سبب التجميد</p>
                  <div className="rounded-xl border border-sky-200/90 bg-sky-50/60 p-4 shadow-inner">
                    <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900">
                      {(row.freeze_reason || row.suggestions || '').trim() || '—'}
                    </p>
                    <p className="mt-3 text-[11px] text-slate-600">
                      نُفّذ التجميد بواسطة:{' '}
                      <span className="font-bold text-slate-800">
                        {(row.staff_fullname || row.frozen_by || row.staff_username || '—').trim()}
                      </span>
                      {row.staff_username ? (
                        <span className="mr-1 font-mono text-slate-500">({row.staff_username})</span>
                      ) : null}
                    </p>
                  </div>
                </>
              ) : null}
              {!freezeAlert ? (
                <>
              <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#4B0082]">نتائج الاستبيان</p>
              {onboarding ? (
                <ul className="space-y-2">
                  {(row.answers || []).map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                    >
                      <span className="font-semibold text-slate-800">{a.label}</span>
                      <span className={a.yes ? 'font-black text-emerald-600' : 'font-black text-rose-600'}>{a.yes ? 'نعم' : 'لا'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2">
                  {(row.questions || []).map((q, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                    >
                      <span className="font-semibold text-slate-800">{q.label}</span>
                      <span className="tabular-nums font-black text-violet-800">{q.value}/5</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 rounded-xl border border-amber-100/90 bg-amber-50/40 p-4 shadow-inner">
                <p className="mb-2 text-[11px] font-black text-amber-900/90">ملاحظات الموظف</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {(row.suggestions || '').trim() || '— لا توجد ملاحظات —'}
                </p>
              </div>
                </>
              ) : null}

              {canResolve && !row.resolved && !freezeAlert ? (
                <div className="mt-6 rounded-xl border border-rose-100/90 bg-rose-50/35 p-4 shadow-inner">
                  <p className="mb-1 text-[11px] font-black text-rose-900">إنذار احتضان (اختياري)</p>
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                    إن وُجد تقصير في الاتصال بمسار الاحتضان، حدّد المرحلة؛ تُدمَج الوسوم مع الاستبيان وتُستخدم لإظهار متابعة لمسؤول الاحتضان.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c1}
                        onChange={() => onToggleQvMissedInc('c1')}
                      />
                      لم يتصل موظف الاحتضان — المكالمة الأولى (يوم 1)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c2}
                        onChange={() => onToggleQvMissedInc('c2')}
                      />
                      لم يتصل — المكالمة الثانية (يوم 3)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c3}
                        onChange={() => onToggleQvMissedInc('c3')}
                      />
                      لم يتصل — المكالمة الثالثة (يوم 10)
                    </label>
                  </div>
                </div>
              ) : null}

              {canResolve && !row.resolved ? (
                <div className="mt-6">
                  <label htmlFor="exec-notes" className="mb-2 block text-[11px] font-black text-[#4B0082]">
                    ملاحظات المدير
                  </label>
                  <textarea
                    id="exec-notes"
                    dir="rtl"
                    rows={4}
                    value={executiveNotes}
                    onChange={e => onExecutiveNotesChange(e.target.value)}
                    placeholder="تعليمات أو توجيه للفريق…"
                    className="w-full rounded-xl border border-[#4B0082]/25 bg-white/90 px-3 py-2.5 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-[#4B0082] focus:ring-2 focus:ring-[#4B0082]/15"
                  />
                </div>
              ) : row.resolved && row.executive_notes ? (
                <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <p className="mb-1 text-[11px] font-black text-violet-900">ملاحظات المدير (محفوظة)</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{row.executive_notes}</p>
                </div>
              ) : null}
            </div>

            {canResolve && !row.resolved ? (
              <div className="border-t border-[#4B0082]/12 p-5">
                <button
                  type="button"
                  onClick={() => onResolve(row)}
                  disabled={resolveBusy}
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-[0_8px_36px_-4px_rgba(251,146,60,0.5)] transition hover:brightness-105 disabled:opacity-60"
                >
                  <span className="pointer-events-none absolute inset-0 bg-white/15 blur-xl" aria-hidden />
                  <span className="relative">{resolveBusy ? 'جارٍ التنفيذ…' : 'حل الإشكالية'}</span>
                </button>
              </div>
            ) : row.resolved ? (
              <div className="border-t border-emerald-100/80 bg-emerald-50/30 px-5 py-4 text-center text-sm font-bold text-emerald-800">
                تم الأرشفة في «تم الحل»
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export default function QuickVerification() {
  const { user, can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [onboardingRows, setOnboardingRows] = useState([])
  const [activeRows, setActiveRows] = useState([])
  const [freezeRows, setFreezeRows] = useState([])
  const [query, setQuery] = useState('')
  const [resolvingId, setResolvingId] = useState(null)
  const [tab, setTab] = useState('crisis')
  const [drawerRow, setDrawerRow] = useState(null)
  const [executiveNotes, setExecutiveNotes] = useState('')
  const [qvMissedInc, setQvMissedInc] = useState({ c1: false, c2: false, c3: false })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await getQuickVerificationBourse({
        user_role: user?.role || '',
        username: user?.username || '',
      })
      if (d?.success) {
        setOnboardingRows(Array.isArray(d.rows) ? d.rows : [])
        setActiveRows(Array.isArray(d.active_csat_rows) ? d.active_csat_rows : [])
        setFreezeRows(Array.isArray(d.freeze_rows) ? d.freeze_rows : [])
      } else {
        setErr(d?.error || 'تعذّر التحميل')
        setOnboardingRows([])
        setActiveRows([])
        setFreezeRows([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setOnboardingRows([])
      setActiveRows([])
      setFreezeRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...freezeRows]
    if (!all.length) return { growth: 0, resolution: 100, global: 100 }
    const positive = all.filter(isSatisfied).length
    const growth = Math.round((positive / all.length) * 100)
    const issues = all.filter(r => !isSatisfied(r))
    const resolved = issues.filter(r => r.resolved).length
    const resolution = issues.length ? Math.round((resolved / issues.length) * 100) : 100
    const gSum = all.reduce((acc, r) => acc + satisfactionPercent(r), 0)
    const global = Math.round(gSum / all.length)
    return { growth, resolution, global }
  }, [onboardingRows, activeRows, freezeRows])

  const crisisOnb = useMemo(
    () =>
      onboardingRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [onboardingRows, query],
  )
  const crisisActive = useMemo(
    () => activeRows.filter(r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query)),
    [activeRows, query],
  )
  const crisisFreeze = useMemo(
    () =>
      freezeRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [freezeRows, query],
  )

  const solvedOnb = useMemo(
    () => onboardingRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const solvedActive = useMemo(
    () => activeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [activeRows, query],
  )
  const solvedFreeze = useMemo(
    () => freezeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [freezeRows, query],
  )

  const toggleQvMissedInc = useCallback(key => {
    setQvMissedInc(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    if (!drawerRow) {
      setExecutiveNotes('')
      setQvMissedInc({ c1: false, c2: false, c3: false })
      return
    }
    setExecutiveNotes(drawerRow.executive_notes || '')
    const tags = drawerRow.gap_tags || []
    setQvMissedInc({
      c1: tags.includes(QV_MISSED_INC_TAG.call1),
      c2: tags.includes(QV_MISSED_INC_TAG.call2),
      c3: tags.includes(QV_MISSED_INC_TAG.call3),
    })
  }, [drawerRow])

  const resolve = useCallback(
    async row => {
      const isFreeze = row?.survey_kind === 'freeze_alert'
      const busyKey = isFreeze ? `f-${row.freeze_alert_id}` : row.id
      setResolvingId(busyKey)
      setErr('')
      try {
        const qvTags = []
        if (!isFreeze) {
          if (qvMissedInc.c1) qvTags.push(QV_MISSED_INC_TAG.call1)
          if (qvMissedInc.c2) qvTags.push(QV_MISSED_INC_TAG.call2)
          if (qvMissedInc.c3) qvTags.push(QV_MISSED_INC_TAG.call3)
        }
        const res = await postQuickVerificationResolveAudit({
          survey_id: isFreeze ? 0 : row.id,
          freeze_alert_id: isFreeze ? row.freeze_alert_id : 0,
          user_role: user?.role || 'executive',
          resolved_by: user?.username || '',
          executive_notes: executiveNotes.trim(),
          qv_missed_inc_calls: qvTags,
        })
        if (!res?.success) {
          setErr(res?.error || 'تعذّر الحفظ')
          return
        }
        setDrawerRow(null)
        setExecutiveNotes('')
        setTab('solved')
        await load()
      } catch (e) {
        setErr(e?.response?.data?.error || e?.message || 'خطأ')
      } finally {
        setResolvingId(null)
      }
    },
    [load, user?.role, user?.username, executiveNotes, qvMissedInc],
  )

  const isExec = user?.role === 'executive'
  const canResolveRow = row => {
    if (row.resolved) return false
    if (row.survey_kind === 'freeze_alert') return isExec
    if (isExec) return true
    const u = (user?.username || '').trim()
    const staff = (row.staff_username || '').trim()
    return u && staff && staff === u
  }

  useEffect(() => {
    if (!drawerRow) return
    const stillOnb = onboardingRows.some(r => r.id === drawerRow.id)
    const stillAct = activeRows.some(r => r.id === drawerRow.id)
    const stillFr = freezeRows.some(r => r.id === drawerRow.id)
    if (!stillOnb && !stillAct && !stillFr) setDrawerRow(null)
    else {
      const fresh = [...onboardingRows, ...activeRows, ...freezeRows].find(r => r.id === drawerRow.id)
      if (fresh && fresh.resolved !== drawerRow.resolved) setDrawerRow(fresh)
    }
  }, [onboardingRows, activeRows, freezeRows, drawerRow])

  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  const drawerOpen = !!drawerRow
  const drawerCanResolve = drawerRow ? canResolveRow(drawerRow) : false

  const crisisTotal = crisisOnb.length + crisisActive.length + crisisFreeze.length
  const solvedTotal = solvedOnb.length + solvedActive.length + solvedFreeze.length

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-white via-violet-50/[0.35] to-white pb-24"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="sticky top-0 z-40 shadow-[0_8px_30px_-12px_rgba(75,0,130,0.35)]">
        <QuickAuditTopNav growth={kpis.growth} resolution={kpis.resolution} globalSat={kpis.global} loading={loading} />
        <div className="w-full border-b border-black/15 backdrop-blur-sm" style={{ backgroundColor: QA_PURPLE }}>
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex rounded-2xl border border-white/20 bg-black/15 p-1">
            <button
              type="button"
              onClick={() => setTab('crisis')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition md:text-sm ${
                tab === 'crisis' ? 'bg-white text-[#4B0082] shadow-md' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle size={15} className={tab === 'crisis' ? 'text-rose-600' : 'text-white'} />
                مركز الأزمات
                {crisisTotal > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      tab === 'crisis' ? 'bg-rose-100 text-rose-800' : 'bg-white/20 text-white'
                    }`}
                  >
                    {crisisTotal}
                  </span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('solved')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition md:text-sm ${
                tab === 'solved' ? 'bg-white text-[#4B0082] shadow-md' : 'text-white/75 hover:bg-white/10 hover:text-white'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className={tab === 'solved' ? 'text-emerald-600' : 'text-white'} />
                تم الحل
                {solvedTotal > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      tab === 'solved' ? 'bg-emerald-100 text-emerald-900' : 'bg-white/20 text-white'
                    }`}
                  >
                    {solvedTotal}
                  </span>
                ) : null}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/30 bg-white/10 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-white/15 disabled:opacity-50 md:text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin text-white' : 'text-white'} />
            تحديث
          </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-12">
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#4B0082]/45" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث في الحالات المعروضة…"
            className="w-full rounded-2xl border border-[#4B0082]/20 bg-white py-4 pr-12 pl-4 text-sm font-medium text-slate-800 shadow-[0_4px_24px_-12px_rgba(75,0,130,0.08)] outline-none placeholder:text-slate-400 focus:border-[#4B0082] focus:ring-2 focus:ring-[#4B0082]/15"
          />
        </div>

        {err ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangle size={18} />
            {err}
          </p>
        ) : null}

        {loading && !onboardingRows.length && !activeRows.length && !freezeRows.length ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-[#4B0082]" />
          </div>
        ) : tab === 'crisis' ? (
          crisisTotal === 0 ? (
            <div className="rounded-3xl border border-emerald-100/90 bg-gradient-to-b from-emerald-50/40 to-white py-20 text-center shadow-inner">
              <p className="text-lg font-black text-emerald-900">مركز الأزمات فارغ</p>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-600">
                لا توجد استبيانات غير راضية اليوم — جميع التجار ضمن نطاق الرضا أو لا توجد بيانات مطابقة للبحث.
              </p>
            </div>
          ) : (
            <div className="space-y-12">
              <section>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wide text-[#4B0082]">متاجر جديدة — غير راضٍ</h2>
                  <span className="text-xs font-bold text-slate-400">{crisisOnb.length}</span>
                </div>
                {crisisOnb.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد حالات في هذا القسم.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                      {crisisOnb.map(row => (
                        <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>

              <section>
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-sm font-black uppercase tracking-wide text-[#4B0082]">استبيانات نشطة — غير راضٍ</h2>
                  <span className="text-xs font-bold text-slate-400">{crisisActive.length}</span>
                </div>
                {crisisActive.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد حالات في هذا القسم.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                      {crisisActive.map(row => (
                        <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>

              {isExec ? (
                <section>
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-sm font-black uppercase tracking-wide text-[#4B0082]">
                      تجميد — مراجعة تنفيذية
                    </h2>
                    <span className="text-xs font-bold text-slate-400">{crisisFreeze.length}</span>
                  </div>
                  {crisisFreeze.length === 0 ? (
                    <p className="text-sm text-slate-400">لا توجد تجميدات بانتظار المراجعة اليوم.</p>
                  ) : (
                    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      <AnimatePresence mode="popLayout">
                        {crisisFreeze.map(row => (
                          <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
                        ))}
                      </AnimatePresence>
                    </div>
                  )}
                </section>
              ) : null}
            </div>
          )
        ) : (
          <div className="overflow-hidden rounded-2xl border border-emerald-200/40 bg-white shadow-[0_12px_40px_-20px_rgba(16,185,129,0.12)]">
            <div className="border-b border-emerald-100/80 bg-emerald-50/30 px-4 py-3">
              <p className="text-sm font-black text-emerald-900">أرشيف الحلول</p>
              <p className="text-[11px] text-emerald-800/80">استبيانات أُغلقت من مركز الأزمات</p>
            </div>
            {solvedTotal === 0 ? (
              <p className="py-14 text-center text-sm text-slate-500">لا توجد سجلات بعد.</p>
            ) : (
              <>
                {solvedOnb.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                ))}
                {solvedActive.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                ))}
                {isExec
                  ? solvedFreeze.map(row => (
                      <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                    ))
                  : null}
              </>
            )}
          </div>
        )}
      </div>

      <DetailDrawer
        row={drawerRow}
        open={drawerOpen}
        onClose={() => setDrawerRow(null)}
        onResolve={resolve}
        resolveBusy={
          drawerRow
            ? resolvingId
              === (drawerRow.survey_kind === 'freeze_alert' ? `f-${drawerRow.freeze_alert_id}` : drawerRow.id)
            : false
        }
        canResolve={drawerCanResolve}
        executiveNotes={executiveNotes}
        onExecutiveNotesChange={setExecutiveNotes}
        qvMissedInc={qvMissedInc}
        onToggleQvMissedInc={toggleQvMissedInc}
      />
    </div>
  )
}
