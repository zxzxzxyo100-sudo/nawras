import { useNavigate, Link } from 'react-router-dom'
import { useMemo, useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Flame, Snowflake, Store,
  RefreshCw, AlertCircle, Package, Phone,
  Award, Activity, ArrowUpRight, Baby, ClipboardList,
  BarChart3, ArrowBigUp, ArrowBigDown, ArrowLeftRight, Loader2, BadgeCheck,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import StoreNameWithId from '../components/StoreNameWithId'
import { getDailyStaffSatisfaction, getQuickVerificationBourse, getDailyTaskDismissals } from '../services/api'
import {
  getBizDateKeyAt9am,
  getDailyColdBatchStores,
  buildColdVerificationTasks,
  getDailyActiveManagerColdBatchStores,
  buildActiveManagerColdVerificationTasks,
  COLD_INACTIVE_DAILY_LIMIT,
  ACTIVE_MANAGER_COLD_VERIFY_LIMIT,
} from '../utils/coldVerificationDaily'
import ExecutivePrivateTicketsSection from '../components/ExecutivePrivateTicketsSection'
import { NawrasHeroImageLayer, NawrasTaglineStack } from '../components/NawrasBrandBackdrop'
import { IS_STAGING_OR_DEV } from '../config/envFlags'

// ─── رمز النورس كزخرفة خلفية ─────────────────────────────────────
function SeagullMark({ size = 100, opacity = 0.07 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" fill="white" opacity={opacity} aria-hidden="true">
      <ellipse cx="60" cy="38" rx="22" ry="9" />
      <path d="M52,33 C38,14 6,18 2,28 C18,24 36,28 50,33 Z" />
      <path d="M68,33 C82,14 114,18 118,28 C102,24 84,28 70,33 Z" />
      <circle cx="79" cy="31" r="7" />
      <path d="M85,30 L95,32 L85,34 Z" />
      <path d="M40,39 L25,45 L33,44 L23,52 L40,42 Z" />
    </svg>
  )
}

// animation variants
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0  },
}
const staggerContainer = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.08 } },
}

// ─── Tooltip مخصص ────────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e1333] border border-purple-500/30 rounded-xl px-4 py-2.5 shadow-2xl text-right">
      <p className="text-purple-300 text-xs font-medium mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="text-white text-sm font-bold" style={{ color: p.color }}>
          {p.value} {p.name}
        </p>
      ))}
    </div>
  )
}

// ─── كرت المتجر الملوّن مع Framer Motion ─────────────────────────
function StoreTypeCard({ title, count, sub, gradient, glow, icon: Icon, onClick, dimmed }) {
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -5, boxShadow: `0 14px 40px ${glow}` }}
      whileTap={{ scale: 0.97 }}
      className={`group relative rounded-2xl p-5 text-right overflow-hidden w-full ${
        dimmed ? 'opacity-[0.38] pointer-events-none' : ''
      }`}
      style={{ background: gradient, boxShadow: `0 4px 24px ${glow}` }}
    >
      {/* shimmer overlay */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
      {/* glow circle */}
      <div className="absolute -bottom-6 -left-6 w-28 h-28 rounded-full opacity-20 blur-2xl"
        style={{ background: glow }} />

      <div className="relative flex items-start justify-between gap-3">
        <div>
          <p className="text-white/70 text-xs font-medium mb-2 uppercase tracking-widest">{title}</p>
          <p className="text-white text-4xl font-black leading-none">{(count || 0).toLocaleString('ar-SA')}</p>
          <p className="text-white/60 text-xs mt-2">{sub}</p>
        </div>
        <motion.div
          whileHover={{ scale: 1.15, rotate: 6 }}
          className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0"
        >
          <Icon size={20} className="text-white" />
        </motion.div>
      </div>

      <div className="relative flex items-center gap-1 mt-4 text-white/60 text-xs group-hover:text-white/90 transition-colors">
        <span>عرض التفاصيل</span>
        <ArrowUpRight size={12} />
      </div>
    </motion.button>
  )
}

