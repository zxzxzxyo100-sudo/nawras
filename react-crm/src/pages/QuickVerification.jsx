import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  TrendingUp,
  Timer,
  Globe2,
  AlertTriangle,
  X,
  Sparkles,
  ClipboardList,
  CheckCircle2,
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
      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border border-violet-200/60 bg-white/70 shadow-[0_4px_16px_-4px_rgba(91,33,182,0.2)] backdrop-blur-md ${className}`}
    >
      {children}
    </span>
  )
}

/** شريط علوي رفيع — مؤشرات تنفيذية */
function ExecutiveThinBar({ growth, resolution, global, loading }) {
  const Item = ({ icon: Icon, label, value }) => (
    <div className="flex min-w-0 flex-1 items-center justify-center gap-2.5 border-l border-violet-200/40 px-3 py-1 first:border-l-0 md:gap-3 md:px-4">
      <GlassIcon>
        <Icon size={16} className="text-violet-700" strokeWidth={2.2} />
      </GlassIcon>
      <div className="min-w-0 text-right">
        <p className="truncate text-[10px] font-bold uppercase tracking-wider text-violet-500/90 md:text-[11px]">{label}</p>
        <p className="text-lg font-black tabular-nums leading-none text-violet-950 md:text-xl">
          {loading ? '—' : `${value}%`}
        </p>
      </div>
    </div>
  )

  return (
    <div className="border-b border-violet-200/35 bg-gradient-to-l from-white via-violet-50/30 to-white shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
      <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-2.5">
        <div className="shrink-0 text-right md:pl-6">
          <p className="text-[10px] font-bold uppercase tracking-widest text-violet-500">لوحة تنفيذية</p>
          <p className="text-sm font-black text-violet-950 md:text-base">أداء المدير التنفيذي</p>
        </div>
        <div className="flex min-w-0 flex-1 items-stretch justify-end rounded-xl border border-violet-100/80 bg-white/50 py-2 shadow-sm backdrop-blur-sm md:max-w-3xl">
          <Item icon={TrendingUp} label="النمو" value={growth} />
          <Item icon={Timer} label="سرعة الحل" value={resolution} />
          <Item icon={Globe2} label="الرضا العالمي" value={global} />
        </div>
      </div>
    </div>
  )
}

function MerchantRow({ row, onOpen, layoutId }) {
  const sat = isSatisfied(row)
  const pct = satisfactionPercent(row)
  const kindLabel = row.survey_kind === 'new_merchant_onboarding' ? 'تهيئة' : 'نشط'

  return (
    <motion.button
      type="button"
      layout
      layoutId={layoutId}
      onClick={() => onOpen(row)}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      className={`group flex w-full items-center gap-3 border-b border-violet-100/60 px-4 py-3.5 text-right transition hover:bg-violet-50/40 ${
        sat ? 'bg-white' : 'bg-rose-50/45 hover:bg-rose-50/65'
      } `}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold tracking-tight text-slate-900 md:text-base">{row.store_name || `متجر #${row.store_id}`}</p>
        <p className="mt-0.5 text-[11px] font-medium tabular-nums text-slate-500">
          #{row.store_id} · {row.staff_fullname || row.staff_username || '—'} ·{' '}
          <span className="text-violet-600/80">{kindLabel}</span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {sat ? (
          <span className="rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-[13px] font-black tabular-nums text-emerald-700 shadow-sm">
            {pct}%
          </span>
        ) : (
          <span className="rounded-full border border-rose-200/70 bg-white/80 px-2.5 py-1 text-[11px] font-bold text-rose-700">
            يتطلب متابعة
          </span>
        )}
        <span className="text-[11px] font-bold text-violet-400 opacity-0 transition group-hover:opacity-100">تفاصيل ←</span>
      </div>
    </motion.button>
  )
}

