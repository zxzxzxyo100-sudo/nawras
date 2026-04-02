import { useState, useMemo } from 'react'
import { ClipboardList, Phone, RefreshCw, CheckCircle } from 'lucide-react'
import { useStores } from '../contexts/StoresContext'
import { useAuth } from '../contexts/AuthContext'
import StoreDrawer from '../components/StoreDrawer'

// ══════════════════════════════════════════════════════════════════
// توليد المهام اليومية بناءً على القواعد الحصرية الثلاث
// ══════════════════════════════════════════════════════════════════
function generateTasks(allStores, callLogs, storeStates, userRole, username, assignments) {
  const tasks = []
  const today = new Date().toISOString().split('T')[0]

  allStores.forEach(store => {
    const log          = callLogs[store.id] || {}
    const dbCat        = storeStates[store.id]?.category || store.category
    const incBucket    = store._inc   // الفئة الحصرية من مسار الاحتضان
    const lastCallDate = Object.values(log).map(c => c?.date).filter(Boolean).sort().reverse()[0]
    const calledToday  = lastCallDate?.startsWith(today)

    const daysSinceLast = lastCallDate
      ? Math.floor((new Date() - new Date(lastCallDate)) / 86400000)
      : 999

    // ─── Q1: تحت الاحتضان — مكالمة متابعة لدعم الشحن ────────────
    // الشرط: age ≤ 14d AND ships > 0
    if (incBucket === 'incubating' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!log.day0) {
        tasks.push({
          id: `${store.id}-inc-day0`, store, priority: 'high',
          type: 'new_call', label: 'متابعة تحت الاحتضان',
          desc: 'يشحن ضمن 14 يوم — يحتاج مكالمة دعم',
        })
      }
    }

    // ─── Q2: لم تبدأ — استعادة عاجلة ────────────────────────────
    // الشرط: age > 48h AND ships = 0
    if (incBucket === 'never_started' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id: `${store.id}-never`, store,
          priority: daysSinceLast >= 3 ? 'high' : 'normal',
          type:     'recovery_call',
          label:    'استعادة — لم تبدأ بعد',
          desc:     lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به قط',
        })
      }
    }

    // ─── جاري الاستعادة (يدوي) — متابعة ──────────────────────────
    if (incBucket === 'restoring' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id: `${store.id}-restoring`, store,
          priority: daysSinceLast >= 2 ? 'high' : 'normal',
          type:     'recovery_call',
          label:    'متابعة جاري الاستعادة',
          desc:     lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'يحتاج متابعة',
        })
      }
    }

    // ─── Q3: تخريج — مكالمة ترحيب للانتقال لنشطة ────────────────
    // الشرط: age > 14d AND ships > 0
    if (incBucket === 'graduated' && ['incubation_manager', 'executive'].includes(userRole)) {
      if (!log.graduation_call) {
        tasks.push({
          id: `${store.id}-grad`, store, priority: 'normal',
          type: 'new_call', label: 'مكالمة تخريج',
          desc: 'أكملت الاحتضان بنجاح — مكالمة ترحيب بالنشطة',
        })
      }
    }

    // ─── المتاجر غير النشطة الرئيسية (hot/cold) — استعادة ────────
    if (['hot_inactive', 'cold_inactive'].includes(dbCat) && ['inactive_manager', 'executive'].includes(userRole)) {
      if (!calledToday) {
        tasks.push({
          id:       `${store.id}-recovery`,
          store,
          priority: daysSinceLast >= 7 ? 'high' : 'normal',
          type:     'recovery_call',
          label:    'مكالمة استعادة',
          desc:     lastCallDate ? `آخر تواصل قبل ${daysSinceLast} يوم` : 'لم يُتصل به مطلقاً',
        })
      }
    }

    // ─── المتاجر النشطة ─────────────────────────────────────────
    if (dbCat === 'active_shipping') {
      const daysSinceShip = store.last_shipment_date && store.last_shipment_date !== 'لا يوجد'
        ? Math.floor((new Date() - new Date(store.last_shipment_date)) / 86400000)
        : 999

      const asgn = assignments?.[store.id]
      const isAssignedToMe = asgn?.assigned_to === username

      if (userRole === 'executive' && daysSinceShip >= 10 && !calledToday) {
        // المدير التنفيذي: يرى كل المتاجر المتأخرة
        tasks.push({
          id:       `${store.id}-followup`,
          store,
          priority: daysSinceShip >= 14 ? 'high' : 'normal',
          type:     'followup_call',
          label:    'متابعة متجر نشط',
          desc:     `لم يشحن منذ ${daysSinceShip} يوم`,
        })
      } else if (userRole === 'active_manager' && isAssignedToMe && !calledToday) {
        // مسؤول المتاجر النشطة: يرى فقط متاجره المعيّنة
        tasks.push({
          id:       `${store.id}-assigned`,
          store,
          priority: daysSinceShip >= 10 ? 'high' : 'normal',
          type:     'assigned_store',
          label:    'متجر مُسنَد إليك',
          desc:     daysSinceShip < 999
            ? `آخر شحنة قبل ${daysSinceShip} يوم`
            : 'لا توجد شحنات بعد',
        })
      }
    }
  })

  return tasks.sort((a, b) => (a.priority === 'high' ? -1 : 1) - (b.priority === 'high' ? -1 : 1))
}

