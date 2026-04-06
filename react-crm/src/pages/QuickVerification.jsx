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

function rowMatchesQuery(row, q) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const id = String(row.store_id ?? '')
  const name = (row.store_name || '').toLowerCase()
  const staff = (row.staff_username || row.staff_fullname || '').toLowerCase()
  return id.includes(s) || name.includes(s) || staff.includes(s)
}

function isSatisfied(row) {
  return row.arrow === 'up'
}

/** غير راضٍ أو محايد — يظهر في مركز الأزمات */
function isCrisis(row) {
  return !isSatisfied(row)
}

function satisfactionPercent(row) {
  if (row.survey_kind === 'new_merchant_onboarding') {
    const ans = row.answers || []
    const yes = ans.filter(a => a.yes).length
    return Math.round((yes / Math.max(1, ans.length)) * 100)
  }
  const avg = Number(row.avg) || 0
  return Math.min(100, Math.round((avg / 5) * 100))
}

function GlassIcon({ children, className = '' }) {
  return (
    <span
      className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200/60 bg-white/70 shadow-[0_4px_16px_-4px_rgba(91,33,182,0.2)] backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  )
}

/** شريط علوي: نمو + سرعة حل + الرضا العالمي (أخضر كبير) */
function ExecutiveCrisisBar({ growth, resolution, globalSat, loading }) {
  return (
    <div className="border-b border-violet-200/30 bg-gradient-to-l from-white via-violet-50/25 to-white">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:gap-6 md:px-6 md:py-3">
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-500">لوحة تنفيذية</p>
          <p className="text-base font-black text-violet-950 md:text-lg">أداء المدير التنفيذي</p>
        </div>

        <div className="flex min-w-0 flex-1 flex-wrap items-stretch justify-end gap-3 md:gap-4">
          <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl border border-violet-100/90 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-sm">
            <GlassIcon>
              <TrendingUp size={17} className="text-violet-700" strokeWidth={2.2} />
            </GlassIcon>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">النمو</p>
              <p className="text-xl font-black tabular-nums text-violet-950">{loading ? '—' : `${growth}%`}</p>
            </div>
          </div>

          <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-2xl border border-violet-100/90 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-sm">
            <GlassIcon>
              <Timer size={17} className="text-violet-700" strokeWidth={2.2} />
            </GlassIcon>
            <div className="min-w-0 text-right">
              <p className="text-[10px] font-bold uppercase tracking-wide text-violet-500">سرعة الحل</p>
              <p className="text-xl font-black tabular-nums text-violet-950">{loading ? '—' : `${resolution}%`}</p>
            </div>
          </div>

          <div
            className="flex min-w-[200px] flex-[1.2] items-center justify-between gap-4 rounded-2xl border px-5 py-4 shadow-lg md:min-w-[240px]"
            style={{
              background: 'linear-gradient(135deg, rgba(236,253,245,0.95), rgba(209,250,229,0.85))',
              borderColor: 'rgba(16, 185, 129, 0.35)',
              boxShadow: '0 12px 40px -12px rgba(16, 185, 129, 0.25), inset 0 1px 0 rgba(255,255,255,0.8)',
            }}
          >
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-black uppercase tracking-wide text-emerald-700/90">الرضا العالمي</p>
              <p className="mt-1 text-4xl font-black tabular-nums leading-none text-emerald-700 md:text-5xl">
                {loading ? '—' : `${globalSat}%`}
              </p>
            </div>
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/80 bg-white/90 shadow-inner">
              <span className="text-2xl font-black text-emerald-600">✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MerchantLogo({ name, storeId }) {
  const ch = (name || String(storeId) || '?').trim().slice(0, 1)
  return (
    <div className="relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-rose-200/60 bg-gradient-to-br from-white to-rose-50/80 shadow-inner">
      <span className="text-2xl font-black text-rose-900/80">{ch}</span>
      <span className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-lg border border-violet-200/80 bg-white/95 shadow-md backdrop-blur-sm">
        <Store size={14} className="text-violet-600" strokeWidth={2} />
      </span>
    </div>
  )
}

function CrisisCard({ row, onOpen, layoutId }) {
  const kindLabel = row.survey_kind === 'new_merchant_onboarding' ? 'تهيئة' : 'CSAT نشط'

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
      className="group flex aspect-square max-h-[280px] w-full flex-col rounded-3xl border-2 border-rose-300/50 bg-white/90 p-5 text-right shadow-[0_8px_40px_-12px_rgba(244,63,94,0.35),0_0_0_1px_rgba(244,63,94,0.08)_inset] transition hover:border-rose-400/60 hover:shadow-[0_16px_48px_-12px_rgba(244,63,94,0.45)]"
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <MerchantLogo name={row.store_name} storeId={row.store_id} />
        <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-500/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-rose-800">
          <Flame size={12} className="text-rose-600" />
          أولوية عالية
        </span>
      </div>
      <p className="line-clamp-2 min-h-[2.75rem] text-lg font-black leading-snug text-slate-900">{row.store_name || `متجر #${row.store_id}`}</p>
      <p className="mt-1 text-[12px] font-semibold tabular-nums text-slate-500">
        #{row.store_id} · {kindLabel}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-rose-100/80 pt-4">
        <span className="text-[11px] font-bold text-violet-500 opacity-0 transition group-hover:opacity-100">تفاصيل ←</span>
        <span className="rounded-lg bg-rose-100/80 px-2 py-1 text-[11px] font-black text-rose-800">غير راضٍ</span>
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
          <p className="mt-1 line-clamp-1 text-[11px] text-violet-700">تعليمات المدير: {row.executive_notes}</p>
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
}) {
  if (!row) return null
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
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-violet-200/50 bg-white/95 shadow-[-16px_0_56px_-16px_rgba(76,29,149,0.2)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between gap-3 border-b border-violet-100/80 px-5 py-4">
              <div className="min-w-0 text-right">
                <p id="qv-drawer-title" className="truncate text-lg font-black text-violet-950">
                  {row.store_name || `متجر #${row.store_id}`}
                </p>
                <p className="text-[12px] font-semibold text-slate-500">#{row.store_id}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-100 bg-violet-50/80 text-violet-800 transition hover:bg-violet-100"
              >
                <X size={20} strokeWidth={2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
              <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-violet-600">نتائج الاستبيان</p>
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

              {canResolve && !row.resolved ? (
                <div className="mt-6">
                  <label htmlFor="exec-notes" className="mb-2 block text-[11px] font-black text-violet-800">
                    ملاحظات المدير
                  </label>
                  <textarea
                    id="exec-notes"
                    dir="rtl"
                    rows={4}
                    value={executiveNotes}
                    onChange={e => onExecutiveNotesChange(e.target.value)}
                    placeholder="تعليمات أو توجيه للفريق…"
                    className="w-full rounded-xl border border-violet-200/80 bg-white/90 px-3 py-2.5 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
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
              <div className="border-t border-violet-100/80 p-5">
                <button
                  type="button"
                  onClick={() => onResolve(row.id)}
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
  const [query, setQuery] = useState('')
  const [resolvingId, setResolvingId] = useState(null)
  const [tab, setTab] = useState('crisis')
  const [drawerRow, setDrawerRow] = useState(null)
  const [executiveNotes, setExecutiveNotes] = useState('')

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
      } else {
        setErr(d?.error || 'تعذّر التحميل')
        setOnboardingRows([])
        setActiveRows([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setOnboardingRows([])
      setActiveRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const all = [...onboardingRows, ...activeRows]
    if (!all.length) return { growth: 0, resolution: 100, global: 100 }
    const positive = all.filter(isSatisfied).length
    const growth = Math.round((positive / all.length) * 100)
    const issues = all.filter(r => !isSatisfied(r))
    const resolved = issues.filter(r => r.resolved).length
    const resolution = issues.length ? Math.round((resolved / issues.length) * 100) : 100
    const gSum = all.reduce((acc, r) => acc + satisfactionPercent(r), 0)
    const global = Math.round(gSum / all.length)
    return { growth, resolution, global }
  }, [onboardingRows, activeRows])

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

  const solvedOnb = useMemo(
    () => onboardingRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const solvedActive = useMemo(
    () => activeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [activeRows, query],
  )

  useEffect(() => {
    if (!drawerRow) {
      setExecutiveNotes('')
      return
    }
    setExecutiveNotes(drawerRow.executive_notes || '')
  }, [drawerRow])

  const resolve = useCallback(
    async surveyId => {
      setResolvingId(surveyId)
      setErr('')
      try {
        const res = await postQuickVerificationResolveAudit({
          survey_id: surveyId,
          user_role: user?.role || 'executive',
          resolved_by: user?.username || '',
          executive_notes: executiveNotes.trim(),
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
    [load, user?.role, user?.username, executiveNotes],
  )

  const isExec = user?.role === 'executive'
  const canResolveRow = row => {
    if (row.resolved) return false
    if (isExec) return true
    const u = (user?.username || '').trim()
    const staff = (row.staff_username || '').trim()
    return u && staff && staff === u
  }

  useEffect(() => {
    if (!drawerRow) return
    const stillOnb = onboardingRows.some(r => r.id === drawerRow.id)
    const stillAct = activeRows.some(r => r.id === drawerRow.id)
    if (!stillOnb && !stillAct) setDrawerRow(null)
    else {
      const fresh = [...onboardingRows, ...activeRows].find(r => r.id === drawerRow.id)
      if (fresh && fresh.resolved !== drawerRow.resolved) setDrawerRow(fresh)
    }
  }, [onboardingRows, activeRows, drawerRow])

  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  const drawerOpen = !!drawerRow
  const drawerCanResolve = drawerRow ? canResolveRow(drawerRow) : false

  const crisisTotal = crisisOnb.length + crisisActive.length
  const solvedTotal = solvedOnb.length + solvedActive.length

  return (
    <div className="min-h-screen bg-white pb-24" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/95 backdrop-blur-md">
        <ExecutiveCrisisBar
          growth={kpis.growth}
          resolution={kpis.resolution}
          globalSat={kpis.global}
          loading={loading}
        />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex rounded-2xl border border-violet-100/90 bg-violet-50/20 p-1">
            <button
              type="button"
              onClick={() => setTab('crisis')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition md:text-sm ${
                tab === 'crisis' ? 'bg-white text-violet-900 shadow-md' : 'text-violet-600/80 hover:text-violet-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle size={15} className="text-rose-500" />
                مركز الأزمات
                {crisisTotal > 0 ? (
                  <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] text-rose-800">{crisisTotal}</span>
                ) : null}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setTab('solved')}
              className={`rounded-xl px-4 py-2 text-xs font-black transition md:text-sm ${
                tab === 'solved' ? 'bg-white text-violet-900 shadow-md' : 'text-violet-600/80 hover:text-violet-900'
              }`}
            >
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-emerald-600" />
                تم الحل
                {solvedTotal > 0 ? (
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-900">{solvedTotal}</span>
                ) : null}
              </span>
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2 text-xs font-bold text-violet-900 shadow-sm hover:bg-violet-50 disabled:opacity-50 md:text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-violet-300" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث في الحالات المعروضة…"
            className="w-full rounded-2xl border border-violet-200/70 bg-white py-4 pr-12 pl-4 text-sm font-medium text-slate-800 shadow-[0_4px_24px_-12px_rgba(76,29,149,0.1)] outline-none placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
          />
        </div>

        {err ? (
          <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangle size={18} />
            {err}
          </p>
        ) : null}

        {loading && !onboardingRows.length && !activeRows.length ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-violet-500" />
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
                  <h2 className="text-sm font-black uppercase tracking-wide text-violet-800">متاجر جديدة — غير راضٍ</h2>
                  <span className="text-xs font-bold text-slate-400">{crisisOnb.length}</span>
                </div>
                {crisisOnb.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد حالات في هذا القسم.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
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
                  <h2 className="text-sm font-black uppercase tracking-wide text-violet-800">استبيانات نشطة — غير راضٍ</h2>
                  <span className="text-xs font-bold text-slate-400">{crisisActive.length}</span>
                </div>
                {crisisActive.length === 0 ? (
                  <p className="text-sm text-slate-400">لا توجد حالات في هذا القسم.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-3">
                    <AnimatePresence mode="popLayout">
                      {crisisActive.map(row => (
                        <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </section>
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
        resolveBusy={drawerRow ? resolvingId === drawerRow.id : false}
        canResolve={drawerCanResolve}
        executiveNotes={executiveNotes}
        onExecutiveNotesChange={setExecutiveNotes}
      />
    </div>
  )
}
