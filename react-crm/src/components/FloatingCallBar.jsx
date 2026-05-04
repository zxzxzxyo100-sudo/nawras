import { useState, useRef, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, X, Search, Zap } from 'lucide-react'
import { useStores }  from '../contexts/StoresContext'
import { usePoints }  from '../contexts/PointsContext'
import { useAuth } from '../contexts/AuthContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import CallModal      from './CallModal'
import StoreNameWithId from './StoreNameWithId'

const CAT_COLORS = {
  active_shipping:      { bg: '#10b981', label: 'نشط' },
  active_pending_calls: { bg: '#059669', label: 'قيد المكالمة' },
  completed:          { bg: '#7c3aed', label: 'منجز' },
  completed_merchants:  { bg: '#7c3aed', label: 'منجز' },
  unreachable:          { bg: '#d97706', label: 'لم يُصل' },
  unreachable_merchants: { bg: '#d97706', label: 'لم يُصل' },
  frozen:               { bg: '#475569', label: 'مجمد' },
  frozen_merchants:     { bg: '#475569', label: 'مجمد' },
  hot_inactive:         { bg: '#f59e0b', label: 'ساخن' },
  cold_inactive:        { bg: '#6b7280', label: 'بارد' },
  incubating:           { bg: '#8b5cf6', label: 'تحت الاحتضان' },
}

