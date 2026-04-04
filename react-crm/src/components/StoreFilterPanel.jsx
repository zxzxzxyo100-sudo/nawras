import { Filter } from 'lucide-react'

/**
 * شريط تصفية موحّد: اسم، رقم المتجر، نطاق تاريخ التسجيل، نطاق آخر شحنة
 */
export default function StoreFilterPanel({
  isElite = true,
  /** إخفاء صف العنوان + «مسح التصفية» (للاستخدام داخل لوحة جانبية) */
  showHeaderRow = true,
  nameQuery,
  idQuery,
  regFrom,
  regTo,
  shipFrom,
  shipTo,
  onNameChange,
  onIdChange,
  onRegFromChange,
  onRegToChange,
  onShipFromChange,
  onShipToChange,
  onClear,
}) {
  const label = 'block text-[11px] text-slate-500 mb-1'
  const inp = isElite
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300/80 focus:border-violet-300'
    : 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  const dateInp = isElite
    ? 'min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-300/80 focus:border-violet-300 [color-scheme:light]'
    : 'min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 [color-scheme:light]'

  const clearBtn = isElite
    ? 'text-xs font-medium text-violet-700 hover:text-violet-900 px-3 py-1.5 rounded-lg border border-violet-200 bg-violet-50/80 hover:bg-violet-100 transition-colors'
    : 'text-xs font-medium text-slate-600 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100'

  return (
    <div className="w-full space-y-3">
      {showHeaderRow && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-slate-600">
            <Filter size={15} className={isElite ? 'text-violet-600' : 'text-slate-500'} strokeWidth={2} />
            <span className="text-xs font-semibold">تصفية</span>
          </div>
          <button type="button" onClick={onClear} className={clearBtn}>
            مسح التصفية
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div>
          <label className={label}>اسم المتجر</label>
          <input
            type="text"
            value={nameQuery}
            onChange={e => onNameChange(e.target.value)}
            placeholder="اسم المتجر أو جزء من رقم الهاتف..."
            className={inp}
            dir="rtl"
          />
        </div>
        <div>
          <label className={label}>رقم المتجر / المعرف</label>
          <input
            type="text"
            inputMode="numeric"
            value={idQuery}
            onChange={e => onIdChange(e.target.value)}
            placeholder="مثال: 12345"
            className={`${inp} font-mono tabular-nums`}
            dir="ltr"
          />
        </div>
        <div>
          <span className={label}>تاريخ التسجيل</span>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={regFrom}
              onChange={e => onRegFromChange(e.target.value)}
              className={dateInp}
              title="من"
            />
            <span className="text-slate-400 text-xs shrink-0">—</span>
            <input
              type="date"
              value={regTo}
              onChange={e => onRegToChange(e.target.value)}
              className={dateInp}
              title="إلى"
            />
          </div>
        </div>
        <div>
          <span className={label}>تاريخ آخر شحنة</span>
          <div className="flex gap-2 items-center flex-wrap">
            <input
              type="date"
              value={shipFrom}
              onChange={e => onShipFromChange(e.target.value)}
              className={dateInp}
              title="من"
            />
            <span className="text-slate-400 text-xs shrink-0">—</span>
            <input
              type="date"
              value={shipTo}
              onChange={e => onShipToChange(e.target.value)}
              className={dateInp}
              title="إلى"
            />
          </div>
        </div>
      </div>
    </div>
  )
}
