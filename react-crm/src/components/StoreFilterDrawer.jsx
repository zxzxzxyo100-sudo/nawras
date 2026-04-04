import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import StoreFilterPanel from './StoreFilterPanel'

/**
 * لوحة تصفية جانبية (مثل واجهات الـ backoffice): عنوان، إغلاق، حقول، أزرار أسفل
 */
export default function StoreFilterDrawer({ open, onClose, isElite = true, ...panelProps }) {
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(e) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const onClear = panelProps.onClear

  const shell = (
    <>
      <div
        className="fixed inset-0 z-[100] bg-slate-900/45 backdrop-blur-[2px]"
        aria-hidden
        onClick={onClose}
        role="presentation"
      />
      <aside
        className="fixed inset-y-0 start-0 z-[101] flex w-full max-w-lg flex-col bg-white shadow-2xl ring-1 ring-slate-200/90"
        dir="rtl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="store-filter-drawer-title"
      >
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 bg-slate-50/90">
          <h2 id="store-filter-drawer-title" className="text-lg font-bold text-slate-800">
            تصفية
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-500 hover:bg-slate-200/80 hover:text-slate-800 transition-colors"
            aria-label="إغلاق"
          >
            <X size={22} strokeWidth={2} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <StoreFilterPanel isElite={isElite} showHeaderRow={false} {...panelProps} />
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3 shadow-[0_-4px_20px_-8px_rgba(15,23,42,0.08)]">
          <button
            type="button"
            onClick={() => {
              onClear?.()
            }}
            className="rounded-xl border-2 border-amber-400 bg-white px-4 py-2.5 text-sm font-semibold text-amber-700 hover:bg-amber-50 transition-colors"
          >
            إعادة ضبط
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border-2 border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 transition-colors"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md hover:bg-violet-700 transition-colors"
          >
            بحث
          </button>
        </div>
      </aside>
    </>
  )

  return createPortal(shell, document.body)
}
