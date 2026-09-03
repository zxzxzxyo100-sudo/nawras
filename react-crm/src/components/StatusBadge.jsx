import { getStatusColor } from '../config/designTokens'

/**
 * شارة حالة موحّدة — تقرأ الألوان من designTokens.STATUS_COLORS.
 * category: أي مفتاح فئة/bucket حقيقي من بيانات النظام (new_registered, hot_inactive, ...).
 * label: نص بديل اختياري (وإلا يُستخدم label المعرّف بالخريطة).
 */
export default function StatusBadge({ category, label, size = 'md', className = '' }) {
  const c = getStatusColor(category)
  const text = label || c.label
  const sizeClass = size === 'sm'
    ? 'px-2 py-0.5 text-[10px] gap-1'
    : 'px-2.5 py-1 text-xs gap-1.5'

  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold whitespace-nowrap ${sizeClass} ${c.bg} ${c.text} ${c.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {text}
    </span>
  )
}
