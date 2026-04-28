import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, CheckCircle, Zap, Trophy, Star } from 'lucide-react'
import { usePoints } from '../contexts/PointsContext'

// ── CSS keyframes مدمجة ────────────────────────────────────────────
const ANIM_STYLES = `
@keyframes truckRide {
  0%   { transform: translateX(-14px) scaleX(1); }
  49%  { transform: translateX(14px)  scaleX(1); }
  50%  { transform: translateX(14px)  scaleX(-1); }
  99%  { transform: translateX(-14px) scaleX(-1); }
  100% { transform: translateX(-14px) scaleX(1); }
}
@keyframes coinSpin {
  0%   { transform: rotateY(0deg)   scale(1);   }
  40%  { transform: rotateY(180deg) scale(1.25); }
  80%  { transform: rotateY(360deg) scale(1);   }
  100% { transform: rotateY(360deg) scale(1);   }
}
@keyframes coinFloat {
  0%, 100% { transform: translateY(0px)   rotate(-8deg); }
  50%       { transform: translateY(-10px) rotate(8deg);  }
}
@keyframes seagullSoar {
  0%   { transform: translateY(0px)   rotate(-6deg) scale(1);    }
  25%  { transform: translateY(-14px) rotate(4deg)  scale(1.08); }
  50%  { transform: translateY(-8px)  rotate(-3deg) scale(1.04); }
  75%  { transform: translateY(-18px) rotate(6deg)  scale(1.1);  }
  100% { transform: translateY(0px)   rotate(-6deg) scale(1);    }
}
@keyframes shimmerSlide {
  0%   { left: -60%; }
  100% { left: 130%;  }
}
@keyframes unlockPulse {
  0%   { box-shadow: 0 0 0 0   rgba(245,158,11,0.7); }
  70%  { box-shadow: 0 0 0 12px rgba(245,158,11,0);  }
  100% { box-shadow: 0 0 0 0   rgba(245,158,11,0);   }
}
@keyframes lockShake {
  0%, 100% { transform: rotate(0deg); }
  20%       { transform: rotate(-12deg); }
  40%       { transform: rotate(12deg); }
  60%       { transform: rotate(-8deg); }
  80%       { transform: rotate(8deg); }
}
`

// ── بيانات الـ Milestones ─────────────────────────────────────────
export const MILESTONES = [
  {
    id:        1,
    threshold: 100,
    title:     'بونص الشحن السريع',
    desc:      'كل طرد تشحنه يُضاعف النقاط لمدة 24 ساعة',
    animation: 'truck',
    gradient:  'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)',
    glow:      'rgba(37,99,235,0.55)',
    accent:    '#93c5fd',
    lockedBg:  'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
    emoji:     '🚚',
  },
  {
    id:        2,
    threshold: 200,
    title:     'مضاعف الراتب اليومي',
    desc:      'مكالماتك اليوم تُحتسب بنقاط مضاعفة ×2',
    animation: 'coins',
    gradient:  'linear-gradient(135deg, #78350f 0%, #b45309 50%, #d97706 100%)',
    glow:      'rgba(245,158,11,0.55)',
    accent:    '#fbbf24',
    lockedBg:  'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
    emoji:     '💰',
  },
  {
    id:        3,
    threshold: 300,
    title:     'دخول الترتيب العالمي',
    desc:      'اسمك يُضاء في قائمة شرف النورس الذهبية',
    animation: 'seagull',
    gradient:  'linear-gradient(135deg, #3b0764 0%, #6d28d9 50%, #7c3aed 100%)',
    glow:      'rgba(124,58,237,0.55)',
    accent:    '#c4b5fd',
    lockedBg:  'linear-gradient(135deg, #1c1c2e, #2a2a3e)',
    emoji:     '🦅',
  },
]

// ── أنيميشن الشاحنة ────────────────────────────────────────────────
function TruckAnim() {
  return (
    <div className="flex items-center justify-center h-20 overflow-hidden relative">
      {/* طريق */}
      <div
        className="absolute bottom-2 left-0 right-0 h-1 rounded-full opacity-30"
        style={{ background: 'repeating-linear-gradient(90deg, #93c5fd 0px, #93c5fd 12px, transparent 12px, transparent 22px)' }}
      />
      <div className="text-5xl" style={{ animation: 'truckRide 2.4s ease-in-out infinite', display: 'inline-block' }}>
        🚚
      </div>
    </div>
  )
}