export default function FloatingCallBar() {
  const { user } = useAuth()
  const { allStores, reload } = useStores()
  const { todayCalls, goalPct } = usePoints()

  const [open,       setOpen]       = useState(false)
  const [query,      setQuery]      = useState('')
  const [selected,   setSelected]   = useState(null)   // store to call
  const [showModal,  setShowModal]  = useState(false)
  const inputRef = useRef(null)

  // فتح اللوحة → focus على البحث تلقائياً
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
    else { setQuery(''); setSelected(null) }
  }, [open])

  const filtered = useMemo(() => {
    if (!query.trim()) return []
    const q = query.trim().toLowerCase()
    return allStores
      .filter(s => s.name?.toLowerCase().includes(q) || String(s.id).includes(q))
      .slice(0, 8)
  }, [query, allStores])

  function pick(store) {
    setSelected(store)
    setQuery(store.name)
  }

  function callSelected() {
    if (!selected) return
    setOpen(false)
    setShowModal(true)
  }

  const pulsing = !DISABLE_POINTS_AND_PERFORMANCE && goalPct < 100

  return (
    <>
      {/* ─── زر الاتصال العائم ─────────────────────────────────── */}
      <div className="fixed bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-6 left-6 z-[900] flex flex-col items-center gap-2">

        <AnimatePresence>
          {open && !DISABLE_POINTS_AND_PERFORMANCE && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 8 }}
              animate={{ opacity: 1, scale: 1,   y: 0 }}
              exit={{   opacity: 0, scale: 0.8,  y: 8 }}
              className="text-xs font-bold text-amber-400 bg-[#0f0820] border border-amber-500/30 px-3 py-1 rounded-full"
            >
              {todayCalls} مكالمة اليوم
            </motion.div>
          )}
        </AnimatePresence>

        {/* الزر الرئيسي */}
        <div className="relative">
          {/* موجة النبض */}
          {pulsing && !open && (
            <>
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(139,92,246,0.4)' }}
                animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ background: 'rgba(139,92,246,0.3)' }}
                animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
              />
            </>
          )}

          <motion.button
            onClick={() => setOpen(v => !v)}
            whileHover={{ scale: 1.08 }}
            whileTap={{   scale: 0.93 }}
            className="relative w-16 h-16 rounded-full text-white flex items-center justify-center shadow-2xl"
            style={{
              background: open
                ? 'linear-gradient(135deg, #dc2626, #b91c1c)'
                : 'linear-gradient(135deg, #7c3aed, #5b21b6)',
              boxShadow: open
                ? '0 8px 32px rgba(220,38,38,0.5)'
                : '0 8px 32px rgba(124,58,237,0.6), 0 0 0 2px rgba(124,58,237,0.2)',
            }}
          >
            <motion.div
              animate={{ rotate: open ? 45 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {open ? <X size={22} /> : <Phone size={22} />}
            </motion.div>
          </motion.button>

          {!open && !DISABLE_POINTS_AND_PERFORMANCE && (
            <div
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center text-[8px] font-black"
              style={{
                background: goalPct >= 100 ? '#10b981' : goalPct >= 50 ? '#f59e0b' : '#8b5cf6',
              }}
            >
              {goalPct >= 100 ? '✓' : `${goalPct}%`}
            </div>
          )}
        </div>
      </div>

      {/* ─── لوحة البحث العائمة ──────────────────────────────────── */}
      <AnimatePresence>
        {open && (
          <>
            {/* طبقة خلفية شفافة */}
            <motion.div
              className="fixed inset-0 z-[850]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{   opacity: 0, y: 20, scale: 0.95 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="fixed bottom-[calc(170px+env(safe-area-inset-bottom))] lg:bottom-28 left-4 z-[900] w-80 max-w-[calc(100vw-2rem)] rounded-2xl overflow-hidden shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, #120828, #1a0a3c)',
                border: '1px solid rgba(124,58,237,0.3)',
              }}
              dir="rtl"
            >
              {/* رأس اللوحة */}
              <div className="px-4 py-3 border-b border-white/5 flex items-center gap-2">
                <Zap size={14} className="text-amber-400" />
                <p className="text-white font-bold text-sm">تسجيل مكالمة سريعة</p>
                {!DISABLE_POINTS_AND_PERFORMANCE && (
                  <div className="mr-auto flex items-center gap-1 text-[10px] text-violet-300 font-medium">
                    <Phone size={9} /> {todayCalls}/20
                  </div>
                )}
              </div>

              {/* شريط البحث */}
              <div className="p-3">
                <div className="relative">
                  <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30" />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={e => { setQuery(e.target.value); setSelected(null) }}
                    placeholder="ابحث باسم المتجر أو رقمه..."
                    className="w-full bg-white/8 border border-white/10 rounded-xl pr-9 pl-3 py-2.5 text-white text-sm placeholder-white/25 focus:outline-none focus:border-violet-500/60"
                    style={{ background: 'rgba(255,255,255,0.06)' }}
                  />
                </div>
              </div>

              {/* نتائج البحث */}
              <div className="max-h-52 overflow-y-auto">
                {query.trim() && filtered.length === 0 && (
                  <p className="text-white/30 text-xs text-center py-6">لا توجد نتائج</p>
                )}
                {filtered.map(store => {
                  const cat    = store.category?.replace('_shipping', '') || 'incubating'
                  const catKey = store.category || 'incubating'
                  const color  = CAT_COLORS[catKey]?.bg || '#8b5cf6'
                  const lbl    = CAT_COLORS[catKey]?.label || 'متجر'
                  const isChosen = selected?.id === store.id
                  return (
                    <motion.button
                      key={store.id}
                      onClick={() => pick(store)}
                      whileHover={{ backgroundColor: 'rgba(124,58,237,0.15)' }}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors ${
                        isChosen ? 'bg-violet-600/20 border-r-2 border-violet-400' : ''
                      }`}
                    >
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-xs font-medium min-w-0">
                          <StoreNameWithId store={store} nameClassName="text-white font-medium" idClassName="font-mono text-white/80 text-[10px]" />
                        </div>
                      </div>
                      <span
                        className="text-[9px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: color + '30', color }}
                      >
                        {lbl}
                      </span>
                    </motion.button>
                  )
                })}
              </div>

              {/* زر الاتصال */}
              <div className="p-3 border-t border-white/5">
                <motion.button
                  onClick={callSelected}
                  disabled={!selected}
                  whileTap={{ scale: 0.97 }}
                  className="w-full py-2.5 rounded-xl font-black text-sm text-white flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{
                    background: selected
                      ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                      : 'rgba(255,255,255,0.05)',
                    boxShadow: selected ? '0 4px 16px rgba(124,58,237,0.4)' : 'none',
                  }}
                >
                  <Phone size={14} />
                  {selected
                    ? (
                      <span className="inline-flex items-center gap-1.5 flex-wrap justify-center">
                        <span>اتصل بـ</span>
                        <StoreNameWithId
                          store={selected}
                          nameClassName="font-black"
                          idClassName="font-mono text-white/90 text-[11px]"
                        />
                      </span>
                    )
                    : 'ابحث عن متجر أولاً'}
                </motion.button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─── CallModal ───────────────────────────────────────────── */}
      {showModal && selected && (
        <CallModal
          store={selected}
          onClose={() => { setShowModal(false); setSelected(null) }}
          onSaved={reload}
          taskCompletion={
            user?.role === 'inactive_manager'
              ? { inactiveRecovery: true }
              : null
          }
        />
      )}
    </>
  )
}
