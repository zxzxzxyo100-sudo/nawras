/**
 * ألوان صفوف المتاجر — غير نشط ساخن / بارد (مطابقة تقريبية للمرجع)
 * fg: لون النص داخل الصف الملوّن
 */
export const INACTIVE_ROW_COLOR_OPTIONS = [
  { key: '1', label: 'تسمية 1', bg: '#FFD700', fg: '#1e293b' },
  { key: '2', label: 'تسمية 2', bg: '#4B3621', fg: '#fafaf9' },
  { key: '3', label: 'تسمية 3', bg: '#FF1493', fg: '#ffffff' },
  { key: '4', label: 'تسمية 4', bg: '#228B22', fg: '#ffffff' },
  { key: '5', label: 'تسمية 5', bg: '#007FFF', fg: '#ffffff' },
  { key: '6', label: 'تسمية 6', bg: '#A45EE5', fg: '#ffffff' },
  { key: '7', label: 'تسمية 7', bg: '#000080', fg: '#f8fafc' },
]

export function inactiveRowStyleForKey(colorKey) {
  const opt = INACTIVE_ROW_COLOR_OPTIONS.find(o => o.key === String(colorKey))
  if (!opt) return undefined
  return { backgroundColor: opt.bg, color: opt.fg }
}
