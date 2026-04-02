import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ClipboardList, Phone, RefreshCw, CheckCircle,
  Target, Zap, Star, Award, Wallet, ArrowUpRight,
} from 'lucide-react'
import { useStores }  from '../contexts/StoresContext'
import { useAuth }    from '../contexts/AuthContext'
import { usePoints, DAILY_GOAL } from '../contexts/PointsContext'
import StoreDrawer    from '../components/StoreDrawer'

// ══════════════════════════════════════════════════════════════════
// توليد المهام (بدون تغيير في المنطق)
// ══════════════════════════════════════════════════════════════════
function generateTasks(allStores, callLogs, storeStates, userRole, username, assignments) {
  const tasks = []
  const today = new Date().toISOString().split('T')[0]

  allStores.forEach(store => {
    const log          = callLogs[store.id] || {}
    const dbCat        = storeStates[store.id]?.category || store.category
    const incBucket    = store._inc
    const lastCallDate = Object.values(log).map(c => c?.date).filter(Boolean).sort().reverse()[0]
    const calledToday  = lastCallDate?.startsWith(today)
    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    if (incBucket === 'incubating' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!log.day0) {
        tasks.push({
          id: `${store.id}-inc-day0`, store, priority: 'high',
          type: 'new_call', label: 'متابعة تحت الاحتضان',
          desc: 'يشحن ضمن 14 يوم — يحتاج مكالمة دعم',
        })
      }
    }

    if (incBucket === 'never_started' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id: `${store.id}-never`, store,
          priority: daysSinceLast >= 3 ? 'high' : 'normal',
          type: 'recovery_call', label: 'استعادة — لم تبدأ بعد',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به قط',
        })
      }
    }

    if (incBucket === 'restoring' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id: `${store.id}-restoring`, store,
          priority: daysSinceLast >= 2 ? 'high' : 'normal',
          type: 'recovery_call', label: 'متابعة جاري الاستعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'يحتاج متابعة',
        })
      }
    }

    if (incBucket === 'graduated' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!log.graduation_call) {
        tasks.push({
          id: `${store.id}-grad`, store, priority: 'normal',
          type: 'new_call', label: 'مكالمة تخريج',
          desc: 'أكملت الاحتضان بنجاح — مكالمة ترحيب بالنشطة',
        })
      }
    }

    if (['hot_inactive', 'cold_inactive'].includes(dbCat) && ['inactive_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id: `${store.id}-recovery`, store,
          priority: daysSinceLast >= 7 ? 'high' : 'normal',
          type: 'recovery_call', label: 'مكالمة استعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        })
      }
    }

    if (userRole === 'executive' && dbCat === 'active_shipping') {
      const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
        ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
        : 999
      if (daysSinceShip >= 10 && !calledToday) {
        tasks.push({
          id: `${store.id}-followup`, store,
          priority: daysSinceShip >= 14 ? 'high' : 'normal',
          type: 'followup_call', label: 'متابعة متجر نشط',
          desc: `لم يشحن منذ ${daysSinceShip} يوم`,
        })
      }
    }

    if (userRole === 'active_manager' && username && assignments) {
      const asgn = assignments[String(store.id)] || assignments[store.id]
      if (asgn?.assigned_to === username && !calledToday) {
        const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
          ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
          : 999
        tasks.push({
          id: `${store.id}-assigned`, store,
          priority: daysSinceShip >= 10 ? 'high' : 'normal',
          type: 'assigned_store', label: 'متجر مُسنَد إليك',
          desc: daysSinceShip < 999 ? `آخر شحنة قبل ${daysSinceShip} يوم` : 'لا توجد شحنات بعد',
        })
      }
    }
  })

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}

