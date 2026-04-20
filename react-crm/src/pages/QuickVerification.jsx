import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  RefreshCw,
  Loader2,
  TrendingUp,
  Timer,
  AlertTriangle,
  X,
  CheckCircle2,
  Store,
  Flame,
  Sparkles,
  BarChart3,
  ClipboardList,
  Shield,
  ListFilter,
  ArrowDownAZ,
  ArrowUpAZ,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const MASTER_SURVEY_PAGE_SIZE = 10
import { useAuth } from '../contexts/AuthContext'
import { getQuickVerificationBourse, postQuickVerificationResolveAudit } from '../services/api'
import { QV_MISSED_INC_TAG } from '../utils/merchantOfficerQueue'
import { NawrasHeroImageLayer, NawrasTaglineStack } from '../components/NawrasBrandBackdrop'

function formatYMD(d) {
  const dt = d instanceof Date ? d : new Date(d)
  if (Number.isNaN(dt.getTime())) return ''
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** افتراضي: سنة كاملة للخلف — عرض الاستبيانات السابقة */
function getDefaultHistoryRange() {
  const to = new Date()
  const from = new Date()
  from.setFullYear(from.getFullYear() - 1)
  return { from: formatYMD(from), to: formatYMD(to) }
}

function surveyKindLabel(kind) {
  switch (kind) {
    case 'new_merchant_onboarding':
      return 'تهيئة'
    case 'active_csat':
      return 'نشط CSAT'
    case 'inactive_feedback':
      return 'غير نشط'
    case 'freeze_alert':
      return 'تجميد'
    case 'needs_freeze_request':
      return 'يحتاج تجميد'
    default:
      return kind || '—'
  }
}

function qvTrackLabel(track) {
  switch (track) {
    case 'incubation':
      return 'مسار الاحتضان'
    case 'active':
      return 'نشطة'
    case 'inactive':
      return 'غير نشطة'
    case 'other':
      return 'أخرى'
    default:
      return '—'
  }
}

/** يتوافق مع الخادم عند غياب qv_track (بيانات قديمة). */
function rowQvTrack(row) {
  if (row.qv_track) return row.qv_track
  const c = (row.store_category || '').trim()
  if (c === 'incubating') return 'incubation'
  if (['inactive', 'hot_inactive', 'cold_inactive', 'restoring', 'restored', 'recovered'].includes(c)) return 'inactive'
  if (['active', 'active_pending_calls', 'active_shipping', 'completed', 'unreachable', 'frozen'].includes(c)) return 'active'
  return 'other'
}

function formatSurveyDate(iso) {
  if (!iso) return '—'
  try {
    const d = new Date(String(iso).replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return String(iso).slice(0, 16)
    return d.toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return String(iso)
  }
}

function rowMatchesQuery(row, q) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const id = String(row.store_id ?? '')
  const name = (row.store_name || '').toLowerCase()
  const staff = (row.staff_username || row.staff_fullname || '').toLowerCase()
  const fr = String(row.freeze_reason || '').toLowerCase()
  const src = String(row.source_label || '').toLowerCase()
  const sug = String(row.suggestions || '').toLowerCase()
  return id.includes(s) || name.includes(s) || staff.includes(s) || fr.includes(s) || src.includes(s) || sug.includes(s)
}

function isSatisfied(row) {
  if (row.survey_kind === 'freeze_alert' || row.survey_kind === 'needs_freeze_request') return false
  return row.arrow === 'up'
}

/** غير راضٍ أو محايد — يظهر في مركز الأزمات */
function isCrisis(row) {
  return !isSatisfied(row)
}

function satisfactionPercent(row) {
  if (row.survey_kind === 'freeze_alert' || row.survey_kind === 'needs_freeze_request') return 0
  if (row.survey_kind === 'inactive_feedback') return 0
  if (row.survey_kind === 'new_merchant_onboarding') {
    const ans = row.answers || []
    const yes = ans.filter(a => a.yes).length
    return Math.round((yes / Math.max(1, ans.length)) * 100)
  }
  const avg = Number(row.avg) || 0
  return Math.min(100, Math.round((avg / 5) * 100))
}

/** رأس تنفيذي — تدرج عميق، شبكة خفيفة، مؤشرات زجاجية */
function QuickAuditTopNav({ growth, resolution, globalSat, loading }) {
  const n = Math.min(100, Math.max(0, Number(globalSat) || 0))
  /** بدون padStart: كان 1% يُعرض كصندوقين «0» و«1» فيُقرأ خطأً كـ 001% */
  const sat = loading ? null : String(n)
  return (
    <header
      className="relative isolate w-full overflow-hidden rounded-b-[1.35rem] border border-white/15 border-t-0 shadow-[0_8px_0_0_rgba(167,139,250,0.12),0_28px_80px_-28px_rgba(15,23,42,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-violet-300/25 ring-offset-0 backdrop-blur-2xl sm:rounded-b-[1.75rem]"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <NawrasHeroImageLayer opacity={0.13} footerCropPct={16} className="z-0 mix-blend-soft-light rounded-b-[inherit]" />
      {/* إطار متدرج خفيف — يبرز حواف الكتلة */}
      <div
        className="pointer-events-none absolute inset-0 z-[1] rounded-b-[inherit] bg-gradient-to-b from-white/[0.08] via-transparent to-transparent opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[1px] z-[1] rounded-b-[calc(1.35rem-2px)] border border-white/[0.07] border-t-0 sm:rounded-b-[calc(1.75rem-2px)]"
        aria-hidden
      />
      {/* لمعان سفلي — خط فاصل أنيق يندمج مع الشريط التالي */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[3px] bg-gradient-to-r from-violet-500/0 via-fuchsia-300/35 to-violet-500/0 blur-[2px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-[12%] bottom-0 z-[1] h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
        aria-hidden
      />
      {/* لمسات جانبية رأسية */}
      <div
        className="pointer-events-none absolute inset-y-6 right-0 z-[1] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent opacity-80 sm:inset-y-8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-6 left-0 z-[1] w-px bg-gradient-to-b from-transparent via-white/25 to-transparent opacity-80 sm:inset-y-8"
        aria-hidden
      />
      <div
        className="absolute inset-0 z-[1] bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(167,139,250,0.35),transparent_50%),radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(59,130,246,0.12),transparent_45%)]"
        aria-hidden
      />
      <div className="absolute inset-0 z-[1] bg-gradient-to-br from-slate-950/88 via-[#2d0a52]/88 to-[#4B0082]/88" />
      <div
        className="pointer-events-none absolute inset-0 z-[1] opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative z-10 flex w-full min-w-0 flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 lg:px-10 lg:py-8 xl:px-12 2xl:px-16">
        <div className="min-w-0 flex-1 text-right">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.28em] text-violet-200/90 backdrop-blur-sm">
            <Sparkles size={12} className="text-amber-200/90" strokeWidth={2.2} />
            Executive Audit
          </div>
          <div className="mt-3 flex flex-col items-end gap-1 sm:flex-row sm:items-end sm:justify-end sm:gap-4">
            <h1 className="text-3xl font-black leading-[1.15] tracking-tight text-white sm:text-4xl md:text-[2.15rem]">
              التحقيق السريع
            </h1>
            <span className="text-sm font-medium text-white/55 md:pb-1 md:text-base">Quick Verification</span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/70 md:text-[0.95rem]">
            لوحة مراجعة تنفيذية لاستبيانات اليوم: أزمات الرضا، طلبات التجميد، ومتابعة الحلول — بلمحة سريعة ووضوح بصري.
          </p>
          <NawrasTaglineStack light className="mt-3 max-w-xl" />
          <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/[0.07] px-4 py-2.5 shadow-inner backdrop-blur-md">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-200">
                <TrendingUp size={16} strokeWidth={2.2} />
              </span>
              <div className="text-right leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">مؤشر النمو</p>
                <p className="text-lg font-black tabular-nums text-white">{loading ? '—' : `${growth}%`}</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/[0.07] px-4 py-2.5 shadow-inner backdrop-blur-md">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/20 text-amber-100">
                <Timer size={16} strokeWidth={2.2} />
              </span>
              <div className="text-right leading-tight">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/50">سرعة الحل</p>
                <p className="text-lg font-black tabular-nums text-white">{loading ? '—' : `${resolution}%`}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex w-full shrink-0 justify-center lg:w-auto lg:max-w-sm lg:justify-end">
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-gradient-to-br from-violet-200/40 via-white/25 to-fuchsia-300/30 p-[1.5px] shadow-[0_20px_50px_-20px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="rounded-[1.4rem] border border-white/10 bg-slate-950/50 px-6 py-5 sm:px-7 sm:py-6">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div className="text-right">
                  <p className="text-xs font-black text-white/95">الرضا العالمي</p>
                  <p className="mt-0.5 text-[11px] font-medium text-white/45">Global satisfaction index</p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500/25 text-violet-100 ring-1 ring-white/10">
                  <BarChart3 size={20} strokeWidth={2.2} />
                </div>
              </div>
              <div
                className="mt-5 flex items-end justify-center gap-1.5 sm:gap-2"
                aria-live="polite"
              >
                {loading ? (
                  <span className="py-2 text-4xl font-black tabular-nums text-white/40 sm:text-5xl">—</span>
                ) : (
                  <>
                    {sat.split('').map((ch, i) => (
                      <span
                        key={`${i}-${ch}`}
                        className="flex h-12 w-[1.75rem] items-center justify-center rounded-xl border border-white/20 bg-white/[0.08] text-2xl font-black tabular-nums text-white shadow-lg shadow-black/20 sm:h-14 sm:w-8 sm:text-3xl"
                      >
                        {ch}
                      </span>
                    ))}
                    <span className="mb-1 mr-0.5 text-3xl font-black text-white/90 sm:text-4xl">%</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}

/** شريط مؤشرات سريعة — بطاقات KPI بألوان ممتدة على كامل المربع */
function QvStatStrip({ total, openCrisis, resolved, globalSat, loading, rangeIsToday = true }) {
  const items = [
    {
      label: rangeIsToday ? 'تسجيلات اليوم' : 'إجمالي السجلات',
      sub: rangeIsToday ? 'إجمالي ما ورد للتحقيق' : 'ضمن نطاق التاريخ المحدد',
      value: loading ? '—' : total.toLocaleString('ar-SA'),
      icon: ClipboardList,
      fullBg:
        'bg-gradient-to-br from-fuchsia-600 via-violet-700 to-indigo-950 shadow-[0_18px_44px_-14px_rgba(91,33,182,0.65)] ring-2 ring-fuchsia-300/35',
      sheen:
        'bg-[radial-gradient(ellipse_100%_80%_at_100%_0%,rgba(255,255,255,0.22),transparent_55%)]',
    },
    {
      label: 'قيد المتابعة',
      sub: 'حالات تحتاج قراراً',
      value: loading ? '—' : openCrisis.toLocaleString('ar-SA'),
      icon: AlertTriangle,
      fullBg:
        'bg-gradient-to-br from-rose-600 via-orange-600 to-red-950 shadow-[0_18px_44px_-14px_rgba(225,29,72,0.55)] ring-2 ring-rose-300/40',
      sheen:
        'bg-[radial-gradient(ellipse_90%_70%_at_0%_0%,rgba(255,255,255,0.2),transparent_50%)]',
    },
    {
      label: 'تمت الأرشفة',
      sub: 'حُلّت أو أُغلقت',
      value: loading ? '—' : resolved.toLocaleString('ar-SA'),
      icon: CheckCircle2,
      fullBg:
        'bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-950 shadow-[0_18px_44px_-14px_rgba(5,150,105,0.55)] ring-2 ring-emerald-300/35',
      sheen:
        'bg-[radial-gradient(ellipse_100%_80%_at_80%_100%,rgba(255,255,255,0.18),transparent_55%)]',
    },
    {
      label: 'مؤشر الرضا',
      sub: 'لمحة تراكمية',
      value: loading ? '—' : `${Math.min(100, Math.max(0, Number(globalSat) || 0))}%`,
      icon: Shield,
      fullBg:
        'bg-gradient-to-br from-sky-500 via-cyan-500 to-blue-950 shadow-[0_18px_44px_-14px_rgba(14,165,233,0.55)] ring-2 ring-cyan-200/40',
      sheen:
        'bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,rgba(255,255,255,0.25),transparent_50%)]',
    },
  ]
  return (
    <div className="grid w-full grid-cols-2 gap-3 px-5 sm:px-8 md:grid-cols-4 md:gap-4 lg:px-10 xl:px-12 2xl:px-16">
      {items.map(it => (
        <div
          key={it.label}
          className={`group relative min-h-[7.75rem] overflow-hidden rounded-[1.125rem] transition duration-300 hover:-translate-y-1 hover:brightness-[1.05] ${it.fullBg}`}
        >
          <div className={`pointer-events-none absolute inset-0 ${it.sheen}`} aria-hidden />
          <div className="pointer-events-none absolute inset-0 opacity-30 mix-blend-overlay bg-[linear-gradient(135deg,rgba(255,255,255,0.15)_0%,transparent_45%,rgba(0,0,0,0.12)_100%)]" aria-hidden />
          <div className="relative flex h-full min-h-[7.5rem] flex-col justify-between p-4 pt-5 sm:p-[1.125rem]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 pr-1 text-right">
                <p className="text-[10px] font-black tracking-wide text-white/85 drop-shadow-sm">{it.label}</p>
                <p
                  className={`mt-1.5 font-black tabular-nums tracking-tight drop-shadow-md ${loading ? 'text-2xl text-white/35' : 'text-[1.65rem] leading-none text-white sm:text-[1.75rem]'}`}
                >
                  {it.value}
                </p>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-white shadow-inner ring-1 ring-white/30 transition duration-300 group-hover:scale-[1.06] sm:h-12 sm:w-12">
                <it.icon className="h-[1.15rem] w-[1.15rem] sm:h-5 sm:w-5" strokeWidth={2.2} />
              </span>
            </div>
            <p className="mt-3 border-t border-white/25 pt-2.5 text-[10px] font-semibold leading-relaxed text-white/80 sm:text-[11px]">
              {it.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionShell({ title, subtitle, count, children, empty }) {
  return (
    <section className="relative">
      <div className="relative mb-7 pb-6">
        <div
          className="pointer-events-none absolute bottom-0 left-0 right-0 h-[2px] rounded-full bg-gradient-to-l from-transparent via-violet-400/45 to-transparent"
          aria-hidden
        />
        <div className="min-w-0 text-right">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">{title}</h2>
            <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl bg-gradient-to-br from-violet-100/90 to-white px-3 text-sm font-black tabular-nums text-violet-950 shadow-sm ring-2 ring-violet-200/60 ring-offset-2 ring-offset-[#ebe7f5]">
              {count}
            </span>
          </div>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-right text-xs leading-relaxed text-slate-500 md:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {empty ? (
        <div className="rounded-2xl border-2 border-dashed border-violet-200/60 bg-gradient-to-b from-slate-50/80 to-violet-50/20 px-5 py-12 text-center shadow-inner">
          <p className="text-sm font-medium text-slate-400">لا توجد حالات في هذا القسم.</p>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

const LOGO_SIZES = {
  md: {
    box: 'h-14 w-14 rounded-2xl',
    letter: 'text-xl',
    ico: 'h-7 w-7 rounded-lg',
    store: 13,
  },
  sm: {
    box: 'h-11 w-11 rounded-xl',
    letter: 'text-lg',
    ico: 'h-6 w-6 rounded-md',
    store: 11,
  },
  xs: {
    box: 'h-9 w-9 rounded-lg',
    letter: 'text-base',
    ico: 'h-5 w-5 rounded-md',
    store: 10,
  },
}

function MerchantLogo({ name, storeId, size = 'md' }) {
  const ch = (name || String(storeId) || '?').trim().slice(0, 1)
  const s = LOGO_SIZES[size] || LOGO_SIZES.md
  return (
    <div
      className={`relative flex shrink-0 items-center justify-center border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/30 to-violet-100/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] ${s.box}`}
    >
      <span className={`font-black text-violet-900 ${s.letter}`}>{ch}</span>
      <span
        className={`absolute -bottom-0.5 -left-0.5 flex items-center justify-center border border-white bg-white shadow-md ring-1 ring-slate-200/80 ${s.ico}`}
      >
        <Store size={s.store} className="text-violet-700" strokeWidth={2.2} />
      </span>
    </div>
  )
}

/** كلما زاد عدد الحالات في القسم صغر مربع البطاقة لاستيعاب المزيد في الشاشة */
function crisisDensity(sectionCount) {
  const n = Math.max(0, Number(sectionCount) || 0)
  if (n >= 18) return 'ultra'
  if (n >= 10) return 'dense'
  if (n >= 5) return 'compact'
  return 'comfortable'
}

function CrisisCard({ row, onOpen, layoutId, sectionCount = 0 }) {
  const kindLabel =
    row.survey_kind === 'freeze_alert'
      ? 'تجميد'
      : row.survey_kind === 'needs_freeze_request'
        ? 'يحتاج تجميد'
        : row.survey_kind === 'inactive_feedback'
          ? 'غير نشط'
          : row.survey_kind === 'new_merchant_onboarding'
            ? 'تهيئة'
            : 'CSAT نشط'
  const displayName = row.store_name || `متجر #${row.store_id}`
  const headerBadge =
    row.survey_kind === 'freeze_alert'
      ? 'تجميد — تحقيق'
      : row.survey_kind === 'needs_freeze_request'
        ? 'تحتاج تجميد'
        : 'غير راضٍ'

  const tier = crisisDensity(sectionCount)
  const tierClass =
    tier === 'ultra'
      ? {
          minH: 'min-h-[112px]',
          outerRound: 'rounded-2xl',
          innerRound: 'rounded-[1.05rem]',
          topBar: 'left-2 right-2 top-2 h-0.5',
          head: 'mt-1 px-2.5 pb-2 pt-0.5 gap-1.5',
          name: 'text-[11px]',
          badge: 'px-1.5 py-0.5 text-[8px]',
          body: 'p-2',
          rowGap: 'mb-1.5 gap-1',
          meta: 'text-[10px]',
          footer: 'pt-1.5',
          footL: 'text-[9px]',
          footR: 'text-[9px]',
          logo: 'xs',
          showPriority: false,
        }
      : tier === 'dense'
        ? {
            minH: 'min-h-[142px]',
            outerRound: 'rounded-2xl',
            innerRound: 'rounded-[1.2rem]',
            topBar: 'left-2.5 right-2.5 top-2.5 h-0.5',
            head: 'mt-1.5 px-3 pb-2.5 pt-0.5 gap-2',
            name: 'text-[12px]',
            badge: 'px-2 py-0.5 text-[9px]',
            body: 'p-2.5',
            rowGap: 'mb-2 gap-1.5',
            meta: 'text-[11px]',
            footer: 'pt-2',
            footL: 'text-[9px]',
            footR: 'text-[10px]',
            logo: 'xs',
            showPriority: true,
          }
        : tier === 'compact'
          ? {
              minH: 'min-h-[168px]',
              outerRound: 'rounded-3xl',
              innerRound: 'rounded-[1.3rem]',
              topBar: 'left-3 right-3 top-3 h-0.5',
              head: 'mt-2 px-3.5 pb-3 pt-1 gap-2',
              name: 'text-[12.5px]',
              badge: 'px-2 py-0.5 text-[9px]',
              body: 'p-3',
              rowGap: 'mb-2.5 gap-2',
              meta: 'text-[11.5px]',
              footer: 'pt-2.5',
              footL: 'text-[10px]',
              footR: 'text-[10.5px]',
              logo: 'sm',
              showPriority: true,
            }
          : {
              minH: 'min-h-[200px]',
              outerRound: 'rounded-3xl',
              innerRound: 'rounded-[1.35rem]',
              topBar: 'left-3 right-3 top-3 h-1',
              head: 'mt-2 px-4 pb-3.5 pt-1 gap-2',
              name: 'text-[13px]',
              badge: 'px-2.5 py-1 text-[10px]',
              body: 'p-4',
              rowGap: 'mb-3 gap-2',
              meta: 'text-[12px]',
              footer: 'pt-3',
              footL: 'text-[10px]',
              footR: 'text-[11px]',
              logo: 'md',
              showPriority: true,
            }

  return (
    <motion.button
      type="button"
      layout
      layoutId={layoutId}
      onClick={() => onOpen(row)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
      className={`group relative flex w-full flex-col overflow-hidden bg-gradient-to-br from-violet-300/45 via-fuchsia-200/25 to-indigo-200/35 p-[1.5px] text-right shadow-[0_4px_6px_-1px_rgba(15,23,42,0.06),0_20px_40px_-24px_rgba(75,0,130,0.2)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_28px_56px_-20px_rgba(75,0,130,0.32)] ${tierClass.minH} ${tierClass.outerRound}`}
    >
      <div
        className={`relative flex w-full flex-col overflow-hidden border border-white/70 bg-white shadow-inner ${tierClass.minH} ${tierClass.innerRound}`}
      >
      <div
        className={`absolute z-10 rounded-full bg-gradient-to-l from-fuchsia-500 via-[#4B0082] to-indigo-600 opacity-95 ${tierClass.topBar}`}
        aria-hidden
      />
      <div
        className={`relative flex w-full shrink-0 items-center justify-between border-b border-slate-100/90 bg-gradient-to-l from-violet-50/40 via-white to-slate-50/30 ${tierClass.head}`}
      >
        <span className={`min-w-0 flex-1 truncate text-right font-black leading-snug text-slate-900 ${tierClass.name}`}>
          {displayName}
        </span>
        <span className={`shrink-0 rounded-lg border border-violet-200/80 bg-violet-50 font-black text-violet-900 ${tierClass.badge}`}>
          {headerBadge}
        </span>
      </div>
      <div className={`flex min-h-0 flex-1 flex-col ${tierClass.body}`}>
        <div className={`flex items-start justify-between ${tierClass.rowGap}`}>
          <MerchantLogo name={row.store_name} storeId={row.store_id} size={tierClass.logo} />
          {tierClass.showPriority ? (
            <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-100 bg-gradient-to-l from-rose-50 to-orange-50/80 px-2 py-0.5 text-[8px] font-black text-rose-800 shadow-sm sm:text-[9px]">
              <Flame size={tier === 'comfortable' ? 11 : 10} className="text-rose-500" />
              أولوية
            </span>
          ) : (
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-rose-500/10 text-rose-600" title="أولوية">
              <Flame size={12} className="text-rose-500" strokeWidth={2.2} />
            </span>
          )}
        </div>
        <p className={`font-semibold tabular-nums text-slate-500 ${tierClass.meta}`}>
          #{row.store_id} · {kindLabel}
        </p>
        <div className={`mt-auto flex items-center justify-between border-t border-slate-100/80 bg-slate-50/30 ${tierClass.footer}`}>
          <span className={`font-bold text-slate-400 ${tierClass.footL}`}>استبيان اليوم</span>
          <span className={`font-bold text-violet-700 opacity-0 transition group-hover:opacity-100 ${tierClass.footR}`}>
            عرض التفاصيل
          </span>
        </div>
      </div>
      </div>
    </motion.button>
  )
}

function SolvedRow({ row, onOpen, listSize = 0 }) {
  const denseList = listSize >= 14
  const tightList = listSize >= 24
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className={`group flex w-full items-center border-b border-slate-100/90 bg-white text-right transition hover:bg-slate-50/90 ${tightList ? 'gap-2.5 px-3 py-2' : denseList ? 'gap-3 px-4 py-2.5' : 'gap-4 px-5 py-4'}`}
    >
      <div
        className={`flex shrink-0 items-center justify-center rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white font-black text-emerald-900 shadow-sm ${denseList ? 'h-10 w-10 text-sm' : 'h-12 w-12 text-base'}`}
      >
        {(row.store_name || '?').trim().slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className={`truncate font-bold text-slate-900 ${denseList ? 'text-[13px]' : 'text-[15px]'}`}>{row.store_name}</p>
        <p className={`font-medium text-slate-400 ${denseList ? 'mt-0 text-[11px]' : 'mt-0.5 text-xs'}`}>#{row.store_id}</p>
        {row.executive_notes ? (
          <p
            className={`line-clamp-1 text-right font-medium text-violet-800/90 ${denseList ? 'mt-1 text-[11px]' : 'mt-1.5 text-xs'}`}
          >
            {row.executive_notes}
          </p>
        ) : null}
      </div>
      <CheckCircle2
        className="shrink-0 text-emerald-500 opacity-70 transition group-hover:opacity-100"
        size={tightList ? 18 : denseList ? 20 : 22}
        strokeWidth={2.2}
      />
    </button>
  )
}

function DetailDrawer({
  row,
  open,
  onClose,
  onResolve,
  resolveBusy,
  canResolve,
  executiveNotes,
  onExecutiveNotesChange,
  qvMissedInc,
  onToggleQvMissedInc,
}) {
  if (!row) return null
  const freezeAlert = row.survey_kind === 'freeze_alert'
  const needsFreezeReq = row.survey_kind === 'needs_freeze_request'
  const freezeLike = freezeAlert || needsFreezeReq
  const onboarding = row.survey_kind === 'new_merchant_onboarding'
  const inactiveFeedback = row.survey_kind === 'inactive_feedback'

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.button
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] bg-slate-950/40 backdrop-blur-sm"
            aria-label="إغلاق"
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="qv-drawer-title"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l-[5px] border-l-violet-600 bg-white shadow-[-28px_0_90px_-24px_rgba(75,0,130,0.28)] ring-1 ring-violet-200/30"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100/80 bg-gradient-to-l from-violet-50/75 via-white/92 to-white/95 px-5 py-5 backdrop-blur-xl">
              <div className="min-w-0 text-right">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-violet-600/90">سجل التحقيق</p>
                <p id="qv-drawer-title" className="mt-1 truncate text-xl font-black text-slate-900">
                  {row.store_name || `متجر #${row.store_id}`}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-slate-400">#{row.store_id}</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
              >
                <X size={20} strokeWidth={2.2} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-6">
              {freezeLike ? (
                <>
                  {needsFreezeReq ? (
                    <p className="mb-2 text-xs font-bold text-violet-800">
                      المصدر:{' '}
                      <span className="text-slate-800">{row.source_label || '—'}</span>
                    </p>
                  ) : null}
                  <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#4B0082]">
                    {needsFreezeReq ? 'سبب طلب التجميد' : 'سبب التجميد'}
                  </p>
                  <div className="rounded-xl border border-sky-200/90 bg-sky-50/60 p-4 shadow-inner">
                    <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900">
                      {(row.freeze_reason || row.suggestions || '').trim() || '—'}
                    </p>
                    <p className="mt-3 text-[11px] text-slate-600">
                      {needsFreezeReq ? 'طُلب من:' : 'نُفّذ التجميد بواسطة:'}{' '}
                      <span className="font-bold text-slate-800">
                        {(row.staff_fullname || row.frozen_by || row.staff_username || '—').trim()}
                      </span>
                      {row.staff_username ? (
                        <span className="mr-1 font-mono text-slate-500">({row.staff_username})</span>
                      ) : null}
                    </p>
                  </div>
                </>
              ) : null}
              {inactiveFeedback ? (
                <div className="rounded-xl border border-slate-200/90 bg-slate-50/60 p-4 shadow-inner">
                  <p className="mb-2 text-[11px] font-black text-[#4B0082]">ملاحظة المتجر (غير نشط)</p>
                  <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-slate-900">
                    {(row.suggestions || '').trim() || '—'}
                  </p>
                </div>
              ) : null}
              {!freezeLike && !inactiveFeedback ? (
                <>
              <p className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#4B0082]">نتائج الاستبيان</p>
              {onboarding ? (
                <ul className="space-y-2">
                  {(row.answers || []).map((a, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                    >
                      <span className="font-semibold text-slate-800">{a.label}</span>
                      <span className={a.yes ? 'font-black text-emerald-600' : 'font-black text-rose-600'}>{a.yes ? 'نعم' : 'لا'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <ul className="space-y-2">
                  {(row.questions || []).map((q, i) => (
                    <li
                      key={i}
                      className="flex items-center justify-between gap-2 rounded-xl border border-slate-100/90 bg-white px-3 py-2.5 text-sm shadow-sm"
                    >
                      <span className="font-semibold text-slate-800">{q.label}</span>
                      <span className="tabular-nums font-black text-violet-800">{q.value}/5</span>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 rounded-xl border border-amber-100/90 bg-amber-50/40 p-4 shadow-inner">
                <p className="mb-2 text-[11px] font-black text-amber-900/90">ملاحظات الموظف</p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                  {(row.suggestions || '').trim() || '— لا توجد ملاحظات —'}
                </p>
              </div>
                </>
              ) : null}

              {canResolve && !row.resolved && !freezeLike && !inactiveFeedback ? (
                <div className="mt-6 rounded-xl border border-rose-100/90 bg-rose-50/35 p-4 shadow-inner">
                  <p className="mb-1 text-[11px] font-black text-rose-900">إنذار احتضان (اختياري)</p>
                  <p className="mb-3 text-[11px] leading-relaxed text-slate-600">
                    إن وُجد تقصير في الاتصال بمسار الاحتضان، حدّد المرحلة؛ تُدمَج الوسوم مع الاستبيان وتُستخدم لإظهار متابعة لمسؤول الاحتضان.
                  </p>
                  <div className="flex flex-col gap-2.5">
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c1}
                        onChange={() => onToggleQvMissedInc('c1')}
                      />
                      لم يتصل موظف الاحتضان — المكالمة الأولى (يوم 1)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c2}
                        onChange={() => onToggleQvMissedInc('c2')}
                      />
                      لم يتصل — المكالمة الثانية (يوم 3)
                    </label>
                    <label className="flex cursor-pointer items-center gap-2 text-sm font-semibold text-slate-800">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-rose-300 text-rose-600 focus:ring-rose-500"
                        checked={qvMissedInc.c3}
                        onChange={() => onToggleQvMissedInc('c3')}
                      />
                      لم يتصل — المكالمة الثالثة (يوم 10)
                    </label>
                  </div>
                </div>
              ) : null}

              {canResolve && !row.resolved ? (
                <div className="mt-6">
                  <label htmlFor="exec-notes" className="mb-2 block text-[11px] font-black text-[#4B0082]">
                    ملاحظات المدير
                  </label>
                  <textarea
                    id="exec-notes"
                    dir="rtl"
                    rows={4}
                    value={executiveNotes}
                    onChange={e => onExecutiveNotesChange(e.target.value)}
                    placeholder="تعليمات أو توجيه للفريق…"
                    className="w-full rounded-xl border border-[#4B0082]/25 bg-white/90 px-3 py-2.5 text-sm text-slate-800 shadow-inner outline-none ring-0 placeholder:text-slate-400 focus:border-[#4B0082] focus:ring-2 focus:ring-[#4B0082]/15"
                  />
                </div>
              ) : row.resolved && row.executive_notes ? (
                <div className="mt-6 rounded-xl border border-violet-100 bg-violet-50/40 p-4">
                  <p className="mb-1 text-[11px] font-black text-violet-900">ملاحظات المدير (محفوظة)</p>
                  <p className="whitespace-pre-wrap text-sm text-slate-800">{row.executive_notes}</p>
                </div>
              ) : null}
            </div>

            {canResolve && !row.resolved ? (
              <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                <button
                  type="button"
                  onClick={() => onResolve(row)}
                  disabled={resolveBusy}
                  className="relative w-full overflow-hidden rounded-2xl bg-gradient-to-l from-violet-700 via-[#4B0082] to-indigo-800 py-4 text-sm font-black text-white shadow-[0_12px_40px_-8px_rgba(75,0,130,0.55)] transition hover:brightness-[1.05] disabled:opacity-60"
                >
                  <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white/10 to-transparent" aria-hidden />
                  <span className="relative">{resolveBusy ? 'جارٍ التنفيذ…' : 'حل الإشكالية وتأكيد الأرشفة'}</span>
                </button>
              </div>
            ) : row.resolved ? (
              <div className="border-t border-emerald-100 bg-emerald-50/50 px-5 py-4 text-center">
                <p className="text-sm font-bold text-emerald-900">تم الأرشفة ضمن «تم الحل»</p>
              </div>
            ) : null}
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  )
}

export default function QuickVerification() {
  const { user, can } = useAuth()
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [onboardingRows, setOnboardingRows] = useState([])
  const [activeRows, setActiveRows] = useState([])
  const [freezeRows, setFreezeRows] = useState([])
  const [needsFreezeRows, setNeedsFreezeRows] = useState([])
  const [inactiveFeedbackRows, setInactiveFeedbackRows] = useState([])
  const [query, setQuery] = useState('')
  const [trackFilter, setTrackFilter] = useState('all')
  const [sortAz, setSortAz] = useState(true)
  const defRange = useMemo(() => getDefaultHistoryRange(), [])
  const [qvDateMode, setQvDateMode] = useState('range')
  const [qvDateFrom, setQvDateFrom] = useState(defRange.from)
  const [qvDateTo, setQvDateTo] = useState(defRange.to)
  const [dateRangeMeta, setDateRangeMeta] = useState(null)
  const [masterTablePage, setMasterTablePage] = useState(1)
  const [resolvingId, setResolvingId] = useState(null)
  const [tab, setTab] = useState('crisis')
  const [drawerRow, setDrawerRow] = useState(null)
  const [executiveNotes, setExecutiveNotes] = useState('')
  const [qvMissedInc, setQvMissedInc] = useState({ c1: false, c2: false, c3: false })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const payload = {
        user_role: user?.role || '',
        username: user?.username || '',
      }
      if (qvDateMode === 'range') {
        if (!qvDateFrom || !qvDateTo || qvDateFrom > qvDateTo) {
          setErr('حدّد تاريخي «من» و«إلى» بشكل صحيح.')
          setLoading(false)
          return
        }
        payload.from = qvDateFrom
        payload.to = qvDateTo
      }
      const d = await getQuickVerificationBourse(payload)
      if (d?.success) {
        setDateRangeMeta(d.date_range ?? null)
        setOnboardingRows(Array.isArray(d.rows) ? d.rows : [])
        setActiveRows(Array.isArray(d.active_csat_rows) ? d.active_csat_rows : [])
        setFreezeRows(Array.isArray(d.freeze_rows) ? d.freeze_rows : [])
        setNeedsFreezeRows(Array.isArray(d.needs_freeze_rows) ? d.needs_freeze_rows : [])
        setInactiveFeedbackRows(Array.isArray(d.inactive_feedback_rows) ? d.inactive_feedback_rows : [])
      } else {
        setDateRangeMeta(null)
        setErr(d?.error || 'تعذّر التحميل')
        setOnboardingRows([])
        setActiveRows([])
        setFreezeRows([])
        setNeedsFreezeRows([])
        setInactiveFeedbackRows([])
      }
    } catch (e) {
      setDateRangeMeta(null)
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setOnboardingRows([])
      setActiveRows([])
      setFreezeRows([])
      setNeedsFreezeRows([])
      setInactiveFeedbackRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username, qvDateMode, qvDateFrom, qvDateTo])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...inactiveFeedbackRows, ...freezeRows, ...needsFreezeRows]
    if (!all.length) return { growth: 0, resolution: 100, global: 100 }
    const positive = all.filter(isSatisfied).length
    const growth = Math.round((positive / all.length) * 100)
    const issues = all.filter(r => !isSatisfied(r))
    const resolved = issues.filter(r => r.resolved).length
    const resolution = issues.length ? Math.round((resolved / issues.length) * 100) : 100
    const gSum = all.reduce((acc, r) => acc + satisfactionPercent(r), 0)
    const global = Math.round(gSum / all.length)
    return { growth, resolution, global }
  }, [onboardingRows, activeRows, inactiveFeedbackRows, freezeRows, needsFreezeRows])

  const statStrip = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...inactiveFeedbackRows, ...freezeRows, ...needsFreezeRows]
    const openCrisis = all.filter(r => !r.resolved && !isSatisfied(r)).length
    const resolved = all.filter(r => r.resolved).length
    return { total: all.length, openCrisis, resolved }
  }, [onboardingRows, activeRows, inactiveFeedbackRows, freezeRows, needsFreezeRows])

  const masterSurveyList = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...inactiveFeedbackRows, ...freezeRows, ...needsFreezeRows]
    const filtered = all.filter(row => {
      if (!rowMatchesQuery(row, query)) return false
      if (trackFilter === 'all') return true
      return rowQvTrack(row) === trackFilter
    })
    const nameKey = r => (r.store_name || String(r.store_id || '')).trim()
    filtered.sort((a, b) => {
      const cmp = nameKey(a).localeCompare(nameKey(b), 'ar', { sensitivity: 'base' })
      return sortAz ? cmp : -cmp
    })
    return filtered
  }, [
    onboardingRows,
    activeRows,
    inactiveFeedbackRows,
    freezeRows,
    needsFreezeRows,
    query,
    trackFilter,
    sortAz,
  ])

  const masterSurveyTotalPages = Math.max(1, Math.ceil(masterSurveyList.length / MASTER_SURVEY_PAGE_SIZE))

  const pagedMasterSurveyList = useMemo(() => {
    const page = Math.min(masterTablePage, masterSurveyTotalPages)
    const start = (page - 1) * MASTER_SURVEY_PAGE_SIZE
    return masterSurveyList.slice(start, start + MASTER_SURVEY_PAGE_SIZE)
  }, [masterSurveyList, masterTablePage, masterSurveyTotalPages])

  useEffect(() => {
    setMasterTablePage(1)
  }, [query, trackFilter, sortAz, qvDateMode, qvDateFrom, qvDateTo])

  useEffect(() => {
    setMasterTablePage(p => Math.min(p, masterSurveyTotalPages))
  }, [masterSurveyTotalPages])

  const crisisOnb = useMemo(
    () =>
      onboardingRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [onboardingRows, query],
  )
  const crisisActive = useMemo(
    () => activeRows.filter(r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query)),
    [activeRows, query],
  )
  const crisisFreeze = useMemo(
    () =>
      freezeRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [freezeRows, query],
  )
  const crisisNeedsFreeze = useMemo(
    () =>
      needsFreezeRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [needsFreezeRows, query],
  )

  const crisisInactiveFb = useMemo(
    () =>
      inactiveFeedbackRows.filter(
        r => !r.resolved && isCrisis(r) && rowMatchesQuery(r, query),
      ),
    [inactiveFeedbackRows, query],
  )

  const solvedOnb = useMemo(
    () => onboardingRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [onboardingRows, query],
  )
  const solvedActive = useMemo(
    () => activeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [activeRows, query],
  )
  const solvedFreeze = useMemo(
    () => freezeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [freezeRows, query],
  )
  const solvedNeedsFreeze = useMemo(
    () => needsFreezeRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [needsFreezeRows, query],
  )

  const solvedInactiveFb = useMemo(
    () => inactiveFeedbackRows.filter(r => r.resolved && rowMatchesQuery(r, query)),
    [inactiveFeedbackRows, query],
  )

  const toggleQvMissedInc = useCallback(key => {
    setQvMissedInc(prev => ({ ...prev, [key]: !prev[key] }))
  }, [])

  useEffect(() => {
    if (!drawerRow) {
      setExecutiveNotes('')
      setQvMissedInc({ c1: false, c2: false, c3: false })
      return
    }
    setExecutiveNotes(drawerRow.executive_notes || '')
    const tags = drawerRow.gap_tags || []
    setQvMissedInc({
      c1: tags.includes(QV_MISSED_INC_TAG.call1),
      c2: tags.includes(QV_MISSED_INC_TAG.call2),
      c3: tags.includes(QV_MISSED_INC_TAG.call3),
    })
  }, [drawerRow])

  const resolve = useCallback(
    async row => {
      const isFreeze = row?.survey_kind === 'freeze_alert'
      const isNeedsFreeze = row?.survey_kind === 'needs_freeze_request'
      const busyKey = isFreeze
        ? `f-${row.freeze_alert_id}`
        : isNeedsFreeze
          ? `nf-${row.needs_freeze_id}`
          : row.id
      setResolvingId(busyKey)
      setErr('')
      try {
        const qvTags = []
        if (!isFreeze && !isNeedsFreeze) {
          if (qvMissedInc.c1) qvTags.push(QV_MISSED_INC_TAG.call1)
          if (qvMissedInc.c2) qvTags.push(QV_MISSED_INC_TAG.call2)
          if (qvMissedInc.c3) qvTags.push(QV_MISSED_INC_TAG.call3)
        }
        const res = await postQuickVerificationResolveAudit({
          survey_id: isFreeze || isNeedsFreeze ? 0 : row.id,
          freeze_alert_id: isFreeze ? row.freeze_alert_id : 0,
          needs_freeze_id: isNeedsFreeze ? row.needs_freeze_id : 0,
          user_role: user?.role || 'executive',
          resolved_by: user?.username || '',
          executive_notes: executiveNotes.trim(),
          qv_missed_inc_calls: qvTags,
        })
        if (!res?.success) {
          setErr(res?.error || 'تعذّر الحفظ')
          return
        }
        setDrawerRow(null)
        setExecutiveNotes('')
        setTab('solved')
        await load()
      } catch (e) {
        setErr(e?.response?.data?.error || e?.message || 'خطأ')
      } finally {
        setResolvingId(null)
      }
    },
    [load, user?.role, user?.username, executiveNotes, qvMissedInc],
  )

  const isExec = user?.role === 'executive'
  const canResolveRow = row => {
    if (row.resolved) return false
    if (row.survey_kind === 'freeze_alert' || row.survey_kind === 'needs_freeze_request') return isExec
    if (isExec) return true
    const u = (user?.username || '').trim()
    const staff = (row.staff_username || '').trim()
    return u && staff && staff === u
  }

  useEffect(() => {
    if (!drawerRow) return
    const stillOnb = onboardingRows.some(r => r.id === drawerRow.id)
    const stillAct = activeRows.some(r => r.id === drawerRow.id)
    const stillIfb = inactiveFeedbackRows.some(r => r.id === drawerRow.id)
    const stillFr = freezeRows.some(r => r.id === drawerRow.id)
    const stillNf = needsFreezeRows.some(r => r.id === drawerRow.id)
    if (!stillOnb && !stillAct && !stillIfb && !stillFr && !stillNf) setDrawerRow(null)
    else {
      const fresh = [...onboardingRows, ...activeRows, ...inactiveFeedbackRows, ...freezeRows, ...needsFreezeRows].find(
        r => r.id === drawerRow.id,
      )
      if (fresh && fresh.resolved !== drawerRow.resolved) setDrawerRow(fresh)
    }
  }, [onboardingRows, activeRows, inactiveFeedbackRows, freezeRows, needsFreezeRows, drawerRow])

  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  const drawerOpen = !!drawerRow
  const drawerCanResolve = drawerRow ? canResolveRow(drawerRow) : false

  const crisisTotal =
    crisisOnb.length +
    crisisActive.length +
    crisisInactiveFb.length +
    crisisFreeze.length +
    crisisNeedsFreeze.length
  const solvedTotal =
    solvedOnb.length +
    solvedActive.length +
    solvedInactiveFb.length +
    solvedFreeze.length +
    solvedNeedsFreeze.length

  return (
    <div
      className="flex min-h-full w-full min-w-0 flex-col bg-[#ebe7f5] pb-16 [background-image:radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(139,92,246,0.12),transparent),radial-gradient(ellipse_60%_40%_at_100%_50%,rgba(244,114,182,0.06),transparent)]"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="sticky top-0 z-40 w-full shadow-[0_8px_32px_-12px_rgba(75,0,130,0.12)]">
        <QuickAuditTopNav growth={kpis.growth} resolution={kpis.resolution} globalSat={kpis.global} loading={loading} />
        <div className="relative isolate w-full overflow-hidden border-x border-white/10 border-b border-white/15 shadow-[0_10px_36px_-20px_rgba(15,23,42,0.65)] ring-1 ring-violet-300/20 backdrop-blur-2xl">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden
          />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_100%_0%,rgba(167,139,250,0.22),transparent_55%),radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(59,130,246,0.1),transparent_50%)]"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-br from-slate-950/80 via-[#2d0a52]/85 to-[#4B0082]/82" />
          <div
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/[0.06] via-transparent to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-px top-px bottom-0 border-x border-b border-white/[0.08] border-t-0"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.12) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)',
              backgroundSize: '32px 32px',
            }}
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-violet-500/0 via-fuchsia-300/28 to-violet-500/0 blur-[2px]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-[14%] bottom-0 h-px bg-gradient-to-r from-transparent via-white/45 to-transparent"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-y-5 right-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent opacity-70 sm:inset-y-6" aria-hidden />
          <div className="pointer-events-none absolute inset-y-5 left-0 w-px bg-gradient-to-b from-transparent via-white/20 to-transparent opacity-70 sm:inset-y-6" aria-hidden />
          <div className="relative flex w-full flex-col gap-3 px-5 py-4 sm:flex-row sm:items-stretch sm:justify-between sm:gap-4 sm:px-8 lg:px-10 xl:px-12 2xl:px-16">
            {/* شريط تبويب احترافي — مسار داكن + قرص أبيض متحرك */}
            <div className="relative flex min-h-[3.5rem] w-full flex-1 overflow-hidden rounded-[14px] border border-white/20 bg-gradient-to-b from-black/35 via-black/40 to-black/55 p-[5px] shadow-[inset_0_1px_0_rgba(255,255,255,0.14),inset_0_-8px_20px_rgba(0,0,0,0.35)] backdrop-blur-xl ring-1 ring-white/[0.07]">
              <motion.div
                layout
                transition={{ type: 'spring', stiffness: 460, damping: 38 }}
                className="pointer-events-none absolute z-0 w-[calc(50%-5px)] rounded-[10px] bg-white shadow-[0_8px_32px_-10px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,1)] ring-1 ring-black/[0.06]"
                style={
                  tab === 'crisis'
                    ? { top: '5px', right: '5px', bottom: '5px', left: 'auto' }
                    : { top: '5px', left: '5px', bottom: '5px', right: 'auto' }
                }
              />
              <div
                className="relative z-10 flex min-h-[3.25rem] w-full flex-1 items-stretch"
                role="tablist"
                aria-label="تبديل عرض التحقيق"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'crisis'}
                  id="qv-tab-crisis"
                  onClick={() => setTab('crisis')}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-3 py-2 transition-colors duration-200 sm:flex-row sm:gap-2.5 sm:px-4 md:gap-3 ${
                    tab === 'crisis'
                      ? 'text-slate-900'
                      : 'text-white/72 hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start sm:gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${
                        tab === 'crisis'
                          ? 'bg-rose-500/12 text-rose-600 ring-1 ring-rose-500/20'
                          : 'bg-white/5 text-rose-200/95 ring-1 ring-white/10'
                      }`}
                    >
                      <AlertTriangle size={17} strokeWidth={2.2} className="sm:h-[18px] sm:w-[18px]" />
                    </span>
                    <span className="min-w-0 text-center sm:text-right">
                      <span className="block text-[0.8125rem] font-extrabold leading-tight tracking-tight md:text-[0.9375rem]">
                        مركز الأزمات
                      </span>
                      <span
                        className={`mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.14em] sm:block ${
                          tab === 'crisis' ? 'text-slate-500' : 'text-white/45'
                        }`}
                      >
                        قيد المراجعة
                      </span>
                    </span>
                  </span>
                  {crisisTotal > 0 ? (
                    <span
                      className={`mt-1 inline-flex min-w-[1.65rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ring-1 sm:mt-0 sm:ms-auto sm:min-w-[1.85rem] ${
                        tab === 'crisis'
                          ? 'bg-rose-500/15 text-rose-800 ring-rose-500/25'
                          : 'bg-black/30 text-white/95 ring-white/15'
                      }`}
                    >
                      {crisisTotal}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={tab === 'solved'}
                  id="qv-tab-solved"
                  onClick={() => setTab('solved')}
                  className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-[10px] px-3 py-2 transition-colors duration-200 sm:flex-row sm:gap-2.5 sm:px-4 md:gap-3 ${
                    tab === 'solved'
                      ? 'text-slate-900'
                      : 'text-white/72 hover:text-white'
                  }`}
                >
                  <span className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:justify-start sm:gap-2.5">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg sm:h-9 sm:w-9 ${
                        tab === 'solved'
                          ? 'bg-emerald-500/12 text-emerald-700 ring-1 ring-emerald-500/25'
                          : 'bg-white/5 text-emerald-200/95 ring-1 ring-white/10'
                      }`}
                    >
                      <CheckCircle2 size={17} strokeWidth={2.2} className="sm:h-[18px] sm:w-[18px]" />
                    </span>
                    <span className="min-w-0 text-center sm:text-right">
                      <span className="block text-[0.8125rem] font-extrabold leading-tight tracking-tight md:text-[0.9375rem]">
                        تم الحل
                      </span>
                      <span
                        className={`mt-0.5 hidden text-[10px] font-semibold uppercase tracking-[0.14em] sm:block ${
                          tab === 'solved' ? 'text-slate-500' : 'text-white/45'
                        }`}
                      >
                        أرشيف الحلول
                      </span>
                    </span>
                  </span>
                  {solvedTotal > 0 ? (
                    <span
                      className={`mt-1 inline-flex min-w-[1.65rem] items-center justify-center rounded-full px-2 py-0.5 text-[10px] font-black tabular-nums ring-1 sm:mt-0 sm:ms-auto sm:min-w-[1.85rem] ${
                        tab === 'solved'
                          ? 'bg-emerald-500/15 text-emerald-900 ring-emerald-500/30'
                          : 'bg-black/30 text-white/95 ring-white/15'
                      }`}
                    >
                      {solvedTotal}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex h-[3.5rem] shrink-0 items-center justify-center gap-2 rounded-[14px] border border-white/25 bg-gradient-to-b from-white/14 to-white/[0.07] px-4 text-xs font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] backdrop-blur-xl transition hover:from-white/20 hover:to-white/12 disabled:opacity-50 sm:min-w-[9.5rem] md:px-5 md:text-sm"
            >
              <RefreshCw size={17} className={loading ? 'animate-spin' : ''} strokeWidth={2.2} />
              <span className="whitespace-nowrap">تحديث البيانات</span>
            </button>
          </div>
        </div>
        <div className="relative isolate w-full overflow-hidden border-b border-violet-200/35 bg-gradient-to-b from-white/40 via-violet-100/30 to-[#ebe7f5]/95 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] backdrop-blur-xl md:py-6">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-300/50 to-transparent"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
            aria-hidden
          />
          <QvStatStrip
            total={statStrip.total}
            openCrisis={statStrip.openCrisis}
            resolved={statStrip.resolved}
            globalSat={kpis.global}
            loading={loading}
            rangeIsToday={dateRangeMeta?.mode === 'today'}
          />
        </div>
      </div>

      <div className="w-full px-5 py-8 sm:px-8 lg:px-10 xl:px-12 2xl:px-16 md:py-10">
        <div className="relative mb-6 overflow-hidden rounded-[1.25rem] border border-violet-200/55 bg-white/92 px-4 py-4 shadow-sm backdrop-blur-sm sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-3 text-right">
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <CalendarDays size={20} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-sm font-black text-slate-900">فلترة بالتاريخ</p>
                <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-500">
                  اختر «اليوم فقط» أو حدّد نطاقاً (من — إلى) لعرض كل الاستبيانات السابقة ضمنه. النطاق الأقصى 1095 يوماً.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setQvDateMode('today')}
                  className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                    qvDateMode === 'today'
                      ? 'bg-violet-700 text-white shadow-md'
                      : 'border border-violet-200 bg-white text-violet-900 hover:bg-violet-50'
                  }`}
                >
                  اليوم فقط
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const r = getDefaultHistoryRange()
                    setQvDateFrom(r.from)
                    setQvDateTo(r.to)
                    setQvDateMode('range')
                  }}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-900 transition hover:bg-violet-50"
                >
                  سنة (افتراضي)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const to = new Date()
                    const from = new Date()
                    from.setDate(from.getDate() - 1095)
                    setQvDateFrom(formatYMD(from))
                    setQvDateTo(formatYMD(to))
                    setQvDateMode('range')
                  }}
                  className="rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-900 transition hover:bg-violet-50"
                >
                  3 سنوات
                </button>
              </div>
              <div
                className={`flex flex-wrap items-center gap-2 ${qvDateMode === 'today' ? 'pointer-events-none opacity-45' : ''}`}
              >
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="whitespace-nowrap">من</span>
                  <input
                    type="date"
                    value={qvDateFrom}
                    onChange={e => {
                      setQvDateMode('range')
                      setQvDateFrom(e.target.value)
                    }}
                    className="rounded-xl border border-violet-200/80 bg-white px-2 py-2 text-xs font-semibold text-slate-800"
                  />
                </label>
                <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                  <span className="whitespace-nowrap">إلى</span>
                  <input
                    type="date"
                    value={qvDateTo}
                    onChange={e => {
                      setQvDateMode('range')
                      setQvDateTo(e.target.value)
                    }}
                    className="rounded-xl border border-violet-200/80 bg-white px-2 py-2 text-xs font-semibold text-slate-800"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void load()}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-xs font-black text-violet-900 transition hover:bg-violet-100 disabled:opacity-50"
                >
                  <RefreshCw size={14} className={loading ? 'animate-spin' : ''} strokeWidth={2.2} />
                  تحديث
                </button>
              </div>
            </div>
          </div>
          {dateRangeMeta ? (
            <p className="mt-3 border-t border-violet-100 pt-3 text-center text-[11px] font-semibold text-violet-700">
              {dateRangeMeta.mode === 'today'
                ? 'العرض الحالي: يوم اليوم (توقيت بغداد)'
                : `العرض الحالي: من ${dateRangeMeta.from} إلى ${dateRangeMeta.to}`}
            </p>
          ) : null}
        </div>

        <div className="relative mb-10 rounded-[1.35rem] bg-gradient-to-br from-violet-300/28 via-white/45 to-fuchsia-200/25 p-[2px] shadow-[0_12px_40px_-12px_rgba(75,0,130,0.15)] ring-1 ring-violet-200/30 backdrop-blur-sm">
          <div className="relative rounded-[1.25rem] border border-white/85 bg-white/78 backdrop-blur-xl shadow-inner">
          <Search className="pointer-events-none absolute right-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-violet-500/70" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث بالاسم، رقم المتجر، الموظف، السبب، أو نص الملاحظة…"
            className="w-full rounded-[1.25rem] border-0 bg-transparent py-4 pr-14 pl-5 text-sm font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-400/25"
          />
          </div>
        </div>

        <div className="relative mb-10 overflow-hidden rounded-[1.35rem] border border-violet-200/50 bg-white/90 shadow-[0_12px_40px_-12px_rgba(75,0,130,0.12)] backdrop-blur-sm">
          <div className="flex flex-col gap-4 border-b border-violet-100/80 bg-gradient-to-l from-violet-50/90 via-white to-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div className="flex items-center gap-2 text-right">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                <ListFilter size={20} strokeWidth={2.2} />
              </span>
              <div>
                <p className="text-base font-black text-slate-900">جدول الاستبيانات</p>
                <p className="text-xs font-medium text-slate-500">
                  فلترة مسار المتجر وترتيب أبجدي؛ يظهر كل ما في النطاق الزمني أعلاه ({MASTER_SURVEY_PAGE_SIZE} استبيانات لكل صفحة).
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-600">
                <span className="whitespace-nowrap">المسار</span>
                <select
                  value={trackFilter}
                  onChange={e => setTrackFilter(e.target.value)}
                  className="rounded-xl border border-violet-200/80 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none ring-0 focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20"
                >
                  <option value="all">الكل</option>
                  <option value="incubation">مسار الاحتضان</option>
                  <option value="active">نشطة</option>
                  <option value="inactive">غير نشطة</option>
                  <option value="other">أخرى</option>
                </select>
              </label>
              <button
                type="button"
                onClick={() => setSortAz(v => !v)}
                className="inline-flex items-center gap-2 rounded-xl border border-violet-200/80 bg-white px-3 py-2 text-xs font-black text-violet-900 shadow-sm transition hover:bg-violet-50"
              >
                {sortAz ? <ArrowDownAZ size={16} strokeWidth={2.2} /> : <ArrowUpAZ size={16} strokeWidth={2.2} />}
                {sortAz ? 'أ → ي' : 'ي → أ'}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-right text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-black uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">المتجر</th>
                  <th className="px-4 py-3">نوع الاستبيان</th>
                  <th className="px-4 py-3">مسار المتجر</th>
                  <th className="px-4 py-3 whitespace-nowrap">تاريخ التسجيل</th>
                  <th className="px-4 py-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {loading && masterSurveyList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      جارٍ التحميل…
                    </td>
                  </tr>
                ) : masterSurveyList.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                      لا توجد استبيانات تطابق البحث أو الفلتر.
                    </td>
                  </tr>
                ) : (
                  pagedMasterSurveyList.map(row => (
                    <tr
                      key={`${row.survey_kind}-${row.id}`}
                      className="cursor-pointer border-b border-slate-100/90 transition hover:bg-violet-50/50"
                      onClick={() => setDrawerRow(row)}
                    >
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <span className="block truncate">{row.store_name || `متجر #${row.store_id}`}</span>
                        <span className="text-[11px] font-semibold text-slate-400">#{row.store_id}</span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-violet-900">{surveyKindLabel(row.survey_kind)}</td>
                      <td className="px-4 py-3 text-slate-700">{qvTrackLabel(rowQvTrack(row))}</td>
                      <td className="px-4 py-3 text-[11px] font-semibold tabular-nums text-slate-600 whitespace-nowrap">
                        {formatSurveyDate(row.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        {row.resolved ? (
                          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-black text-emerald-800">
                            تم الحل
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-black text-amber-900">
                            قيد المراجعة
                          </span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {masterSurveyList.length > 0 ? (
            <div className="flex flex-col gap-3 border-t border-violet-100/90 bg-slate-50/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
              <p className="text-center text-[11px] font-semibold text-slate-600 sm:text-right">
                عرض{' '}
                {(Math.min(masterTablePage, masterSurveyTotalPages) - 1) * MASTER_SURVEY_PAGE_SIZE + 1}–
                {Math.min(
                  Math.min(masterTablePage, masterSurveyTotalPages) * MASTER_SURVEY_PAGE_SIZE,
                  masterSurveyList.length,
                )}{' '}
                من {masterSurveyList.length.toLocaleString('ar-SA')}
              </p>
              <div className="flex items-center justify-center gap-2 sm:justify-end">
                <button
                  type="button"
                  onClick={() => setMasterTablePage(p => Math.max(1, p - 1))}
                  disabled={masterTablePage <= 1}
                  className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronRight size={16} strokeWidth={2.2} className="shrink-0" />
                  السابق
                </button>
                <span className="min-w-[5rem] text-center text-xs font-black tabular-nums text-slate-700">
                  {Math.min(masterTablePage, masterSurveyTotalPages).toLocaleString('ar-SA')} /{' '}
                  {masterSurveyTotalPages.toLocaleString('ar-SA')}
                </span>
                <button
                  type="button"
                  onClick={() => setMasterTablePage(p => Math.min(masterSurveyTotalPages, p + 1))}
                  disabled={masterTablePage >= masterSurveyTotalPages}
                  className="inline-flex items-center gap-1 rounded-xl border border-violet-200 bg-white px-3 py-2 text-xs font-black text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  التالي
                  <ChevronLeft size={16} strokeWidth={2.2} className="shrink-0" />
                </button>
              </div>
            </div>
          ) : null}
        </div>

        {err ? (
          <p className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200/90 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-950 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={20} strokeWidth={2.2} />
            </span>
            {err}
          </p>
        ) : null}

        {loading &&
        !onboardingRows.length &&
        !activeRows.length &&
        !inactiveFeedbackRows.length &&
        !freezeRows.length &&
        !needsFreezeRows.length ? (
          <div className="flex flex-col items-center justify-center gap-4 py-28">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600" strokeWidth={2.2} />
            <p className="text-sm font-semibold text-slate-500">جارٍ تحميل لوحة التحقيق…</p>
          </div>
        ) : tab === 'crisis' ? (
          crisisTotal === 0 ? (
            <div className="overflow-hidden rounded-3xl border-2 border-emerald-200/50 bg-gradient-to-b from-emerald-50/90 via-white to-white px-8 py-16 text-center shadow-[0_20px_60px_-30px_rgba(16,185,129,0.2)] ring-4 ring-emerald-100/30">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 shadow-inner">
                <CheckCircle2 size={32} strokeWidth={2.2} />
              </div>
              <p className="text-xl font-black text-emerald-950">مركز الأزمات فارغ</p>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-600">
                لا توجد حالات مفتوحة تطابق المعايير — إما أن الرضا ضمن المطلوب أو أن البحث الحالي لا يطابق أي سجل.
              </p>
            </div>
          ) : (
            <div className="space-y-14 md:space-y-16">
              <SectionShell
                title="متاجر جديدة — غير راضٍ"
                subtitle="استبيان تهيئة التاجر ضمن نطاق يومي يحتاج متابعة."
                count={crisisOnb.length}
                empty={crisisOnb.length === 0}
              >
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${crisisOnb.length > 16 ? '2xl:grid-cols-5' : ''} ${crisisOnb.length > 12 ? 'gap-3 sm:gap-4' : 'gap-5'}`}
                >
                  <AnimatePresence mode="popLayout">
                    {crisisOnb.map(row => (
                      <CrisisCard
                        key={row.id}
                        row={row}
                        layoutId={`qv-c-${row.id}`}
                        onOpen={setDrawerRow}
                        sectionCount={crisisOnb.length}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SectionShell>

              <SectionShell
                title="استبيانات نشطة — غير راضٍ"
                subtitle="تقييم CSAT للتجار النشطين — متوسط المحاور أدنى من المستهدف."
                count={crisisActive.length}
                empty={crisisActive.length === 0}
              >
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${crisisActive.length > 16 ? '2xl:grid-cols-5' : ''} ${crisisActive.length > 12 ? 'gap-3 sm:gap-4' : 'gap-5'}`}
                >
                  <AnimatePresence mode="popLayout">
                    {crisisActive.map(row => (
                      <CrisisCard
                        key={row.id}
                        row={row}
                        layoutId={`qv-c-${row.id}`}
                        onOpen={setDrawerRow}
                        sectionCount={crisisActive.length}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SectionShell>

              <SectionShell
                title="غير النشطين — ملاحظات"
                subtitle="استبيان «ماذا قال المتجر؟» لمسار غير النشط — يظهر للمراجعة التنفيذية."
                count={crisisInactiveFb.length}
                empty={crisisInactiveFb.length === 0}
              >
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${crisisInactiveFb.length > 16 ? '2xl:grid-cols-5' : ''} ${crisisInactiveFb.length > 12 ? 'gap-3 sm:gap-4' : 'gap-5'}`}
                >
                  <AnimatePresence mode="popLayout">
                    {crisisInactiveFb.map(row => (
                      <CrisisCard
                        key={row.id}
                        row={row}
                        layoutId={`qv-c-${row.id}`}
                        onOpen={setDrawerRow}
                        sectionCount={crisisInactiveFb.length}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SectionShell>

              <SectionShell
                title="تحتاج التجميد"
                subtitle="طلبات مرسلة من مسؤول المتاجر الجديدة أو مسؤول غير النشطة — للمراجعة التنفيذية دون تجميد آلي من النظام."
                count={crisisNeedsFreeze.length}
                empty={crisisNeedsFreeze.length === 0}
              >
                <div
                  className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${crisisNeedsFreeze.length > 16 ? '2xl:grid-cols-5' : ''} ${crisisNeedsFreeze.length > 12 ? 'gap-3 sm:gap-4' : 'gap-5'}`}
                >
                  <AnimatePresence mode="popLayout">
                    {crisisNeedsFreeze.map(row => (
                      <CrisisCard
                        key={row.id}
                        row={row}
                        layoutId={`qv-c-${row.id}`}
                        onOpen={setDrawerRow}
                        sectionCount={crisisNeedsFreeze.length}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </SectionShell>

              {isExec ? (
                <SectionShell
                  title="تجميد — مراجعة تنفيذية"
                  subtitle="تجميدات نُفّذت مع ذكر السبب — تظهر للمدير التنفيذي لمتابعة التدقيق."
                  count={crisisFreeze.length}
                  empty={crisisFreeze.length === 0}
                >
                  <div
                    className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${crisisFreeze.length > 16 ? '2xl:grid-cols-5' : ''} ${crisisFreeze.length > 12 ? 'gap-3 sm:gap-4' : 'gap-5'}`}
                  >
                    <AnimatePresence mode="popLayout">
                      {crisisFreeze.map(row => (
                        <CrisisCard
                          key={row.id}
                          row={row}
                          layoutId={`qv-c-${row.id}`}
                          onOpen={setDrawerRow}
                          sectionCount={crisisFreeze.length}
                        />
                      ))}
                    </AnimatePresence>
                  </div>
                </SectionShell>
              ) : null}
            </div>
          )
        ) : (
          <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-200/35 via-violet-100/25 to-slate-200/40 p-[2px] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.2)]">
            <div className="overflow-hidden rounded-[1.4rem] border border-white/90 bg-white shadow-inner">
            <div className="border-b border-emerald-100/80 bg-gradient-to-l from-emerald-50/95 via-white to-violet-50/30 px-6 py-5">
              <p className="text-base font-black text-emerald-950">أرشيف الحلول</p>
              <p className="mt-1 text-xs font-medium text-slate-500">
                حالات أُغلقت من «مركز الأزمات» مع إمكانية الاطلاع على ملاحظات المدير.
              </p>
            </div>
            {solvedTotal === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm font-medium text-slate-400">لا توجد سجلات مؤرشفة بعد في هذا العرض.</p>
              </div>
            ) : (
              <>
                {solvedOnb.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} listSize={solvedTotal} />
                ))}
                {solvedActive.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} listSize={solvedTotal} />
                ))}
                {solvedInactiveFb.map(row => (
                  <SolvedRow key={`ifb-${row.id}`} row={row} onOpen={setDrawerRow} listSize={solvedTotal} />
                ))}
                {isExec
                  ? solvedFreeze.map(row => (
                      <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} listSize={solvedTotal} />
                    ))
                  : null}
                {solvedNeedsFreeze.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} listSize={solvedTotal} />
                ))}
              </>
            )}
            </div>
          </div>
        )}
      </div>

      <DetailDrawer
        row={drawerRow}
        open={drawerOpen}
        onClose={() => setDrawerRow(null)}
        onResolve={resolve}
        resolveBusy={
          drawerRow
            ? resolvingId ===
              (drawerRow.survey_kind === 'freeze_alert'
                ? `f-${drawerRow.freeze_alert_id}`
                : drawerRow.survey_kind === 'needs_freeze_request'
                  ? `nf-${drawerRow.needs_freeze_id}`
                  : drawerRow.id)
            : false
        }
        canResolve={drawerCanResolve}
        executiveNotes={executiveNotes}
        onExecutiveNotesChange={setExecutiveNotes}
        qvMissedInc={qvMissedInc}
        onToggleQvMissedInc={toggleQvMissedInc}
      />
    </div>
  )
}
