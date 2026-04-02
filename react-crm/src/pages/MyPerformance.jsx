import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Zap, Phone, Star, RefreshCw, Award, TrendingUp, Wallet } from 'lucide-react'
import { useAuth }   from '../contexts/AuthContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'
import SmartAds from '../components/SmartAds'
import MilestonesSection from '../components/MilestonesCard'

// ── Tooltip مخصص ─────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#1e1333] border border-purple-500/30 rounded-xl px-3 py-2 text-right shadow-2xl">
      <p className="text-purple-300 text-xs mb-1">{label}</p>
      <p className="text-amber-400 font-black">{payload[0]?.value} مكالمة</p>
    </div>
  )
}

// ── Crown Glow Styles ─────────────────────────────────────────────
const CROWN_CSS = `
@keyframes goldGlow {
  0%, 100% { filter: drop-shadow(0 0 12px #f59e0b) drop-shadow(0 0 28px #fbbf24); }
  50%       { filter: drop-shadow(0 0 24px #fde68a) drop-shadow(0 0 48px #f59e0b); }
}
@keyframes seagullFloat {
  0%, 100% { transform: translateY(0px)   rotate(-2deg); }
  50%       { transform: translateY(-5px) rotate(2deg);  }
}
@keyframes seagullFloatGoal {
  0%   { transform: translateY(0px)    rotate(-4deg) scale(1);    }
  25%  { transform: translateY(-8px)   rotate(5deg)  scale(1.06); }
  50%  { transform: translateY(-4px)   rotate(-2deg) scale(1.03); }
  75%  { transform: translateY(-10px)  rotate(6deg)  scale(1.08); }
  100% { transform: translateY(0px)    rotate(-4deg) scale(1);    }
}
@keyframes ringPulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.7; }
}
`

