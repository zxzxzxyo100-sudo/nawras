import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck, RefreshCw, ArrowBigUp, ArrowBigDown, Loader2, X, Filter,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import { IS_STAGING_OR_DEV } from '../config/envFlags'
import { getQuickVerificationBourse } from '../services/api'

/**
 * التحقق السريع — بورصة رضا من استبيان التهيئة (3 أسئلة)، تفاصيل عند النقر، فلتر الأسهم الحمراء.
 * يُفعَّل في التطوير وبناء التجريبي فقط.
 */
export default function QuickVerification() {
  const { user } = useAuth()
  const [staffMissions, setStaffMissions] = useState([])
  const [detailRows, setDetailRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [redOnly, setRedOnly] = useState(false)
  const [modalRow, setModalRow] = useState(null)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await getQuickVerificationBourse()
      if (d?.success) {
        setDetailRows(Array.isArray(d.rows) ? d.rows : [])
        setStaffMissions(Array.isArray(d.staff_summary) ? d.staff_summary : [])
      } else {
        setDetailRows([])
        setStaffMissions([])
        setErr(d?.error || 'تعذّر تحميل بيانات التحقق السريع.')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setStaffMissions([])
      setDetailRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const filteredDetails = useMemo(() => {
    if (!redOnly) return detailRows
    return detailRows.filter(r => r.arrow === 'down')
  }, [detailRows, redOnly])

  if (!IS_STAGING_OR_DEV) {
    return <Navigate to="/" replace />
  }
  if (user?.role !== 'executive') {
    return <Navigate to="/" replace />
  }

  return (
    <div className="space-y-5 pb-16" dir="rtl" style={{ fontFamily: "'Cairo', sans-serif" }}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
            <ShieldCheck size={22} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900">التحقق السريع</h1>
            <p className="text-slate-600 text-sm mt-0.5">
              بورصة الرضا من استبيان تهيئة المتجر الجديد (ثلاثة أسئلة نعم/لا): الكل نعم 🔼، أي لا 🔽 — اضغط صفاً للتقرير التفصيلي.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setRedOnly(v => !v)}
            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-colors ${
              redOnly
                ? 'bg-rose-600 border-rose-600 text-white'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={16} />
            {redOnly ? 'عرض الكل' : 'فقط الأسهم الحمراء'}
          </button>
          <button
            type="button"
            onClick={() => void loadAll()}
            disabled={loading}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </button>
        </div>
      </div>

      {err && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">{err}</p>
      )}

      {/* ملخص الموظفين (نفس منطق بورصة الرضا اليوم) */}
      <section className="rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-5 shadow-xl text-white">
        <h2 className="text-sm font-black text-white mb-3">ملخص الموظفين (اليوم)</h2>
        {loading && staffMissions.length === 0 && detailRows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <Loader2 size={20} className="animate-spin" />
            جارٍ التحميل…
          </div>
        ) : !staffMissions?.length ? (
          <p className="text-slate-500 text-sm py-6 text-center">لا توجد بيانات موظفين اليوم.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {staffMissions.map(row => {
              const up = row.satisfaction_arrow === 'up'
              return (
                <li
                  key={row.username}
                  className="rounded-xl border border-slate-600/70 bg-slate-800/50 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-100 text-sm truncate">{row.fullname || row.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">{row.role || '—'} · {row.answered_surveys_today ?? 0} استبيان</p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 shrink-0 cursor-pointer rounded-lg hover:bg-white/10 p-1 -m-1 transition-colors"
                    onClick={() => {
                      const u = row.username
                      const first = u
                        ? detailRows.find(dr => dr.staff_username === u)
                        : detailRows.find(dr => (dr.staff_fullname || '') === (row.fullname || ''))
                      if (first) setModalRow(first)
                    }}
                    title="عرض تفاصيل استبيان مرتبط بهذا الموظف إن وُجد"
                  >
                    {up ? (
                      <ArrowBigUp size={22} strokeWidth={2.5} className="text-emerald-400" aria-hidden />
                    ) : (
                      <ArrowBigDown size={22} strokeWidth={2.5} className="text-rose-400" aria-hidden />
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* تفاصيل حسب متجر */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
          <h2 className="text-sm font-black text-slate-900">استبيانات تهيئة المتاجر (اليوم)</h2>
          <span className="text-xs text-slate-500 tabular-nums">{filteredDetails.length} سجل</span>
        </div>
        {loading && detailRows.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
            <Loader2 size={22} className="animate-spin" />
            جارٍ تحميل التفاصيل…
          </div>
        ) : filteredDetails.length === 0 ? (
          <p className="text-slate-500 text-sm py-12 text-center">لا توجد سجلات مطابقة.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-xs">
                  <th className="px-4 py-2 font-bold">المتجر</th>
                  <th className="px-4 py-2 font-bold">الموظف</th>
                  <th className="px-4 py-2 font-bold w-24">المؤشر</th>
                </tr>
              </thead>
              <tbody>
                {filteredDetails.map(row => (
                  <tr
                    key={row.id}
                    className="border-b border-slate-50 hover:bg-violet-50/50 cursor-pointer transition-colors"
                    onClick={() => setModalRow(row)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => { if (e.key === 'Enter') setModalRow(row) }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{row.store_name}</td>
                    <td className="px-4 py-3 text-slate-700">{row.staff_fullname || row.staff_username || '—'}</td>
                    <td className="px-4 py-3">
                      {row.arrow === 'up' ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold" title="🔼">
                          <ArrowBigUp size={20} />
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-600 font-bold" title="🔽">
                          <ArrowBigDown size={20} />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {modalRow && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-black/55"
            onClick={() => setModalRow(null)}
          >
            <motion.div
              initial={{ scale: 0.96, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[min(90vh,640px)] overflow-hidden border border-slate-200"
              dir="rtl"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <p className="font-black text-sm">تقرير الاستبيان</p>
                <button type="button" onClick={() => setModalRow(null)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(min(90vh,640px)-56px)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم المتجر</p>
                  <p className="text-slate-900 font-bold">{modalRow.store_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم الموظف</p>
                  <p className="text-slate-800">{modalRow.staff_fullname || modalRow.staff_username || '—'}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-2">نتائج الاستبيان التفصيلية</p>
                  <ul className="space-y-2">
                    {(modalRow.answers || []).map((a, i) => (
                      <li
                        key={i}
                        className={`rounded-xl border px-3 py-2 text-sm ${
                          a.yes ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'
                        }`}
                      >
                        <span className="font-bold">{a.label}:</span>{' '}
                        {a.yes ? 'نعم' : 'لا'}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-2">سبب الخلل / التاغ</p>
                  {modalRow.gap_tags?.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {modalRow.gap_tags.map(t => (
                        <span key={t} className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200">
                          {t}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500">لا يوجد — جميع الإجابات إيجابية.</p>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
