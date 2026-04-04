import { Filter } from 'lucide-react'
import { NAME_MATCH_MODES } from '../utils/storeFilters'

const NAME_MODE_OPTIONS = [
  {
    value: NAME_MATCH_MODES.contains,
    title: 'يحتوي على النص',
    hint: 'الاسم في أي موضع؛ الهاتف: أي تسلسل أرقام',
  },
  {
    value: NAME_MATCH_MODES.startsWith,
    title: 'يبدأ الاسم بهذا النص',
    hint: 'من أول الاسم أو الحرف؛ الهاتف: أي جزء من الرقم',
  },
  {
    value: NAME_MATCH_MODES.word,
    title: 'كلمة من اسم المتجر',
    hint: 'كل كلمة لوحدها؛ الهاتف: أي جزء أرقام',
  },
]

/**
 * شريط تصفية موحّد: اسم، رقم المتجر، نطاق تاريخ التسجيل، نطاق آخر شحنة
 */
export default function StoreFilterPanel({
  isElite = true,
  /** إخفاء صف العنوان + «مسح التصفية» (للاستخدام داخل لوحة جانبية) */
  showHeaderRow = true,
  nameQuery,
  nameMatchMode = NAME_MATCH_MODES.contains,
  onNameMatchModeChange,
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

  const modeCardBase = isElite
    ? 'w-full rounded-xl border px-3 py-2.5 text-start transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-1'
    : 'w-full rounded-lg border px-3 py-2.5 text-start transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1'
  const modeCardOn = isElite
    ? 'border-violet-400 bg-violet-50/90 shadow-sm ring-1 ring-violet-200/80'
    : 'border-blue-500 bg-blue-50/90 ring-1 ring-blue-200/80'
  const modeCardOff = isElite
    ? 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/90'
    : 'border-slate-200 bg-white hover:bg-slate-50'

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
        <div className="space-y-2 sm:col-span-2 xl:col-span-1">
          <label className={label}>اسم المتجر أو رقم الهاتف</label>
          <input
            type="text"
            value={nameQuery}
            onChange={e => onNameChange(e.target.value)}
            placeholder="اسم، أو أرقام الهاتف (أي جزء من الرقم، بلا شرط البداية)..."
            className={inp}
            dir="rtl"
          />
          {onNameMatchModeChange && (
            <div className="space-y-2">
              <span className={label}>طريقة البحث في الاسم</span>
              <p className="text-[10px] text-slate-400 leading-snug -mt-0.5 mb-1">
                الهاتف يُطابق دائماً بأي جزء من الأرقام بغضّ النظر عن الخيار
              </p>
              <div
                className="flex flex-col gap-2"
                role="radiogroup"
                aria-label="طريقة البحث في اسم المتجر"
              >
                {NAME_MODE_OPTIONS.map(opt => {
                  const sel = nameMatchMode === opt.value
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      role="radio"
                      aria-checked={sel}
                      onClick={() => onNameMatchModeChange(opt.value)}
                      className={`${modeCardBase} ${sel ? modeCardOn : modeCardOff}`}
                    >
                      <span
                        className={`block text-sm font-semibold ${
                          sel ? (isElite ? 'text-violet-900' : 'text-blue-900') : 'text-slate-800'
                        }`}
                      >
                        {opt.title}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-slate-500 leading-snug">
                        {opt.hint}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
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
