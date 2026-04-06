import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  TrendingUp,
  Timer,
  Globe2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getQuickVerificationBourse, postQuickVerificationResolveAudit } from '../services/api'

const PURPLE = {
  glow: 'rgba(124, 58, 237, 0.35)',
  border: 'rgba(91, 33, 182, 0.25)',
}

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

function KpiDigit({ label, value, sub, icon: Icon, accent }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border px-5 py-4 text-right shadow-lg"
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.95), rgba(250,245,255,0.9))',
        borderColor: PURPLE.border,
        boxShadow: `0 12px 40px -12px ${PURPLE.glow}, inset 0 1px 0 rgba(255,255,255,0.9)`,
      }}
    >
      <div
        className="pointer-events-none absolute -left-6 -top-10 h-24 w-24 rounded-full opacity-40 blur-2xl"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-violet-600/90">{label}</p>
          <p className="mt-1 text-3xl font-black tabular-nums tracking-tight text-violet-950 md:text-[2rem]">
            {value}
            <span className="mr-1 text-lg font-bold text-violet-400">%</span>
          </p>
          {sub ? <p className="mt-1 text-[11px] font-medium text-slate-500">{sub}</p> : null}
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200/80 bg-white/90 shadow-inner"
          style={{ boxShadow: `0 0 24px ${PURPLE.glow}` }}
        >
          <Icon size={22} className="text-violet-700" strokeWidth={2.2} />
        </div>
      </div>
    </motion.div>
  )
}