const TYPE_COLORS = {
  new_call:      { bg: 'bg-purple-50', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-700' },
  recovery_call: { bg: 'bg-red-50',    border: 'border-red-200',    badge: 'bg-red-100 text-red-700'       },
  followup_call: { bg: 'bg-amber-50',  border: 'border-amber-200',  badge: 'bg-amber-100 text-amber-700'   },
  assigned_store:{ bg: 'bg-blue-50',   border: 'border-blue-200',   badge: 'bg-blue-100 text-blue-700'     },
}

export default function Tasks() {
  const { allStores, callLogs, storeStates, assignments, loading, reload } = useStores()
  const { user } = useAuth()
  const [selected, setSelected]   = useState(null)
  const [doneIds, setDoneIds]     = useState(new Set())
  const [filter, setFilter]       = useState('all')

  const tasks = useMemo(
    () => generateTasks(allStores, callLogs, storeStates, user?.role, user?.username, assignments),
    [allStores, callLogs, storeStates, user, assignments]
  )

  const pendingTasks = tasks.filter(t => !doneIds.has(t.id))
  const highCount    = pendingTasks.filter(t => t.priority === 'high').length
  const displayed    = filter === 'high'
    ? pendingTasks.filter(t => t.priority === 'high')
    : pendingTasks

  function markDone(id) { setDoneIds(prev => new Set([...prev, id])) }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <ClipboardList size={24} className="text-blue-600" />
            المهام اليومية
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {pendingTasks.length} مهمة معلقة •{' '}
            <span className="text-red-600 font-medium">{highCount} عالية الأولوية</span>
          </p>
        </div>
        <button onClick={reload} disabled={loading} className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {[
          { val: 'all',  label: `الكل (${pendingTasks.length})` },
          { val: 'high', label: `عالية الأولوية (${highCount})` },
        ].map(tab => (
          <button
            key={tab.val}
            onClick={() => setFilter(tab.val)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              filter === tab.val
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tasks list */}
      {displayed.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 text-center shadow-sm border border-slate-100">
          <CheckCircle size={48} className="text-green-400 mx-auto mb-3" />
          <p className="font-bold text-slate-700 text-lg">أحسنت! لا توجد مهام معلقة</p>
          <p className="text-slate-400 text-sm mt-1">تم الانتهاء من جميع المهام اليوم</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map(task => {
            const colors = TYPE_COLORS[task.type] || TYPE_COLORS.followup_call
            return (
              <div
                key={task.id}
                className={`flex items-center gap-4 p-4 rounded-2xl border ${colors.bg} ${colors.border} transition-all`}
              >
                {/* Priority dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${task.priority === 'high' ? 'bg-red-500' : 'bg-amber-400'}`} />

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-bold text-slate-800 truncate">{task.store.name}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${colors.badge}`}>
                      {task.label}
                    </span>
                    {task.priority === 'high' && (
                      <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium flex-shrink-0">عاجل</span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{task.desc}</p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => setSelected(task.store)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-sm"
                  >
                    <Phone size={13} />
                    اتصل
                  </button>
                  <button
                    onClick={() => markDone(task.id)}
                    className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl text-xs font-medium transition-colors"
                  >
                    <CheckCircle size={13} />
                    تم
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {selected && <StoreDrawer store={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