// ══════════════════════════════════════════════════════════════════
// رمز النورس (طائر النورس كزخرفة في الخلفية)
// ══════════════════════════════════════════════════════════════════
function SeagullMark({ size = 100, opacity = 0.07 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" fill="white" opacity={opacity} aria-hidden="true">
      {/* جسم */}
      <ellipse cx="60" cy="38" rx="22" ry="9" />
      {/* الجناح الأيسر */}
      <path d="M52,33 C38,14 6,18 2,28 C18,24 36,28 50,33 Z" />
      {/* الجناح الأيمن */}
      <path d="M68,33 C82,14 114,18 118,28 C102,24 84,28 70,33 Z" />
      {/* الرأس */}
      <circle cx="79" cy="31" r="7" />
      {/* المنقار */}
      <path d="M85,30 L95,32 L85,34 Z" />
      {/* الذيل */}
      <path d="M40,39 L25,45 L33,44 L23,52 L40,42 Z" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════
// خاتم التحدي الذاتي — يتغير لونه بناءً على نسبة الإنجاز
// ══════════════════════════════════════════════════════════════════
function ChallengeRing({ done, total }) {
  const pct   = total ? Math.round((done / total) * 100) : 0
  const color = pct >= 70 ? '#a78bfa' : pct >= 40 ? '#fbbf24' : '#f87171'
  const glow  = pct >= 70 ? '#8b5cf680' : pct >= 40 ? '#f59e0b80' : '#ef444480'
  const label = pct >= 70 ? '🚀 ممتاز' : pct >= 40 ? '💪 جيد، واصل' : '🎯 هيا نبدأ!'

  const r    = 40
  const circ = 2 * Math.PI * r
  const dash = circ - (pct / 100) * circ

  return (
    <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" viewBox="0 0 96 96" style={{ transform: 'rotate(-90deg)' }}>
          {/* المسار الخلفي */}
          <circle cx="48" cy="48" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="8" />
          {/* شريط التقدم المتحرك */}
          <motion.circle
            cx="48" cy="48" r={r}
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: dash }}
            transition={{ duration: 1.5, ease: 'easeOut', delay: 0.4 }}
            style={{ filter: `drop-shadow(0 0 8px ${glow})` }}
          />
        </svg>
        {/* النص في المنتصف */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.p
            className="text-white text-xl font-black leading-none"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.7, type: 'spring' }}
          >
            {pct}%
          </motion.p>
          <p className="text-white/40 text-[10px] mt-0.5">مُنجز</p>
        </div>
      </div>
      <motion.p
        className="text-xs font-bold text-center"
        style={{ color }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.9 }}
      >
        {label}
      </motion.p>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════
// زر الاتصال مع تأثير Ripple
// ══════════════════════════════════════════════════════════════════
function CallButton({ onClick }) {
  const [rippling, setRippling] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    setRippling(true)
    setTimeout(() => setRippling(false), 650)
    onClick()
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.9 }}
      className="relative overflow-hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
      }}
    >
      <Phone size={12} />
      اتصل
      <AnimatePresence>
        {rippling && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.55) 0%, transparent 65%)',
            }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ══════════════════════════════════════════════════════════════════
// بطاقة المهمة المتحركة
// ══════════════════════════════════════════════════════════════════
const TYPE_STYLES = {
  new_call:       { borderColor: '#c4b5fd', accent: '#7c3aed', badge: 'bg-violet-100 text-violet-700', bg: 'rgba(124,58,237,0.04)' },
  recovery_call:  { borderColor: '#fca5a5', accent: '#dc2626', badge: 'bg-red-100 text-red-700',       bg: 'rgba(220,38,38,0.04)'  },
  followup_call:  { borderColor: '#fcd34d', accent: '#d97706', badge: 'bg-amber-100 text-amber-700',   bg: 'rgba(217,119,6,0.04)'  },
  assigned_store: { borderColor: '#93c5fd', accent: '#2563eb', badge: 'bg-blue-100 text-blue-700',     bg: 'rgba(37,99,235,0.04)'  },
}

