import { useState, useRef, useEffect, useCallback, useLayoutEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Loader2 } from 'lucide-react'
import { searchStores } from '../services/api'

const DEBOUNCE_MS = 300

/**
 * حقل اسم متجر مع اقتراحات من الخادم (debounce + قائمة منسدلة RTL)
 * القائمة تُعرض عبر portal لتجنب القص داخل لوحات التمرير
 */
export default function StoreNameAutocomplete({
  value,
  onChange,
  selectedStoreId,
  onSelectedStoreIdChange,
  isElite = true,
  placeholder = '',
  inputClassName = '',
}) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState([])
  const [highlight, setHighlight] = useState(-1)
  const [menuStyle, setMenuStyle] = useState(null)
  const debounceRef = useRef(null)
  const abortRef = useRef(null)
  const pickedLabelRef = useRef(null)
  const rootRef = useRef(null)
  const dropdownRef = useRef(null)

  const inp = isElite
    ? 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-300/80 focus:border-violet-300'
    : 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/30'

  const loaderClass = isElite ? 'text-violet-500' : 'text-blue-600'

  const runSearch = useCallback(async (q) => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    const trimmed = q.trim()
    if (trimmed.length < 1) {
      setResults([])
      setLoading(false)
      return
    }
    const ac = new AbortController()
    abortRef.current = ac
    setLoading(true)
    try {
      const res = await searchStores(trimmed, { signal: ac.signal })
      if (res?.success && Array.isArray(res.data)) {
        setResults(res.data)
      } else {
        setResults([])
      }
    } catch (e) {
      if (e?.name === 'CanceledError' || e?.code === 'ERR_CANCELED') return
      setResults([])
    } finally {
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [])

  const showList = open && value.trim().length >= 1

  useLayoutEffect(() => {
    if (!showList) {
      setMenuStyle(null)
      return
    }
    function updatePos() {
      const el = rootRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      setMenuStyle({
        position: 'fixed',
        top: r.bottom + 6,
        left: r.left,
        width: r.width,
        zIndex: 200,
      })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [showList, results, loading, value])

  useEffect(() => {
    function onDocDown(e) {
      const inRoot = rootRef.current?.contains(e.target)
      const inMenu = dropdownRef.current?.contains(e.target)
      if (!inRoot && !inMenu) {
        setOpen(false)
        setHighlight(-1)
      }
    }
    document.addEventListener('mousedown', onDocDown)
    return () => document.removeEventListener('mousedown', onDocDown)
  }, [])

  function handleInputChange(e) {
    const v = e.target.value
    onChange(v)
    if (selectedStoreId != null && v !== pickedLabelRef.current) {
      onSelectedStoreIdChange(null)
      pickedLabelRef.current = null
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      runSearch(v)
    }, DEBOUNCE_MS)
    setOpen(true)
    setHighlight(-1)
  }

  function pickItem(row) {
    const id = row.id
    const name = row.name ?? ''
    pickedLabelRef.current = name
    onChange(name)
    onSelectedStoreIdChange(id)
    setOpen(false)
    setResults([])
    setHighlight(-1)
  }

  function onKeyDown(e) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlight(h => Math.min(h + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter' && highlight >= 0) {
      e.preventDefault()
      pickItem(results[highlight])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  const dropdown = showList && menuStyle && (
    <ul
      ref={dropdownRef}
      id={listId}
      role="listbox"
      style={menuStyle}
      dir="rtl"
      className="max-h-60 overflow-y-auto rounded-xl border border-slate-200/90 bg-white py-1 shadow-[0_12px_40px_-8px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/50"
    >
      {loading && results.length === 0 && (
        <li className="px-3 py-2.5 text-xs text-slate-500 text-center">جاري البحث…</li>
      )}
      {!loading &&
        results.map((row, i) => {
          const active = i === highlight
          const sub = row.phone ? (
            <span dir="ltr" className="mt-0.5 block font-mono text-[11px] text-slate-400 tabular-nums">
              {row.phone}
            </span>
          ) : null
          return (
            <li key={String(row.id) + i} role="option" aria-selected={active}>
              <button
                type="button"
                className={`flex w-full flex-col items-start px-3 py-2.5 text-start text-sm transition-colors ${
                  active
                    ? 'bg-violet-100/90 text-violet-950'
                    : 'text-slate-800 hover:bg-slate-50'
                }`}
                onMouseDown={e => e.preventDefault()}
                onClick={() => pickItem(row)}
              >
                <span className="font-medium leading-snug">{row.name || '—'}</span>
                {sub}
              </button>
            </li>
          )
        })}
      {!loading && results.length === 0 && value.trim().length >= 1 && (
        <li className="px-3 py-3 text-center text-xs text-slate-500">لا توجد نتائج</li>
      )}
    </ul>
  )

  return (
    <div ref={rootRef} className="relative w-full" dir="rtl">
      <div className="relative">
        <input
          type="text"
          autoComplete="off"
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            setOpen(true)
            if (value.trim().length >= 1) runSearch(value)
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className={`${inp} ${inputClassName} ${loading ? 'pe-9' : ''}`}
          aria-expanded={Boolean(showList && menuStyle)}
          aria-controls={listId}
          aria-autocomplete="list"
        />
        {loading && (
          <span className={`pointer-events-none absolute top-1/2 -translate-y-1/2 end-2.5 ${loaderClass}`}>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </span>
        )}
      </div>

      {dropdown && createPortal(dropdown, document.body)}
    </div>
  )
}
