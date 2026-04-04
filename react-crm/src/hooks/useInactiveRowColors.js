import { useState, useEffect, useCallback } from 'react'
import { inactiveRowStyleForKey } from '../constants/inactiveRowColors'

function loadMap(storageKey) {
  try {
    if (typeof localStorage === 'undefined') return {}
    const raw = localStorage.getItem(storageKey)
    if (!raw) return {}
    const p = JSON.parse(raw)
    return p && typeof p === 'object' ? p : {}
  } catch {
    return {}
  }
}

/**
 * تلوين صفوف حسب معرف المتجر — يُحفظ في localStorage لكل قائمة (ساخن / بارد)
 */
export function useInactiveRowColors(scope) {
  const storageKey = `nawras_inactive_row_colors_v1_${scope}`
  const [map, setMap] = useState(() => loadMap(storageKey))

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(map))
    } catch { /* ignore quota */ }
  }, [storageKey, map])

  const styleFor = useCallback(
    storeId => inactiveRowStyleForKey(map[String(storeId)]),
    [map]
  )

  const apply = useCallback((storeId, colorKey) => {
    setMap(m => ({ ...m, [String(storeId)]: String(colorKey) }))
  }, [])

  const clearRow = useCallback(storeId => {
    setMap(m => {
      const n = { ...m }
      delete n[String(storeId)]
      return n
    })
  }, [])

  const clearAll = useCallback(() => setMap({}), [])

  return { map, styleFor, apply, clearRow, clearAll }
}
