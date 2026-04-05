import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ── عملة ذهبية واحدة ─────────────────────────────────────────────
function Coin({ x, delay, points }) {
  return (
    <motion.div
      className="fixed z-[9999] pointer-events-none select-none"
      style={{ left: `${x}%`, bottom: '10%' }}
      initial={{ y: 0, opacity: 1, scale: 0.6, rotate: -20 }}
      animate={{ y: -320, opacity: 0, scale: 1.2, rotate: 20 }}
      transition={{ duration: 1.2, delay, ease: [0.2, 0.8, 0.4, 1] }}
    >
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center text-xl font-black shadow-2xl"
        style={{
          background: 'radial-gradient(circle at 35% 35%, #fde68a, #f59e0b 50%, #b45309)',
          boxShadow: '0 0 20px rgba(245,158,11,0.8), 0 0 40px rgba(245,158,11,0.4)',
          border: '2px solid #fbbf24',
          textShadow: '0 1px 2px rgba(0,0,0,0.4)',
        }}
      >
        ن
      </div>
      {points && (
        <motion.div
          className="absolute -top-6 left-1/2 -translate-x-1/2 text-amber-400 font-black text-sm whitespace-nowrap"
          style={{ textShadow: '0 0 8px rgba(245,158,11,0.9)' }}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: delay + 0.1 }}
        >
          +{points} NRS
        </motion.div>
      )}
    </motion.div>
  )
}

// ── تأثير احتفالي عند بلوغ الهدف ─────────────────────────────────
function JackpotOverlay({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 3500)
    return () => clearTimeout(t)
  }, [onDone])

  const confetti = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    color: ['#7c3aed','#f59e0b','#10b981','#ec4899','#3b82f6'][i % 5],
    delay: Math.random() * 0.8,
    size: 8 + Math.random() * 14,
  }))

  return (
    <motion.div
      className="fixed inset-0 z-[9998] flex items-center justify-center pointer-events-none"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* خلفية */}
      <div className="absolute inset-0 bg-black/40" />

      {/* حبوب الاحتفال */}
      {confetti.map(c => (
        <motion.div
          key={c.id}
          className="absolute rounded-full"
          style={{ left: `${c.x}%`, top: '-2%', width: c.size, height: c.size, background: c.color }}
          animate={{ y: '110vh', rotate: 720, opacity: [1, 1, 0] }}
          transition={{ duration: 2.5 + Math.random(), delay: c.delay, ease: 'easeIn' }}
        />
      ))}

      {/* البطاقة الاحتفالية */}
      <motion.div
        className="relative rounded-3xl p-8 text-center text-white mx-4 max-w-xs w-full"
        style={{ background: 'linear-gradient(135deg, #1e0a3c, #2d1466)' }}
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.2 }}
      >
        {/* تاج */}
        <motion.div
          className="text-6xl mb-2"
          animate={{ rotate: [-10, 10, -10] }}
          transition={{ duration: 0.5, repeat: 4 }}
        >
          👑
        </motion.div>

        <motion.h2
          className="text-2xl font-black mb-1"
          style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6, repeat: 2 }}
        >
          أحسنت! 🎉
        </motion.h2>

        <p className="text-white/80 text-sm font-medium mb-4">بلغت هدفك اليومي!</p>

        <div
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-lg"
          style={{ background: 'linear-gradient(135deg, #f59e0b, #b45309)', boxShadow: '0 8px 30px rgba(245,158,11,0.5)' }}
        >
          🪙 محترف النورس
        </div>

        <p className="text-white/40 text-xs mt-4">
          يُغلق تلقائياً...
        </p>
      </motion.div>
    </motion.div>
  )
}

// ── المكون الرئيسي الذي يُستدعى بعد حفظ المكالمة ─────────────────
export default function GoldCoinAnimation({ trigger, points = 10, showJackpot = false, onJackpotDone }) {
  const [coins, setCoins] = useState([])
  const [jackpot, setJackpot] = useState(false)

  useEffect(() => {
    if (!trigger) return
    // أطلق 5 عملات بمواضع عشوائية
    const batch = Array.from({ length: 5 }, (_, i) => ({
      id: `${trigger}-${i}`,
      x: 30 + Math.random() * 40,
      delay: i * 0.12,
      points: i === 2 ? points : null,
    }))
    setCoins(batch)
    const t = setTimeout(() => setCoins([]), 2000)

    if (showJackpot) {
      const jt = setTimeout(() => setJackpot(true), 400)
      return () => { clearTimeout(t); clearTimeout(jt) }
    }
    return () => clearTimeout(t)
  }, [trigger, points, showJackpot])

  return (
    <AnimatePresence>
      {coins.map(c => (
        <Coin key={c.id} x={c.x} delay={c.delay} points={c.points} />
      ))}
      {jackpot && (
        <JackpotOverlay
          key="jackpot"
          onDone={() => { setJackpot(false); onJackpotDone?.() }}
        />
      )}
    </AnimatePresence>
  )
}
