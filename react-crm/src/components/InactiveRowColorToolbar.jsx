import { useState, useRef, useEffect } from 'react'
import { Palette, ChevronDown } from 'lucide-react'
import { INACTIVE_ROW_COLOR_OPTIONS } from '../constants/inactiveRowColors'

/**
 * شريط ألوان: معاينة على الزر + شريط مربعات ملوّنة دائماً + قائمة منسدلة
 */
export default function InactiveRowColorToolbar({
  activeColorKey,
  onSelectColorKey,
  paintMode,
  onTogglePaintMode,
  onClearAll,
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useEffect(() => {
    function close(e) {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [])

  const active = INACTIVE_ROW_COLOR_OPTIONS.find(o => o.key === activeColorKey) || INACTIVE_ROW_COLOR_OPTIONS[0]

  return (
    <div
      ref={rootRef}
      className="flex flex-col gap-3 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-3 shadow-sm"
      dir="rtl"
    >
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="inline-flex items-center gap-2.5 rounded-xl bg-amber-500 px-3.5 py-2.5 text-sm font-semibold text-white shadow-md shadow-amber-600/25 transition hover:bg-amber-600"
          >
            {/* معاينة اللون الحالي — يظهر دائماً */}
            <span
              className="h-8 w-8 shrink-0 rounded-lg border-2 border-white/90 shadow-md"
              style={{ backgroundColor: active.bg }}
              title={active.label}
              aria-hidden
            />
            <Palette size={18} strokeWidth={2} className="shrink-0 opacity-95" />
            الألوان
            <ChevronDown size={16} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
          </button>
          {open && (
            <ul
              className="absolute end-0 top-full z-[300] mt-2 min-w-[15rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1.5 shadow-2xl shadow-slate-400/30 ring-1 ring-slate-200/60"
              role="listbox"
            >
              {INACTIVE_ROW_COLOR_OPTIONS.map(opt => (
                <li key={opt.key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={activeColorKey === opt.key}
                    onClick={() => {
                      onSelectColorKey(opt.key)
                      setOpen(false)
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-3 text-start text-sm transition hover:bg-slate-50 ${
                      activeColorKey === opt.key ? 'bg-violet-50 text-violet-900' : 'text-slate-800'
                    }`}
                  >
                    <span
                      className="h-8 min-w-[3.25rem] shrink-0 rounded-lg border-2 border-slate-300/90 shadow-inner"
                      style={{ backgroundColor: opt.bg }}
                      aria-hidden
                    />
                    <span className="font-semibold">{opt.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="button"
          onClick={onTogglePaintMode}
          className={`rounded-xl px-3.5 py-2.5 text-sm font-semibold transition ${
            paintMode
              ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25 hover:bg-violet-700'
              : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {paintMode ? 'إيقاف التلوين' : 'تلوين بالنقر'}
        </button>

        {paintMode && (
          <span className="text-xs text-amber-950/95 max-w-[min(100%,20rem)] leading-relaxed">
            انقر على صف المتجر لتلوينه بـ <strong className="text-violet-800">{active.label}</strong>.
            {' '}
            <span className="text-slate-600">أوقف التلوين ثم انقر لفتح التفاصيل.</span>
          </span>
        )}

        <button
          type="button"
          onClick={onClearAll}
          className="ms-auto text-xs font-medium text-slate-500 underline-offset-2 hover:text-rose-600 hover:underline"
        >
          مسح كل الألوان
        </button>
      </div>

      {/* شريط الألوان السبعة — يظهر دائماً حتى لا يبدو أن «لا توجد ألوان» */}
      <div className="rounded-xl border border-amber-200/70 bg-white/70 px-2 py-2">
        <p className="mb-2 text-center text-[11px] font-semibold text-slate-600 sm:text-start">
          اختر لوناً ثم فعّل «تلوين بالنقر» وانقر على الصف
        </p>
        <div className="flex flex-wrap items-stretch justify-center gap-2 sm:justify-start">
          {INACTIVE_ROW_COLOR_OPTIONS.map(opt => {
            const sel = activeColorKey === opt.key
            return (
              <button
                key={opt.key}
                type="button"
                title={`${opt.label} — ${opt.bg}`}
                onClick={() => onSelectColorKey(opt.key)}
                className={`flex min-w-[2.75rem] flex-col items-center gap-1 rounded-lg p-1.5 transition hover:scale-[1.03] hover:shadow-md ${
                  sel ? 'bg-violet-100 ring-2 ring-violet-500' : 'bg-slate-50/80 ring-1 ring-slate-200'
                }`}
              >
                <span
                  className="h-10 w-full min-w-[2.5rem] max-w-[3rem] rounded-md border-2 border-slate-400/30 shadow-sm"
                  style={{ backgroundColor: opt.bg }}
                  aria-hidden
                />
                <span className="text-[10px] font-bold text-slate-700">{opt.key}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
