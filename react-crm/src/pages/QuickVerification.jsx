import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  RefreshCw,
  ArrowBigUp,
  ArrowBigDown,
  ArrowLeftRight,
  Loader2,
  X,
  Filter,
  Star,
  Store,
  Truck,
  CheckCircle2,
  Copy,
  ClipboardList,
  User,
  Calendar,
  ChevronLeft,
  Search,
  Package,
  AlertCircle,
  BarChart3,
} from 'lucide-react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import { IS_STAGING_OR_DEV, IS_VITE_APP_STAGING } from '../config/envFlags'
import {
  getQuickVerificationBourse,
  getQuickVerificationAuditTimeline,
  postQuickVerificationResolveAudit,
} from '../services/api'
import { totalShipments, parcelsInRangeDisplay } from '../utils/storeFields'

const SUCCESS = '#059669'
const DANGER = '#E11D48'

/**
 * نظام ألوان موحّد — لوحة تنفيذية هادئة (slate + teal/amber كلمسة علامة)
 * تباين WCAG مقبول، بدون صراخ لوني.
 */
const DS = {
  bgPage: '#F1F5F9',
  surface: '#FFFFFF',
  border: '#E2E8F0',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  /** كحلي العلامة */
  brand: '#1E3A5F',
  brandIconEnd: '#0F172A',
  success: { solid: '#059669', light: '#ECFDF5', soft: '#D1FAE5', border: '#A7F3D0' },
  danger: { solid: '#BE123C', light: '#FFF1F2', soft: '#FFE4E6', border: '#FECDD3' },
  amber: { solid: '#D97706', light: '#FFFBEB', border: '#FDE68A', muted: '#F59E0B' },
  /** تدرج شريط إنجاز: teal → amber ذهبي هادئ */
  progressFrom: '#0D9488',
  progressTo: '#B45309',
  riskPulse: 'rgba(190, 18, 60, 0.22)',
  riskBorder: 'rgba(190, 18, 60, 0.42)',
  statWellRed: 'rgba(220, 38, 38, 0.09)',
  statWellGreen: 'rgba(5, 150, 105, 0.1)',
  radarStroke: '#0D9488',
}

const NAVY = DS.brand
const SLATE_SECONDARY = DS.textSecondary
const PAGE_BG_STAGING = DS.bgPage
const CARD_BORDER = DS.border
const PASTEL_GREEN_BG = DS.success.soft
const PASTEL_GREEN_ICON = DS.success.solid
const SOFT_CORAL_BG = DS.danger.soft
const SOFT_CORAL_ICON = DS.danger.solid
const CORPORATE_ORANGE = DS.progressTo
const ACHIEVE_RED = '#DC2626'
const ACHIEVE_GREEN = DS.success.solid
const NEON_GREEN = PASTEL_GREEN_ICON
const CRIMSON = SOFT_CORAL_ICON

/** عتبة شحنات عالية + 🔽 = أولوية قصوى */
const HIGH_SHIPMENT_THRESHOLD = 50

/** لوحة أعمال بسيطة — تجريبي (Apple/Stripe): أبيض، رمادي هادئ، أزرق ملكي واحد */
const PRO = {
  bg: '#FFFFFF',
  surface: '#F3F4F6',
  border: '#E5E7EB',
  text: '#1F2937',
  textMuted: '#6B7280',
  accent: '#1D4ED8',
  green: '#16A34A',
  red: '#DC2626',
  amber: '#D97706',
}

/** التحقق السريع — تجريبي `VITE_APP_STAGING=1`: خلفية بيضاء وبطاقات كبيرة */
const STAGING_LIGHT = {
  pageBg: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textMuted: '#6B7280',
}

const fadeUpStaging = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0 },
}

