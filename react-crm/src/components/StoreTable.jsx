import { useState } from 'react'
import { Search, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'

const PAGE_SIZE = 50

export default function StoreTable({ stores = [], onSelectStore, extraColumns = [], emptyMsg = 'لا توجد متاجر' }) {
  const [search, setSearch] = useState('')
  const [page, setPage]     = useState(1)

  const filtered = stores.filter(s =>
    !search || s.name?.toLowerCase().includes(search.toLowerCase()) || String(s.id).includes(search)
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const paginated  = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleSearch(v) { setSearch(v); setPage(1) }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
      {/* Search bar */}
      <div className="p-4 border-b border-slate-100 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => handleSearch(e.target.value)}
            placeholder="بحث بالاسم أو الرقم..."
            className="w-full pr-9 pl-4 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <span className="text-sm text-slate-500 whitespace-nowrap">{filtered.length} متجر</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-semibold">
              <th className="text-right px-4 py-3">رقم المتجر</th>
              <th className="text-right px-4 py-3">اسم المتجر</th>
              <th className="text-right px-4 py-3">رقم الهاتف</th>
              <th className="text-right px-4 py-3">تاريخ التسجيل</th>
              <th className="text-right px-4 py-3">آخر شحنة</th>
              <th className="text-right px-4 py-3">الطرود</th>
              {extraColumns.map(col => (
                <th key={col.key} className="text-right px-4 py-3">{col.label}</th>
              ))}
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={7 + extraColumns.length} className="text-center py-12 text-slate-400">{emptyMsg}</td>
              </tr>
            ) : (
              paginated.map(store => (
                <tr
                  key={store.id}
                  className="border-t border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => onSelectStore?.(store)}
                >
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
                    <span className="font-bold text-slate-700">{parseInt(store.total_shipments) || 0}</span>
                  </td>
                  {extraColumns.map(col => (
                    <td key={col.key} className="px-4 py-3.5 text-slate-500">
                      {col.render ? col.render(store) : store[col.key] ?? '—'}
                    </td>
                  ))}
                  <td className="px-4 py-3.5">
                    <ExternalLink size={14} className="text-slate-300 hover:text-blue-500 transition-colors" />
                  </td>
                </tr>
              ))
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
