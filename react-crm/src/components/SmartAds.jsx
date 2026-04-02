import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Zap, X, ChevronLeft, ChevronRight, Gift } from 'lucide-react'
import { awardBonus } from '../services/api'
import { useAuth }    from '../contexts/AuthContext'
import { usePoints }  from '../contexts/PointsContext'

// ── بيانات الإعلانات ─────────────────────────────────────────────
const ADS = [
  {
    id:      'fast_shipping_triploi',
    title:   '🚚 شحن سريع — طرابلس وبنغازي',
    desc:    'طرود تصل خلال 24 ساعة لجميع أحياء طرابلس والجفارة',
    cta:     'احصل على 15 NRS',
    points:  15,
    gradient: 'linear-gradient(135deg, #1e3a5f, #1e40af)',
    accent:  '#60a5fa',
    emoji:   '📦',
  },
  {
    id:      'double_points_10_orders',
    title:   '⚡ نقاط مضاعفة × 2',
    desc:    'عند شحن 10 طلبيات لنفس المتجر هذا الشهر تحصل على نقاط مضاعفة',
    cta:     'احصل على 20 NRS',
    points:  20,
    gradient: 'linear-gradient(135deg, #3b1e6b, #5b21b6)',
    accent:  '#c4b5fd',
    emoji:   '💎',
  },
  {
    id:      'new_merchant_bonus',
    title:   '🎁 بونص المتجر الجديد',
    desc:    'لكل متجر يشحن أول طلبية خلال أسبوع من التسجيل — مكافأة خاصة',
    cta:     'احصل على 25 NRS',
    points:  25,
    gradient: 'linear-gradient(135deg, #065f46, #047857)',
    accent:  '#6ee7b7',
    emoji:   '🌟',
  },
  {
    id:      'coverage_misrata',
    title:   '🗺️ توسعة التغطية — مصراتة',
    desc:    'خدمة التوصيل الآن في مصراتة وضواحيها — شجّع تجارك الجدد',
    cta:     'احصل على 10 NRS',
    points:  10,
    gradient: 'linear-gradient(135deg, #7c2d12, #c2410c)',
    accent:  '#fdba74',
    emoji:   '🚀',
  },
]

// ── مكون الإعلان الواحد ───────────────────────────────────────────
function AdCard({ ad, onClaim, claimed, claiming }) {
  return (
    <div
      className="relative rounded-2xl overflow-hidden h-full flex flex-col"
      style={{ background: ad.gradient, minHeight: 160 }}
    >
      {/* زخرفة خلفية */}
      <div
        className="absolute top-0 left-0 w-32 h-32 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ background: ad.accent }}
      />
      <div
        className="absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-xl opacity-10 pointer-events-none"
        style={{ background: ad.accent }}
      />

      <div className="relative flex-1 p-4">
        <div className="text-3xl mb-2">{ad.emoji}</div>
        <h3 className="text-white font-black text-sm leading-tight mb-1">{ad.title}</h3>
        <p className="text-white/60 text-xs leading-relaxed">{ad.desc}</p>
      </div>

      <div className="relative p-3 pt-0">
        <motion.button
          onClick={() => !claimed && !claiming && onClaim(ad)}
          disabled={claimed || claiming}
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: claimed ? 1 : 1.02 }}
          className="w-full py-2 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition-all"
          style={{
            background: claimed
              ? 'rgba(255,255,255,0.1)'
              : `linear-gradient(135deg, ${ad.accent}40, ${ad.accent}20)`,
            border: `1px solid ${ad.accent}${claimed ? '20' : '50'}`,
            color: claimed ? 'rgba(255,255,255,0.4)' : ad.accent,
          }}
        >
          {claiming ? (
            <><div className="w-3 h-3 border border-current/40 border-t-current rounded-full animate-spin" /> جارٍ...</>
          ) : claimed ? (
            <><span>✅</span> تم الاستلام اليوم</>
          ) : (
            <><Gift size={11} /> {ad.cta}</>
          )}
        </motion.button>
      </div>
    </div>
  )
}

// ── المكون الرئيسي ────────────────────────────────────────────────
export default function SmartAds() {
  const { user }          = useAuth()
  const { onCallSaved }   = usePoints()  // نستخدمه لمنح النقاط فورياً في الـ UI

  const [current,    setCurrent]    = useState(0)
  const [claimedIds, setClaimedIds] = useState(() => {
    // احفظ في localStorage تاريخ اليوم مع الـ IDs المطالَب بها
    const today = new Date().toDateString()
    try {
      const stored = JSON.parse(localStorage.getItem('nrs_claimed_ads') || '{}')
      return stored[today] || []
    } catch { return [] }
  })
  const [claimingId, setClaimingId] = useState(null)
  const [toastMsg,   setToastMsg]   = useState(null)

  function saveClaimedLocal(id) {
    const today = new Date().toDateString()
    try {
      const stored = JSON.parse(localStorage.getItem('nrs_claimed_ads') || '{}')
      stored[today] = [...(stored[today] || []), id]
      localStorage.setItem('nrs_claimed_ads', JSON.stringify(stored))
    } catch {}
  }

  async function handleClaim(ad) {
    if (!user?.fullname) return
    setClaimingId(ad.id)
    try {
      const res = await awardBonus({
        username:  user.fullname,
        ad_id:     ad.id,
        ad_title:  ad.title,
        points:    ad.points,
      })
      if (res.success) {
        setClaimedIds(prev => [...prev, ad.id])
        saveClaimedLocal(ad.id)
        onCallSaved(ad.points)   // يُطلق الأنيميشن ويُحدّث النقاط فوراً
        setToastMsg(`+${ad.points} NRS — ${ad.title}`)
        setTimeout(() => setToastMsg(null), 3000)
      } else if (res.already_claimed) {
        setClaimedIds(prev => [...prev, ad.id])
        saveClaimedLocal(ad.id)
      }
    } catch {}
    setClaimingId(null)
  }

  const prev = () => setCurrent(c => (c - 1 + ADS.length) % ADS.length)
  const next = () => setCurrent(c => (c + 1) % ADS.length)
  const ad   = ADS[current]

  return (
    <div className="relative" dir="rtl">
      {/* Toast الإشعار */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0,   scale: 1   }}
            exit={{   opacity: 0, y: -12, scale: 0.9 }}
            className="absolute -top-12 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-xs font-black px-4 py-2 rounded-full shadow-xl whitespace-nowrap z-10 flex items-center gap-1.5"
          >
            🪙 {toastMsg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* الإعلان الحالي */}
      <AnimatePresence mode="wait">
        <motion.div
          key={ad.id}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0  }}
          exit={{   opacity: 0, x: -20 }}
          transition={{ duration: 0.22 }}
        >
          <AdCard
            ad={ad}
            onClaim={handleClaim}
            claimed={claimedIds.includes(ad.id)}
            claiming={claimingId === ad.id}
          />
        </motion.div>
      </AnimatePresence>

      {/* التنقل */}
      <div className="flex items-center justify-between mt-2.5 px-1">
        <div className="flex gap-1.5">
          {ADS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className="rounded-full transition-all"
              style={{
                width: i === current ? 20 : 6,
                height: 6,
                background: i === current ? '#a78bfa' : 'rgba(255,255,255,0.15)',
              }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button
            onClick={prev}
            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <ChevronRight size={13} />
          </button>
          <button
            onClick={next}
            className="w-7 h-7 rounded-lg bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/50 hover:text-white transition-colors"
          >
            <ChevronLeft size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}
