import { useNavigate } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  AreaChart, Area, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'
import {
  TrendingUp, Flame, Snowflake, Store,
  RefreshCw, AlertCircle, Package, Phone,
  Award, Activity, ArrowUpRight, Baby, Crown, Zap, Wallet, Trophy, Lock,
} from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import { getLeaderboard } from '../services/api'
import { MILESTONES } from '../components/MilestonesCard'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'

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
function StoreTypeCard({ title, count, sub, gradient, glow, icon: Icon, onClick }) {
  return (
    <motion.button
      variants={fadeUp}
      onClick={onClick}
      whileHover={{ y: -5, boxShadow: `0 14px 40px ${glow}` }}
      whileTap={{ scale: 0.97 }}
      className="group relative rounded-2xl p-5 text-right overflow-hidden w-full"
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

// ── حساب الميلستون القادم لموظف ──────────────────────────────────
function getNextMilestone(pts) {
  return MILESTONES.find(m => pts < m.threshold) ?? null
}
function getUnlockedCount(pts) {
  return MILESTONES.filter(m => pts >= m.threshold).length
}

// ─── Hall of Fame + جدول المحافظ الشاملة ─────────────────────────
function HallOfFame() {
  const [board,    setBoard]    = useState([])
  const [sortBy,   setSortBy]   = useState('total_points')

  useEffect(() => {
    getLeaderboard().then(r => setBoard(r.data || [])).catch(() => {})
  }, [])

  if (!board.length) return null

  const medals       = ['🥇','🥈','🥉']
  const podiumColors = [
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #9ca3af, #6b7280)',
    'linear-gradient(135deg, #cd7c2f, #a0522d)',
  ]
  const SORT_LABELS = {
    total_points: 'إجمالي NRS',
    today_points: 'نقاط اليوم',
    today_calls:  'مكالمات اليوم',
  }

  const sorted = [...board].sort((a, b) => (b[sortBy] || 0) - (a[sortBy] || 0))
  const top3   = sorted.slice(0, 3)
  const rest   = sorted.slice(3)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.3 }}
      className="rounded-2xl overflow-hidden"
      style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
    >
      {/* رأس */}
      <div className="flex items-center justify-between p-5 pb-4">
        <div>
          <h2 className="text-white font-bold text-base flex items-center gap-2">
            <Crown size={16} className="text-amber-400" /> قاعة المتميزين
          </h2>
          <p className="text-white/30 text-xs mt-0.5">المحفظة الشاملة لكل الموظفين</p>
        </div>
        <div className="flex items-center gap-2">
          {/* إجمالي الإنجازات المفتوحة */}
          {board.length > 0 && (() => {
            const totalUnlocked = board.reduce((s, e) => s + getUnlockedCount(e.total_points || 0), 0)
            return totalUnlocked > 0 ? (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold"
                style={{ background: 'rgba(124,58,237,0.2)', border: '1px solid rgba(124,58,237,0.3)', color: '#c4b5fd' }}>
                <Trophy size={9} /> {totalUnlocked} إنجاز
              </div>
            ) : null
          })()}
          <div className="flex items-center gap-1.5 bg-amber-500/15 border border-amber-500/25 text-amber-300 text-xs font-bold px-3 py-1 rounded-full">
            <Zap size={10} /> NRS Points
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="grid grid-cols-3 gap-3 px-5 mb-4">
        {top3.map((emp, i) => (
          <motion.div
            key={emp.username}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="rounded-2xl p-3 text-center"
            style={{
              background: i === 0
                ? 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(245,158,11,0.05))'
                : 'rgba(255,255,255,0.04)',
              border: i === 0 ? '1px solid rgba(245,158,11,0.3)' : '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <div className="text-2xl mb-1">{medals[i]}</div>
            <div
              className="w-9 h-9 rounded-xl mx-auto flex items-center justify-center text-white font-black text-sm mb-2"
              style={{ background: podiumColors[i] }}
            >
              {emp.fullname?.charAt(0) || '؟'}
            </div>
            <p className="text-white text-xs font-bold truncate">{emp.fullname?.split(' ')[0]}</p>
            <p className="font-black mt-1" style={{ color: i === 0 ? '#fbbf24' : '#a78bfa', fontSize: '1.1rem' }}>
              {emp[sortBy] ?? emp.total_points}
            </p>
            <p className="text-white/30 text-[9px]">{sortBy === 'today_calls' ? 'مكالمة' : 'NRS'}</p>
            <div className="mt-1.5 text-[10px] text-white/40 flex items-center justify-center gap-1">
              <Phone size={8} /> {emp.today_calls} اليوم
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── جدول المحافظ الشاملة ─────────────────────────────── */}
      <div className="border-t border-white/5">
        {/* رأس الجدول + فلاتر الفرز */}
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/5 flex-wrap">
          <span className="text-white/30 text-[10px] ml-2">ترتيب حسب:</span>
          {Object.entries(SORT_LABELS).map(([key, lbl]) => (
            <button
              key={key}
              onClick={() => setSortBy(key)}
              className="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all"
              style={{
                background: sortBy === key ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.05)',
                color: sortBy === key ? '#c4b5fd' : 'rgba(255,255,255,0.35)',
                border: sortBy === key ? '1px solid rgba(124,58,237,0.4)' : '1px solid transparent',
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="divide-y divide-white/5">
          {sorted.map((emp, i) => {
            const pts           = emp.total_points || 0
            const nextM         = getNextMilestone(pts)
            const unlockedCount = getUnlockedCount(pts)
            const progPct       = nextM
              ? Math.round((pts / nextM.threshold) * 100)
              : 100
            const isJustUnlocked = nextM
              ? (pts >= (MILESTONES[unlockedCount - 1]?.threshold ?? 0) &&
                 pts <  nextM.threshold &&
                 pts >= (MILESTONES[unlockedCount - 1]?.threshold ?? 0))
              : false

            return (
              <div key={emp.username} className="px-4 py-3 hover:bg-white/3 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-white/25 text-xs w-5 text-center font-bold flex-shrink-0">{i + 1}</span>
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white font-black text-xs flex-shrink-0"
                    style={{ background: i < 3 ? podiumColors[i] : 'rgba(124,58,237,0.25)' }}
                  >
                    {i < 3 ? medals[i] : emp.fullname?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-white/80 text-xs font-semibold truncate">{emp.fullname}</span>
                        {/* شارات الإنجاز */}
                        {unlockedCount > 0 && (
                          <div className="flex gap-0.5 flex-shrink-0">
                            {MILESTONES.slice(0, unlockedCount).map(m => (
                              <span key={m.id} className="text-[11px]" title={m.title}>{m.emoji}</span>
                            ))}
                          </div>
                        )}
                        {/* تنبيه الفتح الجديد */}
                        {pts >= 100 && pts < 110 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5 }}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}
                          >
                            🔓 جديد
                          </motion.span>
                        )}
                        {pts >= 200 && pts < 210 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5 }}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(245,158,11,0.25)', color: '#fbbf24' }}
                          >
                            🔓 جديد
                          </motion.span>
                        )}
                        {pts >= 300 && pts < 310 && (
                          <motion.span
                            initial={{ scale: 0 }}
                            animate={{ scale: [0, 1.3, 1] }}
                            transition={{ duration: 0.5 }}
                            className="text-[9px] font-black px-1.5 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: 'rgba(124,58,237,0.3)', color: '#c4b5fd' }}
                          >
                            🏆 ماكس
                          </motion.span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0 text-right">
                        <span className="text-amber-300 font-black text-xs">{pts} <span className="text-amber-300/50 font-normal">NRS</span></span>
                        <span className="text-violet-300 text-[10px]">{emp.today_calls} اليوم</span>
                      </div>
                    </div>

                    {/* شريط التقدم للميلستون القادم */}
                    <div className="mt-1.5">
                      <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                          className="h-full rounded-full"
                          style={{
                            background: unlockedCount >= 3
                              ? 'linear-gradient(90deg, #a78bfa, #7c3aed)'
                              : unlockedCount >= 1
                              ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                              : 'linear-gradient(90deg, #3b82f6, #60a5fa)',
                          }}
                          initial={{ width: 0 }}
                          animate={{ width: `${progPct}%` }}
                          transition={{ duration: 0.8, delay: 0.1 + i * 0.05, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[9px] text-white/25">
                          {nextM
                            ? `${pts}/${nextM.threshold} لفتح ${nextM.emoji} ${nextM.title}`
                            : '🏆 جميع المكافآت مفتوحة'}
                        </span>
                        <span className="text-[9px] font-bold" style={{ color: unlockedCount >= 3 ? '#a78bfa' : '#f59e0b' }}>
                          {progPct}%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

// ─── الداشبورد ────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const { counts, stores, allStores, callLogs, loading, error, lastLoaded, reload } = useStores()
  const { user } = useAuth()
  const navigate = useNavigate()
  const { totalPoints, todayPoints, todayCalls, goalPct } = usePoints()

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

  // ── أداء الموظفين ───────────────────────────────────────────────
  const employeeData = useMemo(() => {
    const map = {}
    Object.values(callLogs).forEach(log => {
      Object.values(log || {}).forEach(e => {
        if (e?.performed_by) {
          map[e.performed_by] = (map[e.performed_by] || 0) + 1
        }
      })
    })
    return Object.entries(map)
      .map(([name, calls]) => ({ name, مكالمات: calls }))
      .sort((a, b) => b.مكالمات - a.مكالمات)
      .slice(0, 6)
  }, [callLogs])

  const topEmployee = employeeData[0]?.name

  // ── إحصائيات سريعة ─────────────────────────────────────────────
  const totalShipments  = allStores.reduce((s, x) => s + (parseInt(x.total_shipments) || 0), 0)
  const today           = new Date().toISOString().split('T')[0]
  const calledToday     = Object.values(callLogs).filter(log =>
    Object.values(log || {}).some(e => e?.date?.startsWith(today))
  ).length
  const pendingNewCalls = (stores.incubating || []).filter(s => !callLogs[s.id]?.day0).length
  const activeRate      = counts.total ? Math.round(((counts.active_shipping || 0) / counts.total) * 100) : 0

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
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">
            لوحة <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-500">التحكم</span>
          </h1>
          <p className="text-slate-400 text-sm mt-0.5">
            مرحباً <span className="text-violet-600 font-semibold">{user?.fullname}</span>
            {lastLoaded && <span className="mr-2 text-slate-300">• {lastLoaded.toLocaleTimeString('ar-SA')}</span>}
          </p>
        </div>
        <motion.button
          onClick={reload}
          disabled={loading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.96 }}
          className="flex items-center gap-2 px-4 py-2.5 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-violet-500/25 transition-all disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </motion.button>
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

        <div className="relative grid grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { label: 'إجمالي المتاجر',  value: (counts.total || 0).toLocaleString('ar-SA'), icon: Package,  sub: `${activeRate}% نسبة النشاط` },
            { label: 'إجمالي الطرود',    value: totalShipments.toLocaleString('ar-SA'),       icon: TrendingUp, sub: 'كل المتاجر' },
            { label: 'مكالمات اليوم',    value: calledToday,                                  icon: Phone,   sub: 'تواصل مباشر' },
            { label: 'تحتاج تواصل',      value: pendingNewCalls,                              icon: Store,   sub: 'متاجر جديدة' },
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

      {/* ══ Store Type Cards ════════════════════════════════════════ */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <StoreTypeCard
          title="جديدة & احتضان"
          count={counts.incubating}
          sub={`${pendingNewCalls} تحتاج مكالمة`}
          icon={Baby}
          gradient="linear-gradient(135deg, #5b21b6, #7c3aed)"
          glow="#7c3aed55"
          onClick={() => navigate('/new')}
        />
        <StoreTypeCard
          title="نشط يشحن"
          count={counts.active_shipping}
          sub="آخر 14 يوم"
          icon={TrendingUp}
          gradient="linear-gradient(135deg, #065f46, #059669)"
          glow="#05966955"
          onClick={() => navigate('/active')}
        />
        <StoreTypeCard
          title="غير نشط ساخن"
          count={counts.hot_inactive}
          sub="15 – 60 يوم"
          icon={Flame}
          gradient="linear-gradient(135deg, #92400e, #d97706)"
          glow="#d9770655"
          onClick={() => navigate('/hot-inactive')}
        />
        <StoreTypeCard
          title="غير نشط بارد"
          count={counts.cold_inactive}
          sub="أكثر من 60 يوم"
          icon={Snowflake}
          gradient="linear-gradient(135deg, #4c1d95, #6d28d9, #8b5cf6)"
          glow="#8b5cf655"
          onClick={() => navigate('/cold-inactive')}
        />
      </motion.div>

      {/* ══ بطاقة المحفظة السريعة (للموظفين) ══════════════════════ */}
      {user?.role !== 'executive' && (
        <motion.button
          onClick={() => navigate('/performance')}
          variants={fadeUp} initial="hidden" animate="visible"
          transition={{ duration: 0.45, delay: 0.28 }}
          whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          className="w-full rounded-2xl overflow-hidden text-right"
          style={{
            background: 'linear-gradient(135deg, #78350f 0%, #92400e 40%, #78350f 100%)',
            boxShadow: '0 4px 24px rgba(245,158,11,0.25)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <div className="relative px-5 py-4 flex items-center gap-4">
            <div className="absolute top-0 right-0 w-32 h-full bg-amber-400/10 blur-2xl pointer-events-none rounded-full" />
            <motion.div
              className="absolute top-0 left-0 w-1/3 h-full pointer-events-none"
              style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }}
              animate={{ x: ['0%', '350%'] }}
              transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
            />
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
              style={{ background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              🪙
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-amber-300 text-xs font-medium">محفظة NRS — اضغط لعرض التفاصيل</p>
              </div>
              <p className="text-white font-black text-2xl leading-tight">{totalPoints.toLocaleString()}</p>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-amber-400/70 text-xs">+{todayPoints} نقطة اليوم</span>
                <span className="text-white/20 text-xs">·</span>
                <span className="text-white/40 text-xs">{todayCalls}/{DAILY_GOAL} مكالمة</span>
              </div>
            </div>
            <div className="flex flex-col items-center gap-1 flex-shrink-0">
              <span className="text-sm font-black" style={{ color: goalPct >= 100 ? '#10b981' : '#fbbf24' }}>{goalPct}%</span>
              <div className="w-1.5 h-10 bg-white/10 rounded-full overflow-hidden flex flex-col justify-end">
                <motion.div
                  className="w-full rounded-full"
                  style={{ background: goalPct >= 100 ? '#10b981' : 'linear-gradient(180deg, #fbbf24, #d97706)' }}
                  initial={{ height: 0 }}
                  animate={{ height: `${goalPct}%` }}
                  transition={{ duration: 1, ease: 'easeOut', delay: 0.4 }}
                />
              </div>
              <ArrowUpRight size={12} className="text-amber-400/60" />
            </div>
          </div>
        </motion.button>
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

        {/* Bar Chart — أداء الموظفين */}
        <div
          className="lg:col-span-2 rounded-2xl p-5 lg:p-6"
          style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-white font-bold text-base flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                أداء الموظفين
              </h2>
              <p className="text-white/40 text-xs mt-0.5">إجمالي المكالمات</p>
            </div>
            {topEmployee && (
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

      {/* ══ Hall of Fame (للمدير التنفيذي فقط) ═══════════════════ */}
      {user?.role === 'executive' && <HallOfFame />}

      {/* ══ Recent + Quick Stats ════════════════════════════════════ */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ duration: 0.5, delay: 0.5 }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-5"
      >

        {/* أحدث المتاجر */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
                <Store size={14} className="text-violet-600" />
              </div>
              أحدث المتاجر المسجلة
            </h2>
            <button onClick={() => navigate('/new')} className="text-violet-600 text-xs font-semibold hover:text-violet-800 flex items-center gap-0.5 transition-colors">
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
                    <p className="text-slate-800 font-semibold text-sm truncate">{s.name}</p>
                    <p className="text-slate-400 text-xs">{hours !== null ? (hours < 24 ? `منذ ${hours} ساعة` : `منذ ${Math.floor(hours / 24)} يوم`) : '—'}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-300 font-mono">#{s.id}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${parseInt(s.total_shipments) > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {parseInt(s.total_shipments) || 0} طرد
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* توزيع فوري */}
        <div
          className="rounded-2xl p-5 lg:p-6 flex flex-col gap-4"
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
            { label: 'نشط يشحن',   v: counts.active_shipping || 0, color: '#10b981', bg: '#10b98115' },
            { label: 'غير نشط ساخن', v: counts.hot_inactive    || 0, color: '#f59e0b', bg: '#f59e0b15' },
            { label: 'غير نشط بارد', v: counts.cold_inactive   || 0, color: '#8b5cf6', bg: '#8b5cf615' },
            { label: 'جديدة & احتضان', v: counts.incubating  || 0, color: '#a78bfa', bg: '#a78bfa15' },
          ].map(row => {
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
