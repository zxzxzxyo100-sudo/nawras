import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, CheckCircle, Gift, Zap, Star } from 'lucide-react'
import { awardBonus } from '../services/api'
import { useAuth }    from '../contexts/AuthContext'
import { usePoints }  from '../contexts/PointsContext'

// ── CSS Keyframes ──────────────────────────────────────────────────
const ANIM_CSS = `
@keyframes planeSweep {
  0%   { transform: translateX(110%) scaleX(1);  }
  48%  { transform: translateX(-110%) scaleX(1);  }
  50%  { transform: translateX(-110%) scaleX(-1); }
  98%  { transform: translateX(110%) scaleX(-1);  }
  100% { transform: translateX(110%) scaleX(1);   }
}
@keyframes truckRoll {
  0%   { transform: translateX(105%); }
  100% { transform: translateX(-105%); }
}
@keyframes coinFall {
  0%   { transform: translateY(-24px) rotateY(0deg);   opacity: 1; }
  100% { transform: translateY(56px)  rotateY(360deg); opacity: 0; }
}
@keyframes binanceSpin {
  0%   { transform: rotateY(0deg)   scale(1);    }
  50%  { transform: rotateY(180deg) scale(1.25); }
  100% { transform: rotateY(360deg) scale(1);    }
}
@keyframes glowPulse {
  0%, 100% { opacity: 0.25; transform: scale(1);    }
  50%       { opacity: 0.55; transform: scale(1.12); }
}
@keyframes unlockBurst {
  0%   { opacity: 1; transform: scale(0.4); }
  60%  { opacity: 0.7; transform: scale(1.8); }
  100% { opacity: 0; transform: scale(2.4); }
}
@keyframes slideInOffer {
  from { opacity: 0; transform: translateY(16px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0)    scale(1);    }
}
@keyframes shimmer {
  0%   { left: -60%; }
  100% { left: 130%;  }
}
`

// ── بيانات العروض (3 مستويات) ─────────────────────────────────────
const OFFERS = [
  {
    id:          'offer_shipping_100',
    requiredPts: 100,
    title:       'العرض 1: شحن سريع ✈️',
    shortTitle:  'شحن سريع',
    desc:        'كل طرد تشحنه اليوم يُضاعف نقاطك تلقائياً',
    cta:         '15 NRS — استلم',
    points:      15,
    gradient:    'linear-gradient(135deg, #0f2a6b 0%, #1e40af 60%, #1d4ed8 100%)',
    glow:        'rgba(37,99,235,0.6)',
    accent:      '#60a5fa',
    bgColor:     '#0f1e4a',
  },
  {
    id:          'offer_salary_200',
    requiredPts: 200,
    title:       'العرض 2: بونص راتب 💰',
    shortTitle:  'بونص راتب',
    desc:        'أداؤك اليوم يُحتسب ضعفين في الراتب الشهري',
    cta:         '20 NRS — استلم',
    points:      20,
    gradient:    'linear-gradient(135deg, #451a03 0%, #92400e 60%, #b45309 100%)',
    glow:        'rgba(245,158,11,0.6)',
    accent:      '#fbbf24',
    bgColor:     '#3d1c02',
  },
  {
    id:          'offer_withdraw_300',
    requiredPts: 300,
    title:       'العرض 3: سحب فوري ⚡',
    shortTitle:  'سحب فوري',
    desc:        'حوّل نقاطك إلى مكافأة نقدية فورية عبر المنصة',
    cta:         '25 NRS — استلم',
    points:      25,
    gradient:    'linear-gradient(135deg, #022c22 0%, #065f46 60%, #047857 100%)',
    glow:        'rgba(16,185,129,0.6)',
    accent:      '#34d399',
    bgColor:     '#012018',
  },
]

