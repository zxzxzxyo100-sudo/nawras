import { useState, useMemo, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Phone, RefreshCw, CheckCircle, X, ClipboardList,
} from 'lucide-react'
import { useStores }  from '../contexts/StoresContext'
import { useAuth }    from '../contexts/AuthContext'
import { usePoints }  from '../contexts/PointsContext'
import { DISABLE_POINTS_AND_PERFORMANCE } from '../config/features'
import StoreDrawer    from '../components/StoreDrawer'
import StoreNameWithId from '../components/StoreNameWithId'
import {
  getDailyTaskDismissals, markDailyTaskDone, logCall, markSurveyNoAnswer, getMyWorkflow,
  completeInactiveQueueSuccess,
} from '../services/api'
import { needsActiveSatisfactionSurvey } from '../constants/satisfactionSurvey'
import { needsNewMerchantOnboardingSurvey } from '../constants/newMerchantOnboardingSurvey'
import NewMerchantOnboardingModal from '../components/NewMerchantOnboardingModal'
import InactiveGoalCelebration, { InactiveGoalCounterBadge } from '../components/InactiveGoalCelebration'
import { IS_SIMPLE_LOG_CALL_MODAL, IS_STAGING_OR_DEV } from '../config/envFlags'

const MIN_TASK_NOTE_LENGTH = 10

function storeHasShipped(store) {
  if (!store) return false
  const n = Number(store.total_shipments ?? 0)
  if (n > 0) return true
  const d = store.last_shipment_date
  return Boolean(d && d !== 'لا يوجد')
}

/** نوع المكالمة لـ log_call حسب مفتاح المهمة */
function taskIdToCallType(taskId) {
  const m = String(taskId).match(/-inc-(call_[123])$/)
  if (m) {
    const n = m[1].replace('call_', '')
    return `inc_call${n}`
  }
  return 'general'
}

/** أحدث سجل مكالمة للمتجر (حسب التاريخ) */
function latestCallEntry(log) {
  const entries = Object.values(log || {}).filter(c => c?.date)
  if (!entries.length) return null
  entries.sort((a, b) => new Date(b.date) - new Date(a.date))
  return entries[0]
}

/**
 * إذا آخر مكالمة اليوم كانت «عدم رد» لا نُخفي المهمة — يبقى المتجر معلّقاً في المهام اليومية.
 */
function hideDailyTaskDueToCallToday(log, todayIso) {
  const top = latestCallEntry(log)
  if (!top?.date || !String(top.date).startsWith(todayIso)) return false
  return String(top.outcome ?? '').trim() !== 'no_answer'
}

/** مهمة ضمن تبويب «متاجر لم ترد»: آخر مكالمة عدم رد، أو تعيين سير عمل no_answer */
function taskIsNoAnswer(task, callLogs, assignments) {
  const log = callLogs[task.store.id] || {}
  const top = latestCallEntry(log)
  if (top && String(top.outcome ?? '').trim() === 'no_answer') return true
  if (task.type === 'assigned_store' && assignments) {
    const a = assignments[String(task.store.id)] || assignments[task.store.id]
    if (a?.workflow_status === 'no_answer') return true
  }
  if (task.type === 'recovery_call' && task.workflowQueue === 'inactive' && assignments) {
    const a = assignments[String(task.store.id)] || assignments[task.store.id]
    if (a?.assignment_queue === 'inactive' && a?.workflow_status === 'no_answer') return true
  }
  return false
}

// ══════════════════════════════════════════════════════════════════
// توليد المهام — مسار الاحتضان: المكالمات 1–3 فقط عند استحقاقها (يوم 1؛ بعد X/Y يوماً من إتمام السابقة)
// «بين المكالمات» لا تُدرَج هنا — تُدار من واجهة المدير التنفيذي في مسار الاحتضان
// ══════════════════════════════════════════════════════════════════
function onboardingDoneForStore(doneSet, storeId) {
  if (!doneSet || storeId == null) return false
  return doneSet.has(storeId) || doneSet.has(String(storeId)) || doneSet.has(Number(storeId))
}

