/**
 * نظام تصميم موحّد — ألوان الحالة، لوحة الـKPI، وثوابت مسافات/ظلال قياسية.
 * يجمع 4 خرائط ألوان كانت مبعثرة سابقاً (StoreDrawer.CATEGORY_LABELS،
 * StoreDrawer.LIFECYCLE_UI، FloatingCallBar.CAT_COLORS، StatCard palette)
 * في مصدر واحد. لا يُعاد تسمية أي مفتاح فئة/bucket حقيقي — فقط يُترجم
 * لعرض بصري متّسق. الاستخدامات القديمة تبقى تعمل كما هي حتى تُهاجَر لاحقاً.
 */

/**
 * كل مفتاح: { label, bg, text, border, dot, hex }
 * - bg/text/border: Tailwind classes لشارات الحالة (badges)
 * - dot: لون النقطة الصغيرة (Tailwind bg-*)
 * - hex: نفس اللون بصيغة hex — للرسوم البيانية (Recharts) والأماكن غير-Tailwind
 */
export const STATUS_COLORS = {
  new_registered: {
    label: 'جديد — بانتظار أول شحنة',
    bg: 'bg-sky-100', text: 'text-sky-800', border: 'border-sky-200',
    dot: 'bg-sky-500', hex: '#0ea5e9',
  },
  incubating: {
    label: 'تحت الاحتضان',
    bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200',
    dot: 'bg-purple-500', hex: '#8b5cf6',
  },
  active_shipping: {
    label: 'نشط يشحن',
    bg: 'bg-emerald-100', text: 'text-emerald-800', border: 'border-emerald-200',
    dot: 'bg-emerald-500', hex: '#10b981',
  },
  active_pending_calls: {
    label: 'نشط قيد المكالمة',
    bg: 'bg-emerald-50', text: 'text-emerald-800', border: 'border-emerald-100',
    dot: 'bg-emerald-400', hex: '#059669',
  },
  completed_merchants: {
    label: 'منجز',
    bg: 'bg-violet-100', text: 'text-violet-800', border: 'border-violet-200',
    dot: 'bg-violet-500', hex: '#7c3aed',
  },
  unreachable_merchants: {
    label: 'لم يتم الوصول',
    bg: 'bg-amber-100', text: 'text-amber-900', border: 'border-amber-200',
    dot: 'bg-amber-500', hex: '#d97706',
  },
  frozen_merchants: {
    label: 'مجمد',
    bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200',
    dot: 'bg-slate-400', hex: '#475569',
  },
  hot_inactive: {
    label: 'غير نشط ساخن',
    bg: 'bg-orange-100', text: 'text-orange-900', border: 'border-orange-200',
    dot: 'bg-orange-500', hex: '#f59e0b',
  },
  cold_inactive: {
    label: 'غير نشط بارد',
    bg: 'bg-slate-200', text: 'text-slate-800', border: 'border-slate-300',
    dot: 'bg-slate-500', hex: '#6b7280',
  },
  restoring: {
    label: 'قيد الاستعادة',
    bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-200',
    dot: 'bg-cyan-500', hex: '#06b6d4',
  },
  restored: {
    label: 'تمت الاستعادة',
    bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200',
    dot: 'bg-teal-500', hex: '#14b8a6',
  },
}

/** أسماء بديلة (مفاتيح قديمة/عامة تُستخدم بأماكن أخرى بالكود) لنفس القيم أعلاه */
export const STATUS_COLOR_ALIASES = {
  active: 'active_shipping',
  completed: 'completed_merchants',
  unreachable: 'unreachable_merchants',
  inactive: 'hot_inactive',
  frozen: 'frozen_merchants',
  recovered: 'restored',
  new_pre_ship: 'new_registered',
}

/** يُرجع تعريف اللون لأي مفتاح فئة/bucket حقيقي، مع دعم الأسماء البديلة */
export function getStatusColor(category) {
  const key = STATUS_COLOR_ALIASES[category] || category
  return STATUS_COLORS[key] || {
    label: category || '—',
    bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200',
    dot: 'bg-slate-400', hex: '#94a3b8',
  }
}

/** لوحة KPI عامة (منقولة من StatCard.jsx الحالي — بدون ألوان جديدة) */
export const KPI_PALETTE = {
  blue:   { bg: 'bg-blue-50',    icon: 'bg-blue-600',    text: 'text-blue-600',    bar: 'bg-blue-500' },
  green:  { bg: 'bg-emerald-50', icon: 'bg-emerald-600', text: 'text-emerald-600', bar: 'bg-emerald-500' },
  amber:  { bg: 'bg-amber-50',   icon: 'bg-amber-600',   text: 'text-amber-600',   bar: 'bg-amber-500' },
  red:    { bg: 'bg-red-50',     icon: 'bg-red-600',     text: 'text-red-600',     bar: 'bg-red-500' },
  purple: { bg: 'bg-purple-50',  icon: 'bg-purple-600',  text: 'text-purple-600',  bar: 'bg-purple-500' },
}

/** ثوابت بصرية قياسية — تُستخدم بدل تكرار نفس القيم يدوياً بكل مكوّن */
export const CARD_RADIUS = 'rounded-2xl'
export const CARD_SHADOW = 'shadow-sm'
export const CARD_BORDER = 'border border-slate-200/80'
export const SIDEBAR_GRADIENT_ACTIVE = 'linear-gradient(135deg, rgba(124,58,237,0.32), rgba(168,85,247,0.16))'
export const SIDEBAR_GLOW_ACTIVE = '0 0 22px rgba(139,92,246,0.18)'
