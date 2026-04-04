import { useState, useMemo, useEffect } from 'react'
import {
  Filter,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Phone,
  RotateCcw,
} from 'lucide-react'
import { parcelsInRangeDisplay } from '../utils/storeFields'
import { filterStoresByToolbar } from '../utils/storeFilters'
import { STORE_BUCKET_KEYS } from '../utils/storeBuckets'
import StoreFilterDrawer from './StoreFilterDrawer'

/** خيارات عدد الصفوف في الصفحة (قائمة منسدلة مثل واجهات الإدارة) */
const PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 150, 200, 500, 1000, 'الكل']

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
  /**
   * تلوين صفوف (غير نشط ساخن/بارد): getStyle يعيد خلفية/لون نص؛ paintMode + onPaintClick للتلوين بالنقر
   */
  rowTint = null,
  /** تصفية بحسب خانة المتجر (احتضان / نشط يشحن / …) — يتطلب أن يكون لكل عنصر في stores حقل bucket */
  enableBucketFilter = false,
  /** عند التصفية: كل الخانات (افتراضي) أو احتضان فقط — يُزامَن مع مسار ?bucket=incubating */
  bucketPreset = 'all',
}) {
  const isElite = variant === 'elite'

  const [nameQuery, setNameQuery] = useState('')
  const [namePickedStoreId, setNamePickedStoreId] = useState(null)
  const [idQuery, setIdQuery] = useState('')
  const [regFrom, setRegFrom] = useState('')
  const [regTo, setRegTo] = useState('')
  const [shipFrom, setShipFrom] = useState('')
  const [shipTo, setShipTo] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [filterOpen, setFilterOpen] = useState(false)
  const [selectedBucketKeys, setSelectedBucketKeys] = useState(() => (
    bucketPreset === 'incubating' ? ['incubating'] : [...STORE_BUCKET_KEYS]
  ))

  useEffect(() => {
    if (!enableBucketFilter) return
    setSelectedBucketKeys(bucketPreset === 'incubating' ? ['incubating'] : [...STORE_BUCKET_KEYS])
  }, [bucketPreset, enableBucketFilter])

  const filterPayload = useMemo(
    () => ({
      nameQuery,
      namePickedStoreId,
      idQuery,
      regFrom,
      regTo,
      shipFrom,
      shipTo,
      ...(enableBucketFilter ? { bucketKeys: selectedBucketKeys } : {}),
    }),
    [nameQuery, namePickedStoreId, idQuery, regFrom, regTo, shipFrom, shipTo, enableBucketFilter, selectedBucketKeys]
  )

  const filtered = useMemo(
    () => filterStoresByToolbar(stores, filterPayload),
    [stores, filterPayload]
  )

  useEffect(() => {
    setPage(1)
  }, [filterPayload])

  const effectiveSize = pageSize === 'الكل' ? filtered.length || 1 : pageSize
  const totalPages    = Math.max(1, Math.ceil(filtered.length / effectiveSize))
  const paginated     = filtered.slice((page - 1) * effectiveSize, page * effectiveSize)

  function handlePageSize(v) { setPageSize(v === 'الكل' ? 'الكل' : Number(v)); setPage(1) }

  function clearFilters() {
    setNameQuery('')
    setNamePickedStoreId(null)
    setIdQuery('')
    setRegFrom('')
    setRegTo('')
    setShipFrom('')
    setShipTo('')
    if (enableBucketFilter) {
      setSelectedBucketKeys(bucketPreset === 'incubating' ? ['incubating'] : [...STORE_BUCKET_KEYS])
    }
  }

  const hasActiveFilters = useMemo(
    () =>
      Boolean(
        nameQuery.trim()
        || namePickedStoreId != null
        || idQuery.trim()
        || regFrom
        || regTo
        || shipFrom
        || shipTo
        || (enableBucketFilter && selectedBucketKeys.length < STORE_BUCKET_KEYS.length)
      ),
    [nameQuery, namePickedStoreId, idQuery, regFrom, regTo, shipFrom, shipTo, enableBucketFilter, selectedBucketKeys]
  )

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
    ? 'rounded-3xl overflow-hidden bg-gradient-to-br from-slate-50 via-violet-50/35 to-slate-100/90 p-2 sm:p-3 shadow-lg shadow-slate-200/60 border border-slate-200/90'
    : 'bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden'

  const toolbarClass = isElite
    ? 'p-4 md:p-5 backdrop-blur-md bg-white/85 border border-slate-200/80 rounded-2xl mb-3 shadow-sm space-y-4'
    : 'p-4 border-b border-slate-100 space-y-4'

  const pageSizeSelectClass = isElite
    ? 'min-w-[8.5rem] rounded-xl border border-slate-200 bg-white py-2 ps-3 pe-9 text-sm font-medium text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-300/80 focus:border-violet-300 cursor-pointer appearance-none'
    : 'min-w-[8.5rem] rounded-lg border border-slate-200 bg-white py-2 ps-3 pe-9 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 cursor-pointer appearance-none'

  const tableWrapClass = isElite
    ? 'rounded-2xl border border-slate-200/90 bg-white overflow-x-auto shadow-inner'
    : 'overflow-x-auto'

  const theadTrClass = isElite
    ? 'bg-slate-50/95 text-slate-600 text-[11px] font-semibold border-b border-slate-200'
    : 'bg-slate-50 text-slate-500 text-xs font-semibold'

  const rowClass = (isSelected, hasCustomTint) => {
    if (hasCustomTint) {
      return [
        'border-b border-black/10 transition-all duration-200 cursor-pointer',
        isSelected ? 'ring-2 ring-white/60 ring-inset' : '',
        'hover:brightness-[0.97]',
      ].join(' ')
    }
    if (isElite) {
      return [
        'border-b border-slate-100 transition-all duration-300 cursor-pointer',
        'bg-white shadow-[inset_0_0_0_1px_rgba(226,232,240,0.9)]',
        isSelected ? 'bg-violet-50 ring-1 ring-violet-200/80' : '',
        'hover:bg-amber-50/50 hover:shadow-[inset_0_0_0_1px_rgba(234,179,8,0.28),0_6px_24px_-12px_rgba(234,179,8,0.18)]',
      ].join(' ')
    }
    return `border-t border-slate-50 transition-colors cursor-pointer ${
      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
    }`
  }

  /** نص موحّد لخلايا الجدول في الوضع الفاتح */
  const eliteCell = 'text-slate-700'

  const tdPad = isElite ? `px-5 py-4 ${eliteCell}` : 'px-4 py-3.5'
  const thPad = isElite ? 'px-5 py-3.5' : 'px-4 py-3'

  function handleRowClick(store) {
    if (rowTint?.paintMode && rowTint?.onPaintClick) {
      rowTint.onPaintClick(store)
      return
    }
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
      {/* زر تصفية + عرض */}
      <div className={toolbarClass}>
        <div
          className={
            isElite
              ? 'flex flex-wrap items-center justify-between gap-4'
              : 'flex flex-wrap items-center justify-between gap-4'
          }
        >
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className={
                isElite
                  ? 'inline-flex items-center gap-2 rounded-xl border-2 border-blue-500 bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-600/20 transition-colors hover:bg-blue-700'
                  : 'inline-flex items-center gap-2 rounded-xl border border-blue-600 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700'
              }
            >
              <Filter size={18} strokeWidth={2.5} className="shrink-0" />
              تصفية
              {hasActiveFilters && (
                <span className="flex h-2 w-2 rounded-full bg-amber-300 ring-2 ring-white" title="تصفية نشطة" />
              )}
            </button>
            <div className="hidden sm:block h-8 w-px bg-slate-200/90" aria-hidden />
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span
                className={`flex items-center gap-2 whitespace-nowrap ${
                  isElite ? 'text-xs text-slate-600' : 'text-xs text-slate-500'
                }`}
              >
                <span dir="ltr" className="font-semibold tracking-tight text-slate-700">
                  Show
                </span>
                <span className="text-slate-300" aria-hidden>
                  |
                </span>
                <span className="font-medium">عرض:</span>
              </span>
              <div className="relative inline-flex">
                <select
                  aria-label="عدد الصفوف في الصفحة"
                  value={pageSize === 'الكل' ? 'all' : String(pageSize)}
                  onChange={e => {
                    const v = e.target.value
                    handlePageSize(v === 'all' ? 'الكل' : Number(v))
                  }}
                  className={pageSizeSelectClass}
                >
                  {PAGE_SIZE_OPTIONS.map(sz => (
                    <option
                      key={sz}
                      value={sz === 'الكل' ? 'all' : String(sz)}
                    >
                      {sz === 'الكل' ? 'الكل' : sz.toLocaleString('en-US')}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={16}
                  className="pointer-events-none absolute top-1/2 -translate-y-1/2 end-2.5 text-slate-400"
                  aria-hidden
                />
              </div>
            </div>
          </div>
          <span
            className={`tabular-nums font-medium ${isElite ? 'text-sm text-slate-700' : 'text-sm text-slate-600'}`}
          >
            {filtered.length.toLocaleString('ar-SA')} متجر
          </span>
        </div>
      </div>

      <StoreFilterDrawer
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        isElite={isElite}
        nameQuery={nameQuery}
        namePickedStoreId={namePickedStoreId}
        onNamePickedStoreIdChange={setNamePickedStoreId}
        idQuery={idQuery}
        regFrom={regFrom}
        regTo={regTo}
        shipFrom={shipFrom}
        shipTo={shipTo}
        onNameChange={setNameQuery}
        onIdChange={setIdQuery}
        onRegFromChange={setRegFrom}
        onRegToChange={setRegTo}
        onShipFromChange={setShipFrom}
        onShipToChange={setShipTo}
        onClear={clearFilters}
        showBucketFilter={enableBucketFilter}
        selectedBucketKeys={selectedBucketKeys}
        onBucketKeysChange={setSelectedBucketKeys}
      />

      <div className={tableWrapClass}>
        <table className="w-full text-sm">
          <thead>
            <tr className={theadTrClass}>
              {selectable && (
                <th className={`${thPad} w-10 ${isElite ? 'bg-slate-50/95' : ''}`}>
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleAll}
                    className={`w-4 h-4 rounded cursor-pointer ${isElite ? 'accent-violet-500' : 'accent-blue-600'}`}
                  />
                </th>
              )}
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>رقم المتجر</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>اسم المتجر</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>رقم الهاتف</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>تاريخ التسجيل</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>آخر شحنة</th>
              <th className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>
                <span className="block">الطرود</span>
                {parcelsColumnSub && (
                  <span className="block text-[10px] font-normal text-slate-500 mt-0.5" dir="ltr">
                    {parcelsColumnSub}
                  </span>
                )}
              </th>
              {extraColumns.map(col => (
                <th key={col.key} className={`text-right ${thPad} ${isElite ? 'bg-slate-50/95' : ''}`}>{col.label}</th>
              ))}
              <th className={`${thPad} w-24 ${isElite ? 'text-center text-slate-500 text-[10px] font-medium bg-slate-50/95' : ''}`}>
                {isElite ? 'إجراءات' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={7 + extraColumns.length + extraColCount + 1}
                  className={`text-center py-12 ${isElite ? 'text-slate-500 bg-white' : 'text-slate-400'}`}
                >
                  {stores.length > 0 && filtered.length === 0
                    ? 'لا توجد نتائج تطابق التصفية الحالية'
                    : emptyMsg}
                </td>
              </tr>
            ) : (
              paginated.map(store => {
                const isSelected = selectedIds.has(store.id)
                const tintStyle = rowTint?.getStyle?.(store)
                const hasTint = Boolean(tintStyle?.backgroundColor)
                const paintActive = Boolean(rowTint?.paintMode && rowTint?.onPaintClick)
                return (
                  <tr
                    key={store.id}
                    style={tintStyle}
                    title={paintActive ? 'انقر لتطبيق اللون على هذا الصف' : undefined}
                    className={[
                      rowClass(isSelected, hasTint),
                      hasTint ? '[&_td]:!text-inherit' : '',
                      paintActive ? 'outline outline-1 outline-offset-[-1px] outline-amber-300/40' : '',
                    ].filter(Boolean).join(' ')}
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
                              ? 'text-xs font-mono tabular-nums text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/90'
                              : 'text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg'
                          }
                        >
                          {store.id}
                        </span>
                        {renderIdBadge?.(store)}
                      </div>
                    </td>
                    <td className={`${tdPad} ${isElite ? 'font-semibold text-slate-900' : 'font-medium text-slate-800'}`}>
                      {store.name}
                    </td>
                    <td className={tdPad}>
                      {store.phone
                        ? (
                          <span
                            className={
                              isElite
                                ? 'text-sm font-mono tabular-nums tracking-tight text-slate-800'
                                : 'text-xs font-mono text-slate-600'
                            }
                            dir="ltr"
                          >
                            {store.phone}
                          </span>
                        )
                        : <span className={`text-xs ${isElite ? 'text-slate-400' : 'text-slate-300'}`}>—</span>}
                    </td>
                    <td className={`${tdPad} ${isElite ? 'text-slate-600' : 'text-slate-500'}`}>
                      {store.registered_at ? new Date(store.registered_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td className={`${tdPad} ${isElite ? 'text-slate-600' : 'text-slate-500'}`}>
                      {store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
                        ? new Date(store.last_shipment_date).toLocaleDateString('ar-SA')
                        : <span className={`text-xs ${isElite ? 'text-rose-600' : 'text-red-400'}`}>لا يوجد</span>
                      }
                    </td>
                    <td className={tdPad}>
                      <span
                        className={
                          isElite
                            ? 'font-bold text-slate-900'
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
                      <td key={col.key} className={`${tdPad} ${isElite ? eliteCell : 'text-slate-500'}`}>
                        {col.render ? col.render(store) : store[col.key] ?? '—'}
                      </td>
                    ))}
                    <td
                      className={`${tdPad} ${isElite ? 'text-center' : ''}`}
                      onClick={e => {
                        if (paintActive) return
                        e.stopPropagation()
                        if (!isElite) onSelectStore?.(store)
                      }}
                    >
                      {isElite ? (
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="اتصال"
                            disabled={!store.phone}
                            onClick={e => {
                              e.stopPropagation()
                              ;(onCallStore || defaultCall)(store)
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-violet-50 text-violet-700 transition-all hover:bg-violet-100 hover:shadow-[0_0_14px_-4px_rgba(139,92,246,0.35)] disabled:opacity-35 disabled:pointer-events-none"
                          >
                            <Phone size={16} strokeWidth={2} className="text-violet-600 drop-shadow-[0_0_4px_rgba(139,92,246,0.2)]" />
                          </button>
                          <button
                            type="button"
                            title="استعادة / تفاصيل"
                            onClick={e => {
                              e.stopPropagation()
                              handleRestoreClick(store)
                            }}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-violet-200 bg-white text-violet-700 transition-all hover:bg-violet-50 hover:shadow-[0_0_12px_-4px_rgba(139,92,246,0.25)]"
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
              ? 'flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50/80'
              : 'flex items-center justify-between px-4 py-3 border-t border-slate-100'
          }
        >
          <button
            type="button"
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className={
              isElite
                ? 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-white transition-colors'
                : 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors'
            }
          >
            <ChevronRight size={14} />
            السابق
          </button>
          <span className={`text-xs ${isElite ? 'text-slate-600' : 'text-slate-500'}`}>
            صفحة {page} من {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={
              isElite
                ? 'flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 disabled:opacity-40 hover:bg-white transition-colors'
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
