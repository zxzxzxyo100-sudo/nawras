import { useCallback, useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  RefreshCw,
  ArrowBigUp,
  ArrowBigDown,
  ArrowLeftRight,
  Loader2,
  X,
  Filter,
  Star,
  Store,
  Truck,
  CheckCircle2,
  XCircle,
  Copy,
  ClipboardList,
  User,
  Calendar,
  ChevronLeft,
  LayoutGrid,
  Smile,
  Frown,
  Package,
} from 'lucide-react'
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from 'recharts'
import { useAuth } from '../contexts/AuthContext'
import { useStores } from '../contexts/StoresContext'
import { IS_STAGING_OR_DEV, IS_VITE_APP_STAGING } from '../config/envFlags'
import { getQuickVerificationBourse, getQuickVerificationAuditTimeline } from '../services/api'
import { totalShipments, parcelsInRangeDisplay } from '../utils/storeFields'

const SUCCESS = '#28C76F'
const DANGER = '#EA5455'
const NAVY = '#1e3a5f'
/** أخضر نيون للرضا */
const NEON_GREEN = '#00E676'
/** قرمزي عميق لعدم الرضا */
const CRIMSON = '#B71C1C'
/** برتقالي مؤسسي للإحصائيات */
const CORPORATE_ORANGE = '#FF9F43'
const PAGE_BG_STAGING = '#F8F9FA'

function resolveShipmentCount(allStores, storeId) {
  if (storeId == null || !Array.isArray(allStores)) return null
  const s = allStores.find(
    x => x?.id === storeId || String(x?.id) === String(storeId) || Number(x?.id) === Number(storeId),
  )
  if (!s) return null
  const life = totalShipments(s)
  const range = parcelsInRangeDisplay(s)
  const n = life > 0 ? life : range
  return Number.isFinite(n) ? Math.trunc(n) : 0
}

/** سهم رضا بتوهج نيون / قرمزي */
function StagingSatisfactionArrow({ arrow }) {
  if (arrow === 'up') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-2xl p-3 bg-white border border-white"
        style={{
          boxShadow: `0 0 22px ${NEON_GREEN}88, 0 0 40px ${NEON_GREEN}44`,
          color: NEON_GREEN,
        }}
      >
        <ArrowBigUp size={26} strokeWidth={2.6} aria-hidden />
      </span>
    )
  }
  if (arrow === 'mid') {
    return (
      <span
        className="inline-flex items-center justify-center rounded-2xl p-3 bg-white border border-amber-100"
        style={{ boxShadow: '0 0 18px rgba(245,158,11,0.35)' }}
      >
        <ArrowLeftRight size={24} strokeWidth={2.5} className="text-amber-500" aria-hidden />
      </span>
    )
  }
  return (
    <span
      className="inline-flex items-center justify-center rounded-2xl p-3 bg-white border border-white"
      style={{
        boxShadow: `0 0 22px ${CRIMSON}99, 0 0 38px ${CRIMSON}55`,
        color: CRIMSON,
      }}
    >
      <ArrowBigDown size={26} strokeWidth={2.6} aria-hidden />
    </span>
  )
}

function textSnippet(s, max = 64) {
  const t = (s || '').trim()
  if (!t) return ''
  return t.length > max ? `${t.slice(0, max)}…` : t
}

function fmtServerAt(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return String(iso)
  return d.toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' })
}

function MiniStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-0.5 flex-row-reverse" aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          size={14}
          className={n <= v ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
          strokeWidth={n <= v ? 0 : 1.2}
        />
      ))}
    </div>
  )
}

function ArrowForState({ arrow }) {
  if (arrow === 'up') {
    return <ArrowBigUp size={20} strokeWidth={2.5} className="text-emerald-600" aria-hidden />
  }
  if (arrow === 'mid') {
    return <ArrowLeftRight size={20} strokeWidth={2.5} className="text-amber-500" aria-hidden />
  }
  return <ArrowBigDown size={20} strokeWidth={2.5} className="text-rose-600" aria-hidden />
}