// ── النورس الملكي 3D ─────────────────────────────────────────────
function SeagullCrown({ pct, calls }) {
  const isGoalMet = pct >= 100
  const ringColor = isGoalMet ? '#f59e0b' : pct >= 60 ? '#a78bfa' : '#7c3aed'
  const ringGlow  = isGoalMet ? '#f59e0b50' : '#7c3aed40'
  const label     = isGoalMet ? '🏆 أكملت الهدف!' : pct >= 60 ? '💪 أنت في المسار' : '🎯 هيا نبدأ!'
  const r         = 62
  const circ      = 2 * Math.PI * r
  const dash      = circ - (Math.min(pct, 100) / 100) * circ

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CROWN_CSS }} />
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-36 h-36">
          {/* Progress ring */}
          <svg
            width="144" height="144" viewBox="0 0 144 144"
            className="absolute top-0 left-0"
            style={{ transform: 'rotate(-90deg)' }}
          >
            <defs>
              <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor={isGoalMet ? '#f59e0b' : '#7c3aed'} />
                <stop offset="100%" stopColor={isGoalMet ? '#fde68a' : '#a78bfa'} />
              </linearGradient>
              {/* هالة خارجية */}
              <filter id="ringBlur">
                <feGaussianBlur stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            {/* الحلقة الخلفية */}
            <circle cx="72" cy="72" r={r}
              fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
            {/* الحلقة المتعبئة */}
            <motion.circle
              cx="72" cy="72" r={r} fill="none"
              stroke="url(#ringGrad)" strokeWidth="9" strokeLinecap="round"
              strokeDasharray={circ}
              initial={{ strokeDashoffset: circ }}
              animate={{ strokeDashoffset: dash }}
              transition={{ duration: 1.8, ease: 'easeOut', delay: 0.3 }}
              style={{
                filter: `drop-shadow(0 0 6px ${ringGlow})`,
                animation: isGoalMet ? 'ringPulse 1.5s ease-in-out infinite' : 'none',
              }}
            />
            {/* علامات النقاط على الحلقة */}
            {[0, 25, 50, 75].map((pctMark, i) => {
              const angle = (pctMark / 100) * 2 * Math.PI
              const x = 72 + r * Math.cos(angle)
              const y = 72 + r * Math.sin(angle)
              return (
                <circle key={i} cx={x} cy={y} r={2}
                  fill={pct >= pctMark ? ringColor : 'rgba(255,255,255,0.15)'} />
              )
            })}
          </svg>

          {/* النورس SVG */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              style={{
                animation: isGoalMet
                  ? 'seagullFloatGoal 2s ease-in-out infinite, goldGlow 1.5s ease-in-out infinite'
                  : 'seagullFloat 3.5s ease-in-out infinite',
              }}
            >
              <svg width="88" height="64" viewBox="0 0 130 90" fill="none">
                <defs>
                  <linearGradient id="sgBody" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={isGoalMet ? '#fef3c7' : '#ede9fe'} />
                    <stop offset="100%" stopColor={isGoalMet ? '#f59e0b' : '#8b5cf6'} />
                  </linearGradient>
                  <linearGradient id="sgWing" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%"   stopColor={isGoalMet ? '#fde68a' : '#f5f3ff'} />
                    <stop offset="60%"  stopColor={isGoalMet ? '#fbbf24' : '#c4b5fd'} />
                    <stop offset="100%" stopColor={isGoalMet ? '#d97706' : '#7c3aed'} />
                  </linearGradient>
                  <linearGradient id="sgHead" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={isGoalMet ? '#fefce8' : '#f5f3ff'} />
                    <stop offset="100%" stopColor={isGoalMet ? '#f59e0b' : '#a78bfa'} />
                  </linearGradient>
                  <linearGradient id="sgTail" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%"   stopColor={isGoalMet ? '#fbbf24' : '#8b5cf6'} />
                    <stop offset="100%" stopColor={isGoalMet ? '#d97706' : '#6d28d9'} />
                  </linearGradient>
                  <filter id="sgGlow">
                    <feGaussianBlur stdDeviation="1.5" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                </defs>

                {/* ظل الجسم */}
                <ellipse cx="62" cy="60" rx="17" ry="5" fill="rgba(0,0,0,0.25)" />

                {/* الجناح الأيسر — طبقات */}
                <path d="M48,50 C30,24 2,28 0,40 C18,34 36,38 50,46 Z"
                  fill="url(#sgWing)" opacity="0.85" />
                <path d="M48,52 C30,28 2,30 0,40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none" />
                <path d="M44,52 C28,34 8,32 2,40" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" fill="none" />

                {/* الجناح الأيمن */}
                <path d="M76,50 C94,24 122,28 124,40 C106,34 88,38 74,46 Z"
                  fill="url(#sgWing)" opacity="0.85" />
                <path d="M76,52 C94,28 122,30 124,40" stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" fill="none" />
                <path d="M80,52 C96,34 116,32 122,40" stroke="rgba(255,255,255,0.12)" strokeWidth="0.6" fill="none" />

                {/* الجسم */}
                <ellipse cx="62" cy="54" rx="17" ry="8" fill="url(#sgBody)" />
                {/* بريق الجسم */}
                <ellipse cx="58" cy="50" rx="8" ry="3.5" fill="rgba(255,255,255,0.22)" />

                {/* العنق */}
                <ellipse cx="74" cy="46" rx="8" ry="9" fill="url(#sgHead)" />

                {/* الرأس */}
                <circle cx="80" cy="37" r="13" fill="url(#sgHead)" />
                {/* بريق الرأس 3D */}
                <ellipse cx="75" cy="33" rx="6" ry="4.5" fill="rgba(255,255,255,0.3)" />

                {/* المنقار */}
                <path d="M91,35 L108,39 L91,43 Z"
                  fill={isGoalMet ? '#d97706' : '#f59e0b'} />
                <path d="M91,35 L108,39 L91,39.5 Z"
                  fill={isGoalMet ? '#92400e' : '#b45309'} />

                {/* العين */}
                <circle cx="85" cy="35" r="4" fill="#0a0118" />
                <circle cx="83.5" cy="33.5" r="1.5" fill="white" />
                <circle cx="86" cy="33" r="0.7" fill="rgba(255,255,255,0.5)" />

                {/* الذيل */}
                <path d="M46,56 L28,68 L37,65 L22,76 L46,60 Z"
                  fill="url(#sgTail)" opacity="0.9" />

                {/* ريشة التاج عند الهدف */}
                {isGoalMet && (
                  <g>
                    <path d="M76,26 L80,14 L84,26" fill="#fbbf24" opacity="0.8" />
                    <path d="M82,24 L88,12 L91,24" fill="#f59e0b" opacity="0.7" />
                    <path d="M70,25 L72,12 L77,25" fill="#fde68a" opacity="0.7" />
                  </g>
                )}
              </svg>
            </motion.div>
          </div>

          {/* تاج عند الهدف */}
          <AnimatePresence>
            {isGoalMet && (
              <motion.div
                initial={{ scale: 0, y: -10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl"
              >
                👑
              </motion.div>
            )}
          </AnimatePresence>

          {/* شارة العدد */}
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-black text-white border"
            style={{
              background:  isGoalMet ? 'rgba(245,158,11,0.25)' : 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(8px)',
              borderColor: isGoalMet ? 'rgba(251,191,36,0.5)' : 'rgba(255,255,255,0.1)',
              color:       isGoalMet ? '#fbbf24' : 'white',
            }}
          >
            {calls} / {DAILY_GOAL}
          </div>
        </div>

        {/* التسمية */}
        <motion.p
          className="text-sm font-black text-center"
          style={{ color: isGoalMet ? '#fbbf24' : pct >= 60 ? '#a78bfa' : '#7c3aed' }}
          animate={isGoalMet ? { scale: [1, 1.06, 1] } : {}}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {label}
        </motion.p>
      </div>
    </>
  )
}

// ── كرت المحفظة الذهبي ───────────────────────────────────────────
function WalletCard({ totalPoints, todayPoints }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="relative rounded-3xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #78350f, #92400e, #78350f)',
        boxShadow: '0 8px 40px rgba(245,158,11,0.35), 0 0 0 1px rgba(245,158,11,0.2)',
      }}
    >
      {/* بريق خلفي */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-6 -left-6 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl" />
        <div className="absolute -bottom-4 -right-4 w-28 h-28 bg-yellow-300/15 rounded-full blur-xl" />
        {/* شبكة لامعة */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 20px, rgba(255,255,255,0.1) 20px, rgba(255,255,255,0.1) 21px)',
          }}
        />
      </div>

      <div className="relative p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Wallet size={16} className="text-amber-300" />
              <span className="text-amber-300 text-xs font-bold tracking-wide uppercase">Nawras Wallet</span>
            </div>
            <p className="text-white/50 text-[10px]">رصيدك التراكمي</p>
          </div>
          <div className="text-3xl">🪙</div>
        </div>

        <div className="flex items-end gap-3">
          <div>
            <motion.p
              className="text-white font-black leading-none"
              style={{ fontSize: '2.6rem' }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
            >
              {totalPoints.toLocaleString()}
            </motion.p>
            <p className="text-amber-300/80 font-bold text-sm">NRS Points</p>
          </div>
          <div className="pb-1 mr-auto text-right">
            <p className="text-white/40 text-[10px]">اليوم</p>
            <p className="text-amber-300 font-black text-lg">+{todayPoints}</p>
          </div>
        </div>

        {/* شريط تلميع */}
        <motion.div
          className="absolute top-0 left-0 w-1/3 h-full"
          style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
          animate={{ x: ['0%', '300%'] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut', repeatDelay: 2 }}
        />
      </div>
    </motion.div>
  )
}

export default function MyPerformance() {
  const { user }  = useAuth()
  const {
    totalPoints, todayPoints, todayCalls,
    weekData, recent, goalPct, loading, loadError, reload,
  } = usePoints()

  // تحضير بيانات آخر 7 أيام
  const chartData = useMemo(() => {
    const map = {}
    weekData.forEach(d => { map[d.day] = parseInt(d.calls) })
    const result = []
    for (let i = 6; i >= 0; i--) {
      const date = new Date()
      date.setDate(date.getDate() - i)
      const key   = date.toISOString().slice(0, 10)
      const label = date.toLocaleDateString('ar-SA', { weekday: 'short' })
      result.push({ day: label, مكالمات: map[key] || 0, isToday: i === 0 })
    }
    return result
  }, [weekData])

  if (loading && totalPoints === 0 && todayCalls === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">جارٍ تحميل بياناتك...</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="text-4xl">⚠️</div>
        <p className="text-red-400 font-bold">{loadError}</p>
        <button
          onClick={reload}
          className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-bold transition-colors"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-5 pb-20" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ══ Hero Header ═══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="relative rounded-3xl overflow-hidden text-white p-5 lg:p-8"
        style={{
          background: goalPct >= 100
            ? 'linear-gradient(135deg, #1c0a00 0%, #3d1c00 35%, #1c0a00 100%)'
            : 'linear-gradient(135deg, #0d0320 0%, #1e0a3c 40%, #0a0318 100%)',
          boxShadow: goalPct >= 100
            ? '0 0 60px rgba(245,158,11,0.2), 0 20px 60px rgba(0,0,0,0.5)'
            : '0 20px 60px rgba(0,0,0,0.5)',
          transition: 'background 1s ease, box-shadow 1s ease',
        }}
      >
        {/* خلفية ضوئية */}
        <div
          className="absolute top-0 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000"
          style={{ background: goalPct >= 100 ? 'rgba(245,158,11,0.12)' : 'rgba(124,58,237,0.12)' }}
        />
        <div
          className="absolute -bottom-12 right-0 w-56 h-56 rounded-full blur-3xl pointer-events-none transition-all duration-1000"
          style={{ background: goalPct >= 100 ? 'rgba(251,191,36,0.08)' : 'rgba(109,40,217,0.08)' }}
        />
        {/* نقاط خلفية زخرفية */}
        <div className="absolute inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
          <SeagullCrown pct={goalPct} calls={todayCalls} />

          <div className="flex-1 text-center lg:text-right w-full">
            <h1 className="text-2xl font-black">أدائي اليومي</h1>
            <p className="text-white/50 text-sm mt-0.5">
              {user?.fullname} ·{' '}
              <span className="text-violet-300">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </p>

            <div className="grid grid-cols-3 gap-3 mt-4">
              {[
                { icon: Phone,   label: 'مكالمات اليوم', val: todayCalls,  color: '#a78bfa' },
                { icon: Zap,     label: 'نقاط اليوم',    val: todayPoints, color: '#fbbf24' },
                { icon: Star,    label: 'إجمالي النقاط',  val: totalPoints, color: '#34d399' },
              ].map(({ icon: Icon, label, val, color }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Icon size={14} className="mx-auto mb-1" style={{ color }} />
                  <p className="text-white text-xl font-black leading-none">{val}</p>
                  <p className="text-white/40 text-[10px] mt-0.5">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.button
            onClick={reload}
            disabled={loading}
            whileTap={{ scale: 0.9 }}
            className="lg:self-start flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/50 border border-white/10 hover:bg-white/8 transition-colors"
          >
            <RefreshCw size={11} className={loading ? 'animate-spin' : ''} />
            تحديث
          </motion.button>
        </div>
      </motion.div>

      {/* ══ محفظة NRS + عروض ════════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* المحفظة */}
        <div className="lg:col-span-3">
          <WalletCard totalPoints={totalPoints} todayPoints={todayPoints} />
        </div>

        {/* محرك العروض */}
        <div
          className="lg:col-span-2 rounded-3xl p-4 overflow-hidden"
          style={{
            background: 'linear-gradient(145deg, #0a0318, #120828)',
            border:     '1px solid rgba(124,58,237,0.18)',
            boxShadow:  '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <SmartAds />
        </div>
      </div>

      {/* ══ رسم بياني آخر 7 أيام ═══════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <TrendingUp size={14} className="text-violet-400" /> أداء الأسبوع
            </h2>
            <p className="text-white/30 text-xs mt-0.5">مكالماتي آخر 7 أيام</p>
          </div>
          <div className="text-xs text-white/40">
            إجمالي: <span className="text-white font-bold">{chartData.reduce((s, d) => s + d.مكالمات, 0)}</span>
          </div>
        </div>

        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <svg>
              <defs>
                <linearGradient id="barNorm" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" /><stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="barToday" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" /><stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff06" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#ffffff35', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="مكالمات" radius={[6, 6, 0, 0]} maxBarSize={38}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.isToday ? 'url(#barToday)' : 'url(#barNorm)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </motion.div>

      {/* ══ محطات الإنجاز ══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.25 }}
        className="rounded-2xl p-5"
        style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
      >
        <MilestonesSection />
      </motion.div>

      {/* ══ سجل المعاملات ══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Award size={14} className="text-amber-500" />
            سجل المعاملات
          </h2>
          <span className="text-xs text-slate-400">{recent.length} عملية</span>
        </div>

        {recent.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            لا توجد معاملات بعد — ابدأ الاتصال! 🚀
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((r, i) => {
              const isAd = r.reason?.startsWith('إعلان')
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 + i * 0.04 }}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
                    style={{
                      background: isAd
                        ? 'linear-gradient(135deg, #78350f, #92400e)'
                        : 'linear-gradient(135deg, #1e0a3c, #2d1466)',
                    }}
                  >
                    {isAd ? '🎁' : '🪙'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-800 font-semibold text-sm truncate">
                      {r.store_name || r.reason || 'مكالمة'}
                    </p>
                    <p className="text-slate-400 text-xs">{r.reason} · {new Date(r.created_at).toLocaleString('ar-SA')}</p>
                  </div>
                  <div
                    className="font-black text-sm px-2.5 py-1 rounded-xl flex-shrink-0"
                    style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}
                  >
                    +{r.points} NRS
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </motion.div>

    </div>
  )
}