function TaskCard({ task, index, onCall, onDone }) {
  const s = TYPE_STYLES[task.type] || TYPE_STYLES.followup_call
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.25), ease: 'easeOut' }}
      className="flex items-center gap-3 lg:gap-4 p-3.5 lg:p-4 rounded-2xl border"
      style={{ background: s.bg, borderColor: s.borderColor }}
    >
      {/* نقطة الأولوية النابضة */}
      <motion.div
        className="flex-shrink-0 w-3 h-3 rounded-full"
        style={{ background: task.priority === 'high' ? '#ef4444' : s.accent }}
        animate={task.priority === 'high' ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* أفاتار المتجر */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${s.accent}dd, ${s.accent}88)` }}
      >
        {task.store.name?.charAt(0) || '؟'}
      </div>

      {/* معلومات المهمة */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <p className="font-bold text-slate-800 text-sm truncate">{task.store.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.badge}`}>
            {task.label}
          </span>
          {task.priority === 'high' && (
            <motion.span
              className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              عاجل
            </motion.span>
          )}
        </div>
        <p className="text-xs text-slate-500">{task.desc}</p>
      </div>

      {/* أزرار الإجراء */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <CallButton onClick={() => onCall(task.store)} />
        <motion.button
          onClick={() => onDone(task.id)}
          whileHover={{ scale: 1.06, y: -1 }}
          whileTap={{ scale: 0.9 }}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
          style={{
            background: 'linear-gradient(135deg, #059669, #047857)',
            boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
          }}
        >
          <CheckCircle size={12} />
          تم
        </motion.button>
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════════════════
export default function Tasks() {
  const { allStores, callLogs, storeStates, assignments, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected] = useState(null)
  const [doneIds, setDoneIds]   = useState(new Set())
  const [filter, setFilter]     = useState('all')

  const tasks = useMemo(
    () => generateTasks(allStores, callLogs, storeStates, user?.role, user?.username, assignments),
    [allStores, callLogs, storeStates, user, assignments]
  )

  const pendingTasks = tasks.filter(t => !doneIds.has(t.id))
  const highCount    = pendingTasks.filter(t => t.priority === 'high').length
  const doneCount    = doneIds.size
  const displayed    = filter === 'high'
    ? pendingTasks.filter(t => t.priority === 'high')
    : pendingTasks

  function markDone(id) { setDoneIds(prev => new Set([...prev, id])) }

  const navigate = useNavigate()
  const { totalPoints, todayPoints, todayCalls, goalPct } = usePoints()

  return (
    <div className="space-y-5 pb-20" style={{ fontFamily: "'Cairo', sans-serif" }}>

      {/* ══ بطاقة الهيدر + التحدي الذاتي ═══════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative rounded-3xl overflow-hidden text-white p-5 lg:p-7"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 55%, #1a0a4e 100%)' }}
      >
        {/* Blobs */}
        <div className="absolute top-0 left-1/3 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* نورس كبير خلفية */}
        <div className="absolute bottom-2 left-4 pointer-events-none">
          <SeagullMark size={110} opacity={0.06} />
        </div>
        {/* نورس صغير مقلوب */}
        <div className="absolute top-3 right-8 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <SeagullMark size={65} opacity={0.04} />
        </div>

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-5 lg:gap-7">
            {/* خاتم التحدي الذاتي */}
            <ChallengeRing done={doneCount} total={tasks.length} />

            {/* النص + الإحصائيات السريعة */}
            <div>
              <h1 className="text-xl lg:text-2xl font-black leading-tight">
                المهام اليومية
              </h1>
              <p className="text-white/50 text-sm mt-0.5">
                مرحباً{' '}
                <span className="text-violet-300 font-semibold">{user?.fullname || user?.username}</span>
              </p>

              <div className="flex items-center gap-4 mt-3 flex-wrap">
                {[
                  { Icon: ClipboardList, label: 'الكل',     val: tasks.length,  color: 'text-white/70'    },
                  { Icon: CheckCircle,  label: 'مُنجز',    val: doneCount,     color: 'text-emerald-400' },
                  { Icon: Zap,          label: 'عاجلة',    val: highCount,     color: 'text-red-400'     },
                  { Icon: Target,       label: 'متبقية',   val: pendingTasks.length, color: 'text-amber-300' },
                ].map(({ Icon, label, val, color }) => (
                  <div key={label} className="flex items-center gap-1.5">
                    <Icon size={13} className={color} />
                    <span className={`text-sm font-black ${color}`}>{val}</span>
                    <span className="text-white/30 text-xs">{label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* زر التحديث */}
          <motion.button
            onClick={reload}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white border border-white/20 bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </motion.button>
        </div>
      </motion.div>

      {/* ══ بطاقة المحفظة السريعة ════════════════════════════════════ */}
      <motion.button
        onClick={() => navigate('/performance')}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.12 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="w-full rounded-2xl overflow-hidden text-right"
        style={{
          background: 'linear-gradient(135deg, #78350f 0%, #92400e 40%, #78350f 100%)',
          boxShadow: '0 4px 24px rgba(245,158,11,0.25)',
          border: '1px solid rgba(245,158,11,0.2)',
        }}
      >
        <div className="relative px-5 py-4 flex items-center gap-4">
          {/* بريق خلفي */}
          <div className="absolute top-0 right-0 w-28 h-full bg-amber-400/10 blur-2xl pointer-events-none rounded-full" />
          <motion.div
            className="absolute top-0 left-0 w-1/3 h-full pointer-events-none"
            style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)' }}
            animate={{ x: ['0%', '350%'] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', repeatDelay: 3 }}
          />

          {/* أيقونة المحفظة */}
          <div
            className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl"
            style={{ background: 'rgba(245,158,11,0.25)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            🪙
          </div>

          {/* البيانات */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-amber-300 text-xs font-medium">محفظة NRS</p>
              <span className="text-amber-400/50 text-[10px]">Nawras Points</span>
            </div>
            <p className="text-white font-black text-2xl leading-tight">{totalPoints.toLocaleString()}</p>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-amber-400/70 text-xs">+{todayPoints} اليوم</span>
              <span className="text-white/20 text-xs">·</span>
              <span className="text-white/40 text-xs">{todayCalls}/{DAILY_GOAL} مكالمة</span>
            </div>
          </div>

          {/* شريط التقدم العمودي */}
          <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
            <div className="text-xs font-black" style={{ color: goalPct >= 100 ? '#10b981' : '#fbbf24' }}>
              {goalPct}%
            </div>
            <div className="w-1.5 h-12 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className="w-full rounded-full"
                style={{
                  background: goalPct >= 100 ? '#10b981' : 'linear-gradient(180deg, #fbbf24, #d97706)',
                  height: `${goalPct}%`,
                  marginTop: `${100 - goalPct}%`,
                }}
                initial={{ height: 0, marginTop: '100%' }}
                animate={{ height: `${goalPct}%`, marginTop: `${100 - goalPct}%` }}
                transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <ArrowUpRight size={13} className="text-amber-400/60" />
          </div>
        </div>
      </motion.button>

      {/* ══ تبويبات التصفية ══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="flex gap-2"
      >
        {[
          { val: 'all',  label: 'الكل',             count: pendingTasks.length },
          { val: 'high', label: 'عالية الأولوية',   count: highCount           },
        ].map(tab => (
          <motion.button
            key={tab.val}
            onClick={() => setFilter(tab.val)}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.val
                ? 'text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            style={filter === tab.val ? {
              background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
              boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
            } : {}}
          >
            {tab.label}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              filter === tab.val ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* ══ قائمة المهام ════════════════════════════════════════════ */}
      {displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100"
        >
          <motion.div
            animate={{ rotate: [0, 12, -12, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
          >
            <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
          </motion.div>
          <p className="font-black text-slate-700 text-xl">أحسنت! لا توجد مهام معلقة</p>
          <p className="text-slate-400 text-sm mt-2">تم الانتهاء من جميع المهام اليوم 🎉</p>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="space-y-2.5"
        >
          <AnimatePresence mode="popLayout">
            {displayed.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                index={i}
                onCall={store => setSelected(store)}
                onDone={markDone}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