function AnimatedStars({ value }) {
  const v = Math.max(0, Math.min(5, Number(value) || 0))
  return (
    <div className="flex items-center gap-1 flex-row-reverse justify-end" aria-hidden>
      {[1, 2, 3, 4, 5].map(n => (
        <motion.span
          key={n}
          initial={{ scale: 0.2, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 18, delay: (n - 1) * 0.05 }}
        >
          <Star
            size={20}
            className={n <= v ? 'text-amber-400 fill-amber-400' : 'text-slate-200'}
            strokeWidth={n <= v ? 0 : 1.5}
          />
        </motion.span>
      ))}
    </div>
  )
}

/** درج التفصيل — داخل نفس الملف (تجريبي فقط) */
function StagingAuditDrawer({ row, onClose }) {
  const [latestCallNote, setLatestCallNote] = useState(null)
  const [callStage, setCallStage] = useState(null)
  const [loading, setLoading] = useState(true)

  const radarData = useMemo(() => {
    if (!row?.questions?.length) return []
    return row.questions.map(q => ({
      subject: q.label.length > 12 ? `${q.label.slice(0, 11)}…` : q.label,
      score: q.value,
      fullMark: 5,
    }))
  }, [row])

  useEffect(() => {
    if (!row?.store_id) return
    let cancelled = false
    setLoading(true)
    getQuickVerificationAuditTimeline(row.store_id)
      .then(d => {
        if (cancelled) return
        setLatestCallNote(d?.latest_call_note || null)
        const evs = Array.isArray(d?.events) ? d.events : []
        let stage = null
        for (let i = evs.length - 1; i >= 0; i--) {
          const sub = String(evs[i]?.sub || '')
          if (sub.includes('inc_call1')) {
            stage = 1
            break
          }
          if (sub.includes('inc_call2')) {
            stage = 2
            break
          }
          if (sub.includes('inc_call3')) {
            stage = 3
            break
          }
        }
        setCallStage(stage)
      })
      .catch(() => {
        if (!cancelled) {
          setLatestCallNote(null)
          setCallStage(null)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [row?.store_id])

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const fullNoteText = [row?.suggestions?.trim(), latestCallNote?.text].filter(Boolean).join('\n\n---\n\n') || ''

  async function copyNote() {
    const t = fullNoteText || (row?.suggestions || '').trim() || latestCallNote?.text || ''
    if (!t || !navigator.clipboard?.writeText) return
    try {
      await navigator.clipboard.writeText(t)
    } catch { /* */ }
  }

  if (!row) return null

  return (
    <motion.div
      className="fixed inset-0 z-[600] flex justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      dir="rtl"
      style={{ fontFamily: "'Cairo', sans-serif" }}
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label="إغلاق"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative h-full w-full max-w-[480px] flex flex-col bg-white shadow-2xl border-r border-slate-200"
      >
        <div className="shrink-0 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-lg font-black truncate" style={{ color: NAVY }}>
              {row.store_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">#{row.store_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-xl p-2 text-slate-500 hover:bg-slate-100"
          >
            <X size={22} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-6">
          <section className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 space-y-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide">معلومات المكالمة</p>
            <div className="flex items-start gap-2 text-sm">
              <User size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-700">الموظف: </span>
                <span className="text-slate-900">{row.staff_fullname || row.staff_username || '—'}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <Calendar size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-700">التاريخ والوقت: </span>
                <span className="text-slate-900 tabular-nums">{fmtServerAt(row.created_at)}</span>
              </div>
            </div>
            <div className="flex items-start gap-2 text-sm">
              <ClipboardList size={16} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <span className="font-bold text-slate-700">مرحلة المكالمة: </span>
                <span className="text-slate-900">
                  {loading ? '…' : callStage != null ? `مكالمة ${callStage}` : 'غير محدد في السجل'}
                </span>
              </div>
            </div>
          </section>

          <section>
            <p className="text-xs font-black text-slate-500 mb-3">إجابات الاستبيان</p>
            {row.survey_kind === 'new_merchant_onboarding' && row.answers && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {row.answers.map((a, i) => (
                  <div
                    key={i}
                    className={`rounded-xl border p-3 flex flex-col gap-2 ${
                      a.yes ? 'border-emerald-200 bg-emerald-50/50' : 'border-rose-200 bg-rose-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {a.yes ? (
                        <CheckCircle2 size={28} style={{ color: SUCCESS }} />
                      ) : (
                        <XCircle size={28} style={{ color: DANGER }} />
                      )}
                    </div>
                    <p className="text-xs font-bold text-slate-800 leading-snug">{a.label}</p>
                    <p className="text-[10px] text-slate-400 tabular-nums">{fmtServerAt(row.created_at)}</p>
                  </div>
                ))}
              </div>
            )}
            {row.survey_kind === 'active_csat' && row.questions && (
              <>
                {radarData.length > 0 && (
                  <div className="h-[200px] w-full mb-4 rounded-xl border border-slate-200 p-2 bg-white" dir="ltr">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart data={radarData} margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
                        <PolarGrid stroke="#e2e8f0" />
                        <PolarAngleAxis dataKey="subject" tick={{ fontSize: 9, fill: '#64748b' }} />
                        <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 9 }} />
                        <Radar name="A" dataKey="score" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {row.questions.map((q, i) => (
                    <div
                      key={i}
                      className={`rounded-xl border p-3 ${
                        q.risk === 'high'
                          ? 'border-rose-200 bg-rose-50/40'
                          : q.risk === 'mid'
                            ? 'border-amber-200 bg-amber-50/40'
                            : 'border-emerald-100 bg-emerald-50/30'
                      }`}
                    >
                      <p className="text-xs font-bold text-slate-800 mb-2">{q.label}</p>
                      <div className="flex items-center justify-between gap-2">
                        <AnimatedStars value={q.value} />
                        <span className="text-sm font-black tabular-nums text-slate-700">{q.value}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-2">
              <p className="text-sm font-black" style={{ color: NAVY }}>
                الملاحظات والتعليقات
              </p>
              <button
                type="button"
                onClick={() => void copyNote()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100"
              >
                <Copy size={14} />
                نسخ الملاحظة
              </button>
            </div>
            {(row.suggestions || '').trim() !== '' && (
              <div className="mb-3">
                <p className="text-[11px] font-bold text-slate-500 mb-1">صوت المتجر (مسجّل)</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100 rounded-lg p-3 bg-slate-50/80">
                  {(row.suggestions || '').trim()}
                </p>
              </div>
            )}
            {latestCallNote?.text ? (
              <div>
                <p className="text-[11px] font-bold text-slate-500 mb-1">ملاحظة المكالمة (الموظف)</p>
                <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed border border-slate-100 rounded-lg p-3 bg-slate-50/80">
                  {latestCallNote.text}
                </p>
                <p className="text-[10px] text-slate-400 mt-1 tabular-nums">
                  {latestCallNote.by ? `${latestCallNote.by} — ` : ''}
                  {fmtServerAt(latestCallNote.at)}
                </p>
              </div>
            ) : (
              !((row.suggestions || '').trim()) && (
                <p className="text-sm text-slate-400">لا توجد ملاحظات نصية في هذا السجل.</p>
              )
            )}
          </section>
        </div>
      </motion.aside>
    </motion.div>
  )
}

/**
 * التحقق السريع — استبيان تهيئة (3) منفصل عن CSAT التجار النشطين (6 نجوم).
 * يُفعَّل في التطوير وبناء التجريبي فقط.
 */
export default function QuickVerification() {
  const { user } = useAuth()
  const { allStores } = useStores()
  const [mainTab, setMainTab] = useState('onboarding')
  const [staffMissions, setStaffMissions] = useState([])
  const [activeStaffMissions, setActiveStaffMissions] = useState([])
  const [detailRows, setDetailRows] = useState([])
  const [activeDetailRows, setActiveDetailRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [redOnly, setRedOnly] = useState(false)
  const [modalRow, setModalRow] = useState(null)
  /** تبويبات الرضا — تجريبي فقط */
  const [satTab, setSatTab] = useState('all')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = await getQuickVerificationBourse()
      if (d?.success) {
        setDetailRows(Array.isArray(d.rows) ? d.rows : [])
        setStaffMissions(Array.isArray(d.staff_summary) ? d.staff_summary : [])
        setActiveDetailRows(Array.isArray(d.active_csat_rows) ? d.active_csat_rows : [])
        setActiveStaffMissions(Array.isArray(d.active_csat_staff_summary) ? d.active_csat_staff_summary : [])
      } else {
        setDetailRows([])
        setStaffMissions([])
        setActiveDetailRows([])
        setActiveStaffMissions([])
        setErr(d?.error || 'تعذّر تحميل بيانات التحقق السريع.')
      }
    } catch (e) {
      setErr(e?.response?.data?.error || e?.message || 'خطأ في التحميل')
      setStaffMissions([])
      setActiveStaffMissions([])
      setDetailRows([])
      setActiveDetailRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadAll()
  }, [loadAll])

  const currentDetails = mainTab === 'onboarding' ? detailRows : activeDetailRows
  const currentStaff = mainTab === 'onboarding' ? staffMissions : activeStaffMissions

  const satStats = useMemo(() => {
    let sat = 0
    let uns = 0
    currentDetails.forEach(r => {
      if (r.arrow === 'up') sat += 1
      else if (r.arrow === 'down') uns += 1
    })
    return { total: currentDetails.length, sat, uns }
  }, [currentDetails])

  const filteredDetails = useMemo(() => {
    if (IS_VITE_APP_STAGING) {
      if (satTab === 'up') return currentDetails.filter(r => r.arrow === 'up')
      if (satTab === 'down') return currentDetails.filter(r => r.arrow === 'down')
      return currentDetails
    }
    if (!redOnly) return currentDetails
    if (mainTab === 'onboarding') {
      return currentDetails.filter(r => r.arrow === 'down')
    }
    return currentDetails.filter(r => r.arrow === 'down' || r.tier === 'red')
  }, [currentDetails, redOnly, mainTab, satTab])

  const radarData = useMemo(() => {
    if (!modalRow?.questions?.length) return []
    return modalRow.questions.map(q => ({
      subject: q.label.length > 10 ? `${q.label.slice(0, 9)}…` : q.label,
      score: q.value,
      fullMark: 5,
    }))
  }, [modalRow])

  if (!IS_STAGING_OR_DEV) {
    return <Navigate to="/" replace />
  }
  if (user?.role !== 'executive') {
    return <Navigate to="/" replace />
  }

  return (
    <div
      className={IS_VITE_APP_STAGING ? 'space-y-6 pb-16 px-3 md:px-5 pt-1' : 'space-y-5 pb-16'}
      dir="rtl"
      style={{
        fontFamily: "'Cairo', sans-serif",
        ...(IS_VITE_APP_STAGING ? { background: PAGE_BG_STAGING } : {}),
      }}
    >
      {/* رأس الصفحة */}
      {IS_VITE_APP_STAGING ? (
        <div className="rounded-2xl border-2 border-slate-200/90 bg-white px-5 py-6 shadow-[0_4px_24px_rgba(30,58,95,0.06)]">
          <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-5">
            <div className="flex items-start gap-4 min-w-0">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg"
                style={{
                  background: `linear-gradient(145deg, ${NAVY} 0%, #2c5282 100%)`,
                  border: `1px solid ${CORPORATE_ORANGE}55`,
                }}
              >
                <ShieldCheck size={28} className="text-white" strokeWidth={2.2} />
              </div>
              <div>
                <h1
                  className="text-2xl font-black tracking-tight leading-tight"
                  style={{ color: NAVY, fontFeatureSettings: '"kern" 1' }}
                >
                  التحقق السريع
                </h1>
                <p className="text-slate-500 text-sm mt-1.5 font-medium">
                  لوحة مراقبة الاستبيانات — {mainTab === 'onboarding' ? 'متاجر جدد' : 'تجار نشطون'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span
                className="inline-flex items-center gap-2.5 rounded-2xl px-4 py-2.5 text-sm font-black shadow-sm border-2 bg-white"
                style={{ borderColor: NAVY, color: NAVY }}
              >
                <LayoutGrid size={18} style={{ color: CORPORATE_ORANGE }} aria-hidden />
                الإجمالي
                <span
                  className="tabular-nums rounded-lg px-2.5 py-0.5 font-black"
                  style={{ background: `${CORPORATE_ORANGE}18`, color: NAVY }}
                >
                  {satStats.total}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 text-sm font-black bg-white shadow-sm"
                style={{ borderColor: NEON_GREEN, color: NAVY }}
              >
                <Smile size={18} style={{ color: NEON_GREEN }} strokeWidth={2.4} aria-hidden />
                راضٍ
                <ArrowBigUp size={16} style={{ color: NEON_GREEN }} className="opacity-90" aria-hidden />
                <span
                  className="tabular-nums rounded-lg px-2.5 py-0.5 font-black"
                  style={{ background: `${NEON_GREEN}14`, color: NAVY }}
                >
                  {satStats.sat}
                </span>
              </span>
              <span
                className="inline-flex items-center gap-2.5 rounded-2xl border-2 px-4 py-2.5 text-sm font-black bg-white shadow-sm"
                style={{ borderColor: CRIMSON, color: NAVY }}
              >
                <Frown size={18} style={{ color: CRIMSON }} strokeWidth={2.4} aria-hidden />
                غير راضٍ
                <ArrowBigDown size={16} style={{ color: CRIMSON }} className="opacity-90" aria-hidden />
                <span
                  className="tabular-nums rounded-lg px-2.5 py-0.5 font-black"
                  style={{ background: `${CRIMSON}12`, color: NAVY }}
                >
                  {satStats.uns}
                </span>
              </span>
              <button
                type="button"
                onClick={() => void loadAll()}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold border-2 border-slate-200 text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 shadow-sm"
                style={{ color: NAVY }}
              >
                <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                تحديث
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
          <div className="flex items-start gap-3 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center shrink-0">
              <ShieldCheck size={22} className="text-emerald-400" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900">التحقق السريع</h1>
              <p className="text-slate-600 text-sm mt-0.5">
                {mainTab === 'onboarding'
                  ? 'استبيان تهيئة المتجر الجديد (ثلاثة أسئلة نعم/لا): الكل نعم 🔼، أي لا 🔽.'
                  : 'استبيان رضا التجار النشطين — ستة محاور بنجوم 1–5: المتوسط ≥4 🔼، 3–3.9 ↔️، أقل من 3 🔽.'}
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
              {redOnly ? 'عرض الكل' : 'فقط الأحمر / الهبوط'}
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
      )}

      <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-2">
        <button
          type="button"
          onClick={() => setMainTab('onboarding')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            mainTab === 'onboarding'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <Store size={18} />
          متاجر جدد (تهيئة)
        </button>
        <button
          type="button"
          onClick={() => setMainTab('active_csat')}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            mainTab === 'active_csat'
              ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
              : 'text-slate-600 hover:bg-white/80'
          }`}
        >
          <Truck size={18} />
          تجار نشطون (CSAT)
        </button>
      </div>

      {IS_VITE_APP_STAGING && (
        <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
          {[
            { id: 'all', label: 'الكل' },
            { id: 'down', label: 'غير راضٍ 🔽' },
            { id: 'up', label: 'راضي 🔼' },
          ].map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setSatTab(t.id)}
              className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-colors ${
                satTab === t.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {err && (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">{err}</p>
      )}

      <section className="rounded-2xl border border-slate-700/80 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 lg:p-5 shadow-xl text-white">
        <h2 className="text-sm font-black text-white mb-3">
          ملخص الموظفين (اليوم) — {mainTab === 'onboarding' ? 'تهيئة' : 'CSAT نشط'}
        </h2>
        {loading && currentStaff.length === 0 && currentDetails.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-8 text-slate-400 text-sm">
            <Loader2 size={20} className="animate-spin" />
            جارٍ التحميل…
          </div>
        ) : !currentStaff?.length ? (
          <p className="text-slate-500 text-sm py-6 text-center">لا توجد بيانات موظفين اليوم في هذا القسم.</p>
        ) : (
          <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
            {currentStaff.map(row => {
              const arrow = row.satisfaction_arrow
              const up = arrow === 'up'
              const mid = arrow === 'mid'
              return (
                <li
                  key={row.username || row.fullname}
                  className="rounded-xl border border-slate-600/70 bg-slate-800/50 px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-slate-100 text-sm truncate">{row.fullname || row.username}</p>
                    <p className="text-[10px] text-slate-500 truncate">
                      {row.role || '—'} · {row.answered_surveys_today ?? 0} استبيان
                    </p>
                  </div>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 shrink-0 cursor-pointer rounded-lg hover:bg-white/10 p-1 -m-1 transition-colors"
                    onClick={() => {
                      const u = row.username
                      const pool = mainTab === 'onboarding' ? detailRows : activeDetailRows
                      const first = u
                        ? pool.find(dr => dr.staff_username === u)
                        : pool.find(dr => (dr.staff_fullname || '') === (row.fullname || ''))
                      if (first) setModalRow(first)
                    }}
                    title="عرض تفاصيل استبيان مرتبط بهذا الموظف إن وُجد"
                  >
                    {up ? (
                      <ArrowBigUp size={22} strokeWidth={2.5} className="text-emerald-400" aria-hidden />
                    ) : mid ? (
                      <ArrowLeftRight size={22} strokeWidth={2.5} className="text-amber-400" aria-hidden />
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

      <section
        className={
          IS_VITE_APP_STAGING
            ? 'rounded-2xl border border-slate-200/90 bg-[#F8F9FA] shadow-[0_2px_20px_rgba(15,23,42,0.04)] overflow-hidden'
            : 'rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden'
        }
      >
        {!IS_VITE_APP_STAGING && (
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between gap-2">
            <h2 className="text-sm font-black text-slate-900">
              {mainTab === 'onboarding' ? 'استبيانات تهيئة المتاجر (اليوم)' : 'تجار نشطون — متوسط الرضا (اليوم)'}
            </h2>
            <span className="text-xs text-slate-500 tabular-nums">{filteredDetails.length} سجل</span>
          </div>
        )}
        {IS_VITE_APP_STAGING && (
          <div className="px-5 py-4 border-b border-slate-200/80 bg-white/90 flex items-center justify-between gap-2">
            <h2 className="text-base font-black" style={{ color: NAVY }}>
              سجلات المتاجر (اليوم)
            </h2>
            <span className="text-xs font-bold text-slate-500 tabular-nums">{filteredDetails.length} عرض</span>
          </div>
        )}
        {loading && currentDetails.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-400 text-sm">
            <Loader2 size={22} className="animate-spin" />
            جارٍ تحميل التفاصيل…
          </div>
        ) : filteredDetails.length === 0 ? (
          <p className="text-slate-500 text-sm py-12 text-center">لا توجد سجلات مطابقة.</p>
        ) : IS_VITE_APP_STAGING ? (
          <div className="px-3 md:px-4 pb-6 pt-2 space-y-4">
            {filteredDetails.map(row => {
              const shipN = resolveShipmentCount(allStores, row.store_id)
              return (
                <motion.div
                  key={row.id}
                  layout
                  className="group rounded-2xl border border-slate-200/90 bg-white px-5 py-5 md:px-6 md:py-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_40px_rgba(15,23,42,0.08)]"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
                    {/* الهوية + القوة التشغيلية — خط أفقي واحد */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <h3
                          className="text-lg md:text-xl font-black leading-snug tracking-tight truncate"
                          style={{ color: NAVY, fontFeatureSettings: '"kern" 1' }}
                        >
                          {row.store_name}
                        </h3>
                        <p className="mt-1 text-xs font-bold text-slate-500 tabular-nums tracking-wide">
                          كود المتجر{' '}
                          <span className="inline-block rounded-lg bg-slate-100 text-slate-700 px-2 py-0.5 border border-slate-200/90">
                            #{row.store_id}
                          </span>
                        </p>
                      </div>
                      <div
                        className="shrink-0 inline-flex items-center gap-2 rounded-xl px-4 py-2.5 border border-slate-200/80"
                        style={{ background: 'linear-gradient(180deg, #f1f5f9 0%, #e8ecf0 100%)' }}
                        title="عدد الشحنات (من بيانات المتجر)"
                      >
                        <Package size={18} className="text-slate-500 shrink-0" aria-hidden />
                        <span className="text-[11px] font-bold text-slate-500 uppercase">الشحنات</span>
                        <span className="text-base font-black tabular-nums text-slate-900">
                          {shipN != null ? shipN.toLocaleString('ar-EG') : '—'}
                        </span>
                        <span className="text-xs font-bold text-slate-600">شحنة</span>
                      </div>
                    </div>

                    <div className="flex flex-row flex-wrap items-center justify-between lg:justify-end gap-4 lg:gap-6">
                      <div className="flex items-center justify-center shrink-0">
                        <StagingSatisfactionArrow arrow={row.arrow} />
                      </div>
                      <div className="flex items-center gap-3 min-w-0 flex-1 lg:max-w-[240px] lg:flex-initial lg:justify-end">
                        <p className="text-xs text-slate-500 truncate flex-1 text-right lg:text-right font-medium">
                          {textSnippet(row.suggestions, 20) || '—'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setModalRow(row)}
                          className="shrink-0 inline-flex items-center gap-1.5 rounded-xl border-2 border-slate-300 bg-transparent px-4 py-2 text-xs font-black transition-colors text-[#1e3a5f] hover:bg-[#1e3a5f] hover:border-[#1e3a5f] hover:text-white"
                        >
                          عرض التفاصيل
                          <ChevronLeft size={14} className="opacity-70" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80 text-slate-600 text-xs">
                  <th className="px-4 py-2 font-bold">المتجر</th>
                  {mainTab === 'active_csat' && (
                    <th className="px-4 py-2 font-bold w-28">المتوسط</th>
                  )}
                  <th className="px-4 py-2 font-bold">الموظف</th>
                  <th className="px-4 py-2 font-bold w-28">المؤشر</th>
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
                    onKeyDown={e => {
                      if (e.key === 'Enter') setModalRow(row)
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900">{row.store_name}</td>
                    {mainTab === 'active_csat' && (
                      <td className="px-4 py-3 tabular-nums font-bold text-slate-800">{row.avg}</td>
                    )}
                    <td className="px-4 py-3 text-slate-700">{row.staff_fullname || row.staff_username || '—'}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 font-bold" title={row.arrow}>
                        <ArrowForState arrow={row.arrow} />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <AnimatePresence>
        {modalRow && IS_VITE_APP_STAGING && (
          <StagingAuditDrawer key={modalRow.id} row={modalRow} onClose={() => setModalRow(null)} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {modalRow && !IS_VITE_APP_STAGING && (
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
              className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[min(90vh,720px)] overflow-hidden border border-slate-200"
              dir="rtl"
            >
              <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white">
                <p className="font-black text-sm">تقرير الاستبيان</p>
                <button type="button" onClick={() => setModalRow(null)} className="p-1.5 rounded-lg hover:bg-white/10">
                  <X size={18} />
                </button>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto max-h-[calc(min(90vh,720px)-56px)]">
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم المتجر</p>
                  <p className="text-slate-900 font-bold">{modalRow.store_name}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold text-slate-500 mb-1">اسم الموظف</p>
                  <p className="text-slate-800">{modalRow.staff_fullname || modalRow.staff_username || '—'}</p>
                </div>

                {(modalRow.suggestions || '').trim() !== '' && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-1">
                      ملاحظات أو مقترحات المتجر
                    </p>
                    <p className="text-sm text-slate-800 whitespace-pre-wrap rounded-xl border border-violet-200 bg-violet-50/80 px-3 py-2.5 leading-relaxed">
                      {(modalRow.suggestions || '').trim()}
                    </p>
                  </div>
                )}

                {modalRow.survey_kind === 'active_csat' && modalRow.questions && (
                  <>
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="text-slate-600">متوسط الستة:</span>
                      <span className="font-black tabular-nums text-violet-800">{modalRow.avg}</span>
                      <span
                        className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                          modalRow.tier === 'green'
                            ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                            : modalRow.tier === 'yellow'
                              ? 'bg-amber-50 text-amber-950 border-amber-200'
                              : 'bg-rose-50 text-rose-900 border-rose-200'
                        }`}
                      >
                        {modalRow.tier === 'green'
                          ? '🔼 راضٍ'
                          : modalRow.tier === 'yellow'
                            ? '↔️ محايد / خطر'
                            : '🔽 غير راضٍ'}
                      </span>
                    </div>

                    {radarData.length > 0 && (
                      <div className="h-[260px] w-full" dir="ltr">
                        <ResponsiveContainer width="100%" height="100%">
                          <RadarChart data={radarData} margin={{ top: 16, right: 16, bottom: 16, left: 16 }}>
                            <PolarGrid stroke="#e2e8f0" />
                            <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: '#475569' }} />
                            <PolarRadiusAxis angle={90} domain={[0, 5]} tickCount={6} tick={{ fontSize: 10 }} />
                            <Radar
                              name="التقييم"
                              dataKey="score"
                              stroke="#7c3aed"
                              fill="#7c3aed"
                              fillOpacity={0.35}
                            />
                          </RadarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">التفصيل حسب المحور</p>
                      <ul className="space-y-2">
                        {modalRow.questions.map((q, i) => (
                          <li
                            key={i}
                            className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between gap-2 flex-wrap ${
                              q.risk === 'high'
                                ? 'border-rose-300 bg-rose-50 text-rose-950'
                                : q.risk === 'mid'
                                  ? 'border-amber-200 bg-amber-50 text-amber-950'
                                  : 'border-emerald-100 bg-emerald-50/60 text-emerald-950'
                            }`}
                          >
                            <span className="font-bold">{q.label}</span>
                            <span className="flex items-center gap-2 shrink-0">
                              <MiniStars value={q.value} />
                              <span className="tabular-nums font-black">{q.value}/5</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}

                {modalRow.survey_kind !== 'active_csat' && (
                  <>
                    <div>
                      <p className="text-[11px] font-bold text-slate-500 mb-2">نتائج الاستبيان التفصيلية</p>
                      <ul className="space-y-2">
                        {(modalRow.answers || []).map((a, i) => (
                          <li
                            key={i}
                            className={`rounded-xl border px-3 py-2 text-sm ${
                              a.yes
                                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                : 'border-rose-200 bg-rose-50 text-rose-900'
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
                            <span
                              key={t}
                              className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-100 text-rose-800 border border-rose-200"
                            >
                              {t}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-slate-500">لا يوجد — جميع الإجابات إيجابية.</p>
                      )}
                    </div>
                  </>
                )}

                {modalRow.survey_kind === 'active_csat' && (
                  <div>
                    <p className="text-[11px] font-bold text-slate-500 mb-2">تاغات الفجوة (≤3)</p>
                    {modalRow.gap_tags?.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {modalRow.gap_tags.map(t => (
                          <span
                            key={t}
                            className="text-xs font-bold px-2 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500">لا يوجد.</p>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