// ── خلفية الشاحنة والطائرة (عرض 1) ───────────────────────────────
function ShippingBg({ accent }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {/* طائرة */}
      <div className="absolute top-3 left-0 right-0"
        style={{ animation: 'planeSweep 5s linear infinite' }}>
        <span style={{ fontSize: 20 }}>✈️</span>
      </div>
      {/* شاحنة */}
      <div className="absolute bottom-8 left-0 right-0"
        style={{ animation: 'truckRoll 4s linear infinite', animationDelay: '2s' }}>
        <span style={{ fontSize: 18 }}>🚚</span>
      </div>
      {/* خط الطريق */}
      <div className="absolute bottom-10 left-0 right-0 h-px opacity-20"
        style={{ background: `repeating-linear-gradient(90deg, ${accent} 0, ${accent} 10px, transparent 10px, transparent 20px)` }}
      />
    </div>
  )
}

// ── خلفية العملات الذهبية (عرض 2) ────────────────────────────────
function CoinsBg() {
  const coins = [
    { l: '10%', d: '0s',    sz: 18 },
    { l: '30%', d: '0.6s',  sz: 22 },
    { l: '55%', d: '1.1s',  sz: 16 },
    { l: '72%', d: '0.3s',  sz: 20 },
    { l: '88%', d: '0.9s',  sz: 24 },
  ]
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {coins.map((c, i) => (
        <div
          key={i}
          className="absolute top-0"
          style={{
            left: c.l,
            fontSize: c.sz,
            animation: `coinFall 2.2s ease-in infinite`,
            animationDelay: c.d,
          }}
        >
          🪙
        </div>
      ))}
    </div>
  )
}