function Tag({ children, tone = 'slate' }) {
  const map = {
    slate: 'bg-slate-100 text-slate-700 border-slate-200',
    green: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    amber: 'bg-amber-50 text-amber-900 border-amber-200',
    rose: 'bg-rose-50 text-rose-800 border-rose-200',
    violet: 'bg-violet-50 text-violet-900 border-violet-200',
  }
  return (
    <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-[11px] font-bold ${map[tone]}`}>
      {children}
    </span>
  )
}

function SurveyCard({ row, onResolve, resolveBusy, canResolve }) {
  const sat = isSatisfied(row)
  const pct = satisfactionPercent(row)
  const [savedFlash, setSavedFlash] = useState(false)
  const [detailOpen, setDetailOpen] = useState(!sat)

  const onboarding = row.survey_kind === 'new_merchant_onboarding'
  const tier = row.tier || 'green'
  const tierTag =
    tier === 'green' ? (
      <Tag tone="green">ممتاز</Tag>
    ) : tier === 'yellow' ? (
      <Tag tone="amber">متوسط</Tag>
    ) : (
      <Tag tone="rose">يحتاج متابعة</Tag>
    )

  return (
    <motion.div
      layout
      className="rounded-2xl border border-purple-200/40 bg-white/75 p-4 shadow-[0_8px_32px_-12px_rgba(76,29,149,0.12)] backdrop-blur-md"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-black text-slate-900">{row.store_name || `متجر #${row.store_id}`}</p>
          <p className="mt-0.5 text-[11px] font-semibold tabular-nums text-slate-500">
            #{row.store_id} · {row.staff_fullname || row.staff_username || '—'}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {onboarding ? (
              sat ? (
                <Tag tone="green">راضٍ</Tag>
              ) : (
                <Tag tone="rose">غير راضٍ</Tag>
              )
            ) : (
              <>
                {sat ? <Tag tone="green">راضٍ</Tag> : row.arrow === 'mid' ? <Tag tone="amber">محايد</Tag> : <Tag tone="rose">غير راضٍ</Tag>}
                {!sat || tier !== 'green' ? tierTag : null}
              </>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          {sat ? (
            <button
              type="button"
              onClick={() => {
                setSavedFlash(true)
                window.setTimeout(() => setSavedFlash(false), 2400)
              }}
              className="rounded-xl bg-gradient-to-l from-violet-700 to-purple-700 px-4 py-2 text-xs font-black text-white shadow-md shadow-violet-500/25 transition hover:from-violet-600 hover:to-purple-600"
            >
              حفظ الاستبيان
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setDetailOpen(v => !v)}
              className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-1.5 text-xs font-bold text-violet-900"
            >
              {detailOpen ? (
                <>
                  طي التقرير
                  <ChevronUp size={14} />
                </>
              ) : (
                <>
                  عرض التقرير
                  <ChevronDown size={14} />
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence mode="wait">
        {sat && savedFlash ? (
          <motion.div
            key="ok"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 flex items-center justify-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/90 py-6"
          >
            <CheckCircle2 className="text-emerald-600" size={40} strokeWidth={2.2} />
            <div>
              <p className="text-center text-sm font-bold text-emerald-900">تم التسجيل بنجاح</p>
              <p className="text-center text-4xl font-black tabular-nums text-emerald-700">{pct}%</p>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!sat && (
        <AnimatePresence>
          {detailOpen ? (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4 space-y-4 border-t border-purple-100/80 pt-4"
            >
              <div>
                <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-violet-700">إجابات الاستبيان</p>
                {onboarding ? (
                  <ul className="space-y-2">
                    {(row.answers || []).map((a, i) => (
                      <li
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 text-sm"
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
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-100 bg-white/90 px-3 py-2 text-sm"
                      >
                        <span className="font-semibold text-slate-800">{q.label}</span>
                        <span className="tabular-nums font-black text-violet-800">
                          {q.value}/5
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3">
                <p className="mb-1 text-[11px] font-black text-amber-900/90">ملاحظات الموظف</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {(row.suggestions || '').trim() || '— لا توجد ملاحظات مسجّلة —'}
                </p>
              </div>
              {canResolve && !row.resolved ? (
                <button
                  type="button"
                  onClick={() => onResolve(row.id)}
                  disabled={resolveBusy}
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-orange-500 via-amber-500 to-orange-600 px-4 py-3.5 text-sm font-black text-white shadow-[0_0_32px_rgba(251,146,60,0.45)] transition hover:brightness-105 disabled:opacity-60"
                >
                  <span className="pointer-events-none absolute inset-0 bg-white/10 opacity-30 blur-xl" aria-hidden />
                  <span className="relative">{resolveBusy ? 'جارٍ التنفيذ…' : 'حل الإشكالية'}</span>
                </button>
              ) : row.resolved ? (
                <p className="text-center text-xs font-bold text-emerald-700">تم تسجيل الحل ✓</p>
              ) : null}
            </motion.div>
          ) : null}
        </AnimatePresence>
      )}
    </motion.div>
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

  const filteredOnb = useMemo(
    () => onboardingRows.filter(r => rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const filteredActive = useMemo(() => activeRows.filter(r => rowMatchesQuery(r, query)), [activeRows, query])

  const kpis = useMemo(() => {
    const all = [...onboardingRows, ...activeRows]
    if (!all.length) {
      return { growth: 0, resolution: 100, global: 100 }
    }
    const positive = all.filter(isSatisfied).length
    const growth = Math.round((positive / all.length) * 100)

    const issues = all.filter(r => !isSatisfied(r))
    const resolved = issues.filter(r => r.resolved).length
    const resolution = issues.length ? Math.round((resolved / issues.length) * 100) : 100

    const gSum = all.reduce((acc, r) => acc + satisfactionPercent(r), 0)
    const global = Math.round(gSum / all.length)

    return { growth, resolution, global }
  }, [onboardingRows, activeRows])

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

  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className="min-h-screen bg-white pb-16"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div
        className="border-b border-violet-200/50 bg-gradient-to-l from-white via-violet-50/40 to-white shadow-[0_8px_30px_-18px_rgba(76,29,149,0.15)]"
      >
        <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
          <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-widest text-violet-600/90">لوحة تنفيذية</p>
              <h1 className="text-2xl font-black text-violet-950 md:text-[1.65rem]">أداء المدير التنفيذي</h1>
              <p className="mt-1 text-sm text-slate-500">مؤشرات رقمية محدّثة من استبيانات اليوم</p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-white px-4 py-2.5 text-sm font-bold text-violet-900 shadow-sm hover:bg-violet-50 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <KpiDigit
              label="النمو"
              value={kpis.growth}
              sub="نسبة النتائج الإيجابية اليوم"
              icon={TrendingUp}
              accent="#a78bfa"
            />
            <KpiDigit
              label="سرعة الحل"
              value={kpis.resolution}
              sub="حالات الإشكاليات المُغلقة / المفتوحة"
              icon={Timer}
              accent="#c4b5fd"
            />
            <KpiDigit
              label="الرضا العالمي"
              value={kpis.global}
              sub="متوسط مؤشر الرضا المحسوب"
              icon={Globe2}
              accent="#7c3aed"
            />
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="relative mb-8">
          <Search className="pointer-events-none absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-400" />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="ابحث عن متجر، معرّف، أو موظف…"
            className="w-full rounded-2xl border border-violet-200/80 bg-white/90 py-4 pr-12 pl-4 text-sm font-semibold text-slate-900 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400 focus:ring-2 focus:ring-violet-200"
          />
        </div>

        {err ? (
          <p className="mb-6 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
            <AlertTriangle size={18} />
            {err}
          </p>
        ) : null}

        {loading && !onboardingRows.length && !activeRows.length ? (
          <div className="flex justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-violet-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
            <section>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-black text-violet-950">المتاجر الجديدة</h2>
                <span className="text-xs font-bold tabular-nums text-slate-400">{filteredOnb.length}</span>
              </div>
              <div className="space-y-4">
                {filteredOnb.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30 py-12 text-center text-sm text-slate-500">
                    لا توجد استبيانات تهيئة مطابقة.
                  </p>
                ) : (
                  filteredOnb.map(row => (
                    <SurveyCard
                      key={row.id}
                      row={row}
                      onResolve={resolve}
                      resolveBusy={resolvingId === row.id}
                      canResolve={canResolveRow(row)}
                    />
                  ))
                )}
              </div>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-black text-violet-950">الاستبيانات النشطة</h2>
                <span className="text-xs font-bold tabular-nums text-slate-400">{filteredActive.length}</span>
              </div>
              <div className="space-y-4">
                {filteredActive.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/30 py-12 text-center text-sm text-slate-500">
                    لا توجد استبيانات تجار نشطين مطابقة.
                  </p>
                ) : (
                  filteredActive.map(row => (
                    <SurveyCard
                      key={row.id}
                      row={row}
                      onResolve={resolve}
                      resolveBusy={resolvingId === row.id}
                      canResolve={canResolveRow(row)}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  )
}
