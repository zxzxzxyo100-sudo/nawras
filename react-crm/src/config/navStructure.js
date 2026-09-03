/**
 * بنية التنقّل (Sidebar) — بيانات بحتة، منفصلة عن المكوّن (Sidebar.jsx) عمداً
 * حتى تُستخدم أيضاً بمكان آخر (مثل breadcrumb الهيدر) بدون تكرار التسميات،
 * وحتى يشتغل Fast Refresh بشكل سليم لملف Sidebar.jsx (يُصدّر مكوّنات فقط).
 */
import {
  LayoutDashboard, Store, TrendingUp,
  Users, Baby, BarChart2, Crown,
  BadgeCheck, Package, ClipboardList, Phone,
} from 'lucide-react'

export const NAV_ALL = [
  { to: '/',              label: 'لوحة التحكم',       icon: LayoutDashboard, view: 'dashboard'    },
  { to: '/tasks',         label: 'المهام',            icon: ClipboardList,   view: 'tasks'        },
  { to: '/active/pending', label: 'قيد المتابعة',     icon: TrendingUp,      view: 'active'       },
  { to: '/quick-verification', label: 'التحقيق السريع', icon: BadgeCheck,   view: 'quick_verification' },
  { to: '/new',           label: 'المتاجر',            icon: Store,           view: 'new'          },
  { to: '/vip',           label: 'كبار التجار',        icon: Crown,           view: 'vip_merchants' },
  { to: '/performance',   label: 'أدائي',              icon: BarChart2,       view: 'dashboard'    },
  { to: '/users',         label: 'إدارة المستخدمين',    icon: Users,           view: 'users'        },
  { to: '/lead-management', label: 'جمع البيانات والمتابعة', icon: Phone,       view: 'lead_management' },
  { to: '/analytics/logistics', label: 'تحليلات اللوجستيات', icon: Package,   view: 'dashboard' },
]

/** المتاجر — كل المتاجر ثم جديدة (48 ساعة) ثم تحت الاحتضان — مستقلة عن مسار الاحتضان */
export const STORES_SUB = [
  { to: '/new', label: 'كل المتاجر', kind: 'all' },
  { to: '/new?view=new48', label: 'جديدة', kind: 'new48' },
  { to: '/new?bucket=incubating', label: 'تحت الاحتضان', kind: 'new_inc' },
]

/** نشط يشحن — قيد المكالمة / المنجزة (مثل مسار الاحتضان) */
export const ACTIVE_SUB = [
  { to: '/active/pending', label: 'قيد المتابعة', kind: 'pending' },
  { to: '/active/completed', label: 'المتاجر المنجزة', kind: 'completed' },
  { to: '/active/unreachable', label: 'لم يتم الوصول للمتجر', kind: 'unreachable' },
]

/** مسار الاحتضان — أسفل المتاجر */
export const INCUBATION_SUB = [
  { to: '/incubation/between-calls', label: 'بين المكالمات', kind: 'between' },
  { to: '/incubation/call-delay', label: 'تأخير المكالمة', kind: 'delay' },
  { to: '/incubation/call-1', label: 'المكالمة الأولى', kind: 'call1' },
  { to: '/incubation/call-2', label: 'المكالمة الثانية', kind: 'call2' },
  { to: '/incubation/call-3', label: 'المكالمة الثالثة', kind: 'call3' },
  { to: '/incubation/new-completed', label: 'المتاجر الجديدة المنجزة', kind: 'new_completed' },
]

/** ترتيب: ساخنة → باردة → جاري الاستعادة → تمت الاستعادة */
export const INACTIVE_SUB = [
  { to: '/hot-inactive/all',       label: 'غير نشطة ساخنة', view: 'hot_inactive' },
  { to: '/cold-inactive',          label: 'غير نشطة باردة', view: 'cold_inactive' },
  { to: '/hot-inactive/restoring', label: 'جاري الاستعادة', viewAny: ['hot_inactive', 'cold_inactive'] },
  { to: '/hot-inactive/restored',  label: 'تمت الاستعادة — المنجزة',  viewAny: ['hot_inactive', 'cold_inactive'] },
]

/** أداء الفريق — أهداف اليوم + الإحصائيات */
export const STAFF_PERFORMANCE_SUB = [
  { to: '/staff-performance', label: 'أهداف اليوم', kind: 'goals' },
  { to: '/staff-performance/stats', label: 'الإحصائيات', kind: 'stats' },
  { to: '/staff-performance/recovery-report', label: 'تقرير الاستعادة', kind: 'recovery' },
  { to: '/staff-performance/conversion-report', label: 'تقرير نسبة التحويل', kind: 'conversion' },
  { to: '/staff-performance/satisfaction-report', label: 'تقرير معدل الرضا', kind: 'satisfaction' },
  { to: '/staff-performance/incubation-calls-report', label: 'تقرير مكالمات الاحتضان', kind: 'incubation_calls' },
]
