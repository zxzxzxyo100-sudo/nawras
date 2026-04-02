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

// ── خاتم الأداء اليومي ───────────────────────────────────────────
function GoalRing({ pct, calls }) {
  const color = pct >= 100 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#8b5cf6'
  const glow  = pct >= 100 ? '#10b98180' : pct >= 60 ? '#f59e0b80' : '#8b5cf680'
  const label = pct >= 100 ? '🏆 أكملت الهدف!' : pct >= 60 ? '💪 أنت في المسار' : '🎯 هيا نبدأ!'
  const r     = 52
  const circ  = 2 * Math.PI * r
  const dash  = circ - (Math.min(pct, 100) / 100) * circ

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-32">
        <svg width="128" height="128" viewBox="0 0 128 128" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="64" cy="64" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
          <motion.circle
            cx="64" cy="64" r={r} fill="none"
            stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: dash }}
            transition={{ duration: 1.6, ease: 'easeOut', delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 10px ${glow})` }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.p
            className="text-white text-3xl font-black leading-none"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.5 }}
          >
            {calls}
          </motion.p>
          <p className="text-white/40 text-[10px] mt-0.5">/ {DAILY_GOAL}</p>
        </div>
      </div>
      <p className="text-sm font-bold" style={{ color }}>{label}</p>
    </div>
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
        className="relative rounded-3xl overflow-hidden text-white p-5 lg:p-7"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 55%, #1a0a4e 100%)' }}
      >
        <div className="absolute top-0 left-1/4 w-60 h-60 bg-violet-600/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-48 h-48 bg-amber-500/8 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row items-center gap-6 lg:gap-8">
          <GoalRing pct={goalPct} calls={todayCalls} />

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

      {/* ══ محفظة NRS + إعلانات ════════════════════════════════════ */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* المحفظة */}
        <div className="lg:col-span-3">
          <WalletCard totalPoints={totalPoints} todayPoints={todayPoints} />
        </div>

        {/* الإعلانات */}
        <div
          className="lg:col-span-2 rounded-3xl p-4"
          style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <Zap size={13} className="text-amber-400" />
            <span className="text-white font-bold text-xs">عروض النورس الذكية</span>
            <span className="mr-auto text-[10px] text-white/30">نقاط مجانية</span>
          </div>
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