function generateTasks(allStores, callLogs, storeStates, userRole, username, assignments, inactiveWf, newMerchantOnboardingDoneIds) {
  const today = new Date().toISOString().split('T')[0]

  /** مسؤول الاستعادة: طابور 50 متجر غير نشط فقط (سير عمل من الخادم) */
  if (userRole === 'inactive_manager') {
    const tasks = []
    const rows = [
      ...(inactiveWf?.active_tasks || []),
      ...(inactiveWf?.no_answer_tasks || []),
    ]
    for (const row of rows) {
      const store = allStores.find(s => String(s.id) === String(row.store_id))
      if (!store) continue
      const log = callLogs[store.id] || {}
      const lastCallDate = latestCallEntry(log)?.date
      const callTodayHidesTask = hideDailyTaskDueToCallToday(log, today)
      const daysSinceLast = lastCallDate
        ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
        : 999
      if (callTodayHidesTask) continue
      tasks.push({
        id: `${store.id}-recovery-inactive`,
        store,
        priority: daysSinceLast >= 7 ? 'high' : 'normal',
        type: 'recovery_call',
        label: 'مكالمة استعادة',
        desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        workflowQueue: 'inactive',
      })
    }
    return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
  }

  const tasks = []
  allStores.forEach(store => {
    const log          = callLogs[store.id] || {}
    const dbCat        = storeStates[store.id]?.category || store.category
    const incBucket    = store._inc
    const topCall      = latestCallEntry(log)
    const lastCallDate = topCall?.date
    const callTodayHidesTask = hideDailyTaskDueToCallToday(log, today)
    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    if (['call_1', 'call_2', 'call_3'].includes(incBucket) && ['incubation_manager', 'executive'].includes(userRole)) {
      const incubationBadge =
        IS_STAGING_OR_DEV && incBucket === 'call_2'
          ? '⚠️ المكالمة الثانية للمتجر'
          : IS_STAGING_OR_DEV && incBucket === 'call_3'
            ? '🚨 المكالمة الثالثة والأخيرة'
            : null
      tasks.push({
        id: `${store.id}-inc-${incBucket}`, store,
        priority: incBucket === 'call_1' || incBucket === 'call_3' ? 'high' : 'normal',
        type: 'new_call',
        label:
          incBucket === 'call_1' ? 'مسار الاحتضان — المكالمة الأولى'
            : incBucket === 'call_2' ? 'مسار الاحتضان — المكالمة الثانية'
              : 'مسار الاحتضان — المكالمة الثالثة (تخريج)',
        desc: 'سجّل المكالمة من صفحة المتاجر أو الاتصال السريع — الموعد يُحسب من الخادم بعد إتمام المكالمة السابقة',
        incubationBadge,
      })
    }

    if (
      store.bucket === 'incubating'
      && ['incubation_manager', 'executive'].includes(userRole)
      && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
    ) {
      tasks.push({
        id: `${store.id}-new-onboarding`,
        store,
        priority: 'normal',
        type: 'new_merchant_onboarding',
        label: 'استبيان تهيئة متجر جديد',
        desc: IS_STAGING_OR_DEV
          ? 'اضغط «اتصل» ليظهر استبيان التهيئة (ثلاثة أسئلة) فوراً، ثم سجّل المكالمة من البطاقة — أو من لوحة المتاجر الجديدة'
          : 'قيّم تجربة التاجر ثم اضغط «تم» في الاستبيان — أو من لوحة المتاجر الجديدة',
      })
    }

    if (incBucket === 'never_started' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-never`, store,
          priority: daysSinceLast >= 3 ? 'high' : 'normal',
          type: 'recovery_call', label: 'استعادة — لم تبدأ بعد',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به قط',
        })
      }
    }

    if (incBucket === 'restoring' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-restoring`, store,
          priority: daysSinceLast >= 2 ? 'high' : 'normal',
          type: 'recovery_call', label: 'متابعة جاري الاستعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'يحتاج متابعة',
        })
      }
    }

    if (['hot_inactive', 'cold_inactive'].includes(dbCat) && userRole === 'executive') {
      if (!callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-recovery`, store,
          priority: daysSinceLast >= 7 ? 'high' : 'normal',
          type: 'recovery_call', label: 'مكالمة استعادة',
          desc: lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        })
      }
    }

    if (userRole === 'executive' && dbCat === 'active_shipping') {
      const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
        ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
        : 999
      if (daysSinceShip >= 10 && !callTodayHidesTask) {
        tasks.push({
          id: `${store.id}-followup`, store,
          priority: daysSinceShip >= 14 ? 'high' : 'normal',
          type: 'followup_call', label: 'متابعة متجر نشط',
          desc: `لم يشحن منذ ${daysSinceShip} يوم`,
        })
      }
    }

    if (userRole === 'active_manager' && username && assignments) {
      const asgn = assignments[String(store.id)] || assignments[store.id]
      if (asgn?.assigned_to === username && !callTodayHidesTask) {
        const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
          ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
          : 999
        const needsOnboarding =
          store.bucket === 'incubating'
          && !onboardingDoneForStore(newMerchantOnboardingDoneIds, store.id)
        const shipDesc = daysSinceShip < 999 ? `آخر شحنة قبل ${daysSinceShip} يوم` : 'لا توجد شحنات بعد'
        tasks.push({
          id: `${store.id}-assigned`, store,
          priority: daysSinceShip >= 10 ? 'high' : 'normal',
          type: 'assigned_store', label: 'متجر مُسنَد إليك',
          desc: needsOnboarding && IS_STAGING_OR_DEV
            ? `${shipDesc} — اضغط «اتصل» لفتح استبيان التهيئة (ثلاثة أسئلة) مباشرة`
            : shipDesc,
        })
      }
    }
  })

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}

// ══════════════════════════════════════════════════════════════════
// رمز النورس (طائر النورس كزخرفة في الخلفية)
// ══════════════════════════════════════════════════════════════════
function SeagullMark({ size = 100, opacity = 0.07 }) {
  return (
    <svg width={size} height={size * 0.6} viewBox="0 0 120 72" fill="white" opacity={opacity} aria-hidden="true">
      {/* جسم */}
      <ellipse cx="60" cy="38" rx="22" ry="9" />
      {/* الجناح الأيسر */}
      <path d="M52,33 C38,14 6,18 2,28 C18,24 36,28 50,33 Z" />
      {/* الجناح الأيمن */}
      <path d="M68,33 C82,14 114,18 118,28 C102,24 84,28 70,33 Z" />
      {/* الرأس */}
      <circle cx="79" cy="31" r="7" />
      {/* المنقار */}
      <path d="M85,30 L95,32 L85,34 Z" />
      {/* الذيل */}
      <path d="M40,39 L25,45 L33,44 L23,52 L40,42 Z" />
    </svg>
  )
}

// ══════════════════════════════════════════════════════════════════
// زر الاتصال مع تأثير Ripple
// ══════════════════════════════════════════════════════════════════
function CallButton({ onClick }) {
  const [rippling, setRippling] = useState(false)

  function handleClick(e) {
    e.stopPropagation()
    setRippling(true)
    setTimeout(() => setRippling(false), 650)
    onClick()
  }

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ scale: 1.06, y: -1 }}
      whileTap={{ scale: 0.9 }}
      className="relative overflow-hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white"
      style={{
        background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
        boxShadow: '0 4px 14px rgba(124,58,237,0.45)',
      }}
    >
      <Phone size={12} />
      اتصل
      <AnimatePresence>
        {rippling && (
          <motion.span
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle at center, rgba(255,255,255,0.55) 0%, transparent 65%)',
            }}
            initial={{ scale: 0.2, opacity: 1 }}
            animate={{ scale: 2.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>
    </motion.button>
  )
}

// ══════════════════════════════════════════════════════════════════
// بطاقة المهمة المتحركة
// ══════════════════════════════════════════════════════════════════
const TYPE_STYLES = {
  new_call:       { borderColor: '#c4b5fd', accent: '#7c3aed', badge: 'bg-violet-100 text-violet-700', bg: 'rgba(124,58,237,0.04)' },
  recovery_call:  { borderColor: '#fca5a5', accent: '#dc2626', badge: 'bg-red-100 text-red-700',       bg: 'rgba(220,38,38,0.04)'  },
  followup_call:  { borderColor: '#fcd34d', accent: '#d97706', badge: 'bg-amber-100 text-amber-700',   bg: 'rgba(217,119,6,0.04)'  },
  assigned_store: { borderColor: '#93c5fd', accent: '#2563eb', badge: 'bg-blue-100 text-blue-700',     bg: 'rgba(37,99,235,0.04)'  },
  new_merchant_onboarding: { borderColor: '#ddd6fe', accent: '#6d28d9', badge: 'bg-violet-100 text-violet-800', bg: 'rgba(109,40,217,0.06)' },
}

function TaskCard({
  task,
  index,
  onCall,
  onDone,
  onNoAnswerWorkflow,
  noAnswerLoading,
  userRole,
  doneDisabled,
  hideDoneButton,
  callButtonLabel,
}) {
  const s = TYPE_STYLES[task.type] || TYPE_STYLES.followup_call
  const handleDone = () => {
    void onDone(task)
  }
  const showNoAnswer =
    typeof onNoAnswerWorkflow === 'function'
    && (
      (task.type === 'assigned_store' && userRole === 'active_manager')
      || task.type === 'recovery_call'
    )
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0, paddingTop: 0, paddingBottom: 0 }}
      transition={{ duration: 0.3, delay: Math.min(index * 0.035, 0.25), ease: 'easeOut' }}
      className="flex items-center gap-3 lg:gap-4 p-3.5 lg:p-4 rounded-2xl border"
      style={{ background: s.bg, borderColor: s.borderColor }}
    >
      {/* نقطة الأولوية النابضة */}
      <motion.div
        className="flex-shrink-0 w-3 h-3 rounded-full"
        style={{ background: task.priority === 'high' ? '#ef4444' : s.accent }}
        animate={task.priority === 'high' ? { scale: [1, 1.5, 1], opacity: [1, 0.6, 1] } : {}}
        transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* أفاتار المتجر */}
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-black text-sm flex-shrink-0"
        style={{ background: `linear-gradient(135deg, ${s.accent}dd, ${s.accent}88)` }}
      >
        {task.store.name?.charAt(0) || '؟'}
      </div>

      {/* معلومات المهمة */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <div className="font-bold text-slate-800 text-sm min-w-0">
            <StoreNameWithId store={task.store} nameClassName="font-bold text-slate-800" idClassName="font-mono text-xs font-semibold text-slate-500" />
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${s.badge}`}>
            {task.label}
          </span>
          {task.incubationBadge && (
            <span className="text-[10px] px-2 py-0.5 rounded-lg font-bold bg-amber-100 text-amber-900 border border-amber-200/80 flex-shrink-0 max-w-[14rem] leading-snug">
              {task.incubationBadge}
            </span>
          )}
          {task.priority === 'high' && (
            <motion.span
              className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold flex-shrink-0"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            >
              عاجل
            </motion.span>
          )}
        </div>
        <p className="text-xs text-slate-500">{task.desc}</p>
      </div>

      {/* أزرار الإجراء */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
        <CallButton label={callButtonLabel} onClick={() => onCall(task)} />
        {showNoAnswer && (
          <motion.button
            type="button"
            onClick={() => onNoAnswerWorkflow(task)}
            disabled={noAnswerLoading}
            whileHover={{ scale: noAnswerLoading ? 1 : 1.06, y: -1 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border-2 border-amber-400 bg-amber-50 text-amber-950 hover:bg-amber-100 disabled:opacity-50"
          >
            عدم الرد
          </motion.button>
        )}
        {!hideDoneButton && (
          <motion.button
            onClick={handleDone}
            disabled={doneDisabled}
            title={doneDisabled ? 'يجب إكمال الاستبيان أولاً لإتمام المهمة.' : undefined}
            whileHover={{ scale: doneDisabled ? 1 : 1.06, y: doneDisabled ? 0 : -1 }}
            whileTap={{ scale: doneDisabled ? 1 : 0.9 }}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold text-white disabled:opacity-45 disabled:cursor-not-allowed disabled:grayscale"
            style={{
              background: 'linear-gradient(135deg, #059669, #047857)',
              boxShadow: '0 4px 12px rgba(5,150,105,0.35)',
            }}
          >
            <CheckCircle size={12} />
            تم
          </motion.button>
        )}
      </div>
    </motion.div>
  )
}

// ══════════════════════════════════════════════════════════════════
// الصفحة الرئيسية
// ══════════════════════════════════════════════════════════════════
function IncManagerDoneModal({ task, onClose, onConfirm, saving, error }) {
  const [note, setNote] = useState('')
  const ok = note.trim().length >= MIN_TASK_NOTE_LENGTH
  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-[600] p-4" dir="rtl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200"
      >
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-emerald-50/80">
          <p className="font-bold text-slate-800 text-sm">إتمام المهمة — محتوى المكالمة</p>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500">
            <X size={18} />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 min-w-0">
            <StoreNameWithId store={task.store} nameClassName="font-semibold text-slate-800" idClassName="font-mono text-slate-500 text-[11px]" />
            <span className="text-slate-400 mr-2">— {task.label}</span>
          </p>
          <label className="block text-xs font-bold text-slate-700">محتوى المكالمة (إلزامي — {MIN_TASK_NOTE_LENGTH} أحرف فأكثر)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={5}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-y min-h-[120px]"
            placeholder="اكتب ملخص ما دار في المكالمة..."
          />
          <p className="text-[11px] text-slate-400">
            {note.trim().length}/{MIN_TASK_NOTE_LENGTH} حرفاً على الأقل
          </p>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              disabled={!ok || saving}
              onClick={() => onConfirm(note.trim())}
              className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white text-sm font-bold"
            >
              {saving ? 'جارٍ الحفظ...' : 'تأكيد وإخفاء المهمة'}
            </button>
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm">
              إلغاء
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function Tasks() {
  const {
    allStores, callLogs, storeStates, assignments, loading, reload, lastLoaded, surveyByStoreId,
    newMerchantOnboardingDoneIds,
  } = useStores()
  const { user } = useAuth()
  const { onCallSaved } = usePoints()
  const [selectedTask, setSelectedTask] = useState(null)
  /** مفاتيح مهام مُخفاة بعد «تم» — مُحمّلة من الخادم + نفس اليوم */
  const [dismissalKeys, setDismissalKeys] = useState(() => new Set())
  const [filter, setFilter]     = useState('all') // 'all' | 'high' | 'no_answer'
  const [dismissErr, setDismissErr] = useState('')
  /** مسؤول المتاجر: يجب كتابة ملاحظة مكالمة قبل الإخفاء */
  const [pendingDoneTask, setPendingDoneTask] = useState(null)
  const [doneSaving, setDoneSaving] = useState(false)
  const [doneModalErr, setDoneModalErr] = useState('')
  const [noAnswerLoadingId, setNoAnswerLoadingId] = useState(null)
  /** إشعار بعد «لم يرد» أو بلوغ الهدف */
  const [toastMsg, setToastMsg] = useState('')
  /** فتح استبيان تهيئة المتجر الجديد من «تم» */
  const [pendingOnboardingTask, setPendingOnboardingTask] = useState(null)
  /** طابور موظف الاستعادة (50 متجر غير نشط) من active-workflow.php */
  const [inactiveWf, setInactiveWf] = useState(null)
  /** لإطلاق الاحتفال فور استجابة goal_just_met */
  const [goalBurstNonce, setGoalBurstNonce] = useState(0)

  const loadInactiveWf = useCallback(async () => {
    if (user?.role !== 'inactive_manager' || !user?.username) return
    try {
      const res = await getMyWorkflow(user.username, { queue: 'inactive' })
      if (res?.success) setInactiveWf(res)
    } catch {
      setInactiveWf(null)
    }
  }, [user?.role, user?.username])

  const loadDismissals = useCallback(() => {
    const u = user?.username
    if (!u) return
    getDailyTaskDismissals(u)
      .then(r => {
        if (r?.success && Array.isArray(r.keys)) {
          setDismissalKeys(new Set(r.keys))
        }
      })
      .catch(() => {})
  }, [user?.username])

  useEffect(() => {
    loadDismissals()
  }, [loadDismissals, lastLoaded])

  useEffect(() => {
    loadInactiveWf()
  }, [loadInactiveWf, lastLoaded])

  const drawerTaskCompletion = useMemo(() => {
    if (!IS_STAGING_OR_DEV || !selectedTask || !user?.username) return undefined
    return {
      dailyTaskKey: selectedTask.id,
      inactiveRecovery:
        selectedTask.type === 'recovery_call' && selectedTask.workflowQueue === 'inactive',
      releaseActiveWorkflow:
        selectedTask.type === 'assigned_store' && user.role === 'active_manager',
      onInactiveGoalBurst: () => setGoalBurstNonce(n => n + 1),
    }
  }, [selectedTask, user?.username, user?.role])

  /**
   * مع VITE_APP_STAGING=1: افتح نافذة «تسجيل مكالمة» (استبيان 3 نعم/لا) مباشرة دون النافذة المنفصلة القديمة.
   * — مسؤول المتاجر + متجر مُسنَد يحتاج تهيئة، أو
   * — مدير الاحتضان/تنفيذي + مهمة «استبيان تهيئة متجر جديد».
   */
  const drawerAutoOpenCallModal = useMemo(() => {
    if (!selectedTask || !IS_SIMPLE_LOG_CALL_MODAL) return false
    const needs = needsNewMerchantOnboardingSurvey(selectedTask.store, newMerchantOnboardingDoneIds)
    if (!needs) return false
    if (user?.role === 'active_manager' && selectedTask.type === 'assigned_store') return true
    if (
      selectedTask.type === 'new_merchant_onboarding'
      && ['incubation_manager', 'executive'].includes(user?.role)
    ) return true
    return false
  }, [user?.role, selectedTask, newMerchantOnboardingDoneIds])

  function handleTaskCall(taskRow) {
    // التجريبي/التطوير: استبيان التهيئة داخل CallModal الموحّد (لا NewMerchantOnboardingModal منفصلة)
    if (taskRow.type === 'new_merchant_onboarding' && IS_SIMPLE_LOG_CALL_MODAL) {
      setSelectedTask(taskRow)
      return
    }
    if (IS_STAGING_OR_DEV && taskRow.type === 'new_merchant_onboarding') {
      setPendingOnboardingTask(taskRow)
      return
    }
    setSelectedTask(taskRow)
  }

  useEffect(() => {
    if (!toastMsg) return undefined
    const t = setTimeout(() => setToastMsg(''), 8000)
    return () => clearTimeout(t)
  }, [toastMsg])

  const tasks = useMemo(
    () => generateTasks(
      allStores, callLogs, storeStates, user?.role, user?.username, assignments, inactiveWf,
      newMerchantOnboardingDoneIds,
    ),
    [allStores, callLogs, storeStates, user, assignments, inactiveWf, newMerchantOnboardingDoneIds]
  )

  const pendingTasks = tasks.filter(t => !dismissalKeys.has(t.id))

  const { mainTasks, noAnswerTasks, highCountMain } = useMemo(() => {
    const main = []
    const noAns = []
    for (const t of pendingTasks) {
      if (taskIsNoAnswer(t, callLogs, assignments)) noAns.push(t)
      else main.push(t)
    }
    return {
      mainTasks: main,
      noAnswerTasks: noAns,
      highCountMain: main.filter(t => t.priority === 'high').length,
    }
  }, [pendingTasks, callLogs, assignments])

  const displayed = useMemo(() => {
    if (filter === 'no_answer') return noAnswerTasks
    if (filter === 'high') return mainTasks.filter(t => t.priority === 'high')
    return mainTasks
  }, [filter, mainTasks, noAnswerTasks])

  async function dismissTaskOnly(id) {
    setDismissErr('')
    const u = user?.username
    if (!u) return
    try {
      await markDailyTaskDone({ username: u, task_key: id })
      setDismissalKeys(prev => new Set([...prev, id]))
    } catch (e) {
      setDismissErr(e.response?.data?.error || 'تعذّر حفظ «تم»')
    }
  }

  async function requestDone(task) {
    setDismissErr('')
    if (task.type === 'recovery_call' && task.workflowQueue === 'inactive' && user?.role === 'inactive_manager') {
      try {
        const res = await completeInactiveQueueSuccess({
          store_id: task.store.id,
          store_name: task.store.name,
          username: user.username,
        })
        if (res?.goal_just_met) {
          setGoalBurstNonce(n => n + 1)
        }
        await dismissTaskOnly(task.id)
        await reload()
        await loadInactiveWf()
        loadDismissals()
        if (res?.daily_target_reached && !res?.goal_just_met) {
          setToastMsg('تم بلوغ هدف 50 اتصالاً ناجحاً اليوم.')
        }
      } catch (e) {
        setDismissErr(e.response?.data?.error || 'تعذّر تسجيل الاتصال الناجح.')
      }
      return
    }
    if (task.type === 'new_merchant_onboarding') {
      if (onboardingDoneForStore(newMerchantOnboardingDoneIds, task.store.id)) {
        dismissTaskOnly(task.id)
        return
      }
      setPendingOnboardingTask(task)
      return
    }
    if (task.type === 'assigned_store') {
      const cat = storeStates[task.store.id]?.category || task.store.category || ''
      if (needsActiveSatisfactionSurvey(task.store.id, cat, surveyByStoreId)) {
        setDismissErr('يجب إكمال الاستبيان أولاً لإتمام المهمة.')
        return
      }
    }
    if (user?.role === 'incubation_manager') {
      setDoneModalErr('')
      setPendingDoneTask(task)
      return
    }
    dismissTaskOnly(task.id)
  }

  async function handleNoAnswerWorkflow(task) {
    if (!user?.username) return
    setDismissErr('')
    setNoAnswerLoadingId(task.id)
    try {
      if (task.type === 'recovery_call') {
        const res = await logCall({
          store_id: task.store.id,
          store_name: task.store.name,
          call_type: 'general',
          outcome: 'no_answer',
          note: '',
          performed_by: user?.fullname || user?.username || '',
          performed_role: user?.role,
          registration_date: task.store.registered_at || null,
        })
        if (!DISABLE_POINTS_AND_PERFORMANCE) {
          onCallSaved(res?.points_awarded ?? 0)
        }
        if (task.workflowQueue === 'inactive' && user?.username) {
          const mar = await markSurveyNoAnswer({
            store_id: task.store.id,
            store_name: task.store.name,
            username: user.username,
            queue: 'inactive',
          })
          if (mar?.notify_ar) setToastMsg(mar.notify_ar)
        }
        await reload()
        await loadInactiveWf()
        loadDismissals()
        setFilter('no_answer')
        return
      }
      if (task.type === 'assigned_store') {
        await markSurveyNoAnswer({
          store_id: task.store.id,
          store_name: task.store.name,
          username: user.username,
        })
        await reload()
        loadDismissals()
        setFilter('no_answer')
      }
    } catch (e) {
      setDismissErr(e.response?.data?.error || 'تعذّر تسجيل عدم الرد.')
    } finally {
      setNoAnswerLoadingId(null)
    }
  }

  async function confirmIncManagerDone(note) {
    const task = pendingDoneTask
    if (!task || !user?.username) return
    setDoneSaving(true)
    setDoneModalErr('')
    try {
      const callType = taskIdToCallType(task.id)
      const payload = {
        store_id: task.store.id,
        store_name: task.store.name,
        call_type: callType,
        outcome: 'answered',
        note,
        performed_by: user?.fullname || user?.username || '',
        performed_role: user?.role,
        registration_date: task.store.registered_at || null,
      }
      if (callType === 'inc_call3') {
        payload.has_shipped = storeHasShipped(task.store)
      }
      const res = await logCall(payload)
      if (!DISABLE_POINTS_AND_PERFORMANCE) {
        onCallSaved(res?.points_awarded ?? 10)
      }
      await markDailyTaskDone({ username: user.username, task_key: task.id })
      setDismissalKeys(prev => new Set([...prev, task.id]))
      setPendingDoneTask(null)
      await reload()
    } catch (e) {
      setDoneModalErr(e.response?.data?.error || 'فشل حفظ المكالمة أو إتمام المهمة')
    } finally {
      setDoneSaving(false)
    }
  }

  return (
    <div className="space-y-5 pb-20" style={{ fontFamily: "'Cairo', sans-serif" }}>
      {user?.role === 'inactive_manager' && user?.username && (
        <InactiveGoalCelebration
          username={user.username}
          successfulCount={inactiveWf?.daily_successful_contacts ?? 0}
          target={inactiveWf?.inactive_daily_target ?? 50}
          dailyTargetReached={inactiveWf?.daily_target_reached}
          burstNonce={goalBurstNonce}
        />
      )}

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-24 left-1/2 z-[500] max-w-md w-[calc(100%-2rem)] -translate-x-1/2 rounded-2xl border border-violet-300/80 bg-violet-950/95 text-violet-50 px-4 py-3 text-sm font-medium shadow-xl shadow-violet-900/40 flex items-start justify-between gap-3"
            dir="rtl"
          >
            <span>{toastMsg}</span>
            <button
              type="button"
              onClick={() => setToastMsg('')}
              className="shrink-0 p-1 rounded-lg hover:bg-white/10 text-white/80"
              aria-label="إغلاق"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ══ بطاقة الهيدر + التحدي الذاتي ═══════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: 'easeOut' }}
        className="relative rounded-3xl overflow-hidden text-white p-5 lg:p-7"
        style={{ background: 'linear-gradient(135deg, #1e0a3c 0%, #2d1466 55%, #1a0a4e 100%)' }}
      >
        {/* Blobs */}
        <div className="absolute top-0 left-1/3 w-60 h-60 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 right-0 w-48 h-48 bg-purple-500/15 rounded-full blur-2xl pointer-events-none" />

        {/* نورس كبير خلفية */}
        <div className="absolute bottom-2 left-4 pointer-events-none">
          <SeagullMark size={110} opacity={0.06} />
        </div>
        {/* نورس صغير مقلوب */}
        <div className="absolute top-3 right-8 pointer-events-none" style={{ transform: 'scaleX(-1)' }}>
          <SeagullMark size={65} opacity={0.04} />
        </div>

        <div className="relative flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl lg:text-2xl font-black leading-tight">
              المهام اليومية
            </h1>
            <p className="text-white/50 text-sm mt-0.5">
              مرحباً{' '}
              <span className="text-violet-300 font-semibold">{user?.fullname || user?.username}</span>
            </p>
            {dismissErr && (
              <p className="text-red-300 text-xs mt-1">{dismissErr}</p>
            )}
            {user?.role === 'inactive_manager' && inactiveWf?.success && (
              <>
                <p className="text-violet-200/90 text-sm mt-2">
                  طابور الاستعادة:{' '}
                  {(inactiveWf.active_count ?? 0) + (inactiveWf.no_answer_count ?? 0)}
                  {' / '}
                  {inactiveWf.target ?? 50} متجراً غير نشط
                </p>
                <p
                  className={`text-sm mt-1.5 flex flex-wrap items-center gap-2 ${
                    inactiveWf.daily_target_reached ? 'text-emerald-200' : 'text-amber-200/95'
                  }`}
                >
                  <span className="font-bold">اتصالات ناجحة اليوم:</span>
                  <InactiveGoalCounterBadge
                    successfulCount={inactiveWf.daily_successful_contacts ?? 0}
                    target={inactiveWf.inactive_daily_target ?? 50}
                    dailyTargetReached={inactiveWf.daily_target_reached}
                    className={inactiveWf.daily_target_reached ? 'text-emerald-200' : ''}
                  />
                  {inactiveWf.daily_target_reached && (
                    <span className="text-emerald-200/90 font-medium">— تم بلوغ الهدف</span>
                  )}
                </p>
              </>
            )}
            {pendingTasks.length > 0 && (
              <p className="text-white/40 text-sm mt-2">
                {mainTasks.length.toLocaleString('ar-SA')} في القائمة الرئيسية
                {noAnswerTasks.length > 0 && (
                  <span className="text-amber-200/90 mr-2">
                    {' '}— {noAnswerTasks.length.toLocaleString('ar-SA')} متجر لم يُرد
                  </span>
                )}
                {highCountMain > 0 && (
                  <span className="text-amber-300/90 mr-2">
                    {' '}— {highCountMain.toLocaleString('ar-SA')} عاجلة
                  </span>
                )}
              </p>
            )}
          </div>

          {/* زر التحديث */}
          <motion.button
            onClick={reload}
            disabled={loading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="flex-shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white border border-white/20 bg-white/10 hover:bg-white/15 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            تحديث
          </motion.button>
        </div>
      </motion.div>

      {/* ══ تبويبات التصفية ══════════════════════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.18 }}
        className="flex flex-wrap gap-2"
      >
        {[
          { val: 'all',  label: 'الكل',             count: mainTasks.length },
          { val: 'high', label: 'عالية الأولوية',   count: highCountMain },
          { val: 'no_answer', label: 'متاجر لم ترد', count: noAnswerTasks.length },
        ].map(tab => (
          <motion.button
            key={tab.val}
            onClick={() => setFilter(tab.val)}
            whileTap={{ scale: 0.97 }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.val
                ? 'text-white shadow-lg'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
            style={filter === tab.val ? (
              tab.val === 'no_answer'
                ? {
                    background: 'linear-gradient(135deg, #d97706, #b45309)',
                    boxShadow: '0 4px 14px rgba(217,119,6,0.35)',
                  }
                : {
                    background: 'linear-gradient(135deg, #7c3aed, #6d28d9)',
                    boxShadow: '0 4px 14px rgba(124,58,237,0.35)',
                  }
            ) : {}}
          >
            {tab.label}
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
              filter === tab.val ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </motion.button>
        ))}
      </motion.div>

      {/* ══ قائمة المهام ════════════════════════════════════════════ */}
      {displayed.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.93 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="bg-white rounded-3xl p-12 text-center shadow-sm border border-slate-100"
        >
          {pendingTasks.length === 0 ? (
            <>
              <motion.div
                animate={{ rotate: [0, 12, -12, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
              >
                <CheckCircle size={56} className="text-emerald-400 mx-auto mb-4" />
              </motion.div>
              <p className="font-black text-slate-700 text-xl">أحسنت! لا توجد مهام معلقة</p>
              <p className="text-slate-400 text-sm mt-2">تم الانتهاء من جميع المهام اليوم 🎉</p>
            </>
          ) : filter === 'no_answer' ? (
            <>
              <CheckCircle size={56} className="text-amber-400 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">لا توجد متاجر في «لم ترد»</p>
              <p className="text-slate-500 text-sm mt-2">عند الضغط على «عدم الرد» يُنقل المتجر إلى هذا التبويب</p>
            </>
          ) : filter === 'high' ? (
            <>
              <CheckCircle size={56} className="text-slate-300 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">لا توجد مهام عاجلة</p>
              <p className="text-slate-500 text-sm mt-2">في القائمة الرئيسية حالياً</p>
            </>
          ) : filter === 'all' && mainTasks.length === 0 && noAnswerTasks.length > 0 ? (
            <>
              <CheckCircle size={56} className="text-amber-400 mx-auto mb-4" />
              <p className="font-black text-slate-700 text-xl">القائمة الرئيسية فارغة</p>
              <p className="text-slate-600 text-sm mt-2">
                {noAnswerTasks.length.toLocaleString('ar-SA')} متجر في تبويب «متاجر لم ترد» — راجعها من هناك
              </p>
            </>
          ) : (
            <>
              <p className="font-bold text-slate-600">لا توجد مهام في هذا التبويب</p>
            </>
          )}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, delay: 0.22 }}
          className="space-y-2.5"
        >
          <AnimatePresence mode="popLayout">
            {displayed.map((task, i) => {
              const cat = storeStates[task.store.id]?.category || task.store.category || ''
              const blockDone =
                task.type === 'assigned_store'
                && needsActiveSatisfactionSurvey(task.store.id, cat, surveyByStoreId)
              return (
                <TaskCard
                  key={task.id}
                  task={task}
                  index={i}
                  onCall={handleTaskCall}
                  onDone={requestDone}
                  userRole={user?.role}
                  onNoAnswerWorkflow={handleNoAnswerWorkflow}
                  noAnswerLoading={noAnswerLoadingId === task.id}
                  doneDisabled={blockDone}
                  hideDoneButton={IS_STAGING_OR_DEV}
                />
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {pendingDoneTask && (
        <IncManagerDoneModal
          task={pendingDoneTask}
          saving={doneSaving}
          error={doneModalErr}
          onClose={() => { if (!doneSaving) setPendingDoneTask(null) }}
          onConfirm={confirmIncManagerDone}
        />
      )}

      {pendingOnboardingTask && (
        <NewMerchantOnboardingModal
          store={pendingOnboardingTask.store}
          dailyTaskKey={pendingOnboardingTask.id}
          onClose={() => setPendingOnboardingTask(null)}
          onSaved={async () => {
            const t = pendingOnboardingTask
            setPendingOnboardingTask(null)
            await reload()
            loadDismissals()
            if (t && IS_STAGING_OR_DEV) {
              setSelectedTask(t)
            }
          }}
        />
      )}

      {selectedTask && (
        <StoreDrawer
          store={selectedTask.store}
          callType={taskIdToCallType(selectedTask.id)}
          onClose={() => setSelectedTask(null)}
          taskCompletion={drawerTaskCompletion}
          autoOpenCallModal={drawerAutoOpenCallModal}
          fromDailyTasks
          extraOnSaved={() => {
            loadDismissals()
            void loadInactiveWf()
          }}
        />
      )}
    </div>
  )
}