// ── خلفية Binance / سحب (عرض 3) ──────────────────────────────────
function WithdrawBg({ accent }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none rounded-2xl">
      {/* دوائر ضوئية */}
      <div
        className="absolute top-2 right-4 w-16 h-16 rounded-full"
        style={{ background: `${accent}25`, animation: 'glowPulse 2s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-4 left-6 w-10 h-10 rounded-full"
        style={{ background: `${accent}20`, animation: 'glowPulse 2.5s ease-in-out infinite', animationDelay: '0.8s' }}
      />
      {/* رمز العملة يدور */}
      <div
        className="absolute top-3 left-1/2 -translate-x-1/2 text-3xl"
        style={{ animation: 'binanceSpin 3s ease-in-out infinite' }}
      >
        💎
      </div>
      {/* نجوم تومض */}
      {[...Array(4)].map((_, i) => (
        <Star
          key={i}
          size={8}
          fill={accent}
          style={{
            position: 'absolute',
            color:    accent,
            top:  `${20 + i * 18}%`,
            left: `${8 + i * 22}%`,
            animation: `glowPulse ${1.2 + i * 0.3}s ease-in-out infinite`,
            animationDelay: `${i * 0.4}s`,
          }}
        />
      ))}
    </div>
  )
}

function getOfferBg(idx, accent) {
  if (idx === 0) return <ShippingBg accent={accent} />
  if (idx === 1) return <CoinsBg />
  return <WithdrawBg accent={accent} />
}

// ── كرت عرض مفتوح ─────────────────────────────────────────────────
function UnlockedCard({ offer, idx, claimed, claiming, onClaim, justUnlocked }) {
  return (
    <motion.div
      initial={justUnlocked ? { rotateY: 90, scale: 0.85 } : { opacity: 0, y: 12 }}
      animate={{ rotateY: 0, scale: 1, opacity: 1 }}
      transition={{ duration: justUnlocked ? 0.7 : 0.4, ease: 'easeOut' }}
      className="relative rounded-2xl overflow-hidden"
      style={{
        background:  offer.gradient,
        boxShadow:   claimed ? 'none' : `0 6px 28px ${offer.glow}`,
        border:      `1px solid ${offer.accent}30`,
        minHeight:   170,
        animation:   justUnlocked ? 'slideInOffer 0.5s ease-out' : 'none',
      }}
    >
      {/* خلفية متحركة */}
      {!claimed && getOfferBg(idx, offer.accent)}

      {/* بريق شريط */}
      {!claimed && (
        <div className="absolute top-0 left-0 h-full w-14 opacity-15 pointer-events-none"
          style={{
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)',
            animation:  'shimmer 3.5s ease-in-out infinite',
          }}
        />
      )}

      {/* انبعاث الفتح الجديد */}
      {justUnlocked && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${offer.accent}50 0%, transparent 70%)`,
            animation:  'unlockBurst 0.8s ease-out forwards',
          }}
        />
      )}

      <div className="relative z-10 p-4 flex flex-col justify-between h-full" style={{ minHeight: 170 }}>
        {/* العنوان */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-white font-black text-sm leading-tight">{offer.title}</h3>
            {claimed ? (
              <CheckCircle size={16} style={{ color: offer.accent, flexShrink: 0 }} />
            ) : (
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `${offer.accent}20`, border: `1px solid ${offer.accent}40` }}
              >
                <Gift size={13} style={{ color: offer.accent }} />
              </div>
            )}
          </div>
          <p className="text-[11px] leading-relaxed" style={{ color: `${offer.accent}bb` }}>
            {offer.desc}
          </p>
        </div>

        {/* زر الاستلام */}
        <motion.button
          onClick={() => !claimed && !claiming && onClaim(offer)}
          disabled={claimed || claiming}
          whileTap={!claimed ? { scale: 0.94 } : {}}
          whileHover={!claimed ? { scale: 1.03 } : {}}
          className="mt-3 w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: claimed
              ? 'rgba(255,255,255,0.08)'
              : `linear-gradient(135deg, ${offer.accent}35, ${offer.accent}20)`,
            border: `1px solid ${offer.accent}${claimed ? '15' : '45'}`,
            color:  claimed ? 'rgba(255,255,255,0.35)' : offer.accent,
          }}
        >
          {claiming ? (
            <>
              <div className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" />
              جارٍ...
            </>
          ) : claimed ? (
            <><CheckCircle size={11} /> تم الاستلام اليوم</>
          ) : (
            <><Zap size={11} /> {offer.cta}</>
          )}
        </motion.button>
      </div>
    </motion.div>
  )
}

// ── كرت مقفول ─────────────────────────────────────────────────────
function LockedCard({ offer, currentPts }) {
  const needed = offer.requiredPts - currentPts
  const pct    = Math.min(100, Math.round((currentPts / offer.requiredPts) * 100))

  return (
    <div
      className="relative rounded-2xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #111827, #1f2937)',
        border:     '1px solid rgba(255,255,255,0.07)',
        filter:     'grayscale(60%)',
        minHeight:  170,
        opacity:    0.75,
      }}
    >
      <div className="relative z-10 p-4 flex flex-col justify-between h-full" style={{ minHeight: 170 }}>
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-white/50 font-black text-sm leading-tight">{offer.shortTitle}</h3>
            {/* أيقونة القفل الذهبية */}
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)' }}
            >
              <Lock size={13} className="text-amber-400" />
            </div>
          </div>
          <p className="text-[11px] text-white/30 leading-relaxed">
            تحتاج <span className="text-amber-400 font-black">{needed}</span> نقطة إضافية للفتح
          </p>
        </div>

        {/* شريط التقدم */}
        <div className="mt-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] text-amber-400/60 font-medium">{currentPts} / {offer.requiredPts} NRS</span>
            <span className="text-[9px] text-white/30 font-bold">{pct}%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, #f59e0b, #fbbf24)' }}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* رسالة الفتح */}
        <div
          className="mt-3 w-full py-2 rounded-xl text-center text-[10px] font-bold"
          style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.15)', color: 'rgba(251,191,36,0.5)' }}
        >
          🔒 مقفول — {offer.requiredPts} NRS للفتح
        </div>
      </div>
    </div>
  )
}

// ── المكوّن الرئيسي ───────────────────────────────────────────────
export default function SmartAds() {
  const { user }                   = useAuth()
  const { totalPoints, onCallSaved } = usePoints()
  const prevPointsRef              = useRef(totalPoints)

  const [claimedIds,  setClaimedIds]  = useState(() => {
    const today = new Date().toDateString()
    try {
      const s = JSON.parse(localStorage.getItem('nrs_claimed_ads') || '{}')
      return s[today] || []
    } catch { return [] }
  })
  const [claimingId,  setClaimingId]  = useState(null)
  const [toastMsg,    setToastMsg]    = useState(null)
  const [justUnlocked, setJustUnlocked] = useState(null)  // id of just-unlocked offer

  // كشف العروض التي فُتحت للتو
  useEffect(() => {
    const prev = prevPointsRef.current
    const curr = totalPoints
    OFFERS.forEach(o => {
      if (prev < o.requiredPts && curr >= o.requiredPts) {
        setJustUnlocked(o.id)
        setTimeout(() => setJustUnlocked(null), 2000)
      }
    })
    prevPointsRef.current = curr
  }, [totalPoints])

  function saveClaimedLocal(id) {
    const today = new Date().toDateString()
    try {
      const s = JSON.parse(localStorage.getItem('nrs_claimed_ads') || '{}')
      s[today] = [...(s[today] || []), id]
      localStorage.setItem('nrs_claimed_ads', JSON.stringify(s))
    } catch {}
  }

  async function handleClaim(offer) {
    if (!user?.fullname && !user?.username) return
    setClaimingId(offer.id)
    try {
      const res = await awardBonus({
        username: user.fullname || user.username,
        ad_id:    offer.id,
        ad_title: offer.shortTitle,
        points:   offer.points,
      })
      if (res.success) {
        setClaimedIds(p => [...p, offer.id])
        saveClaimedLocal(offer.id)
        onCallSaved(offer.points)
        setToastMsg(`+${offer.points} NRS — ${offer.shortTitle}`)
        setTimeout(() => setToastMsg(null), 3000)
      } else if (res.already_claimed) {
        setClaimedIds(p => [...p, offer.id])
        saveClaimedLocal(offer.id)
      }
    } catch {}
    setClaimingId(null)
  }

  const unlockedCount = OFFERS.filter(o => totalPoints >= o.requiredPts).length

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: ANIM_CSS }} />

      <div className="relative" dir="rtl">
        {/* Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: -14, scale: 0.9 }}
              animate={{ opacity: 1, y: 0,   scale: 1   }}
              exit={{   opacity: 0, y: -14, scale: 0.9 }}
              className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl whitespace-nowrap z-30 flex items-center gap-1.5"
            >
              🪙 {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* رأس القسم */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm flex items-center gap-1.5">
            <Zap size={13} className="text-amber-400" />
            عروض النورس الذكية
          </h3>
          {/* مؤشر عدد العروض المفتوحة */}
          <div
            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
            style={{ background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
          >
            {unlockedCount}/3 <span className="text-amber-400/50 font-normal">مفتوح</span>
          </div>
        </div>

        {/* شبكة العروض */}
        <div className="space-y-3">
          {OFFERS.map((offer, idx) => {
            const isUnlocked = totalPoints >= offer.requiredPts
            const isClaimed  = claimedIds.includes(offer.id)
            const isNew      = justUnlocked === offer.id

            return (
              <AnimatePresence key={offer.id} mode="wait">
                {isUnlocked ? (
                  <UnlockedCard
                    key={`unlocked-${offer.id}`}
                    offer={offer}
                    idx={idx}
                    claimed={isClaimed}
                    claiming={claimingId === offer.id}
                    onClaim={handleClaim}
                    justUnlocked={isNew}
                  />
                ) : (
                  <motion.div key={`locked-${offer.id}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <LockedCard offer={offer} currentPts={totalPoints} />
                  </motion.div>
                )}
              </AnimatePresence>
            )
          })}
        </div>

        {/* رسالة إذا كانت كل العروض مطالباً بها */}
        {unlockedCount === 3 && claimedIds.length >= 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-3 rounded-2xl p-3 text-center"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            <p className="text-violet-300 text-xs font-bold">🏆 أحسنت! استلمت جميع عروض اليوم</p>
            <p className="text-violet-300/50 text-[10px] mt-0.5">تعود العروض غداً مجدداً</p>
          </motion.div>
        )}
      </div>
    </>
  )
}
