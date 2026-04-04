import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
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
}) {
  const [search, setSearch]     = useState('')
  const [page, setPage]         = useState(1)
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

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم..."
            className="w-full pr-9 pl-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        {/* Page size selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-slate-400 whitespace-nowrap">عرض:</span>
          <div className="flex gap-1">
            {PAGE_SIZES.map(sz => (
              <button
                key={sz}
                onClick={() => handlePageSize(sz)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                  pageSize === sz || (sz === 'الكل' && pageSize === 'الكل')
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} متجر</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
              {selectable && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    ref={el => { if (el) el.indeterminate = somePageSelected && !allPageSelected }}
                    onChange={toggleAll}
                    className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                  />
                </th>
              )}
              <th className="text-right px-4 py-3">رقم المتجر</th>
              <th className="text-right px-4 py-3">اسم المتجر</th>
              <th className="text-right px-4 py-3">رقم الهاتف</th>
              <th className="text-right px-4 py-3">تاريخ التسجيل</th>
              <th className="text-right px-4 py-3">آخر شحنة</th>
              <th className="text-right px-4 py-3">
                <span className="block">الطرود</span>
                {parcelsColumnSub && (
                  <span className="block text-[10px] font-normal text-slate-400 mt-0.5" dir="ltr">
                    {parcelsColumnSub}
                  </span>
                )}
              </th>
              {extraColumns.map(col => (
                <th key={col.key} className="text-right px-4 py-3">{col.label}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7 + extraColumns.length + extraColCount + 1} className="text-center py-12 text-slate-400">{emptyMsg}</td>
              </tr>
            ) : (
              paginated.map(store => {
                const isSelected = selectedIds.has(store.id)
                return (
                  <tr
                    key={store.id}
                    className={`border-t border-slate-50 transition-colors cursor-pointer ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-slate-50'
                    }`}
                    onClick={() => selectable ? toggleRow(store.id) : onSelectStore?.(store)}
                  >
                    {selectable && (
                      <td className="px-4 py-3.5" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleRow(store.id)}
                          className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <span className="text-xs font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg">{store.id}</span>
                    </td>
                    <td className="px-4 py-3.5 font-medium text-slate-800">{store.name}</td>
                    <td className="px-4 py-3.5">
                      {store.phone
                        ? <span className="text-xs font-mono text-slate-600" dir="ltr">{store.phone}</span>
                        : <span className="text-xs text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {store.registered_at ? new Date(store.registered_at).toLocaleDateString('ar-SA') : '—'}
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
                        ? new Date(store.last_shipment_date).toLocaleDateString('ar-SA')
                        : <span className="text-red-400 text-xs">لا يوجد</span>
                      }
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="font-bold text-slate-700"
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
                      <td key={col.key} className="px-4 py-3.5 text-slate-500">
                        {col.render ? col.render(store) : store[col.key] ?? '—'}
                      </td>
                    ))}
                    <td className="px-4 py-3.5" onClick={e => { e.stopPropagation(); onSelectStore?.(store) }}>
                      <ExternalLink size={14} className="text-slate-300 hover:text-blue-500 transition-colors" />
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            <ChevronRight size={14} />
            السابق
          </button>
          <span className="text-xs text-slate-500">
            صفحة {page} من {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors"
          >
            التالي
            <ChevronLeft size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