/** كرت إحصاء علوي — بطاقات كبيرة بتدرج + وهج داخلي خفيف */
function QuickAuditStatCard({ title, value, sub, gradient, glow, icon: Icon }) {
  return (
    <motion.div
      variants={fadeUpStaging}
      initial="hidden"
      animate="visible"
      whileHover={{ y: -4, boxShadow: `0 18px 44px ${glow}` }}
      className="group relative w-full overflow-hidden rounded-2xl p-6 text-right shadow-lg"
      style={{
        background: gradient,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.2), 0 6px 28px ${glow}`,
      }}
    >
      <div className="absolute inset-0 rounded-2xl bg-white/[0.07] opacity-0 transition-opacity group-hover:opacity-100" />
      <div
        className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full opacity-25 blur-3xl"
        style={{ background: glow }}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-white/85">{title}</p>
          <div className="text-3xl font-black leading-none text-white drop-shadow-sm md:text-[2.35rem]">{value}</div>
          {sub ? <p className="mt-2 text-xs font-medium text-white/75">{sub}</p> : null}
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/20 shadow-inner ring-1 ring-white/20">
          <Icon size={22} className="text-white" />
        </div>
      </div>
    </motion.div>
  )
}

/** مؤشر رضا — صف أبيض مضغوط */
function LightRowSatisfactionGlyph({ arrow, resolvedDown }) {
  if (resolvedDown) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-600">
        <CheckCircle2 size={18} strokeWidth={2.2} aria-hidden />
        <span className="text-xs font-bold">تم الحل</span>
      </span>
    )
  }
  if (arrow === 'up') {
    return <ArrowBigUp size={22} strokeWidth={2.4} className="text-emerald-600" aria-hidden />
  }
  if (arrow === 'mid') {
    return <ArrowLeftRight size={20} strokeWidth={2.5} className="text-amber-500" aria-hidden />
  }
  return <ArrowBigDown size={22} strokeWidth={2.4} className="text-rose-600" aria-hidden />
}

/** لوحة 2025+ — عتمة + نيون (تجريبي `VITE_APP_STAGING=1` فقط) */
const FV = {
  obsidian: '#0A0A0B',
  charcoal: '#111113',
  cyan: '#00F2FE',
  violet: '#4FACFE',
  magenta: '#DA22FF',
  silver: '#C8D4E0',
  silverDim: '#7C8EA3',
  emeraldCore: '#34F5C5',
  rubyCore: '#FF2D6B',
  glass: 'rgba(255,255,255,0.06)',
  glassHi: 'rgba(255,255,255,0.1)',
  edge: 'rgba(0, 242, 254, 0.28)',
  edgeSoft: 'rgba(0, 242, 254, 0.12)',
}

function FuturisticAmbientBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-20 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(168deg, ${FV.obsidian} 0%, ${FV.charcoal} 42%, #0C0C0E 100%)`,
        }}
      />
      <motion.div
        className="absolute -top-[18%] left-1/2 h-[90vh] w-[min(100vw,90vh)] -translate-x-1/2 rounded-full"
        style={{
          background: `radial-gradient(ellipse at 50% 38%, ${FV.cyan}28 0%, transparent 58%)`,
          filter: 'blur(64px)',
        }}
        animate={{ opacity: [0.38, 0.62, 0.38], scale: [1, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute bottom-[-10%] right-[-5%] h-[75vh] w-[75vh] rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 40%, ${FV.magenta}22 0%, transparent 58%)`,
          filter: 'blur(72px)',
        }}
        animate={{ opacity: [0.28, 0.52, 0.28] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />
      <motion.div
        className="absolute left-[-15%] top-[22%] h-[55vh] w-[55vh] rounded-full"
        style={{
          background: `radial-gradient(circle, ${FV.violet}24 0%, transparent 58%)`,
          filter: 'blur(56px)',
        }}
        animate={{ opacity: [0.22, 0.48, 0.22] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />
    </div>
  )
}

/** شبكة سلكية + خطوط خفيفة تشبه خريطة معتمة */
function WireframeMapBackdrop() {
  return (
    <svg
      className="pointer-events-none fixed inset-0 -z-[19] h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id="qv-hex" width="28" height="48" patternUnits="userSpaceOnUse" patternTransform="scale(1)">
          <path
            d="M14 0 L26 8 L26 24 L14 32 L2 24 L2 8 Z"
            fill="none"
            stroke="#00F2FE"
            strokeOpacity="0.07"
            strokeWidth="0.5"
          />
        </pattern>
        <linearGradient id="qv-map-glow" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#00F2FE" stopOpacity="0.12" />
          <stop offset="50%" stopColor="#4FACFE" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#DA22FF" stopOpacity="0.1" />
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#qv-hex)" />
      <path
        d="M12 78 Q 180 40 340 90 T 620 70 T 880 100 T 1080 85"
        fill="none"
        stroke="url(#qv-map-glow)"
        strokeWidth="0.6"
        strokeOpacity="0.35"
      />
      <path
        d="M40 220 Q 260 180 480 210 T 900 195"
        fill="none"
        stroke="#00F2FE"
        strokeOpacity="0.1"
        strokeWidth="0.5"
      />
    </svg>
  )
}

function PrismShieldLogo({ size = 56 }) {
  return (
    <motion.div
      className="relative flex items-center justify-center rounded-2xl"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(145deg, rgba(0,242,254,0.15) 0%, rgba(79,172,254,0.12) 40%, rgba(218,34,255,0.1) 100%)',
        boxShadow: `0 0 28px ${FV.cyan}44, inset 0 1px 0 rgba(255,255,255,0.15)`,
        border: `1px solid ${FV.edge}`,
      }}
      animate={{ boxShadow: [`0 0 20px ${FV.cyan}33`, `0 0 36px ${FV.magenta}44`, `0 0 20px ${FV.cyan}33`] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" aria-hidden>
        <defs>
          <linearGradient id="prism-sh" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={FV.cyan} />
            <stop offset="45%" stopColor={FV.violet} />
            <stop offset="100%" stopColor={FV.magenta} />
          </linearGradient>
        </defs>
        <path
          d="M12 2 L20 8 L20 16 L12 22 L4 16 L4 8 Z"
          fill="none"
          stroke="url(#prism-sh)"
          strokeWidth="1.4"
          strokeLinejoin="miter"
        />
        <path d="M12 2 L12 22 M4 8 L20 16 M20 8 L4 16" stroke="url(#prism-sh)" strokeWidth="0.45" strokeOpacity="0.85" />
      </svg>
    </motion.div>
  )
}

function CrystalEmeraldGlyph({ className = '' }) {
  return (
    <motion.svg
      width={36}
      height={36}
      viewBox="0 0 36 36"
      className={className}
      animate={{ filter: ['drop-shadow(0 0 6px rgba(52,245,197,0.5))', 'drop-shadow(0 0 14px rgba(52,245,197,0.85))', 'drop-shadow(0 0 6px rgba(52,245,197,0.5))'] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
      aria-hidden
    >
      <defs>
        <radialGradient id="cg-em" cx="40%" cy="35%" r="60%">
          <stop offset="0%" stopColor="#ECFDF5" stopOpacity="0.95" />
          <stop offset="45%" stopColor={FV.emeraldCore} />
          <stop offset="100%" stopColor="#047857" />
        </radialGradient>
      </defs>
      <polygon points="18,4 32,12 32,24 18,32 4,24 4,12" fill="none" stroke={FV.emeraldCore} strokeWidth="1.2" strokeOpacity="0.9" />
      <polygon points="18,9 27,14 27,22 18,27 9,22 9,14" fill="url(#cg-em)" opacity="0.95" />
    </motion.svg>
  )
}

function CrystalRubyGlyph({ className = '' }) {
  return (
    <motion.svg
      width={36}
      height={36}
      viewBox="0 0 36 36"
      className={className}
      animate={{ filter: ['drop-shadow(0 0 6px rgba(255,45,107,0.45))', 'drop-shadow(0 0 14px rgba(255,45,107,0.8))', 'drop-shadow(0 0 6px rgba(255,45,107,0.45))'] }}
      transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut', delay: 0.4 }}
      aria-hidden
    >
      <defs>
        <radialGradient id="cg-rb" cx="38%" cy="32%" r="62%">
          <stop offset="0%" stopColor="#FFE4E9" stopOpacity="0.95" />
          <stop offset="50%" stopColor={FV.rubyCore} />
          <stop offset="100%" stopColor="#9F1239" />
        </radialGradient>
      </defs>
      <polygon points="18,4 32,12 32,24 18,32 4,24 4,12" fill="none" stroke={FV.rubyCore} strokeWidth="1.2" strokeOpacity="0.95" />
      <polygon points="18,9 27,14 27,22 18,27 9,22 9,14" fill="url(#cg-rb)" opacity="0.95" />
    </motion.svg>
  )
}

/** شريط تقدّم مقسّم — وضع الوثيقة الفاتح (تجريبي) */
function DocumentEnergyBar({ pct }) {
  const n = 14
  const filled = Math.round((pct / 100) * n)
  return (
    <div className="flex w-full items-center gap-0.5" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: n }).map((_, i) => (
        <div
          key={i}
          className="h-2 flex-1 rounded-sm"
          style={{
            background:
              i < filled
                ? `linear-gradient(180deg, ${DS.progressFrom} 0%, ${DS.progressTo} 100%)`
                : '#E2E8F0',
          }}
        />
      ))}
    </div>
  )
}

function SegmentedEnergyBar({ pct }) {
  const n = 14
  const filled = Math.round((pct / 100) * n)
  return (
    <div className="flex w-full items-center gap-1" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      {Array.from({ length: n }).map((_, i) => (
        <motion.div
          key={i}
          className="h-2.5 flex-1 rounded-sm"
          initial={false}
          animate={{
            opacity: i < filled ? 1 : 0.2,
            boxShadow:
              i < filled
                ? `0 0 10px ${i % 2 === 0 ? FV.cyan : FV.violet}88`
                : 'none',
          }}
          style={{
            background:
              i < filled
                ? `linear-gradient(180deg, ${i % 3 === 0 ? FV.cyan : i % 3 === 1 ? FV.violet : FV.magenta} 0%, ${FV.charcoal} 100%)`
                : 'rgba(255,255,255,0.06)',
            border: `1px solid ${i < filled ? FV.edgeSoft : 'rgba(255,255,255,0.06)'}`,
          }}
        />
      ))}
    </div>
  )
}

/** شريط حالة تنفيذي — أرقام بجانب بعض مع فواصل عمودية */
function ExecStatusStrip({ execMetrics }) {
  const { totalProblems, resolvedProblems, pct } = execMetrics
  return (
    <div
      className="flex flex-col border-b sm:flex-row sm:flex-wrap sm:items-stretch"
      style={{ borderColor: DS.border, background: 'rgba(241,245,249,0.65)' }}
    >
      <div
        className="flex flex-1 items-center justify-center gap-2 px-4 py-3 sm:min-w-0 sm:justify-start sm:border-e"
        style={{ borderColor: DS.border }}
      >
        <span className="text-xs font-semibold text-slate-500">إجمالي المشاكل</span>
        <span className="text-xl font-black tabular-nums text-slate-900">{totalProblems}</span>
      </div>
      <div
        className="flex flex-1 items-center justify-center gap-2 px-4 py-3 sm:min-w-0 sm:justify-start sm:border-e"
        style={{ borderColor: DS.border }}
      >
        <span className="text-xs font-semibold text-slate-500">مشاكل تم حلّها</span>
        <span className="text-xl font-black tabular-nums text-slate-900">{resolvedProblems}</span>
      </div>
      <div className="flex min-w-0 flex-[1.15] flex-col justify-center gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex shrink-0 items-baseline gap-2">
          <span className="text-xs font-semibold text-slate-500">نسبة الإنجاز</span>
          <span className="text-xl font-black tabular-nums text-slate-900">{pct}%</span>
        </div>
        <div className="min-w-0 flex-1 sm:max-w-md">
          <DocumentEnergyBar pct={pct} />
        </div>
      </div>
    </div>
  )
}

const glassPanel =
  'backdrop-blur-[20px] bg-white/[0.06] border border-cyan-400/20 shadow-[0_8px_40px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.08)]'

function resolveShipmentCount(allStores, storeId) {
  if (storeId == null || !Array.isArray(allStores)) return null
  const s = allStores.find(
    x => x?.id === storeId || String(x?.id) === String(storeId) || Number(x?.id) === Number(storeId),
  )
  if (!s) return null
  const life = totalShipments(s)
  const range = parcelsInRangeDisplay(s)
  const n = life > 0 ? life : range
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** سهم رضا — بطاقات DS الهادئة (موحّد للتجريبي والعادي) */
function StagingSatisfactionArrow({ arrow, resolvedDown }) {
  if (resolvedDown) {
    return (
      <span
        className="inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 border"
        style={{
          borderColor: DS.success.border,
          background: DS.success.light,
          color: PASTEL_GREEN_ICON,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
        }}
      >
        <CheckCircle2 size={24} strokeWidth={2.2} aria-hidden />
        <span className="text-xs font-black" style={{ color: DS.textSecondary }}>
          تم الحل
        </span>
      </span>
    )
  }
  if (arrow === 'up') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-2xl p-3 border"
        style={{
          borderColor: DS.success.border,
          background: DS.success.soft,
          color: PASTEL_GREEN_ICON,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
        }}
      >
        <ArrowBigUp size={26} strokeWidth={2.4} aria-hidden />
      </span>
    )
  }
  if (arrow === 'mid') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-2xl p-3 border"
        style={{
          borderColor: DS.amber.border,
          background: DS.amber.light,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
        }}
      >
        <ArrowLeftRight size={24} strokeWidth={2.5} style={{ color: DS.amber.solid }} aria-hidden />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl p-3 border"
      style={{
        borderColor: DS.danger.border,
        background: DS.danger.light,
        color: SOFT_CORAL_ICON,
        boxShadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
      }}
    >
      <ArrowBigDown size={26} strokeWidth={2.4} aria-hidden />
    </span>
  )
}

function textSnippet(s, max = 64) {
  const t = (s || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function fmtServerAt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
}

/** مدة من اكتشاف المشكلة (created_at) حتى الحل (resolved_at) */
function formatResolveDuration(createdIso, resolvedIso) {
  if (!createdIso || !resolvedIso) return '—'
  const a = new Date(createdIso).getTime()
  const b = new Date(resolvedIso).getTime()
  if (!Number.isFinite(a) || !Number.isFinite(b) || b < a) return '—'
  const ms = b - a
  const mins = Math.floor(ms / 60000)
  const hrs = Math.floor(mins / 60)
  const days = Math.floor(hrs / 24)
  if (days > 0) return `${days} يوم ${hrs % 24} س`
  if (hrs > 0) return `${hrs} ساعة ${mins % 60} د`
  if (mins > 0) return `${mins} دقيقة`
  const sec = Math.max(1, Math.floor(ms / 1000))
  return `${sec} ثانية`
}

function rowMatchesQuickSearch(row, qRaw) {
  const q = (qRaw || '').trim().toLowerCase()
  if (!q) return true
  const name = (row.store_name || '').toLowerCase()
  const code = String(row.store_id ?? '')
  return name.includes(q) || code.includes(q) || code === q
}

function sortActiveAuditRows(rows, allStores) {
  return [...rows].sort((a, b) => {
    const sa = resolveShipmentCount(allStores, a.store_id) ?? 0
    const sb = resolveShipmentCount(allStores, b.store_id) ?? 0
    const ra = a.arrow === 'down' && !a.resolved && sa > HIGH_SHIPMENT_THRESHOLD ? 1 : 0
    const rb = b.arrow === 'down' && !b.resolved && sb > HIGH_SHIPMENT_THRESHOLD ? 1 : 0
    if (rb !== ra) return rb - ra
    if (ra && rb) return sb - sa
    const ta = new Date(a.created_at || 0).getTime()
    const tb = new Date(b.created_at || 0).getTime()
    return tb - ta
  })
}

function MiniStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-0.5 flex-row-reverse" aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={14}
          className={n <= v ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
          strokeWidth={n <= v ? 0 : 1.2}
        />
      ))}
    </div>
  )
}

function ArrowForState({ arrow }) {
  if (arrow === 'up') {
    return <ArrowBigUp size={20} strokeWidth={2.5} className="text-emerald-600" aria-hidden />
  }
  if (arrow === 'mid') {
    return <ArrowLeftRight size={20} strokeWidth={2.5} className="text-amber-500" aria-hidden />
  }
  return <ArrowBigDown size={20} strokeWidth={2.5} className="text-rose-600" aria-hidden />
}

function AnimatedStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-1 flex-row-reverse justify-end" aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <motion.span
          key={n}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: (n - 1) * 0.05 }}
        >
          <Star
            size={20}
            strokeWidth={n <= v ? 0 : 1.5}
            className={n <= v ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}
          />
        </motion.span>
      ))}
    </div>
  )
}

/** درج التفصيل — داخل نفس الملف (تجريبي فقط) */
function StagingAuditDrawer({ row, onClose, onResolve, resolveBusy, auditUser }) {
  const [latestCallNote, setLatestCallNote] = useState(null)
  const [callStage, setCallStage] = useState(null)
  const [loading, setLoading] = useState(true)

  const radarData = useMemo(() => {
    if (!row?.questions?.length) return []
    return row.questions.map(q => ({
      subject: q.label.length > 12 ? `${q.label.slice(0, 11)}…` : q.label,
      score: q.value,
      fullMark: 5,
    }))
  }, [row])

  useEffect(() => {
    if (!row?.store_id) return
    let cancelled = false
    setLoading(true)
    getQuickVerificationAuditTimeline(row.store_id, {
      user_role: auditUser?.role ?? 'executive',
      username: auditUser?.username ?? '',
    })
      .then(d => {
        if (cancelled) return
        setLatestCallNote(d?.latest_call_note || null)
        const evs = Array.isArray(d?.events) ? d.events : []
        let stage = null
        for (let i = evs.length - 1; i >= 0; i--) {
          const sub = String(evs[i]?.sub || '')
          if (sub.includes('inc_call1')) {
            stage = 1
            break
          }
          if (sub.includes('inc_call2')) {
            stage = 2
            break
          }
          if (sub.includes('inc_call3')) {
            stage = 3
            break
          }
        }
        setCallStage(stage)
      })
      .catch(() => {
        if (!cancelled) {
          setLatestCallNote(null)
          setCallStage(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row?.store_id, auditUser?.role, auditUser?.username])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fullNoteText = [row?.suggestions?.trim(), latestCallNote?.text].filter(Boolean).join('\n\n---\n\n') || ''

  async function copyNote() {
    const t = fullNoteText || (row?.suggestions || '').trim() || latestCallNote?.text || ''
    if (!t || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(t)
    } catch { /* */ }
  }

  if (!row) return null

  return (
    <motion.div
      className="fixed inset-0 z-[600] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
      style={{ fontFamily: "'Tajawal', sans-serif" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative flex h-full w-full max-w-[480px] flex-col border-l border-slate-200 bg-white shadow-2xl"
      >
        <div className="h-1 w-full shrink-0 bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-500" />
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/90 px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-lg font-black text-slate-900">{row.store_name}</p>
            <p className="mt-0.5 text-xs tabular-nums text-slate-500">#{row.store_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-8 overflow-y-auto px-5 py-6 text-slate-800">
          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">معلومات المكالمة</p>
            <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-sm">
              <div className="flex items-start gap-2">
                <User size={16} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
                <div>
                  <span className="font-medium text-slate-500">الموظف: </span>
                  {row.staff_fullname || row.staff_username || '—'}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Calendar size={16} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
                <div>
                  <span className="font-medium text-slate-500">التاريخ والوقت: </span>
                  <span className="tabular-nums">{fmtServerAt(row.created_at)}</span>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <ClipboardList size={16} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
                <div>
                  <span className="font-medium text-slate-500">مرحلة المكالمة: </span>
                  {loading ? '…' : callStage != null ? `مكالمة ${callStage}` : 'غير محدد في السجل'}
                </div>
              </div>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">إجابات الاستبيان</p>
            {row.survey_kind === 'new_merchant_onboarding' && row.answers && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {row.answers.map((a, i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/80 p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="text-lg" style={{ color: a.yes ? PRO.green : PRO.red }} aria-hidden>
                        ●
                      </span>
                      <span className="text-xs font-bold text-slate-900">{a.label}</span>
                    </div>
                    <p className="text-[10px] tabular-nums text-slate-500">{fmtServerAt(row.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            {row.survey_kind === 'active_csat' && row.questions && (
              <>
                {radarData.length > 0 && (
                  <div className="mb-6 h-[200px] w-full rounded-xl border border-slate-200 bg-white p-2 shadow-inner" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <PolarRadiusAxis
                          angle={90}
                          domain={[0, 5]}
                          tickCount={6}
                          tick={{ fontSize: 9, fill: '#64748b' }}
                        />
                        <Radar name="A" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {row.questions.map((q, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                      <p className="mb-2 text-xs font-bold text-slate-900">{q.label}</p>
                      <div className="flex items-center justify-between gap-2">
                        <AnimatedStars value={q.value} />
                        <span className="text-sm font-semibold tabular-nums text-slate-800">{q.value}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-sm font-black text-slate-900">الملاحظات والتعليقات</p>
              <button
                type="button"
                onClick={() => void copyNote()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
              >
                <Copy size={14} />
                نسخ
              </button>
            </div>
            {(row.suggestions || '').trim() !== '' && (
              <div className="mb-4">
                <p className="mb-1 text-[11px] font-medium text-slate-500">صوت المتجر (مسجّل)</p>
                <p className="whitespace-pre-wrap border-b border-slate-100 pb-3 text-sm leading-relaxed text-slate-700">
                  {(row.suggestions || '').trim()}
                </p>
              </div>
            )}
            {latestCallNote?.text ? (
              <div>
                <p className="mb-1 text-[11px] font-medium text-slate-500">ملاحظة المكالمة (الموظف)</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{latestCallNote.text}</p>
                <p className="mt-1 text-[10px] tabular-nums text-slate-500">
                  {latestCallNote.by ? `${latestCallNote.by} — ` : ''}
                  {fmtServerAt(latestCallNote.at)}
                </p>
              </div>
            ) : (
              !((row.suggestions || '').trim()) && (
                <p className="text-sm text-slate-500">لا توجد ملاحظات نصية في هذا السجل.</p>
              )
            )}
          </div>
        </div>

        {row.arrow === 'down' && !row.resolved && (
          <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-4">
            <button
              type="button"
              onClick={() => onResolve?.(row.id)}
              disabled={resolveBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-md hover:bg-violet-700 disabled:opacity-60"
            >
              {resolveBusy ? <Loader2 size={18} className="animate-spin" /> : null}
              تم حل المشكلة ✅
            </button>
          </div>
        )}
        {row.arrow === 'down' && row.resolved && (
          <div className="shrink-0 border-t border-emerald-200 bg-emerald-50 px-5 py-3 text-center text-sm font-bold text-emerald-800">
            تم تسجيل حل هذه المشكلة
          </div>
        )}
      </motion.aside>
    </motion.div>
  )
}

/**
 * التحقق السريع — استبيان تهيئة (3) منفصل عن CSAT التجار النشطين (6 نجوم).
 * يُفعَّل في التطوير وبناء التجريبي فقط.
 */
export default function QuickVerification() {
  const { user, can } = useAuth()
  const { allStores, counts } = useStores()
  const [mainTab, setMainTab] = useState('onboarding')
  const [staffMissions, setStaffMissions] = useState([])
  const [activeStaffMissions, setActiveStaffMissions] = useState([])
  const [detailRows, setDetailRows] = useState([])
  const [activeDetailRows, setActiveDetailRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [redOnly, setRedOnly] = useState(false)
  const [modalRow, setModalRow] = useState(null)
  /** تبويبات الرضا — تجريبي فقط */
  const [satTab, setSatTab] = useState('all')
  const [resolvingId, setResolvingId] = useState(null)
  /** قيد التدقيق vs سجل الحلول — تجريبي */
  const [auditViewTab, setAuditViewTab] = useState('active')
  const [quickSearch, setQuickSearch] = useState('')
  /** إخفاء فوري للصف بعد الحل — تجريبي */
  const [optimisticResolvedIds, setOptimisticResolvedIds] = useState(() => new Set())

  const loadAll = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await getQuickVerificationBourse({
        user_role: user?.role || '',
        username: user?.username || '',
      })
      if (d?.success) {
        setDetailRows(Array.isArray(d.rows) ? d.rows : [])
        setStaffMissions(Array.isArray(d.staff_summary) ? d.staff_summary : [])
        setActiveDetailRows(Array.isArray(d.active_csat_rows) ? d.active_csat_rows : [])
        setActiveStaffMissions(Array.isArray(d.active_csat_staff_summary) ? d.active_csat_staff_summary : [])
        setOptimisticResolvedIds(new Set())
        return d
      }
      setDetailRows([])
      setStaffMissions([])
      setActiveDetailRows([])
      setActiveStaffMissions([])
      setErr(d?.error || 'تعذّر تحميل بيانات التحقق السريع.')
      return null
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setStaffMissions([])
      setActiveStaffMissions([])
      setDetailRows([])
      setActiveDetailRows([])
      return null
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username])

  const resolveAudit = useCallback(
    async surveyId => {
      setResolvingId(surveyId)
      setErr('')
      try {
        const res = await postQuickVerificationResolveAudit({
          survey_id: surveyId,
          user_role: user?.role || 'executive',
          resolved_by: user?.username || '',
        })
        if (!res?.success) {
          setErr(res?.error || 'تعذّر حفظ الحل.')
          return
        }
        setOptimisticResolvedIds(prev => new Set([...prev, surveyId]))
        const d = await loadAll()
        if (d?.success) {
          setAuditViewTab('resolved')
          setModalRow(null)
        } else {
          setOptimisticResolvedIds(prev => {
            const n = new Set(prev)
            n.delete(surveyId)
            return n
          })
        }
      } catch (e) {
        setErr(e?.response?.data?.error || e?.message || 'تعذّر حفظ الحل.')
        setOptimisticResolvedIds(prev => {
          const n = new Set(prev)
          n.delete(surveyId)
          return n
        })
      } finally {
        setResolvingId(null)
      }
    },
    [loadAll, user?.username, user?.role],
  )

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const currentDetails = mainTab === 'onboarding' ? detailRows : activeDetailRows
  const currentStaff = mainTab === 'onboarding' ? staffMissions : activeStaffMissions

  const satStats = useMemo(() => {
    let sat = 0
    let uns = 0
    currentDetails.forEach(r => {
      if (r.arrow === 'up') sat += 1
      else if (r.arrow === 'down') uns += 1
    })
    return { total: currentDetails.length, sat, uns }
  }, [currentDetails])

  /** مؤشر الأداء التنفيذي — مشاكل 🔽 ومُحلّة */
  const execMetrics = useMemo(() => {
    const downAudits = currentDetails.filter(r => r.arrow === 'down')
    const totalProblems = downAudits.length
    const resolvedProblems = downAudits.filter(r => r.resolved).length
    const pct =
      totalProblems === 0 ? 100 : Math.min(100, Math.round((resolvedProblems / totalProblems) * 100))
    return { totalProblems, resolvedProblems, pct }
  }, [currentDetails])

  const filteredDetails = useMemo(() => {
    if (IS_VITE_APP_STAGING) {
      if (satTab === 'up') return currentDetails.filter(r => r.arrow === 'up')
      if (satTab === 'down') return currentDetails.filter(r => r.arrow === 'down')
      return currentDetails
    }
    if (!redOnly) return currentDetails
    if (mainTab === 'onboarding') {
      return currentDetails.filter(r => r.arrow === 'down')
    }
    return currentDetails.filter(r => r.arrow === 'down' || r.tier === 'red')
  }, [currentDetails, redOnly, mainTab, satTab])

  /** واجهة التدقيق: بدون المُحلّة من قائمة المتابعة؛ سجل الحلول منفصل */
  const activeAuditStagingRows = useMemo(() => {
    if (!IS_VITE_APP_STAGING) return []
    let rows = filteredDetails.filter(r => !(r.arrow === 'down' && r.resolved))
    rows = rows.filter(r => rowMatchesQuickSearch(r, quickSearch))
    return sortActiveAuditRows(rows, allStores)
  }, [filteredDetails, quickSearch, allStores])

  const resolvedHistoryRows = useMemo(() => {
    if (!IS_VITE_APP_STAGING) return []
    let rows = currentDetails.filter(r => r.arrow === 'down' && r.resolved)
    rows = rows.filter(r => rowMatchesQuickSearch(r, quickSearch))
    return [...rows].sort((a, b) => {
      const ta = new Date(a.resolved_at || 0).getTime()
      const tb = new Date(b.resolved_at || 0).getTime()
      return tb - ta
    })
  }, [currentDetails, quickSearch])

  const stagingDisplayRows = auditViewTab === 'active' ? activeAuditStagingRows : resolvedHistoryRows

  const visibleStagingRows = useMemo(
    () => stagingDisplayRows.filter(r => !optimisticResolvedIds.has(r.id)),
    [stagingDisplayRows, optimisticResolvedIds],
  )

  const isDirectorView = user?.role === 'executive'

  const csatRatioValue = useMemo(() => {
    const t = satStats.total
    if (!t) return '—'
    return `${Math.round((satStats.sat / t) * 100)}%`
  }, [satStats])

  const directorStaffBarData = useMemo(() => {
    return (currentStaff || []).map(s => ({
      name: (s.fullname || s.username || '—').slice(0, 20),
      surveys: s.answered_surveys_today ?? 0,
      key: s.username || s.fullname || String(Math.random()),
    }))
  }, [currentStaff])

  const myResolvedToday = useMemo(() => {
    const u = user?.username
    if (!u) return 0
    return currentDetails.filter(r => r.staff_username === u && r.arrow === 'down' && r.resolved).length
  }, [currentDetails, user?.username])

  const myOpenAuditCount = useMemo(() => {
    const u = user?.username
    if (!u) return 0
    return currentDetails.filter(r => r.staff_username === u && r.arrow === 'down' && !r.resolved).length
  }, [currentDetails, user?.username])

  const radarData = useMemo(() => {
    if (!modalRow?.questions?.length) return []
    return modalRow.questions.map(q => ({
      subject: q.label.length > 10 ? `${q.label.slice(0, 9)}…` : q.label,
      score: q.value,
      fullMark: 5,
    }))
  }, [modalRow])

  if (!IS_STAGING_OR_DEV) {
    return <Navigate to="/" replace />
  }
  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  const totalStoresCount = counts?.total ?? allStores?.length ?? 0

  return (
    <div
      className={`relative isolate ${IS_VITE_APP_STAGING ? 'min-h-[100vh] pb-10 px-3 md:px-5 pt-4' : 'space-y-5 pb-16'}`}
      dir="rtl"
      style={{
        fontFamily: IS_VITE_APP_STAGING ? "'Tajawal', sans-serif" : "'Cairo', sans-serif",
        background: IS_VITE_APP_STAGING ? STAGING_LIGHT.pageBg : DS.bgPage,
      }}
    >
      {IS_VITE_APP_STAGING ? (
        <div className="mx-auto max-w-6xl px-4 pb-14 pt-6 md:px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-md"
          >
            <div className="h-1 w-full bg-gradient-to-r from-violet-600 via-purple-500 to-indigo-600" />
            <div className="space-y-5 px-5 py-5 sm:px-8 sm:py-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-8">
                <div className="min-w-0 flex-1">
                  <h1 className="text-2xl font-black tracking-tight text-slate-900 md:text-[1.7rem]">التحقق السريع</h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {mainTab === 'onboarding' ? 'متاجر جدد' : 'تجار نشطون'} ·{' '}
                    <span className="tabular-nums font-semibold text-slate-700">{satStats.total}</span> استبيان · راضٍ{' '}
                    <span className="tabular-nums text-emerald-600">{satStats.sat}</span> · غير راضٍ{' '}
                    <span className="tabular-nums text-rose-600">{satStats.uns}</span>
                  </p>
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center lg:max-w-xl">
                  <label className="relative min-w-0 flex-1">
                    <span className="sr-only">بحث</span>
                    <Search
                      className="pointer-events-none absolute right-3 top-1/2 z-[1] -translate-y-1/2 text-slate-400"
                      size={18}
                      aria-hidden
                    />
                    <input
                      type="search"
                      value={quickSearch}
                      onChange={e => setQuickSearch(e.target.value)}
                      placeholder="بحث باسم المتجر أو الكود…"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-10 pl-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                      autoComplete="off"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void loadAll()}
                    disabled={loading}
                    className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-violet-500/20 hover:bg-violet-700 disabled:opacity-50"
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} strokeWidth={2} />
                    تحديث
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="تصفية الرضا">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'down', label: 'غير راضٍ' },
                  { id: 'up', label: 'راضٍ' },
                ].map(t => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={satTab === t.id}
                    onClick={() => setSatTab(t.id)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                      satTab === t.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="نوع الاستبيان">
                  <button
                    type="button"
                    onClick={() => setMainTab('onboarding')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                      mainTab === 'onboarding' ? 'text-violet-700 underline decoration-2' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    متاجر جدد
                  </button>
                  <button
                    type="button"
                    onClick={() => setMainTab('active_csat')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                      mainTab === 'active_csat' ? 'text-violet-700 underline decoration-2' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    تجار نشطون
                  </button>
                </div>
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="التدقيق">
                  <button
                    type="button"
                    onClick={() => setAuditViewTab('active')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                      auditViewTab === 'active' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    قيد التدقيق
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuditViewTab('resolved')}
                    className={`rounded-lg px-3 py-1.5 text-sm font-bold transition ${
                      auditViewTab === 'resolved' ? 'text-slate-900' : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    سجل الحلول
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <QuickAuditStatCard
              title="إجمالي المتاجر"
              value={totalStoresCount.toLocaleString('ar-SA')}
              sub="إجمالي من السياق"
              gradient="linear-gradient(135deg, #4c1d95, #6d28d9, #7c3aed)"
              glow="#6d28d955"
              icon={Package}
            />
            <QuickAuditStatCard
              title="راضٍ / غير راضٍ"
              value={csatRatioValue}
              sub={`راضٍ ${satStats.sat} · غير راضٍ ${satStats.uns} · من ${satStats.total}`}
              gradient="linear-gradient(135deg, #047857, #059669, #10b981)"
              glow="#05966955"
              icon={BarChart3}
            />
            <QuickAuditStatCard
              title="المشاكل المكتشفة"
              value={execMetrics.totalProblems.toLocaleString('ar-SA')}
              sub="استبيانات 🔽 في القسم الحالي"
              gradient="linear-gradient(135deg, #c2410c, #ea580c, #f97316)"
              glow="#ea580655"
              icon={AlertCircle}
            />
            <QuickAuditStatCard
              title="مشاكل تم حلها"
              value={execMetrics.resolvedProblems.toLocaleString('ar-SA')}
              sub={execMetrics.totalProblems ? `نسبة الإنجاز ${execMetrics.pct}%` : '—'}
              gradient="linear-gradient(135deg, #3730a3, #4f46e5, #6366f1)"
              glow="#6366f155"
              icon={CheckCircle2}
            />
          </div>

          {err ? (
            <p className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
              {err}
            </p>
          ) : null}

          <section className="mb-10">
            <h2 className="mb-4 text-lg font-black text-slate-900">
              {isDirectorView ? 'أداء الموظفين (اليوم)' : 'أداؤك الشخصي'}
              <span className="mr-2 text-sm font-normal text-slate-500">
                — {mainTab === 'onboarding' ? 'تهيئة' : 'CSAT نشط'}
              </span>
            </h2>
            {loading && currentStaff.length === 0 && currentDetails.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-14 text-sm text-slate-500 shadow-sm">
                <Loader2 size={20} className="animate-spin text-violet-600" />
                جارٍ التحميل…
              </div>
            ) : isDirectorView ? (
              !currentStaff?.length ? (
                <p className="rounded-2xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                  لا توجد بيانات موظفين اليوم في هذا القسم.
                </p>
              ) : (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <p className="mb-4 text-sm font-bold text-slate-700">استبيانات مكتملة لكل موظف</p>
                  <div className="h-[min(420px,28rem)] w-full" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={[...directorStaffBarData].reverse()}
                        margin={{ top: 8, right: 12, left: 8, bottom: 8 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} allowDecimals={false} />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={108}
                          tick={{ fontSize: 11, fill: '#334155' }}
                        />
                        <RechartsTooltip
                          cursor={{ fill: '#f8fafc' }}
                          contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', textAlign: 'right' }}
                        />
                        <Bar dataKey="surveys" fill="#6366f1" radius={[0, 8, 8, 0]} name="استبيانات" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl shadow-lg"
                style={{
                  background: 'linear-gradient(135deg, #0d9488, #059669)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), 0 8px 28px rgba(5,150,105,0.35)',
                }}
              >
                <div className="px-6 py-8 text-white">
                  <p className="text-sm font-bold text-white/85">مهامك المحلولة اليوم</p>
                  <p className="mt-2 text-5xl font-black tabular-nums drop-shadow-sm">{myResolvedToday}</p>
                  <p className="mt-3 text-sm font-medium text-white/90">
                    متابعة مفتوحة (🔽): <span className="tabular-nums font-black">{myOpenAuditCount}</span>
                  </p>
                  <p className="mt-2 text-xs text-white/75">@{user?.username || '—'}</p>
                </div>
              </motion.div>
            )}
          </section>

          <section>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <h2 className="text-lg font-black text-slate-900">
                {auditViewTab === 'active' ? 'قائمة المتاجر — متابعة اليوم' : 'سجل الحلول'}
              </h2>
              <span className="text-xs font-semibold tabular-nums text-slate-500">{stagingDisplayRows.length} سجل</span>
            </div>
            {loading && currentDetails.length === 0 ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-16 text-sm text-slate-500 shadow-sm">
                <Loader2 size={22} className="animate-spin text-violet-600" />
                جارٍ تحميل التفاصيل…
              </div>
            ) : stagingDisplayRows.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-200 bg-white py-12 text-center text-sm text-slate-500">
                {auditViewTab === 'active'
                  ? 'لا توجد سجلات مطابقة في قيد التدقيق.'
                  : 'لا توجد مشاكل مُحلّاة في هذا القسم بعد.'}
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                <AnimatePresence mode="popLayout" initial={false}>
                  {visibleStagingRows.map(row => {
                    const shipN = resolveShipmentCount(allStores, row.store_id)
                    const resolvedDown = row.arrow === 'down' && !!row.resolved
                    const isHighRisk =
                      auditViewTab === 'active' &&
                      row.arrow === 'down' &&
                      !row.resolved &&
                      shipN != null &&
                      shipN > HIGH_SHIPMENT_THRESHOLD
                    const showResolve =
                      auditViewTab === 'active' && row.arrow === 'down' && !row.resolved
                    const staffLabel = row.staff_username || row.staff_fullname || '—'
                    return (
                      <motion.div
                        key={row.id}
                        layout
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{
                          opacity: 0,
                          height: 0,
                          marginBottom: 0,
                          transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] },
                        }}
                        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                        style={
                          isHighRisk
                            ? { boxShadow: '0 0 0 1px rgba(251, 191, 36, 0.45)' }
                            : undefined
                        }
                      >
                        <div className="flex flex-col gap-3 px-4 py-3.5 md:flex-row md:items-center md:justify-between md:gap-4">
                          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 md:gap-6">
                            <span className="inline-flex max-w-[7rem] items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                              {staffLabel}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-black text-slate-900">
                                {row.store_name}
                                {isHighRisk ? (
                                  <span className="mr-1.5 text-xs font-bold text-amber-600"> (أولوية)</span>
                                ) : null}
                              </p>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600">
                                <span className="tabular-nums">#{row.store_id}</span>
                                <span className="text-slate-300">|</span>
                                <span className="tabular-nums font-semibold">
                                  {shipN != null ? shipN.toLocaleString('ar-EG') : '—'} شحنة
                                </span>
                              </div>
                              {auditViewTab === 'resolved' ? (
                                <p className="mt-1 text-xs text-slate-500">
                                  مدة المعالجة: {formatResolveDuration(row.created_at, row.resolved_at)}
                                </p>
                              ) : null}
                            </div>
                            <div className="shrink-0">
                              <LightRowSatisfactionGlyph arrow={row.arrow} resolvedDown={resolvedDown} />
                            </div>
                          </div>
                          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                            {showResolve ? (
                              <button
                                type="button"
                                onClick={() => void resolveAudit(row.id)}
                                disabled={resolvingId === row.id}
                                className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-black text-white shadow-md hover:bg-violet-700 disabled:opacity-60"
                              >
                                {resolvingId === row.id ? <Loader2 size={16} className="animate-spin" /> : null}
                                تم الحل ✅
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => setModalRow(row)}
                              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-violet-700 hover:bg-slate-50"
                            >
                              تفاصيل
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )
                  })}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>
      ) : null}

      {!IS_VITE_APP_STAGING && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900">
              <ShieldCheck size={22} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">التحقق السريع</h1>
              <p className="mt-0.5 text-sm text-slate-600">
                {mainTab === 'onboarding'
                  ? 'استبيان تهيئة المتجر الجديد (ثلاثة أسئلة نعم/لا): الكل نعم 🔼، أي لا 🔽.'
                  : 'استبيان رضا التجار النشطين — ستة محاور بنجوم 1–5: المتوسط ≥4 🔼، 3–3.9 ↔️، أقل من 3 🔽.'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setRedOnly(v => !v)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                redOnly
                  ? 'border-rose-600 bg-rose-600 text-white'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Filter size={16} />
              {redOnly ? 'عرض الكل' : 'فقط الأحمر / الهبوط'}
            </button>
            <button
              type="button"
              onClick={() => void loadAll()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              تحديث
            </button>
          </div>
        </div>
      )}

      {!IS_VITE_APP_STAGING && (
        <div
          className="flex flex-wrap gap-2 rounded-2xl border p-2"
          style={{ borderColor: DS.border, background: 'rgba(255,255,255,0.7)' }}
        >
          <button
            type="button"
            onClick={() => setMainTab('onboarding')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              mainTab === 'onboarding'
                ? 'border bg-white text-slate-900 shadow-sm'
                : 'border border-transparent text-slate-600 hover:bg-white/90'
            }`}
            style={mainTab === 'onboarding' ? { borderColor: DS.border } : undefined}
          >
            <Store size={18} strokeWidth={1.8} />
            متاجر جدد (تهيئة)
          </button>
          <button
            type="button"
            onClick={() => setMainTab('active_csat')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition-all ${
              mainTab === 'active_csat'
                ? 'border bg-white text-slate-900 shadow-sm'
                : 'border border-transparent text-slate-600 hover:bg-white/90'
            }`}
            style={mainTab === 'active_csat' ? { borderColor: DS.border } : undefined}
          >
            <Truck size={18} strokeWidth={1.8} />
            تجار نشطون (CSAT)
          </button>
        </div>
      )}

      {err && !IS_VITE_APP_STAGING ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">{err}</p>
      ) : null}

      {!IS_VITE_APP_STAGING && (
        <section className="rounded-2xl border border-slate-700/50 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 p-4 text-white shadow-lg ring-1 ring-white/5 lg:p-5">
          <h2 className="mb-3 text-sm font-black tracking-tight text-slate-100">
            ملخص الموظفين (اليوم) — {mainTab === 'onboarding' ? 'تهيئة' : 'CSAT نشط'}
          </h2>
          {loading && currentStaff.length === 0 && currentDetails.length === 0 ? (
            <div className="relative z-10 flex items-center justify-center gap-2 py-8 text-sm text-slate-400">
              <Loader2 size={20} className="animate-spin" />
              جارٍ التحميل…
            </div>
          ) : !currentStaff?.length ? (
            <p className="relative z-10 py-6 text-center text-sm text-slate-500">لا توجد بيانات موظفين اليوم في هذا القسم.</p>
          ) : (
            <ul className="relative z-10 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              {currentStaff.map(row => {
                const arrow = row.satisfaction_arrow
                const up = arrow === 'up'
                const mid = arrow === 'mid'
                return (
                  <li
                    key={row.username || row.fullname}
                    className="flex items-center justify-between gap-2 rounded-xl border border-slate-600/40 bg-slate-800/35 px-3 py-2.5 backdrop-blur-sm"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-slate-50">{row.fullname || row.username}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {row.role || '—'} · {row.answered_surveys_today ?? 0} استبيان
                      </p>
                    </div>
                    <button
                      type="button"
                      className="-m-1 flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg p-1 transition-colors hover:bg-white/10"
                      onClick={() => {
                        const u = row.username
                        const pool = mainTab === 'onboarding' ? detailRows : activeDetailRows
                        const first = u
                          ? pool.find(dr => dr.staff_username === u)
                          : pool.find(dr => (dr.staff_fullname || '') === (row.fullname || ''))
                        if (first) setModalRow(first)
                      }}
                      title="عرض تفاصيل استبيان مرتبط بهذا الموظف إن وُجد"
                    >
                      {up ? (
                        <ArrowBigUp size={22} strokeWidth={2.5} className="text-emerald-400" aria-hidden />
                      ) : mid ? (
                        <ArrowLeftRight size={22} strokeWidth={2.5} className="text-amber-400" aria-hidden />
                      ) : (
                        <ArrowBigDown size={22} strokeWidth={2.5} className="text-rose-400" aria-hidden />
                      )}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>
      )}

      {!IS_VITE_APP_STAGING && (
        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 bg-slate-50 px-4 py-3">
            <h2 className="text-sm font-black text-slate-900">
              {mainTab === 'onboarding' ? 'استبيانات تهيئة المتاجر (اليوم)' : 'تجار نشطون — متوسط الرضا (اليوم)'}
            </h2>
            <span className="text-xs tabular-nums text-slate-500">{filteredDetails.length} سجل</span>
          </div>
          {loading && currentDetails.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
              <Loader2 size={22} className="animate-spin" />
              جارٍ تحميل التفاصيل…
            </div>
          ) : filteredDetails.length === 0 ? (
            <p className="py-12 text-center text-sm text-slate-500">لا توجد سجلات مطابقة.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-xs">
                  <th className="px-4 py-2 font-bold">المتجر</th>
                  {mainTab === 'active_csat' && (
                    <th className="px-4 py-2 font-bold w-28">المتوسط</th>
                  )}
                  <th className="px-4 py-2 font-bold">الموظف</th>
                  <th className="px-4 py-2 font-bold w-28">المؤشر</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 hover:bg-violet-50/50 cursor-pointer transition-colors"
                    onClick={() => setModalRow(row)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => {
                      if (e.key === 'Enter') setModalRow(row)
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{row.store_name}</td>
                    {mainTab === 'active_csat' && (
                      <td className="px-4 py-3 tabular-nums font-bold text-slate-800">{row.avg}</td>
                    )}
                    <td className="px-4 py-3 text-slate-700">{row.staff_fullname || row.staff_username || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-bold" title={row.arrow}>
                        <ArrowForState arrow={row.arrow} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      <AnimatePresence>
        {modalRow && IS_VITE_APP_STAGING && (
          <StagingAuditDrawer
            key={modalRow.id}
            row={modalRow}
            onClose={() => setModalRow(null)}
            onResolve={resolveAudit}
            resolveBusy={resolvingId === modalRow.id}
            auditUser={{ role: user?.role, username: user?.username }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalRow && !IS_VITE_APP_STAGING && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/55"
            onClick={() => setModalRow(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[min(90vh,720px)] overflow-hidden border border-slate-200"
              dir="rtl"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <p className="font-black text-sm">تقرير الاستبيان</p>
                <button type="button" onClick={() => setModalRow(null)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(min(90vh,720px)-56px)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم المتجر</p>
                  <p className="text-slate-900 font-bold">{modalRow.store_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم الموظف</p>
                  <p className="text-slate-800">{modalRow.staff_fullname || modalRow.staff_username || '—'}</p>
                </div>

                {(modalRow.suggestions || '').trim() !== '' && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1">
                      ملاحظات أو مقترحات المتجر
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5 leading-relaxed">
                      {(modalRow.suggestions || '').trim()}
                    </p>
                  </div>
                )}

                {modalRow.survey_kind === 'active_csat' && modalRow.questions && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-600">متوسط الستة:</span>
                      <span className="font-black tabular-nums text-violet-800">{modalRow.avg}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                          modalRow.tier === 'green'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : modalRow.tier === 'yellow'
                              ? 'bg-amber-50 text-amber-950 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200'
                        }`}
                      >
                        {modalRow.tier === 'green'
                          ? '🔼 راضٍ'
                          : modalRow.tier === 'yellow'
                            ? '↔️ محايد / خطر'
                            : '🔽 غير راضٍ'}
                      </span>
                    </div>

                    {radarData.length > 0 && (
                      <div className="h-[260px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#475569' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                            <Radar
                              name="التقييم"
                              dataKey="score"
                              stroke="#7c3aed"
                              fill="#7c3aed"
                              fillOpacity={0.35}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">التفصيل حسب المحور</p>
                      <ul className="space-y-2">
                        {modalRow.questions.map((q, i) => (
                          <li
                            key={i}
                            className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-2 flex-wrap ${
                              q.risk === 'high'
                                ? 'border-rose-300 bg-rose-50 text-rose-950'
                                : q.risk === 'mid'
                                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                                  : 'border-emerald-100 bg-emerald-50/60 text-emerald-950'
                            }`}
                          >
                            <span className="font-bold">{q.label}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <MiniStars value={q.value} />
                              <span className="tabular-nums font-black">{q.value}/5</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {modalRow.survey_kind !== 'active_csat' && (
                  <>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">نتائج الاستبيان التفصيلية</p>
                      <ul className="space-y-2">
                        {(modalRow.answers || []).map((a, i) => (
                          <li
                            key={i}
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              a.yes
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-rose-200 bg-rose-50 text-rose-900'
                            }`}
                          >
                            <span className="font-bold">{a.label}:</span>{' '}
                            {a.yes ? 'نعم' : 'لا'}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">سبب الخلل / التاغ</p>
                      {modalRow.gap_tags?.length ? (
                        <div className="flex flex-wrap gap-1.5">
                          {modalRow.gap_tags.map(t => (
                            <span
                              key={t}
                              className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">لا يوجد — جميع الإجابات إيجابية.</p>
                      )}
                    </div>
                  </>
                )}

                {modalRow.survey_kind === 'active_csat' && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-2">تاغات الفجوة (≤3)</p>
                    {modalRow.gap_tags?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {modalRow.gap_tags.map(t => (
                          <span
                            key={t}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">لا يوجد.</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
