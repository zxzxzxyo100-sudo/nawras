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
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { getQuickVerificationBourse, postQuickVerificationResolveAudit } from '../services/api'
import { QV_MISSED_INC_TAG } from '../utils/merchantOfficerQueue'

function rowMatchesQuery(row, q) {
  if (!q.trim()) return true
  const s = q.trim().toLowerCase()
  const id = String(row.store_id ?? '')
  const name = (row.store_name || '').toLowerCase()
  const staff = (row.staff_username || row.staff_fullname || '').toLowerCase()
  const fr = String(row.freeze_reason || '').toLowerCase()
  const src = String(row.source_label || '').toLowerCase()
  return id.includes(s) || name.includes(s) || staff.includes(s) || fr.includes(s) || src.includes(s)
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
  const sat = loading ? null : n === 100 ? '100' : String(n).padStart(2, '0')
  return (
    <header
      className="relative isolate w-full overflow-hidden rounded-b-[1.35rem] border border-white/15 border-t-0 shadow-[0_8px_0_0_rgba(167,139,250,0.12),0_28px_80px_-28px_rgba(15,23,42,0.75),inset_0_1px_0_rgba(255,255,255,0.18)] ring-1 ring-violet-300/25 ring-offset-0 backdrop-blur-2xl sm:rounded-b-[1.75rem]"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      {/* إطار متدرج خفيف — يبرز حواف الكتلة */}
      <div
        className="pointer-events-none absolute inset-0 rounded-b-[inherit] bg-gradient-to-b from-white/[0.08] via-transparent to-transparent opacity-90"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-[1px] rounded-b-[calc(1.35rem-2px)] border border-white/[0.07] border-t-0 sm:rounded-b-[calc(1.75rem-2px)]"
        aria-hidden
      />
      {/* لمعان سفلي — خط فاصل أنيق يندمج مع الشريط التالي */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-violet-500/0 via-fuchsia-300/35 to-violet-500/0 blur-[2px]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-[12%] bottom-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"
        aria-hidden
      />
      {/* لمسات جانبية رأسية */}
      <div
        className="pointer-events-none absolute inset-y-6 right-0 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent opacity-80 sm:inset-y-8"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-y-6 left-0 w-px bg-gradient-to-b from-transparent via-white/25 to-transparent opacity-80 sm:inset-y-8"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(167,139,250,0.35),transparent_50%),radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(59,130,246,0.12),transparent_45%)]"
        aria-hidden
      />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/88 via-[#2d0a52]/88 to-[#4B0082]/88" />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative flex w-full min-w-0 flex-col gap-8 px-5 py-8 sm:px-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 lg:px-10 lg:py-8 xl:px-12 2xl:px-16">
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

/** شريط مؤشرات سريعة تحت التبويب */
function QvStatStrip({ total, openCrisis, resolved, globalSat, loading }) {
  const items = [
    {
      label: 'سجلات اليوم',
      sub: 'إجمالي ما ورد للتحقيق',
      value: loading ? '—' : total.toLocaleString('ar-SA'),
      icon: ClipboardList,
      bar: 'bg-violet-600',
      iconBg: 'bg-violet-100 text-violet-700',
    },
    {
      label: 'قيد المتابعة',
      sub: 'حالات تحتاج قراراً',
      value: loading ? '—' : openCrisis.toLocaleString('ar-SA'),
      icon: AlertTriangle,
      bar: 'bg-rose-500',
      iconBg: 'bg-rose-100 text-rose-700',
    },
    {
      label: 'تمت الأرشفة',
      sub: 'حُلّت أو أُغلقت',
      value: loading ? '—' : resolved.toLocaleString('ar-SA'),
      icon: CheckCircle2,
      bar: 'bg-emerald-500',
      iconBg: 'bg-emerald-100 text-emerald-700',
    },
    {
      label: 'مؤشر الرضا',
      sub: 'لمحة تراكمية',
      value: loading ? '—' : `${Math.min(100, Math.max(0, Number(globalSat) || 0))}%`,
      icon: Shield,
      bar: 'bg-sky-500',
      iconBg: 'bg-sky-100 text-sky-700',
    },
  ]
  return (
    <div className="grid w-full grid-cols-2 gap-3 px-5 sm:px-8 md:grid-cols-4 md:gap-4 lg:px-10 xl:px-12 2xl:px-16">
      {items.map(it => (
        <div
          key={it.label}
          className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-200/30 via-white/45 to-fuchsia-100/35 p-[1px] shadow-[0_8px_32px_-12px_rgba(75,0,130,0.18)] backdrop-blur-md transition hover:shadow-[0_16px_48px_-12px_rgba(75,0,130,0.22)]"
        >
          <div className="relative overflow-hidden rounded-[0.9rem] border border-white/75 bg-white/72 backdrop-blur-xl p-4 shadow-inner">
          <div className={`absolute right-0 top-0 h-1 w-full ${it.bar} opacity-90`} aria-hidden />
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-bold text-slate-500">{it.label}</p>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-slate-900">{it.value}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">{it.sub}</p>
            </div>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-2 ring-white/80 ${it.iconBg}`}>
              <it.icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </div>
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
              {!freezeLike ? (
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

              {canResolve && !row.resolved && !freezeLike ? (
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
  const [query, setQuery] = useState('')
  const [resolvingId, setResolvingId] = useState(null)
  const [tab, setTab] = useState('crisis')
  const [drawerRow, setDrawerRow] = useState(null)
  const [executiveNotes, setExecutiveNotes] = useState('')
  const [qvMissedInc, setQvMissedInc] = useState({ c1: false, c2: false, c3: false })

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await getQuickVerificationBourse({
        user_role: user?.role || '',
        username: user?.username || '',
      })
      if (d?.success) {
        setOnboardingRows(Array.isArray(d.rows) ? d.rows : [])
        setActiveRows(Array.isArray(d.active_csat_rows) ? d.active_csat_rows : [])
        setFreezeRows(Array.isArray(d.freeze_rows) ? d.freeze_rows : [])
        setNeedsFreezeRows(Array.isArray(d.needs_freeze_rows) ? d.needs_freeze_rows : [])
      } else {
        setErr(d?.error || 'تعذّر التحميل')
        setOnboardingRows([])
        setActiveRows([])
        setFreezeRows([])
        setNeedsFreezeRows([])
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setOnboardingRows([])
      setActiveRows([])
      setFreezeRows([])
      setNeedsFreezeRows([])
    } finally {
      setLoading(false)
    }
  }, [user?.role, user?.username])

  useEffect(() => {
    void load()
  }, [load])

  const kpis = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...freezeRows, ...needsFreezeRows]
    if (!all.length) return { growth: 0, resolution: 100, global: 100 }
    const positive = all.filter(isSatisfied).length
    const growth = Math.round((positive / all.length) * 100)
    const issues = all.filter(r => !isSatisfied(r))
    const resolved = issues.filter(r => r.resolved).length
    const resolution = issues.length ? Math.round((resolved / issues.length) * 100) : 100
    const gSum = all.reduce((acc, r) => acc + satisfactionPercent(r), 0)
    const global = Math.round(gSum / all.length)
    return { growth, resolution, global }
  }, [onboardingRows, activeRows, freezeRows, needsFreezeRows])

  const statStrip = useMemo(() => {
    const all = [...onboardingRows, ...activeRows, ...freezeRows, ...needsFreezeRows]
    const openCrisis = all.filter(r => !r.resolved && !isSatisfied(r)).length
    const resolved = all.filter(r => r.resolved).length
    return { total: all.length, openCrisis, resolved }
  }, [onboardingRows, activeRows, freezeRows, needsFreezeRows])

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
    const stillFr = freezeRows.some(r => r.id === drawerRow.id)
    const stillNf = needsFreezeRows.some(r => r.id === drawerRow.id)
    if (!stillOnb && !stillAct && !stillFr && !stillNf) setDrawerRow(null)
    else {
      const fresh = [...onboardingRows, ...activeRows, ...freezeRows, ...needsFreezeRows].find(
        r => r.id === drawerRow.id,
      )
      if (fresh && fresh.resolved !== drawerRow.resolved) setDrawerRow(fresh)
    }
  }, [onboardingRows, activeRows, freezeRows, needsFreezeRows, drawerRow])

  if (!can('quick_verification')) {
    return <Navigate to="/" replace />
  }

  const drawerOpen = !!drawerRow
  const drawerCanResolve = drawerRow ? canResolveRow(drawerRow) : false

  const crisisTotal =
    crisisOnb.length + crisisActive.length + crisisFreeze.length + crisisNeedsFreeze.length
  const solvedTotal =
    solvedOnb.length + solvedActive.length + solvedFreeze.length + solvedNeedsFreeze.length

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
          />
        </div>
      </div>

      <div className="w-full px-5 py-8 sm:px-8 lg:px-10 xl:px-12 2xl:px-16 md:py-10">
        <div className="relative mb-10 rounded-[1.35rem] bg-gradient-to-br from-violet-300/28 via-white/45 to-fuchsia-200/25 p-[2px] shadow-[0_12px_40px_-12px_rgba(75,0,130,0.15)] ring-1 ring-violet-200/30 backdrop-blur-sm">
          <div className="relative rounded-[1.25rem] border border-white/85 bg-white/78 backdrop-blur-xl shadow-inner">
          <Search className="pointer-events-none absolute right-5 top-1/2 z-10 h-5 w-5 -translate-y-1/2 text-violet-500/70" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث بالاسم، رقم المتجر، الموظف، أو السبب…"
            className="w-full rounded-[1.25rem] border-0 bg-transparent py-4 pr-14 pl-5 text-sm font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:ring-2 focus:ring-violet-400/25"
          />
          </div>
        </div>

        {err ? (
          <p className="mb-6 flex items-center gap-3 rounded-2xl border border-amber-200/90 bg-amber-50 px-5 py-4 text-sm font-medium text-amber-950 shadow-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <AlertTriangle size={20} strokeWidth={2.2} />
            </span>
            {err}
          </p>
        ) : null}

        {loading && !onboardingRows.length && !activeRows.length && !freezeRows.length && !needsFreezeRows.length ? (
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
