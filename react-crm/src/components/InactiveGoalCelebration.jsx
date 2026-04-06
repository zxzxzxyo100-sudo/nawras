import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import confetti from 'canvas-confetti'
import { Trophy, Sparkles, X } from 'lucide-react'

function celebrationStorageKey(username) {
  const d = new Date().toISOString().slice(0, 10)
  return `nawras_inactive_goal_celebration_${username}_${d}`
}

function playAchievementChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    o.type = 'sine'
    o.frequency.setValueAtTime(523.25, ctx.currentTime)
    g.gain.setValueAtTime(0.06, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    o.start(ctx.currentTime)
    o.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), 500)
  } catch {
    /* ignore */
  }
}

function runConfettiBurst() {
  const duration = 3000
  const end = Date.now() + duration
  const colors = ['#7c3aed', '#a855f7', '#f59e0b', '#10b981', '#38bdf8']

  const frame = () => {
    confetti({
      particleCount: 4,
      spread: 70,
      origin: { y: 0.65, x: Math.random() * 0.4 + 0.3 },
      colors,
      ticks: 200,
      gravity: 1.1,
      scalar: 1.05,
    })
    if (Date.now() < end) {
      requestAnimationFrame(frame)
    }
  }
  frame()
}

/**
 * احتفال عند بلوغ 50 اتصالاً ناجحاً — مرة واحدة يومياً (localStorage)
 */
export default function InactiveGoalCelebration({
  username,
  successfulCount = 0,
  target = 50,
  dailyTargetReached = false,
  /** زيادة عند استجابة API goal_just_met لإعادة تقييم */
  burstNonce = 0,
}) {
  const [showModal, setShowModal] = useState(false)

  const runCelebration = useCallback(() => {
    playAchievementChime()
    runConfettiBurst()
    setShowModal(true)
  }, [])

  useEffect(() => {
    if (!username || !dailyTargetReached || successfulCount < target) return
    const key = celebrationStorageKey(username)
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    runCelebration()
  }, [username, dailyTargetReached, successfulCount, target, burstNonce, runCelebration])

  const closeModal = () => setShowModal(false)

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {showModal && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="inactive-goal-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          dir="rtl"
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 320 }}
            onClick={e => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border-2 border-amber-300/90 bg-gradient-to-br from-amber-50 via-white to-violet-50 shadow-2xl shadow-amber-900/20"
            style={{ fontFamily: "'Cairo', sans-serif" }}
          >
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-l from-amber-400 via-violet-500 to-emerald-400" />
            <button
              type="button"
              onClick={closeModal}
              className="absolute top-3 left-3 z-10 p-2 rounded-xl text-slate-500 hover:bg-slate-100/80"
              aria-label="إغلاق"
            >
              <X size={18} />
            </button>
            <div className="px-6 pt-10 pb-6 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30">
                <Trophy size={34} className="text-white drop-shadow" />
              </div>
              <div className="flex items-center justify-center gap-2 mb-2">
                <Sparkles className="text-violet-500" size={22} />
                <h2 id="inactive-goal-title" className="text-xl font-black text-slate-900">
                  أحسنت يا بطل! 🚀
                </h2>
                <Sparkles className="text-amber-500" size={22} />
              </div>
              <p className="text-slate-700 text-sm leading-relaxed font-medium">
                لقد أتممت حصتك اليومية (50 مكالمة محققة) بنجاح. فخورون بإنتاجيتك اليوم في شركة النورس!
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="mt-6 w-full py-3 rounded-2xl font-black text-white bg-gradient-to-l from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 shadow-lg shadow-violet-500/25 transition-colors"
              >
                متابعة العمل
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}

/** شارة + ألوان ذهبية عند تحقيق الهدف */
export function InactiveGoalCounterBadge({
  successfulCount = 0,
  target = 50,
  dailyTargetReached = false,
  className = '',
}) {
  if (!dailyTargetReached) {
    return (
      <span className={`tabular-nums font-bold ${className}`}>
        {successfulCount.toLocaleString('ar-SA')} / {target}
      </span>
    )
  }
  return (
    <span className={`inline-flex flex-wrap items-center gap-2 ${className}`}>
      <span
        className="tabular-nums font-black bg-gradient-to-l from-amber-600 via-yellow-500 to-amber-600 bg-clip-text text-transparent drop-shadow-sm"
        style={{ WebkitBackgroundClip: 'text' }}
      >
        {successfulCount.toLocaleString('ar-SA')} / {target}
      </span>
      <span className="text-[11px] font-black px-2.5 py-1 rounded-full border border-amber-400/90 bg-gradient-to-b from-amber-100 to-amber-200 text-amber-950 shadow-sm">
        هدف محقق
      </span>
    </span>
  )
}
