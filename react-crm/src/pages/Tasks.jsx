import { Navigate } from 'react-router-dom'
import { ClipboardList } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ActiveStores from './ActiveStores'
import HotInactive from './HotInactive'
import IncubationPath from './IncubationPath'

function TasksIntro({ title, children }) {
  return (
    <div
      className="rounded-2xl border border-white/25 bg-white/45 backdrop-blur-xl px-5 py-4 shadow-[0_12px_40px_-16px_rgba(15,23,42,0.35)] ring-1 ring-violet-200/30"
      dir="rtl"
    >
      <h1 className="text-xl lg:text-2xl font-bold text-slate-800 flex items-center gap-2">
        <ClipboardList size={22} className="text-violet-600 shrink-0" />
        المهام
      </h1>
      <p className="text-slate-600 text-sm mt-1 leading-relaxed">{title}</p>
      {children}
    </div>
  )
}

/**
 * صفحة موحّدة للمهام اليومية: الحصة 50، دفعات الطابور، الاستبيان — حسب الدور.
 */
export default function Tasks() {
  const { user } = useAuth()
  const role = user?.role

  if (role === 'active_manager') {
    return (
      <div className="space-y-4 lg:space-y-5" dir="rtl">
        <TasksIntro title="قائمة متاجرك المعيّنة في «قيد المكالمة»: دفعة صغيرة من الطابور، حفظ الاستبيان أو «لم يرد» يُحدّث العدّ حتى 50 متجراً يومياً." />
        <ActiveStores embeddedSegment="pending" fromDailyTasks />
      </div>
    )
  }

  if (role === 'inactive_manager') {
    return (
      <div className="space-y-4 lg:space-y-5" dir="rtl">
        <TasksIntro title="متاجر «غير نشط ساخن» التي لم تُنقل بعد إلى «قيد الاستعادة». هدف المهمة: متابعة المتجر وتحويل حالته إلى جاري الاستعادة؛ الطابور والحصة اليومية (50) كما في بقية النظام." />
        <HotInactive embeddedRecoverySegment="all" recoveryTasksHotQueue />
      </div>
    )
  }

  if (role === 'incubation_manager') {
    return (
      <div className="space-y-4 lg:space-y-5" dir="rtl">
        <TasksIntro title="مكالمات دورة الاحتضان — للتنقّل بين المراحل استخدم أيضاً «مسار الاحتضان» في القائمة." />
        <IncubationPath embeddedTabKey="call-1" />
      </div>
    )
  }

  return <Navigate to="/" replace />
}
