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
    <header className="relative w-full overflow-hidden border-b border-white/10 shadow-[0_24px_80px_-24px_rgba(15,23,42,0.65)]">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_120%_80%_at_100%_-20%,rgba(167,139,250,0.35),transparent_50%),radial-gradient(ellipse_80%_60%_at_0%_100%,rgba(59,130,246,0.12),transparent_45%)]"
        aria-hidden
      />
      <div
        className="absolute inset-0 bg-gradient-to-br from-slate-950 via-[#2d0a52] to-[#4B0082]"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,.15) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.12) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />
      <div className="relative flex w-full min-w-0 flex-col gap-8 px-4 py-8 sm:px-8 lg:flex-row lg:items-stretch lg:justify-between lg:gap-10 lg:px-10 lg:py-7 xl:px-14">
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
          <div className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-white/12 to-white/[0.04] p-1 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="rounded-[1.35rem] bg-slate-950/40 px-6 py-5 sm:px-7 sm:py-6">
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
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-3 px-4 md:grid-cols-4 md:gap-4 md:px-8">
      {items.map(it => (
        <div
          key={it.label}
          className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_4px_24px_-12px_rgba(15,23,42,0.08)] transition hover:shadow-[0_12px_40px_-16px_rgba(75,0,130,0.12)]"
        >
          <div className={`absolute right-0 top-0 h-1 w-full ${it.bar} opacity-90`} aria-hidden />
          <div className="flex items-start justify-between gap-3 pt-1">
            <div className="min-w-0 text-right">
              <p className="text-[11px] font-bold text-slate-500">{it.label}</p>
              <p className="mt-2 text-2xl font-black tabular-nums tracking-tight text-slate-900">{it.value}</p>
              <p className="mt-1 text-[10px] font-medium text-slate-400">{it.sub}</p>
            </div>
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${it.iconBg}`}>
              <it.icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}

function SectionShell({ title, subtitle, count, children, empty }) {
  return (
    <section className="relative">
      <div className="mb-6 flex flex-col gap-2 border-b border-slate-200/90 pb-5">
        <div className="min-w-0 text-right">
          <div className="flex flex-wrap items-center justify-end gap-3">
            <h2 className="text-lg font-black tracking-tight text-slate-900 md:text-xl">{title}</h2>
            <span className="inline-flex h-9 min-w-[2.25rem] items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-black tabular-nums text-slate-800 shadow-sm">
              {count}
            </span>
          </div>
          {subtitle ? (
            <p className="mt-2 max-w-2xl text-right text-xs leading-relaxed text-slate-500 md:text-sm">{subtitle}</p>
          ) : null}
        </div>
      </div>
      {empty ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 px-5 py-12 text-center">
          <p className="text-sm font-medium text-slate-400">لا توجد حالات في هذا القسم.</p>
        </div>
      ) : (
        children
      )}
    </section>
  )
}

function MerchantLogo({ name, storeId }) {
  const ch = (name || String(storeId) || '?').trim().slice(0, 1)
  return (
    <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-violet-200/80 bg-gradient-to-br from-white via-violet-50/30 to-violet-100/40 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
      <span className="text-xl font-black text-violet-900">{ch}</span>
      <span className="absolute -bottom-1 -left-1 flex h-7 w-7 items-center justify-center rounded-lg border border-white bg-white shadow-md ring-1 ring-slate-200/80">
        <Store size={13} className="text-violet-700" strokeWidth={2.2} />
      </span>
    </div>
  )
}

function CrisisCard({ row, onOpen, layoutId }) {
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
      className="group relative flex min-h-[200px] w-full flex-col overflow-hidden rounded-3xl border border-slate-200/90 bg-white text-right shadow-[0_4px_6px_-1px_rgba(15,23,42,0.06),0_20px_40px_-24px_rgba(75,0,130,0.18)] transition-all duration-300 hover:-translate-y-0.5 hover:border-violet-300/80 hover:shadow-[0_24px_50px_-20px_rgba(75,0,130,0.28)]"
    >
      <div
        className="absolute inset-x-0 top-0 h-1 bg-gradient-to-l from-fuchsia-500 via-[#4B0082] to-indigo-600 opacity-90"
        aria-hidden
      />
      <div
        className="flex w-full shrink-0 items-center justify-between gap-2 border-b border-slate-100/90 bg-gradient-to-l from-slate-50 to-white px-4 py-3"
      >
        <span className="min-w-0 flex-1 truncate text-right text-[13px] font-black leading-snug text-slate-900">
          {displayName}
        </span>
        <span className="shrink-0 rounded-lg border border-violet-200/80 bg-violet-50 px-2.5 py-1 text-[10px] font-black text-violet-900">
          {headerBadge}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 flex-col p-4">
        <div className="mb-3 flex items-start justify-between gap-2">
          <MerchantLogo name={row.store_name} storeId={row.store_id} />
          <span className="inline-flex items-center gap-1 rounded-full border border-rose-100 bg-gradient-to-l from-rose-50 to-orange-50/80 px-2.5 py-1 text-[9px] font-black text-rose-800 shadow-sm">
            <Flame size={11} className="text-rose-500" />
            أولوية
          </span>
        </div>
        <p className="text-[12px] font-semibold tabular-nums text-slate-500">
          #{row.store_id} · {kindLabel}
        </p>
        <div className="mt-auto flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-[10px] font-bold text-slate-400">استبيان اليوم</span>
          <span className="text-[11px] font-bold text-violet-700 opacity-0 transition group-hover:opacity-100">
            عرض التفاصيل
          </span>
        </div>
      </div>
    </motion.button>
  )
}

function SolvedRow({ row, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(row)}
      className="group flex w-full items-center gap-4 border-b border-slate-100/90 bg-white px-5 py-4 text-right transition hover:bg-slate-50/90"
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-white text-base font-black text-emerald-900 shadow-sm">
        {(row.store_name || '?').trim().slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-slate-900">{row.store_name}</p>
        <p className="mt-0.5 text-xs font-medium text-slate-400">#{row.store_id}</p>
        {row.executive_notes ? (
          <p className="mt-1.5 line-clamp-1 text-right text-xs font-medium text-violet-800/90">
            {row.executive_notes}
          </p>
        ) : null}
      </div>
      <CheckCircle2
        className="shrink-0 text-emerald-500 opacity-70 transition group-hover:opacity-100"
        size={22}
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
            className="fixed inset-y-0 right-0 z-[70] flex w-full max-w-md flex-col border-l border-violet-200/60 bg-white shadow-[-24px_0_80px_-20px_rgba(15,23,42,0.25)]"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-l from-violet-50/90 via-white to-white px-5 py-5">
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
      className="min-h-screen bg-[#f4f2fa] pb-24"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <div className="sticky top-0 z-40">
        <QuickAuditTopNav growth={kpis.growth} resolution={kpis.resolution} globalSat={kpis.global} loading={loading} />
        <div className="border-b border-slate-200/80 bg-white/90 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-8">
            <div className="flex flex-1 rounded-2xl border border-slate-200/90 bg-slate-50/80 p-1.5 shadow-inner">
              <button
                type="button"
                onClick={() => setTab('crisis')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition md:text-sm ${
                  tab === 'crisis'
                    ? 'bg-white text-violet-900 shadow-md ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                <AlertTriangle size={16} className={tab === 'crisis' ? 'text-rose-500' : 'text-slate-400'} strokeWidth={2.2} />
                مركز الأزمات
                {crisisTotal > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      tab === 'crisis' ? 'bg-rose-100 text-rose-800' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {crisisTotal}
                  </span>
                ) : null}
              </button>
              <button
                type="button"
                onClick={() => setTab('solved')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-black transition md:text-sm ${
                  tab === 'solved'
                    ? 'bg-white text-violet-900 shadow-md ring-1 ring-slate-200/80'
                    : 'text-slate-500 hover:bg-white/60 hover:text-slate-800'
                }`}
              >
                <CheckCircle2 size={16} className={tab === 'solved' ? 'text-emerald-600' : 'text-slate-400'} strokeWidth={2.2} />
                تم الحل
                {solvedTotal > 0 ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      tab === 'solved' ? 'bg-emerald-100 text-emerald-900' : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {solvedTotal}
                  </span>
                ) : null}
              </button>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white px-5 py-2.5 text-xs font-bold text-violet-900 shadow-sm transition hover:bg-violet-50 disabled:opacity-50 md:text-sm"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin text-violet-600' : 'text-violet-600'} strokeWidth={2.2} />
              تحديث البيانات
            </button>
          </div>
        </div>
        <div className="border-b border-slate-200/60 bg-gradient-to-b from-white to-[#f4f2fa] py-5 md:py-6">
          <QvStatStrip
            total={statStrip.total}
            openCrisis={statStrip.openCrisis}
            resolved={statStrip.resolved}
            globalSat={kpis.global}
            loading={loading}
          />
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <div className="relative mb-10">
          <Search className="pointer-events-none absolute right-5 top-1/2 h-5 w-5 -translate-y-1/2 text-violet-400/80" strokeWidth={2} />
          <input
            type="search"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="بحث بالاسم، رقم المتجر، الموظف، أو السبب…"
            className="w-full rounded-2xl border border-slate-200/90 bg-white py-4 pr-14 pl-5 text-sm font-medium text-slate-800 shadow-[0_8px_30px_-12px_rgba(75,0,130,0.12)] outline-none ring-0 placeholder:text-slate-400 focus:border-violet-400 focus:shadow-[0_12px_40px_-12px_rgba(75,0,130,0.18)] focus:ring-4 focus:ring-violet-500/10"
          />
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
            <div className="overflow-hidden rounded-3xl border border-emerald-200/60 bg-gradient-to-b from-emerald-50/80 via-white to-white px-8 py-16 text-center shadow-[0_20px_60px_-30px_rgba(16,185,129,0.25)]">
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {crisisOnb.map(row => (
                      <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {crisisActive.map(row => (
                      <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
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
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  <AnimatePresence mode="popLayout">
                    {crisisNeedsFreeze.map(row => (
                      <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
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
                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <AnimatePresence mode="popLayout">
                      {crisisFreeze.map(row => (
                        <CrisisCard key={row.id} row={row} layoutId={`qv-c-${row.id}`} onOpen={setDrawerRow} />
                      ))}
                    </AnimatePresence>
                  </div>
                </SectionShell>
              ) : null}
            </div>
          )
        ) : (
          <div className="overflow-hidden rounded-3xl border border-slate-200/90 bg-white shadow-[0_24px_60px_-28px_rgba(15,23,42,0.18)]">
            <div className="border-b border-slate-100 bg-gradient-to-l from-emerald-50/90 to-white px-6 py-5">
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
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                ))}
                {solvedActive.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                ))}
                {isExec
                  ? solvedFreeze.map(row => (
                      <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                    ))
                  : null}
                {solvedNeedsFreeze.map(row => (
                  <SolvedRow key={row.id} row={row} onOpen={setDrawerRow} />
                ))}
              </>
            )}
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
