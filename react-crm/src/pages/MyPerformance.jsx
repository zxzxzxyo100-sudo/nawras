import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import { Zap, Phone, Star, RefreshCw, Award, TrendingUp } from 'lucide-react'
import { useAuth }   from '../contexts/AuthContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'

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
    <div className="flex flex-col items-center gap-3">
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

export default function MyPerformance() {
  const { user }  = useAuth()
  const {
    totalPoints, todayPoints, todayCalls,
    weekData, recent, goalPct, loading, reload,
  } = usePoints()

  // تحضير بيانات آخر 7 أيام للرسم البياني
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

  const maxCalls = Math.max(...chartData.map(d => d.مكالمات), 1)

  return (
    <div className="space-y-5 pb-8" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ══ Hero Header ═════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="relative rounded-3xl overflow-hidden text-white p-6 lg:p-8"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 55%, #1a0a4e 100%)' }}
      >
        {/* Blobs */}
        <div className="absolute top-0 left-1/4 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col lg:flex-row items-center lg:items-start gap-6 lg:gap-10">
          {/* خاتم الأداء */}
          <GoalRing pct={goalPct} calls={todayCalls} />

          {/* معلومات */}
          <div className="flex-1 text-center lg:text-right">
            <h1 className="text-2xl font-black">أدائي اليومي</h1>
            <p className="text-white/50 text-sm mt-0.5">
              {user?.fullname} •{' '}
              <span className="text-violet-300">{new Date().toLocaleDateString('ar-SA', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </p>

            {/* بطاقات الإحصاء */}
            <div className="grid grid-cols-3 gap-3 mt-5">
              {[
                { icon: Phone,    label: 'مكالمات اليوم', val: todayCalls,   color: '#a78bfa' },
                { icon: Zap,      label: 'نقاط اليوم',    val: todayPoints,  color: '#fbbf24' },
                { icon: Star,     label: 'إجمالي النقاط',  val: totalPoints,  color: '#34d399' },
              ].map(({ icon: Icon, label, val, color }) => (
                <motion.div
                  key={label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Icon size={16} className="mx-auto mb-1.5" style={{ color }} />
                  <p className="text-white text-xl font-black leading-none">{val}</p>
                  <p className="text-white/40 text-[10px] mt-1">{label}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* بادج NRS + زر تحديث */}
          <div className="flex flex-col items-center gap-3">
            <div
              className="rounded-2xl px-4 py-3 text-center"
              style={{ background: 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <p className="text-amber-400 text-xs font-medium">رصيدك</p>
              <p className="text-white text-2xl font-black">{totalPoints}</p>
              <p className="text-amber-400/70 text-xs">NRS</p>
            </div>
            <motion.button
              onClick={reload}
              disabled={loading}
              whileTap={{ scale: 0.9 }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-white/60 border border-white/10 hover:bg-white/10 transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              تحديث
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ══ رسم بياني آخر 7 أيام ════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="rounded-2xl p-5 lg:p-6"
        style={{ background: 'linear-gradient(145deg, #0f0820, #160d2e)' }}
      >
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-white font-bold text-sm flex items-center gap-2">
              <TrendingUp size={15} className="text-violet-400" />
              أداء الأسبوع
            </h2>
            <p className="text-white/30 text-xs mt-0.5">مكالماتي آخر 7 أيام</p>
          </div>
          <div className="text-xs text-white/40">
            إجمالي: <span className="text-white font-bold">{chartData.reduce((s, d) => s + d.مكالمات, 0)}</span> مكالمة
          </div>
        </div>

        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 5, right: 5, bottom: 0, left: -25 }}>
            <svg>
              <defs>
                <linearGradient id="myBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" />
                  <stop offset="100%" stopColor="#6d28d9" />
                </linearGradient>
                <linearGradient id="myBarToday" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fbbf24" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
              </defs>
            </svg>
            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
            <XAxis dataKey="day" tick={{ fill: '#ffffff40', fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#ffffff40', fontSize: 9 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="مكالمات" radius={[6, 6, 0, 0]} maxBarSize={40}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.isToday ? 'url(#myBarToday)' : 'url(#myBar)'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        {/* مفتاح الألوان */}
        <div className="flex items-center gap-4 mt-3 justify-end">
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span className="w-3 h-2 rounded bg-violet-500 inline-block" /> أيام سابقة
          </div>
          <div className="flex items-center gap-1.5 text-xs text-white/40">
            <span className="w-3 h-2 rounded bg-amber-400 inline-block" /> اليوم
          </div>
        </div>
      </motion.div>

      {/* ══ آخر المكالمات ════════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.35 }}
        className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
          <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Award size={15} className="text-violet-600" />
            آخر المكالمات المسجلة
          </h2>
          <span className="text-xs text-slate-400">{recent.length} مكالمة</span>
        </div>

        {recent.length === 0 ? (
          <div className="py-10 text-center text-slate-400 text-sm">
            لا توجد مكالمات بعد — ابدأ الآن! 🚀
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {recent.map((r, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 + i * 0.04 }}
                className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 transition-colors"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black text-white flex-shrink-0"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                >
                  🪙
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-800 font-semibold text-sm truncate">{r.store_name || 'متجر'}</p>
                  <p className="text-slate-400 text-xs">{r.reason} • {new Date(r.created_at).toLocaleString('ar-SA')}</p>
                </div>
                <div
                  className="text-sm font-black px-2 py-1 rounded-lg flex-shrink-0"
                  style={{ background: 'rgba(245,158,11,0.1)', color: '#d97706' }}
                >
                  +{r.points} NRS
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
