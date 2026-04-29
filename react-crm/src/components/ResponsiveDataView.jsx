import { useEffect, useState } from 'react'

/**
 * يعرض نفس البيانات بشكل Table على ≥ md، وStack of Cards دون md.
 *
 * Props:
 *  - items: مصفوفة العناصر
 *  - desktop: ReactNode — العرض الجاهز للديسكتوب (عادةً <StoreTable> الحالي أو <table>)
 *  - renderCard: (item) => ReactNode — كيف نعرض كل عنصر كبطاقة في الموبايل
 *  - keyOf: (item, index) => string|number — المفتاح
 *  - emptyMsg: نص الحالة الفارغة
 *  - breakpointPx: عرض الكسر (افتراضي 768)
 *
 * الفائدة: لا يُعاد كتابة الجدول الحالي — فقط يُلفّ ويُضاف بديل cards على الموبايل.
 */
export default function ResponsiveDataView({
  items = [],
  desktop,
  renderCard,
  keyOf = (item, i) => item?.id ?? i,
  emptyMsg = 'لا توجد بيانات',
  breakpointPx = 768,
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(`(max-width: ${breakpointPx - 1}px)`).matches : false
  )

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia(`(max-width: ${breakpointPx - 1}px)`)
    const onChange = e => setIsMobile(e.matches)
    if (mq.addEventListener) mq.addEventListener('change', onChange)
    else mq.addListener(onChange)
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange)
      else mq.removeListener(onChange)
    }
  }, [breakpointPx])

  if (!isMobile) return desktop

  if (!items || items.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white px-4 py-10 text-center text-sm text-slate-500" dir="rtl">
        {emptyMsg}
      </div>
    )
  }

  return (
    <div dir="rtl" className="space-y-2.5">
      {items.map((item, i) => (
        <div key={keyOf(item, i)}>
          {renderCard(item, i)}
        </div>
      ))}
    </div>
  )
}

/**
 * بطاقة قياسية للاستخدام مع ResponsiveDataView — عنوان، شارات، حقول، وأزرار إجراء.
 *
 * Props:
 *  - title, subtitle, badge
 *  - rows: [{ label, value }]  — الحقول المعروضة
 *  - actions: [{ label, icon, onClick, color? }]
 *  - onClick: للنقر على البطاقة كاملة (اختياري)
 */
export function DataCard({ title, subtitle, badge, rows = [], actions = [], onClick }) {
  const Wrapper = onClick ? 'button' : 'div'
  return (
    <Wrapper
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`w-full text-right rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm transition-all ${
        onClick ? 'active:scale-[0.99] active:bg-slate-50 hover:border-slate-300' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-sm text-slate-900 truncate">{title}</p>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
        </div>
        {badge && (
          <span className="shrink-0 inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold bg-violet-50 text-violet-700 border border-violet-200">
            {badge}
          </span>
        )}
      </div>

      {rows.length > 0 && (
        <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
          {rows.map((r, i) => (
            <div key={i} className="min-w-0">
              <dt className="text-[10px] text-slate-400 font-semibold">{r.label}</dt>
              <dd className="text-xs text-slate-800 font-medium truncate">{r.value ?? '—'}</dd>
            </div>
          ))}
        </dl>
      )}

      {actions.length > 0 && (
        <div className="mt-3 flex items-center gap-2 flex-wrap" onClick={e => e.stopPropagation()}>
          {actions.map((a, i) => {
            const Icon = a.icon
            const palette =
              a.color === 'green' ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : a.color === 'red' ? 'bg-rose-600 hover:bg-rose-700 text-white'
              : a.color === 'amber' ? 'bg-amber-500 hover:bg-amber-600 text-white'
              : a.color === 'ghost' ? 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              : 'bg-violet-600 hover:bg-violet-700 text-white'
            return (
              <button
                key={i}
                type="button"
                onClick={a.onClick}
                disabled={a.disabled}
                className={`inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3.5 text-xs font-bold rounded-xl shadow-sm transition-colors disabled:opacity-50 ${palette}`}
              >
                {Icon && <Icon size={14} strokeWidth={2.4} />}
                {a.label}
              </button>
            )
          })}
        </div>
      )}
    </Wrapper>
  )
}
