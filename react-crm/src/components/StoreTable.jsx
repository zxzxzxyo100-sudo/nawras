import { useState } from 'react'
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Phone,
  RotateCcw,
} from 'lucide-react'
import { parcelsInRangeDisplay } from '../utils/storeFields'

const PAGE_SIZES = [10, 50, 100, 'الكل']

export default function StoreTable({
  stores = [],
  onSelectStore,
  extraColumns = [],
  emptyMsg = 'لا توجد متاجر',
  /** نص تحت عنوان «الطرود»، مثل نطاق التاريخ لـ shipments_in_range */
  parcelsColumnSub,
  // multi-select props
  selectable = false,
  selectedIds = new Set(),
  onSelectionChange,
  /** واجهة فاخرة: خلفية متدرجة، صفوف زجاجية، شريط بحث متدرج */
  variant = 'default',
  /** يُعرض بجانب رقم المتجر (مثل وسام الاستعادة) */
  renderIdBadge,
  /** اتصال من صف الجدول (وضع elite) */
  onCallStore,
  /** فتح الاستعادة / التفاصيل (وضع elite) */
  onRestoreStore,
}) {
  const isElite = variant === 'elite'

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const filtered = stores.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search)
  )
  const effectiveSize = pageSize === 'الكل' ? filtered.length || 1 : pageSize
  const totalPages    = Math.max(1, Math.ceil(filtered.length / effectiveSize))
  const paginated     = filtered.slice((page - 1) * effectiveSize, page * effectiveSize)

  function handleSearch(v) { setSearch(v); setPage(1) }
  function handlePageSize(v) { setPageSize(v === 'الكل' ? 'الكل' : Number(v)); setPage(1) }

  // multi-select helpers
  const pageIds   = paginated.map(s => s.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selectedIds.has(id))
  const somePageSelected = pageIds.some(id => selectedIds.has(id))

  function toggleRow(id) {
    const next = new Set(selectedIds)
    next.has(id) ? next.delete(id) : next.add(id)
    onSelectionChange?.(next)
  }

  function toggleAll() {
    const next = new Set(selectedIds)
    if (allPageSelected) {
      pageIds.forEach(id => next.delete(id))
    } else {
      pageIds.forEach(id => next.add(id))
    }
    onSelectionChange?.(next)
  }

  const extraColCount = selectable ? 1 : 0

  const shellClass = isElite
    ? 'rounded-3xl overflow-hidden bg-gradient-to-br from-[#0c0618] via-[#151028] to-[#0e1018] p-2 sm:p-3 shadow-2xl shadow-black/50 border border-violet-500/15'
    : 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'

  const toolbarClass = isElite
    ? 'p-4 md:p-5 backdrop-blur-xl bg-white/[0.06] border border-white/10 rounded-2xl mb-3 shadow-inner'
    : 'p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap'

  const searchInputClass = isElite
    ? 'w-full pr-10 pl-4 py-3 text-sm rounded-xl border transition-all bg-gradient-to-l from-violet-950/45 to-slate-900/35 border-white/10 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-violet-500/35 focus:border-violet-400/25'
    : 'w-full pr-9 pl-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'

  const searchIconClass = isElite
    ? 'absolute right-3 top-1/2 -translate-y-1/2 text-violet-400 drop-shadow-[0_0_10px_rgba(167,139,250,0.45)]'
    : 'absolute right-3 top-1/2 -translate-y-1/2 text-slate-400'

  const pageBtn = (sz, active) =>
    isElite
      ? `px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
          active
            ? 'border-violet-400/35 bg-violet-600/25 text-violet-100 shadow-[0_0_14px_-3px_rgba(139,92,246,0.35)]'
            : 'border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:border-white/15'
        }`
      : `px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
          active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
        }`

  const tableWrapClass = isElite
    ? 'rounded-2xl border border-white/5 bg-black/20 backdrop-blur-md overflow-x-auto'
    : 'overflow-x-auto'

  const theadTrClass = isElite
    ? 'text-slate-400/95 text-[11px] font-semibold border-b border-white/10'
    : 'bg-slate-50 text-slate-500 text-xs font-semibold'

  const rowClass = (isSelected) => {
    if (isElite) {
      return [
        'border-b border-white/[0.06] transition-all duration-300 cursor-pointer rounded-xl',
        'bg-white/[0.03] backdrop-blur-sm shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]',
        isSelected ? 'bg-violet-500/20 ring-1 ring-violet-400/30' : '',
        'hover:bg-white/[0.07] hover:shadow-[inset_0_0_0_1px_rgba(234,179,8,0.14),0_8px_28px_-14px_rgba(234,179,8,0.12)]',
      ].join(' ')
    }
    return `border-t border-slate-50 transition-colors cursor-pointer ${
      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
    }`
  }

  const tdPad = isElite ? 'px-5 py-4' : 'px-4 py-3.5'
  const thPad = isElite ? 'px-5 py-3.5' : 'px-4 py-3'

  function handleRowClick(store) {
    if (selectable) toggleRow(store.id)
    else onSelectStore?.(store)
  }

  function defaultCall(store) {
    const p = store.phone?.replace(/\s/g, '')
    if (p) window.open(`tel:${p}`, '_self')
  }

  function handleRestoreClick(store) {
    const fn = onRestoreStore || onSelectStore
    fn?.(store)
  }

  return (
    <div className={shellClass} dir="rtl">
      {/* Search + page size */}
      <div className={toolbarClass}>
        {isElite ? (
          <div className="flex flex-wrap items-stretch gap-3 md:gap-4">
            <div className="flex flex-wrap items-center gap-1.5 shrink-0 order-1">
              <span className="text-[11px] text-slate-500 whitespace-nowrap hidden sm:inline">عرض:</span>
              <div className="flex flex-wrap gap-1">
                {PAGE_SIZES.map(sz => {
                  const active = pageSize === sz || (sz === 'الكل' && pageSize === 'الكل')
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handlePageSize(sz)}
                      className={pageBtn(sz, active)}
                    >
                      {sz}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="relative flex-1 min-w-[200px] order-2">
              <Search size={16} className={searchIconClass} strokeWidth={2} />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="بحث بالاسم أو الرقم..."
                className={searchInputClass}
              />
            </div>
            <span className="text-xs text-slate-500 whitespace-nowrap self-center order-3 tabular-nums">
              {filtered.length} متجر
            </span>
          </div>
        ) : (
          <>
            <div className="relative flex-1 min-w-[180px]">
              <Search size={15} className={searchIconClass} />
              <input
                type="text"
                value={search}
                onChange={e => handleSearch(e.target.value)}
                placeholder="بحث بالاسم أو الرقم..."
                className={searchInputClass}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-slate-400 whitespace-nowrap">عرض:</span>
              <div className="flex gap-1">
                {PAGE_SIZES.map(sz => {
                  const active = pageSize === sz || (sz === 'الكل' && pageSize === 'الكل')
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => handlePageSize(sz)}
                      className={pageBtn(sz, active)}
                    >
                      {sz}
                    </button>
                  )
                })}
              </div>
            </div>
            <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} متجر</span>
          </>
        )}
      </div>

      <div className={tableWrapClass}>
        <table className={`w-full text-sm ${isElite ? 'border-separate border-spacing-y-2' : ''}`}>
          <thead>
            <tr className={theadTrClass}>
              {selectable && (
                <th className={`${thPad} w-10 ${isElite ? 'bg-transparent' : ''}`}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleAll}
                    className={`w-4 h-4 rounded cursor-pointer ${isElite ? 'accent-violet-500' : 'accent-blue-600'}`}
                  />
                </th>
              )}
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>رقم المتجر</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>اسم المتجر</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>رقم الهاتف</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>تاريخ التسجيل</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>آخر شحنة</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>
                <span className="block">الطرود</span>
                {parcelsColumnSub && (
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5" dir="ltr">
                    {parcelsColumnSub}
                  </span>
                )}
              </th>
              {extraColumns.map(col => (
                <th key={col.key} className={`text-right ${thPad} ${isElite ? 'bg-transparent' : ''}`}>{col.label}</th>
              ))}
              <th className={`${thPad} w-24 ${isElite ? 'text-center text-slate-500 text-[10px] font-medium bg-transparent' : ''}`}>
                {isElite ? 'إجراءات' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + extraColumns.length + extraColCount + 1}
                  className={`text-center py-12 ${isElite ? 'text-slate-500' : 'text-slate-400'}`}
                >
                  {emptyMsg}
                </td>
              </tr>
            ) : (
              paginated.map(store => {
                const isSelected = selectedIds.has(store.id)
                return (
                  <tr
                    key={store.id}
                    className={rowClass(isSelected)}
                    onClick={() => handleRowClick(store)}
                  >
                    {selectable && (
                      <td className={tdPad} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(store.id)}
                          className={`w-4 h-4 rounded cursor-pointer ${isElite ? 'accent-violet-500' : 'accent-blue-600'}`}
                        />
                      </td>
                    )}
                    <td className={tdPad}>
                      <div className="flex items-center justify-end gap-2 flex-wrap">
                        <span
                          className={
                            isElite
                              ? 'text-xs font-mono tabular-nums text-slate-200 bg-white/10 text-slate-100 px-2.5 py-1 rounded-lg border border-white/10'
                              : 'text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg'
                          }
                        >
                          {store.id}
                        </span>
                        {renderIdBadge?.(store)}
                      </div>
                    </td>
                    <td className={`${tdPad} ${isElite ? 'font-semibold text-slate-100' : 'font-medium text-slate-800'}`}>
                      {store.name}
                    </td>
                    <td className={tdPad}>
                      {store.phone
                        ? (
                          <span
                            className={
                              isElite
                                ? 'text-sm font-mono tabular-nums tracking-tight text-slate-200'
                                : 'text-xs font-mono text-slate-600'
                            }
                            dir="ltr"
                          >
                            {store.phone}
                          </span>
                        )
                        : <span className={`text-xs ${isElite ? 'text-slate-600' : 'text-slate-300'}`}>—</span>}
                    </td>
                    <td className={`${tdPad} ${isElite ? 'text-slate-400' : 'text-slate-500'}`}>
                      {store.registered_at ? new Date(store.registered_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td className={`${tdPad} ${isElite ? 'text-slate-400' : 'text-slate-500'}`}>
                      {store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
                        ? new Date(store.last_shipment_date).toLocaleDateString('ar-SA')
                        : <span className={`text-xs ${isElite ? 'text-rose-400/90' : 'text-red-400'}`}>لا يوجد</span>
                      }
                    </td>
                    <td className={tdPad}>
                      <span
                        className={
                          isElite
                            ? 'font-bold text-slate-100'
                            : 'font-bold text-slate-700'
                        }
                        title={
                          store.shipments_range_from && store.shipments_range_to
                            ? `طرود في النطاق (${store.shipments_range_from} — ${store.shipments_range_to})`
                            : undefined
                        }
                      >
                        {parcelsInRangeDisplay(store)}
                      </span>
                    </td>
                    {extraColumns.map(col => (
                      <td key={col.key} className={`${tdPad} ${isElite ? 'text-slate-300' : 'text-slate-500'}`}>
                        {col.render ? col.render(store) : store[col.key] ?? '—'}
                      </td>
                    ))}
                    <td
                      className={`${tdPad} ${isElite ? 'text-center' : ''}`}
                      onClick={e => { e.stopPropagation(); if (!isElite) onSelectStore?.(store) }}
                    >
                      {isElite ? (
                        <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            title="اتصال"
                            disabled={!store.phone}
                            onClick={() => (onCallStore || defaultCall)(store)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/25 bg-violet-600/15 text-violet-300 transition-all hover:bg-violet-500/25 hover:shadow-[0_0_16px_-4px_rgba(167,139,250,0.55)] disabled:opacity-30 disabled:pointer-events-none"
                          >
                            <Phone size={16} strokeWidth={2} className="drop-shadow-[0_0_6px_rgba(167,139,250,0.5)]" />
                          </button>
                          <button
                            type="button"
                            title="استعادة / تفاصيل"
                            onClick={() => handleRestoreClick(store)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-500/25 bg-white/[0.04] text-violet-300/95 transition-all hover:bg-violet-500/20 hover:shadow-[0_0_14px_-4px_rgba(139,92,246,0.4)]"
                          >
                            <RotateCcw size={16} strokeWidth={2} />
                          </button>
                        </div>
                      ) : (
                        <ExternalLink size={14} className="text-slate-300 hover:text-blue-500 transition-colors cursor-pointer" />
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          className={
            isElite
              ? 'flex items-center justify-between px-4 py-3 border-t border-white/10 bg-black/15'
              : 'flex items-center justify-between px-4 py-3 border-t border-slate-100'
          }
        >
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={
              isElite
                ? 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 disabled:opacity-40 hover:bg-white/5 transition-colors'
                : 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors'
            }
          >
            <ChevronRight size={14} />
            السابق
          </button>
          <span className={`text-xs ${isElite ? 'text-slate-500' : 'text-slate-500'}`}>
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={
              isElite
                ? 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-slate-300 disabled:opacity-40 hover:bg-white/5 transition-colors'
                : 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors'
            }
          >
            التالي
            <ChevronLeft size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