function DetailDrawer({ row, open, onClose, onResolve, resolveBusy, canResolve }) {
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
            className="fixed inset-0 z-[60] bg-slate-900/25 backdrop-blur-[2px]"
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
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-violet-200/50 bg-white/92 shadow-[-12px_0_48px_-12px_rgba(76,29,149,0.18)] backdrop-blur-xl"
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
              <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-violet-600">إجابات الاستبيان</p>
              {onboarding ? (
                <ul className="space-y-2">
                  {(row.answers || []).map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white/90 px-3 py-2.5 text-sm shadow-sm"
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
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white/90 px-3 py-2.5 text-sm shadow-sm"
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
            </div>

            {!isSatisfied(row) && canResolve && !row.resolved ? (
              <div className="border-t border-violet-100/80 p-5">
                <button
                  type="button"
                  onClick={() => onResolve(row.id)}
                  disabled={resolveBusy}
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-orange-500 via-amber-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-[0_8px_32px_-4px_rgba(251,146,60,0.45)] transition hover:brightness-105 disabled:opacity-60"
                >
                  <span className="pointer-events-none absolute inset-0 bg-white/15 blur-xl" aria-hidden />
                  <span className="relative">{resolveBusy ? 'جارٍ التنفيذ…' : 'حل الإشكالية'}</span>
                </button>
              </div>
            ) : row.resolved ? (
              <div className="border-t border-emerald-100/80 bg-emerald-50/30 px-5 py-4 text-center text-sm font-bold text-emerald-800">
                تم تسجيل الحل سابقاً
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
  const [tab, setTab] = useState('active')
  const [drawerRow, setDrawerRow] = useState(null)

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

  const pendingOnb = useMemo(
    () => onboardingRows.filter(r => !r.resolved && rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const pendingActive = useMemo(() => activeRows.filter(r => !r.resolved && rowMatchesQuery(r, query)), [activeRows, query])

  const solvedOnb = useMemo(
    () => onboardingRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const solvedActive = useMemo(() => activeRows.filter(r => r.resolved && rowMatchesQuery(r, query)), [activeRows, query])

  const resolve = useCallback(
    async surveyId => {
      setResolvingId(surveyId)
      setErr('')
      try {
        const res = await postQuickVerificationResolveAudit({
          survey_id: surveyId,
          user_role: user?.role || 'executive',
          resolved_by: user?.username || '',
        })
        if (!res?.success) {
          setErr(res?.error || 'تعذّر الحفظ')
          return
        }
        setDrawerRow(null)
        setTab('solved')
        await load()
      } catch (e) {
        setErr(e?.response?.data?.error || e?.message || 'خطأ')
      } finally {
        setResolvingId(null)
      }
    },
    [load, user?.role, user?.username],
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

  return (
    <div className="min-h-screen bg-white pb-20" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="sticky top-0 z-40 border-b border-violet-100/80 bg-white/90 backdrop-blur-md">
        <ExecutiveThinBar growth={kpis.growth} resolution={kpis.resolution} global={kpis.global} loading={loading} />
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 md:px-6">
          <div className="flex rounded-xl border border-violet-100/90 bg-violet-50/30 p-1">
            <button
              type="button"
              onClick={() => setTab('active')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition md:px-4 md:text-sm ${
                tab === 'active' ? 'bg-white text-violet-900 shadow-sm' : 'text-violet-600/80 hover:text-violet-900'
              }`}
            >
              <ClipboardList size={16} className="opacity-80" />
              المتابعة
            </button>
            <button
              type="button"
              onClick={() => setTab('solved')}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-black transition md:px-4 md:text-sm ${
                tab === 'solved' ? 'bg-white text-violet-900 shadow-sm' : 'text-violet-600/80 hover:text-violet-900'
              }`}
            >
              <CheckCircle2 size={16} className="opacity-80" />
              تم الحل
            </button>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-900 shadow-sm hover:bg-violet-50 disabled:opacity-50 md:text-sm"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-violet-300" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث متاجر، معرّف، موظف…"
            className="w-full rounded-2xl border border-violet-200/70 bg-white/95 py-3.5 pr-11 pl-4 text-sm font-medium text-slate-800 shadow-[0_2px_20px_-8px_rgba(76,29,149,0.12)] outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
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
        ) : tab === 'active' ? (
          <div className="overflow-hidden rounded-2xl border border-violet-200/40 bg-white/60 shadow-[0_12px_40px_-24px_rgba(76,29,149,0.12)]">
            {pendingOnb.length === 0 && pendingActive.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-slate-500">لا توجد سجلات مطابقة للبحث أو للمتابعة اليوم.</p>
            ) : (
              <>
                <div className="flex items-center gap-2 border-b border-violet-100/80 bg-violet-50/20 px-4 py-2">
                  <Sparkles size={14} className="text-violet-500" />
                  <span className="text-[12px] font-black text-violet-800">المتاجر الجديدة</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {pendingOnb.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">لا توجد عناصر في هذا القسم.</p>
                  ) : (
                    pendingOnb.map(row => (
                      <MerchantRow
                        key={row.id}
                        row={row}
                        layoutId={`qv-${row.id}`}
                        onOpen={setDrawerRow}
                      />
                    ))
                  )}
                </AnimatePresence>

                <div className="flex items-center gap-2 border-b border-t border-violet-100/80 bg-violet-50/20 px-4 py-2">
                  <Sparkles size={14} className="text-violet-500" />
                  <span className="text-[12px] font-black text-violet-800">الاستبيانات النشطة</span>
                </div>
                <AnimatePresence mode="popLayout">
                  {pendingActive.length === 0 ? (
                    <p className="px-4 py-6 text-center text-sm text-slate-400">لا توجد عناصر في هذا القسم.</p>
                  ) : (
                    pendingActive.map(row => (
                      <MerchantRow
                        key={row.id}
                        row={row}
                        layoutId={`qv-${row.id}`}
                        onOpen={setDrawerRow}
                      />
                    ))
                  )}
                </AnimatePresence>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-emerald-200/30 bg-white/60 shadow-[0_12px_40px_-24px_rgba(16,185,129,0.08)]">
            <div className="border-b border-emerald-100/80 bg-emerald-50/25 px-4 py-2 text-[12px] font-black text-emerald-900">
              استبيانات تم حلّ إشكالياتها
            </div>
            <AnimatePresence mode="popLayout">
              {solvedOnb.length === 0 && solvedActive.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-slate-500">لا توجد سجلات بعد.</p>
              ) : (
                <>
                  {solvedOnb.map(row => (
                    <MerchantRow key={row.id} row={row} layoutId={`qv-s-${row.id}`} onOpen={setDrawerRow} />
                  ))}
                  {solvedActive.map(row => (
                    <MerchantRow key={row.id} row={row} layoutId={`qv-s-${row.id}`} onOpen={setDrawerRow} />
                  ))}
                </>
              )}
            </AnimatePresence>
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
      />
    </div>
  )
}