// ─── الداشبورد ────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const { counts, stores, allStores, callLogs, storeStates, loading, error, lastLoaded, reload } = useStores()
  const { user, can } = useAuth()
  const navigate = useNavigate()

  const [staffMissions, setStaffMissions] = useState(null)
  const [missionsLoading, setMissionsLoading] = useState(false)
  const [missionsErr, setMissionsErr] = useState('')
  const [freezeQvPending, setFreezeQvPending] = useState(null)
  const [dashDismissals, setDashDismissals] = useState(() => new Set())
  const [dashNowTick, setDashNowTick] = useState(() => Date.now())

  useEffect(() => {
    const id = setInterval(() => setDashNowTick(Date.now()), 60 * 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const u = user?.username
    if (!u) return
    getDailyTaskDismissals(u)
      .then(r => {
        if (r?.success && Array.isArray(r.keys)) setDashDismissals(new Set(r.keys))
      })
      .catch(() => {})
  }, [user?.username, lastLoaded])

  const loadFreezeQvPending = useCallback(async () => {
    if (user?.role !== 'executive') {
      setFreezeQvPending(null)
      return
    }
    try {
      const d = await getQuickVerificationBourse({
        user_role: 'executive',
        username: user?.username || '',
      })
      if (d?.success) {
        const fr = Array.isArray(d.freeze_rows) ? d.freeze_rows : []
        const nf = Array.isArray(d.needs_freeze_rows) ? d.needs_freeze_rows : []
        setFreezeQvPending(fr.filter(r => !r.resolved).length + nf.filter(r => !r.resolved).length)
      } else {
        setFreezeQvPending(0)
      }
    } catch {
      setFreezeQvPending(null)
    }
  }, [user?.role, user?.username])

  const loadStaffSatisfaction = useCallback(async () => {
    if (user?.role !== 'executive' || IS_STAGING_OR_DEV) return
    setMissionsLoading(true)
    setMissionsErr('')
    try {
      const res = await getDailyStaffSatisfaction()
      if (res?.success) {
        setStaffMissions(Array.isArray(res.daily_staff_missions) ? res.daily_staff_missions : [])
      } else {
        setMissionsErr(res?.error || 'تعذّر تحميل بورصة الرضا')
        setStaffMissions([])
      }
    } catch (e) {
      setMissionsErr(e.response?.data?.error || e.message || 'خطأ')
      setStaffMissions([])
    } finally {
      setMissionsLoading(false)
    }
  }, [user?.role])

  useEffect(() => {
    loadStaffSatisfaction()
  }, [loadStaffSatisfaction])

  useEffect(() => {
    void loadFreezeQvPending()
  }, [loadFreezeQvPending, lastLoaded])

  function handleDashboardRefresh() {
    reload()
    void loadFreezeQvPending()
    if (user?.username) {
      getDailyTaskDismissals(user.username)
        .then(r => {
          if (r?.success && Array.isArray(r.keys)) setDashDismissals(new Set(r.keys))
        })
        .catch(() => {})
    }
    if (user?.role === 'executive' && !IS_STAGING_OR_DEV) {
      void loadStaffSatisfaction()
    }
  }
  // ── بيانات سير العمل (آخر 7 أيام) ─────────────────────────────
  const workflowData = useMemo(() => {
    const days = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const key = d.toISOString().split('T')[0]
      const label = d.toLocaleDateString('ar-SA', { weekday: 'short', month: 'numeric', day: 'numeric' })

      let calls = 0
      Object.values(callLogs).forEach(log => {
        Object.values(log || {}).forEach(e => {
          if (e?.date?.startsWith(key)) calls++
        })
      })

      // حجم الشحنات من البيانات المتاحة
      const shipments = allStores.filter(s => {
        const d2 = s.last_shipment_date
        return d2 && d2 !== 'لا يوجد' && d2.startsWith(key)
      }).length

      days.push({ day: label, مكالمات: calls, شحنات: shipments })
    }
    return days
  }, [callLogs, allStores])

  // ── مخطط الأداء: «أداء الموظفين» فقط لمن يملك صلاحية إدارة المستخدمين (executive في ROLES).
  //    باقي الحسابات ترى «أداء الموظف» (مكالماتها فقط). نعتمد can('users') لا مقارنة نصية خام
  //    حتى لا يختلف السلوك بسبب فرق في قيمة role من الخادم أو جلسة قديمة.
  const showExecutiveStaffLeaderboard = can('users')
  const employeeData = useMemo(() => {
    const map = {}
    const fn = (user?.fullname || '').trim()
    const un = (user?.username || '').trim()
    Object.values(callLogs).forEach(log => {
      Object.values(log || {}).forEach(e => {
        if (!e?.performed_by) return
        const raw = e.performed_by
        if (showExecutiveStaffLeaderboard) {
          map[raw] = (map[raw] || 0) + 1
        } else {
          const pb = String(raw).trim()
          if (pb === fn || pb === un) {
            const display = fn || un || pb
            map[display] = (map[display] || 0) + 1
          }
        }
      })
    })
    return Object.entries(map)
      .map(([name, calls]) => ({ name, مكالمات: calls }))
      .sort((a, b) => b.مكالمات - a.مكالمات)
      .slice(0, 6)
  }, [callLogs, showExecutiveStaffLeaderboard, user?.fullname, user?.username])

  const topEmployee = employeeData[0]?.name
  const showTopPerformerBadge = showExecutiveStaffLeaderboard && topEmployee && employeeData.length > 1

  // ── إحصائيات سريعة ─────────────────────────────────────────────
  const totalShipments  = allStores.reduce((s, x) => s + (parseInt(x.total_shipments) || 0), 0)
  const today           = new Date().toISOString().split('T')[0]
  const calledToday     = Object.values(callLogs).filter(log =>
    Object.values(log || {}).some(e => e?.date?.startsWith(today))
  ).length
  const pendingNewCalls = (stores.incubating || []).filter(s => !callLogs[s.id]?.day0).length
  const activeRate      = counts.total ? Math.round(((counts.active_shipping || 0) / counts.total) * 100) : 0
  const showIncubationHero = can('new') || can('incubation')

  const dashBizDateKey = useMemo(() => getBizDateKeyAt9am(new Date(dashNowTick)), [dashNowTick])

  const amColdVerifyAlert = useMemo(() => {
    if (user?.role !== 'active_manager' || !user?.username) return null
    const picked = getDailyActiveManagerColdBatchStores(
      allStores,
      storeStates,
      dashBizDateKey,
      user.username,
      ACTIVE_MANAGER_COLD_VERIFY_LIMIT,
    )
    const tasks = buildActiveManagerColdVerificationTasks(picked, dashBizDateKey)
    const pending = tasks.filter(t => !dashDismissals.has(t.id)).length
    const pool = allStores.filter(s => {
      const cat = storeStates[s.id]?.category || s.category || ''
      return cat === 'cold_inactive'
    }).length
    const hour = new Date(dashNowTick).getHours()
    return { pending, pool, beforeNine: hour < 9 }
  }, [user?.role, user?.username, allStores, storeStates, dashBizDateKey, dashDismissals, dashNowTick])

  const coldVerifyAlert = useMemo(() => {
    if (user?.role !== 'incubation_manager' || !user?.username) return null
    const picked = getDailyColdBatchStores(
      allStores,
      storeStates,
      dashBizDateKey,
      user.username,
      COLD_INACTIVE_DAILY_LIMIT,
    )
    const tasks = buildColdVerificationTasks(picked, dashBizDateKey)
    const pending = tasks.filter(t => !dashDismissals.has(t.id)).length
    const pool = allStores.filter(s => {
      const cat = storeStates[s.id]?.category || s.category || ''
      return cat === 'cold_inactive'
    }).length
    const hour = new Date(dashNowTick).getHours()
    return { pending, pool, beforeNine: hour < 9 }
  }, [user?.role, user?.username, allStores, storeStates, dashBizDateKey, dashDismissals, dashNowTick])

  if (loading) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
      <div className="w-12 h-12 rounded-full border-2 border-purple-200 border-t-purple-500 animate-spin" />
      <p className="text-slate-400 text-sm font-medium">جارٍ تحميل البيانات...</p>
    </div>
  )

  if (error) return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-3 text-red-400">
      <AlertCircle size={40} />
      <p>{error}</p>
      <button onClick={reload} className="px-4 py-2 bg-red-600 text-white rounded-xl text-sm">إعادة المحاولة</button>
    </div>
  )

  return (
    <div className="space-y-6 pb-6" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ══ Header ══════════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.45 }}
        className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 shadow-sm backdrop-blur-sm"
      >
        <NawrasHeroImageLayer opacity={0.11} footerCropPct={15} />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-l from-slate-50/95 via-white/85 to-violet-50/25"
          aria-hidden
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black text-slate-800 tracking-tight">
              لوحة <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-500">التحكم</span>
            </h1>
            <p className="text-slate-400 text-sm mt-0.5">
              مرحباً <span className="text-violet-600 font-semibold">{user?.fullname}</span>
              {lastLoaded && <span className="mr-2 text-slate-300">• {lastLoaded.toLocaleTimeString('ar-SA')}</span>}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
            <NawrasTaglineStack className="hidden max-w-[220px] sm:block md:max-w-[260px]" />
            <motion.button
              onClick={handleDashboardRefresh}
              disabled={loading || (user?.role === 'executive' && missionsLoading)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.96 }}
              className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading || missionsLoading ? 'animate-spin' : ''} />
              تحديث
            </motion.button>
          </div>
        </div>
        <div className="relative z-10 border-t border-slate-100/90 px-4 pb-3 sm:hidden">
          <NawrasTaglineStack compact className="pt-2" />
        </div>
      </motion.div>

      {/* ══ Hero Stats ══════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5, delay: 0.1 }}
        className="relative rounded-3xl p-6 lg:p-8 overflow-hidden text-white"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 50%, #1a0a4e 100%)' }}
      >
        {/* Decorative blobs */}
        <div className="absolute top-0 left-1/3 w-64 h-64 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />
        {/* نورس في الخلفية */}
        <div className="absolute bottom-2 left-6 pointer-events-none">
          <SeagullMark size={130} opacity={0.055} />
        </div>
        <div className="absolute top-3 right-10 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <SeagullMark size={70} opacity={0.035} />
        </div>

        <div className={`relative grid grid-cols-2 gap-6 ${showIncubationHero ? 'lg:grid-cols-4' : 'lg:grid-cols-3'}`}>
          {[
            { label: 'إجمالي المتاجر',  value: (counts.total || 0).toLocaleString('ar-SA'), icon: Package,  sub: `${activeRate}% نسبة النشاط` },
            { label: 'إجمالي الطرود',    value: totalShipments.toLocaleString('ar-SA'),       icon: TrendingUp, sub: 'كل المتاجر' },
            { label: 'مكالمات اليوم',    value: calledToday,                                  icon: Phone,   sub: 'تواصل مباشر' },
            ...(showIncubationHero
              ? [{ label: 'تحتاج تواصل', value: pendingNewCalls, icon: Store, sub: 'متاجر جديدة' }]
              : []),
          ].map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 + i * 0.08 }}
              className="flex items-start gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center flex-shrink-0">
                <s.icon size={18} className="text-violet-300" />
              </div>
              <div>
                <p className="text-white/50 text-xs font-medium">{s.label}</p>
                <p className="text-white text-2xl font-black leading-tight">{s.value}</p>
                <p className="text-white/40 text-xs mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {user?.role === 'active_manager' && amColdVerifyAlert ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl border border-cyan-300/80 bg-gradient-to-br from-sky-50 via-white to-cyan-50/80 p-4 shadow-sm lg:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-600/10 text-cyan-800 ring-1 ring-cyan-500/25">
                <Snowflake size={22} strokeWidth={2.2} aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-cyan-900/90">تحقيق بارد — مسؤول المتاجر النشطة</p>
                <p className="text-sm font-bold text-slate-900">
                  من «غير نشط بارد» — دفعة ثابتة {ACTIVE_MANAGER_COLD_VERIFY_LIMIT} متجراً (لا استبدال اليوم) — 9:00 ص
                </p>
                {amColdVerifyAlert.beforeNine ? (
                  <p className="text-sm text-amber-800 font-medium leading-relaxed">
                    قبل 9:00 ص: تُفعَّل الدفعة رسمياً بعد التاسعة. يُعرض آخر شحنة في المهام.
                  </p>
                ) : amColdVerifyAlert.pending > 0 ? (
                  <p className="text-sm text-cyan-950 font-semibold leading-relaxed">
                    متبقٍ للتحقق اليوم:{' '}
                    <span className="tabular-nums font-black">{amColdVerifyAlert.pending.toLocaleString('ar-SA')}</span>
                    {' / '}
                    {ACTIVE_MANAGER_COLD_VERIFY_LIMIT.toLocaleString('ar-SA')}
                  </p>
                ) : amColdVerifyAlert.pool > 0 ? (
                  <p className="text-sm text-slate-600 leading-relaxed">لا مهام متبقية في الدفعة اليوم — أو لا يوجد بارد مؤهل.</p>
                ) : (
                  <p className="text-sm text-slate-500">لا توجد متاجر «غير نشط بارد» في النظام.</p>
                )}
              </div>
            </div>
            <Link
              to="/tasks"
              state={{ openTasksTab: 'am_cold_verify' }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-cyan-600 px-4 py-2.5 text-sm font-black text-white shadow-md shadow-cyan-600/25 transition hover:bg-cyan-700"
            >
              المهام — تحقيق بارد
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </motion.div>
      ) : null}

      {user?.role === 'incubation_manager' && coldVerifyAlert ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.4, delay: 0.05 }}
          className="rounded-2xl border border-cyan-200/90 bg-gradient-to-br from-cyan-50/90 via-white to-slate-50/80 p-4 shadow-sm lg:p-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-500/15 text-cyan-800 ring-1 ring-cyan-400/30">
                <Snowflake size={20} aria-hidden />
              </div>
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-black uppercase tracking-wider text-cyan-900/90">تحقيق بارد — مسؤول المتاجر الجديدة</p>
                <p className="text-sm font-bold text-slate-900">حتى {COLD_INACTIVE_DAILY_LIMIT} متجراً يومياً — 9:00 ص</p>
                {coldVerifyAlert.beforeNine ? (
                  <p className="text-sm text-amber-800 font-medium leading-relaxed">
                    قبل 9:00 ص: انتظر بداية يوم العمل للدفعة الباردة.
                  </p>
                ) : coldVerifyAlert.pending > 0 ? (
                  <p className="text-sm text-cyan-950 font-semibold leading-relaxed">
                    لديك{' '}
                    <span className="tabular-nums font-black">{coldVerifyAlert.pending.toLocaleString('ar-SA')}</span>
                    {' '}
                    متجراً بانتظار التحقق في دفعة «غير نشط بارد».
                  </p>
                ) : coldVerifyAlert.pool > 0 ? (
                  <p className="text-sm text-slate-600">لا يتبقى متاجر في دفعة البارد اليوم.</p>
                ) : (
                  <p className="text-sm text-slate-500">لا توجد متاجر «باردة» في النظام.</p>
                )}
              </div>
            </div>
            <Link
              to="/tasks"
              state={{ openTasksTab: 'cold_verify' }}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-cyan-600 bg-white px-4 py-2.5 text-sm font-black text-cyan-900 shadow-sm transition hover:bg-cyan-50"
            >
              تبويب البارد
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </motion.div>
      ) : null}

      {user?.role === 'executive' && can('quick_verification') ? (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.45, delay: 0.06 }}
        >
          <Link
            to="/quick-verification"
            className="relative flex w-full flex-col gap-4 overflow-hidden rounded-3xl border-2 border-cyan-300/45 bg-gradient-to-br from-slate-950 via-indigo-950 to-fuchsia-950 p-5 text-right text-white shadow-[0_24px_60px_-20px_rgba(99,102,241,0.55),0_0_0_1px_rgba(255,255,255,0.06)_inset] transition hover:brightness-[1.07] sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:p-6 lg:p-7"
          >
            <div
              className="pointer-events-none absolute -left-20 top-0 h-48 w-48 rounded-full bg-cyan-400/25 blur-3xl"
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-16 bottom-0 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl"
              aria-hidden
            />
            <div className="relative flex min-w-0 flex-1 items-start gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10 shadow-[0_8px_32px_-8px_rgba(34,211,238,0.45)] ring-2 ring-cyan-300/30">
                <BadgeCheck size={28} className="text-cyan-100" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 space-y-1.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/90">لوحة تنفيذية</p>
                <p className="text-lg font-black leading-tight tracking-tight sm:text-xl">التحقيق السريع</p>
                <p className="text-sm font-medium leading-relaxed text-white/80">
                  مراجعة استبيانات اليوم، أزمات الرضا، تنبيهات التجميد، وطلبات «يحتاج تجميد» — اضغط للدخول إلى البورصة الكاملة.
                </p>
                {freezeQvPending != null && freezeQvPending > 0 ? (
                  <p className="pt-1 text-xs font-bold text-amber-200">
                    <span className="mr-1 inline-flex items-center rounded-full border border-amber-400/50 bg-amber-500/20 px-2.5 py-1">
                      {freezeQvPending.toLocaleString('ar-SA')} بانتظار مراجعتك الآن
                    </span>
                  </p>
                ) : (
                  <p className="pt-0.5 text-xs text-white/50">لا توجد حالات عاجلة معلّقة في الطابور حسب آخر تحديث.</p>
                )}
              </div>
            </div>
            <div className="relative flex shrink-0 items-center gap-2 self-end sm:self-center">
              <span className="rounded-xl border border-white/15 bg-white/10 px-4 py-2.5 text-xs font-black text-white/95 backdrop-blur-sm">
                فتح اللوحة
              </span>
              <ArrowUpRight className="text-cyan-200" size={22} strokeWidth={2.2} />
            </div>
          </Link>
        </motion.div>
      ) : null}

      {/* ══ Store Type Cards ════════════════════════════════════════ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {can('new') && (
          <StoreTypeCard
            title="جديدة & احتضان"
            count={counts.incubating}
            sub={`${pendingNewCalls} تحتاج مكالمة`}
            icon={Baby}
            gradient="linear-gradient(135deg, #5b21b6, #7c3aed)"
            glow="#7c3aed55"
            onClick={() => navigate('/new')}
          />
        )}
        {can('active') && (
          <StoreTypeCard
            title="نشط يشحن"
            count={counts.active_shipping}
            sub={(() => {
              const parts = []
              if ((counts.completed_merchants || 0) > 0) {
                parts.push(`منجز: ${(counts.completed_merchants || 0).toLocaleString('ar-SA')}`)
              }
              if ((counts.unreachable_merchants || 0) > 0) {
                parts.push(`لم يُصل: ${(counts.unreachable_merchants || 0).toLocaleString('ar-SA')}`)
              }
              if ((counts.frozen_merchants || 0) > 0) {
                parts.push(`مجمد: ${(counts.frozen_merchants || 0).toLocaleString('ar-SA')}`)
              }
              return parts.length ? `قيد المكالمة — ${parts.join(' — ')}` : 'آخر 30 يوم — قيد المكالمة'
            })()}
            icon={TrendingUp}
            gradient="linear-gradient(135deg, #065f46, #059669)"
            glow="#05966955"
            onClick={() => navigate('/active/pending')}
          />
        )}
        {can('hot_inactive') && (
          <StoreTypeCard
            title="غير نشط ساخن"
            count={counts.hot_inactive}
            sub="15 – 60 يوم"
            icon={Flame}
            gradient="linear-gradient(135deg, #92400e, #d97706)"
            glow="#d9770655"
            onClick={() => navigate('/hot-inactive/all')}
          />
        )}
        {can('cold_inactive') && (
          <StoreTypeCard
            title="غير نشط بارد"
            count={counts.cold_inactive}
            sub="أكثر من 60 يوم"
            icon={Snowflake}
            gradient="linear-gradient(135deg, #4c1d95, #6d28d9, #8b5cf6)"
            glow="#8b5cf655"
            onClick={() => navigate('/cold-inactive')}
          />
        )}
        {can('tasks') && (can('active') || can('new')) && (
          <StoreTypeCard
            title="المهام اليومية"
            count="مهام"
            sub="متابعة المسند إليك من صفحة المهام"
            icon={ClipboardList}
            gradient="linear-gradient(135deg, #3730a3, #4f46e5)"
            glow="#4f46e555"
            onClick={() => navigate('/tasks')}
          />
        )}
      </motion.div>

      {/* ══ تذاكر خاصة — مهام من التنفيذي لكل موظف ═══════════════════ */}
      <ExecutivePrivateTicketsSection
        user={user}
        reloadKey={lastLoaded ? lastLoaded.getTime() : 0}
      />

      {/* ══ بورصة رضا الموظفين — التجريبي يخفي هذا القسم (انظر IS_STAGING_OR_DEV) ══ */}
      {user?.role === 'executive' && !IS_STAGING_OR_DEV && (
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          transition={{ duration: 0.45, delay: 0.28 }}
          className="rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-5 shadow-xl text-white"
        >
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center shrink-0 border border-emerald-500/30">
              <BarChart3 size={20} className="text-emerald-300" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-black text-white tracking-tight">بورصة الرضا اليوم</h2>
              <p className="text-slate-400 text-xs mt-0.5 leading-relaxed">
                أسهم من استبيانات «تم الرد» اليوم: تهيئة جدد (نعم/لا)، وتجار نشطون بمتوسط ستة نجوم — أخضر / أصفر / أحمر.
              </p>
            </div>
          </div>

          {missionsErr && (
            <p className="text-amber-300 text-xs mb-3">{missionsErr}</p>
          )}

          {missionsLoading && staffMissions === null ? (
            <div className="flex items-center justify-center gap-2 py-10 text-slate-400 text-sm">
              <Loader2 size={20} className="animate-spin" />
              جارٍ تحميل مؤشرات الرضا…
            </div>
          ) : !staffMissions?.length ? (
            <div className="rounded-xl border border-dashed border-slate-600 py-8 text-center text-slate-500 text-sm">
              لا توجد استبيانات مكتملة اليوم لعرض الأسهم.
            </div>
          ) : (
            <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {staffMissions.slice(0, 9).map(row => {
                const arrow = row.satisfaction_arrow
                const up = arrow === 'up'
                const mid = arrow === 'mid'
                return (
                  <li
                    key={row.username}
                    className="rounded-xl border border-slate-600/70 bg-slate-800/50 px-3 py-2.5 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-100 text-sm truncate">{row.fullname || row.username}</p>
                      <p className="text-[10px] text-slate-500 truncate">{row.role || '—'} · {row.answered_surveys_today ?? 0} استبيان</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {up ? (
                        <span className="inline-flex" title="رضا إيجابي">
                          <ArrowBigUp size={22} strokeWidth={2.5} className="text-emerald-400" aria-hidden />
                        </span>
                      ) : mid ? (
                        <span className="inline-flex" title="محايد / يحتاج متابعة">
                          <ArrowLeftRight size={22} strokeWidth={2.5} className="text-amber-400" aria-hidden />
                        </span>
                      ) : (
                        <span className="inline-flex" title="فجوة في التقييم">
                          <ArrowBigDown size={22} strokeWidth={2.5} className="text-rose-400" aria-hidden />
                        </span>
                      )}
                      {!up && Array.isArray(row.gap_tags) && row.gap_tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                          {row.gap_tags.slice(0, 3).map(t => (
                            <span
                              key={t}
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-950/90 text-rose-200 border border-rose-700/40"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </motion.div>
      )}

      {/* ══ Charts Row ══════════════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5, delay: 0.35 }}
        className="grid grid-cols-1 lg:grid-cols-5 gap-5"
      >

        {/* Area Chart — سير العمل */}
        <div
          className="lg:col-span-3 rounded-2xl p-5 lg:p-6"
          style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                سير العمل اليومي
              </h2>
              <p className="text-white/40 text-xs mt-0.5">المكالمات والشحنات – آخر 7 أيام</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 text-violet-400"><span className="w-3 h-0.5 rounded-full bg-violet-400 inline-block" /> مكالمات</span>
              <span className="flex items-center gap-1.5 text-emerald-400"><span className="w-3 h-0.5 rounded-full bg-emerald-400 inline-block" /> شحنات</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={workflowData} margin={{ top: 5, right: 5, bottom: 0, left: -20 }}>
              <svg>
                <defs>
                  <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradShip" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
              </svg>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="مكالمات" stroke="#8b5cf6" strokeWidth={2.5} fill="url(#gradCalls)" dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="شحنات"   stroke="#10b981" strokeWidth={2.5} fill="url(#gradShip)"  dot={{ fill: '#10b981', r: 3, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Bar Chart — أداء الموظفين (executive فقط) / أداء الموظف (نشطة، استعادة، جديد، …) */}
        <div
          className="lg:col-span-2 rounded-2xl p-5 lg:p-6"
          style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                {showExecutiveStaffLeaderboard ? 'أداء الموظفين' : 'أداء الموظف'}
              </h2>
              <p className="text-white/40 text-xs mt-0.5">
                {showExecutiveStaffLeaderboard ? 'إجمالي المكالمات' : 'مكالماتك المسجّلة'}
              </p>
            </div>
            {showTopPerformerBadge && (
              <div className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-500/30 text-amber-300 text-xs font-bold px-2.5 py-1 rounded-full">
                <Award size={11} />
                المتصدر
              </div>
            )}
          </div>

          {employeeData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[180px] text-white/30 gap-2">
              <Activity size={28} />
              <p className="text-xs">لا توجد مكالمات مسجّلة بعد</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={employeeData} margin={{ top: 5, right: 0, bottom: 5, left: -25 }}>
                <svg>
                  <defs>
                    <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" />
                      <stop offset="100%" stopColor="#7c3aed" />
                    </linearGradient>
                    <linearGradient id="barGradTop" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#fbbf24" />
                      <stop offset="100%" stopColor="#d97706" />
                    </linearGradient>
                  </defs>
                </svg>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#ffffff50', fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  interval={0}
                  tickFormatter={v => v.length > 5 ? v.slice(0, 5) + '…' : v}
                />
                <YAxis tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="مكالمات" radius={[6, 6, 0, 0]}
                  fill="url(#barGrad)"
                  label={false}
                >
                  {employeeData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.name === topEmployee ? 'url(#barGradTop)' : 'url(#barGrad)'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}

          {/* Employee List */}
          <div className="mt-3 space-y-1.5">
            {employeeData.slice(0, 3).map((emp, i) => (
              <div key={emp.name} className="flex items-center gap-2.5">
                <div className={`w-5 h-5 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0 ${
                  i === 0 ? 'bg-amber-500/30 text-amber-300' :
                  i === 1 ? 'bg-violet-500/30 text-violet-300' :
                            'bg-white/10 text-white/40'
                }`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-white/80 text-xs font-medium truncate">{emp.name}</span>
                    <span className={`text-xs font-bold mr-2 ${i === 0 ? 'text-amber-300' : 'text-violet-300'}`}>{emp.مكالمات}</span>
                  </div>
                  <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${i === 0 ? 'bg-amber-400' : 'bg-violet-500'}`}
                      style={{ width: `${(emp.مكالمات / (employeeData[0]?.مكالمات || 1)) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ══ Recent + Quick Stats ════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5, delay: 0.5 }}
        className={can('new') ? 'grid grid-cols-1 lg:grid-cols-3 gap-5' : 'grid grid-cols-1 gap-5'}
      >

        {/* أحدث المتاجر — يظهر لمن لديه صلاحية «المتاجر» فقط */}
        {can('new') && (
          <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                  <Store size={14} className="text-violet-600" />
                </div>
                أحدث المتاجر المسجلة
              </h2>
              <button type="button" onClick={() => navigate('/new')} className="text-violet-600 text-xs font-semibold hover:text-violet-800 flex items-center gap-0.5 transition-colors">
                عرض الكل <ArrowUpRight size={11} />
              </button>
            </div>
            <div>
              {[...(stores.incubating || [])].sort((a, b) => new Date(b.registered_at || 0) - new Date(a.registered_at || 0)).slice(0, 5).map((s, i) => {
                const hours = s.registered_at ? Math.floor((new Date() - new Date(s.registered_at)) / 3600000) : null
                return (
                  <div key={s.id} className={`flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors cursor-pointer ${i !== 4 ? 'border-b border-slate-50' : ''}`}>
                    <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                      {s.name?.charAt(0) || '؟'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-slate-800 font-semibold text-sm truncate">
                        <StoreNameWithId store={s} nameClassName="font-semibold text-slate-800 text-sm" idClassName="font-mono text-xs text-slate-500 font-semibold" />
                      </div>
                      <p className="text-slate-400 text-xs">{hours !== null ? (hours < 24 ? `منذ ${hours} ساعة` : `منذ ${Math.floor(hours / 24)} يوم`) : '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${parseInt(s.total_shipments) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {parseInt(s.total_shipments) || 0} طرد
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* توزيع فوري */}
        <div
          className={`rounded-2xl p-5 lg:p-6 flex flex-col gap-4 ${can('new') ? '' : 'lg:col-span-3'}`}
          style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
        >
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
              توزيع الفئات
            </h2>
            <p className="text-white/40 text-xs mt-0.5">{(counts.total || 0).toLocaleString('ar-SA')} متجر إجمالي</p>
          </div>

          {[
            can('active') && { label: 'نشط يشحن',   v: counts.active_shipping || 0, color: '#10b981', bg: '#10b98115' },
            can('hot_inactive') && { label: 'غير نشط ساخن', v: counts.hot_inactive    || 0, color: '#f59e0b', bg: '#f59e0b15' },
            can('cold_inactive') && { label: 'غير نشط بارد', v: counts.cold_inactive   || 0, color: '#8b5cf6', bg: '#8b5cf615' },
            can('new') && { label: 'جديدة & احتضان', v: counts.incubating  || 0, color: '#a78bfa', bg: '#a78bfa15' },
          ].filter(Boolean).map(row => {
            const pct = counts.total ? Math.round((row.v / counts.total) * 100) : 0
            return (
              <div key={row.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: row.color }} />
                    <span className="text-white/70 text-xs">{row.label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">{pct}%</span>
                    <span className="text-white font-bold text-sm">{row.v.toLocaleString('ar-SA')}</span>
                  </div>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: row.bg }}>
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${pct}%`, background: row.color }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </motion.div>
    </div>
  )
}
