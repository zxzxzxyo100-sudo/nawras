import { useState, useRef, useEffect } from 'react'
import { Palette, ChevronDown } from 'lucide-react'
import { INACTIVE_ROW_COLOR_OPTIONS } from '../constants/inactiveRowColors'

/**
 * زر «الألوان» + قائمة التسميات السبع + وضع التلوين بالنقر
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
      className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 shadow-sm"
      dir="rtl"
    >
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-semibold text-white shadow-md shadow-amber-600/25 transition hover:bg-amber-600"
        >
          <Palette size={18} strokeWidth={2} className="shrink-0" />
          الألوان
          <ChevronDown size={16} className={`shrink-0 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {open && (
          <ul
            className="absolute end-0 top-full z-50 mt-1.5 min-w-[13rem] overflow-hidden rounded-xl border border-slate-200/90 bg-white py-1 shadow-xl shadow-slate-400/20 ring-1 ring-slate-200/60"
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
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-start text-sm transition hover:bg-slate-50 ${
                    activeColorKey === opt.key ? 'bg-violet-50 text-violet-900' : 'text-slate-800'
                  }`}
                >
                  <span
                    className="h-5 w-8 shrink-0 rounded-md border border-black/10 shadow-inner"
                    style={{ backgroundColor: opt.bg }}
                    aria-hidden
                  />
                  <span className="font-medium">{opt.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onTogglePaintMode}
        className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition ${
          paintMode
            ? 'bg-violet-600 text-white shadow-md shadow-violet-600/25 hover:bg-violet-700'
            : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
        }`}
      >
        {paintMode ? 'إيقاف التلوين' : 'تلوين بالنقر'}
      </button>

      {paintMode && (
        <span className="text-xs text-amber-900/90 max-w-[min(100%,18rem)] leading-snug">
          انقر على <strong>أي خلية في الصف</strong> (الاسم، الهاتف، الأعمدة…) لتطبيق <strong>{active.label}</strong>.
          أزرار الاتصال والاستعادة لا تلوّن — أوقف التلوين لفتح تفاصيل المتجر بالنقر.
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
  )
}
