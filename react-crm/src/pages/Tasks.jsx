import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import {
  ClipboardList,
  TrendingUp,
  BadgeCheck,
  PhoneOff,
  Lock,
  Baby,
  Clock,
  PhoneCall,
  Layers,
} from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'
import ActiveStores from './ActiveStores'
import HotInactive from './HotInactive'
import InactiveRestoredFollowupSection from '../components/InactiveRestoredFollowupSection'
import IncubationPath from './IncubationPath'
import FrozenStores from './FrozenStores'

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

/** تبويبات مسار «نشط يشحن» + المجمدة — مطابقة للقائمة الجانبية */
const ACTIVE_MANAGER_TASK_TABS = [
  { id: 'pending', label: 'قيد المكالمة', Icon: TrendingUp },
  { id: 'completed', label: 'المتاجر المنجزة', Icon: BadgeCheck },
  { id: 'unreachable', label: 'لم يتم الوصول', Icon: PhoneOff },
  { id: 'frozen', label: 'المجمدة', Icon: Lock },
]

/** مسار الاحتضان — نفس مفاتيح IncubationPath embeddedTabKey */
const INCUBATION_TASK_TABS = [
  { id: 'call-1', label: 'المكالمة الأولى', Icon: Baby },
  { id: 'call-2', label: 'المكالمة الثانية', Icon: Clock },
  { id: 'call-3', label: 'المكالمة الثالثة', Icon: PhoneCall },
  { id: 'between-calls', label: 'بين المكالمات', Icon: Layers },
]

function IncubationManagerTasksView() {
  const [tab, setTab] = useState('call-1')

  return (
    <div className="space-y-4 lg:space-y-5" dir="rtl">
      <TasksIntro title="كل مراحل مسار الاحتضان هنا: المكالمة الأولى والثانية والثالثة، وبين المكالمات. يظهر إنجاز مسؤول الاحتضان في «أهداف الفريق» كإجمالي تراكمي لكل تلك المكالمات المسجّلة في النظام." />
      <div className="flex flex-wrap gap-2 rounded-2xl border border-violet-200/70 bg-white/70 p-2 shadow-sm ring-1 ring-violet-100/80">
        {INCUBATION_TASK_TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              tab === id
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-violet-50/90 hover:border-violet-200'
            }`}
          >
            <Icon size={16} className="shrink-0 opacity-90" />
            {label}
          </button>
        ))}
      </div>
      <IncubationPath embeddedTabKey={tab} />
    </div>
  )
}

function ActiveManagerTasksView() {
  const [tab, setTab] = useState('pending')

  return (
    <div className="space-y-4 lg:space-y-5" dir="rtl">
      <TasksIntro title="جميع خانات «نشط يشحن» والمجمدة في مكان واحد: اختر التبويب أدناه. في «قيد المكالمة» يُعرض طابورك كاملاً؛ الحصة اليومية (50) تخصّ هذا المسار عند تعيينك." />
      <div className="flex flex-wrap gap-2 rounded-2xl border border-violet-200/70 bg-white/70 p-2 shadow-sm ring-1 ring-violet-100/80">
        {ACTIVE_MANAGER_TASK_TABS.map(({ id, label, Icon }) => (
            <button
            key={id}
              type="button"
            onClick={() => setTab(id)}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-bold transition-all ${
              tab === id
                ? 'bg-violet-600 text-white shadow-md shadow-violet-500/25'
                : 'bg-white text-slate-600 border border-slate-200/90 hover:bg-violet-50/90 hover:border-violet-200'
            }`}
          >
            <Icon size={16} className="shrink-0 opacity-90" />
            {label}
            </button>
        ))}
          </div>
      {tab === 'frozen' ? (
        <FrozenStores embedded />
      ) : (
        <ActiveStores embeddedSegment={tab} fromDailyTasks={tab === 'pending'} />
      )}
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
    return <ActiveManagerTasksView />
  }

  if (role === 'inactive_manager') {
  return (
      <div className="space-y-4 lg:space-y-5" dir="rtl">
        <TasksIntro title="متاجر «غير نشط ساخن» التي لم تُنقل بعد إلى «قيد الاستعادة». هدف المهمة: متابعة المتجر وتحويل حالته إلى جاري الاستعادة؛ الطابور والحصة اليومية (50) كما في بقية النظام." />
        <InactiveRestoredFollowupSection />
        <HotInactive embeddedRecoverySegment="all" recoveryTasksHotQueue />
        </div>
    )
  }

  if (role === 'incubation_manager') {
    return <IncubationManagerTasksView />
  }

  return <Navigate to="/" replace />
}