// ── أنيميشن العملات ────────────────────────────────────────────────
function CoinsAnim() {
  const coins = [
    { delay: '0s',    size: '2.5rem', top: '10%',  left: '15%' },
    { delay: '0.5s',  size: '2rem',   top: '40%',  left: '55%' },
    { delay: '0.9s',  size: '3rem',   top: '15%',  left: '65%' },
    { delay: '0.3s',  size: '1.8rem', top: '55%',  left: '30%' },
    { delay: '0.7s',  size: '2.2rem', top: '45%',  left: '80%' },
  ]
  return (
    <div className="relative h-20 overflow-hidden">
      {coins.map((c, i) => (
        <div
          key={i}
          className="absolute select-none"
          style={{
            fontSize:        c.size,
            top:             c.top,
            left:            c.left,
            animation:       `coinFloat 2s ease-in-out infinite`,
            animationDelay:  c.delay,
          }}
        >
          🪙
        </div>
      ))}
    </div>
  )
}

// ── أنيميشن النورس ─────────────────────────────────────────────────
function SeagullAnim() {
  return (
    <div className="flex flex-col items-center justify-center h-20 gap-1">
      <div className="text-5xl" style={{ animation: 'seagullSoar 3s ease-in-out infinite', display: 'inline-block' }}>
        🦅
      </div>
      {/* نجوم تتلألأ */}
      <div className="flex gap-2">
        {[0, 0.4, 0.8].map((d, i) => (
          <Star
            key={i}
            size={10}
            fill="#c4b5fd"
            className="text-violet-300"
            style={{ animation: `coinFloat ${1.5 + i * 0.3}s ease-in-out infinite`, animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </div>
  )
}

function getAnim(type) {
  if (type === 'truck')  return <TruckAnim />
  if (type === 'coins')  return <CoinsAnim />
  if (type === 'seagull') return <SeagullAnim />
  return null
}

// ── كرت ميلستون واحد ─────────────────────────────────────────────
function MilestoneCard({ milestone, currentPoints }) {
  const isUnlocked   = currentPoints >= milestone.threshold
  const prevRef      = useRef(isUnlocked)
  const [flipping,   setFlipping]   = useState(false)
  const [showBurst,  setShowBurst]  = useState(false)

  const progress = Math.min(100, Math.round((currentPoints / milestone.threshold) * 100))

  // كشف لحظة الفتح وتشغيل الأنيميشن
  useEffect(() => {
    if (isUnlocked && !prevRef.current) {
      setFlipping(true)
      setShowBurst(true)
      setTimeout(() => setFlipping(false), 900)
      setTimeout(() => setShowBurst(false), 1800)
    }
    prevRef.current = isUnlocked
  }, [isUnlocked])

  return (
    <motion.div
      animate={flipping ? { rotateY: [0, 90, 0], scale: [1, 1.05, 1] } : {}}
      transition={{ duration: 0.9, ease: 'easeInOut' }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background:   isUnlocked ? milestone.gradient : milestone.lockedBg,
        boxShadow:    isUnlocked ? `0 8px 30px ${milestone.glow}` : '0 2px 12px rgba(0,0,0,0.4)',
        border:       isUnlocked ? `1px solid ${milestone.accent}30` : '1px solid rgba(255,255,255,0.07)',
        filter:       isUnlocked ? 'none' : 'grayscale(85%) brightness(0.75)',
        transition:   'filter 0.6s ease, background 0.6s ease, box-shadow 0.6s ease',
        minHeight:    220,
      }}
    >
      {/* انفجار نقاط عند الفتح */}
      <AnimatePresence>
        {showBurst && (
          <motion.div
            initial={{ opacity: 1, scale: 0.3 }}
            animate={{ opacity: 0, scale: 2.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="absolute inset-0 rounded-2xl pointer-events-none z-20"
            style={{ background: `radial-gradient(circle, ${milestone.accent}60 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* بريق خلفي للكروت المفتوحة */}
      {isUnlocked && (
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl"
          style={{ zIndex: 0 }}
        >
          <div className="absolute top-0 left-0 w-full h-full"
            style={{
              background: `radial-gradient(ellipse at top left, ${milestone.accent}18 0%, transparent 60%)`,
            }}
          />
          {/* شريط لمعان */}
          <div
            className="absolute top-0 h-full w-16 opacity-20"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
              animation: 'shimmerSlide 3s ease-in-out infinite',
            }}
          />
        </div>
      )}

      <div className="relative z-10 p-4 flex flex-col h-full" style={{ minHeight: 220 }}>
        {/* رأس الكرت */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p
              className="text-xs font-bold uppercase tracking-wider mb-0.5"
              style={{ color: isUnlocked ? milestone.accent : 'rgba(255,255,255,0.3)' }}
            >
              {milestone.threshold} NRS
            </p>
            <h3
              className="font-black text-sm leading-tight"
              style={{ color: isUnlocked ? '#fff' : 'rgba(255,255,255,0.4)' }}
            >
              {milestone.title}
            </h3>
          </div>

          {/* أيقونة القفل / الفتح */}
          <motion.div
            animate={!isUnlocked && flipping === false ? {} : {}}
            className="flex-shrink-0"
          >
            {isUnlocked ? (
              <motion.div
                initial={{ scale: 0, rotate: -45 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15 }}
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${milestone.accent}40, ${milestone.accent}20)`,
                  border: `1px solid ${milestone.accent}50`,
                  animation: showBurst ? 'unlockPulse 0.6s ease-out' : 'none',
                }}
              >
                <CheckCircle size={18} style={{ color: milestone.accent }} />
              </motion.div>
            ) : (
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
              >
                <Lock size={16} className="text-amber-400" style={{ animation: 'lockShake 2.5s ease-in-out infinite 2s' }} />
              </div>
            )}
          </motion.div>
        </div>

        {/* منطقة الأنيميشن */}
        <div className="flex-1">
          {isUnlocked ? (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              {getAnim(milestone.animation)}
            </motion.div>
          ) : (
            <div className="flex items-center justify-center h-20 text-5xl opacity-20">
              {milestone.emoji}
            </div>
          )}
        </div>

        {/* الوصف */}
        <p
          className="text-[11px] leading-relaxed mt-2"
          style={{ color: isUnlocked ? `${milestone.accent}cc` : 'rgba(255,255,255,0.25)' }}
        >
          {isUnlocked ? milestone.desc : `أكمل ${milestone.threshold} نقطة للفتح`}
        </p>

        {/* شريط التقدم */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span
              className="text-[10px] font-medium"
              style={{ color: isUnlocked ? milestone.accent : 'rgba(255,255,255,0.3)' }}
            >
              {isUnlocked ? '✅ مفتوح!' : `${currentPoints < milestone.threshold ? currentPoints : milestone.threshold} / ${milestone.threshold}`}
            </span>
            <span
              className="text-[10px] font-black"
              style={{ color: isUnlocked ? milestone.accent : 'rgba(255,255,255,0.4)' }}
            >
              {progress}%
            </span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: isUnlocked
                  ? `linear-gradient(90deg, ${milestone.accent}, #fff8)`
                  : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: 0.2 }}
            />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────
export default function MilestonesSection() {
  const { totalPoints } = usePoints()

  return (
    <>
      {/* حقن CSS الأنيميشن مرة واحدة */}
      <style dangerouslySetInnerHTML={{ __html: ANIM_STYLES }} />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        {/* رأس القسم */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-black text-white text-base flex items-center gap-2">
              <Trophy size={16} className="text-amber-400" />
              محطات الإنجاز
            </h2>
            <p className="text-white/30 text-xs mt-0.5">افتح المكافآت بتراكم النقاط</p>
          </div>

          {/* مؤشر التقدم الكلي */}
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black"
            style={{
              background: 'rgba(245,158,11,0.12)',
              border: '1px solid rgba(245,158,11,0.25)',
              color: '#fbbf24',
            }}
          >
            <Zap size={11} />
            {totalPoints} NRS
          </div>
        </div>

        {/* شبكة الكروت */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {MILESTONES.map((m, i) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1 }}
            >
              <MilestoneCard milestone={m} currentPoints={totalPoints} />
            </motion.div>
          ))}
        </div>

        {/* مسار النقاط الخطي */}
        <div className="mt-5 rounded-2xl p-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <div className="text-xs text-white/40 flex-shrink-0 w-12 text-left font-mono">
              {totalPoints}
            </div>
            <div className="flex-1 relative h-3">
              {/* خلفية المسار */}
              <div className="absolute inset-0 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }} />

              {/* تعبئة المسار */}
              <motion.div
                className="absolute top-0 left-0 h-full rounded-full"
                style={{
                  background: 'linear-gradient(90deg, #3b82f6, #f59e0b, #7c3aed)',
                  maxWidth: '100%',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.round((totalPoints / 300) * 100))}%` }}
                transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
              />

              {/* علامات الـ Milestones */}
              {MILESTONES.map(m => {
                const pct = (m.threshold / 300) * 100
                const reached = totalPoints >= m.threshold
                return (
                  <div
                    key={m.id}
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                    style={{ left: `${pct}%` }}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full border-2 flex items-center justify-center text-[8px]"
                      style={{
                        background:   reached ? '#f59e0b' : '#1e1333',
                        borderColor:  reached ? '#fbbf24' : 'rgba(255,255,255,0.2)',
                        boxShadow:    reached ? '0 0 8px #f59e0b80' : 'none',
                      }}
                      animate={reached ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.5 }}
                    >
                      {reached && '✓'}
                    </motion.div>
                  </div>
                )
              })}
            </div>
            <div className="text-xs text-white/40 flex-shrink-0 w-12 text-right font-mono">
              300
            </div>
          </div>

          {/* تسميات المحطات */}
          <div className="flex justify-around mt-2">
            {MILESTONES.map(m => (
              <div key={m.id} className="text-center">
                <p
                  className="text-[9px] font-bold"
                  style={{ color: totalPoints >= m.threshold ? '#fbbf24' : 'rgba(255,255,255,0.25)' }}
                >
                  {m.emoji} {m.threshold}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>
    </>
  )
}
