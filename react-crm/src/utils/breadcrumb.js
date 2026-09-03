import {
  NAV_ALL, STORES_SUB, ACTIVE_SUB, INCUBATION_SUB, INACTIVE_SUB, STAFF_PERFORMANCE_SUB,
} from '../config/navStructure'

/** مسارات ثابتة غير موجودة بمصفوفات Sidebar (روابط مستقلة/redirect) */
const EXTRA_LABELS = [
  { to: '/frozen', label: 'المتاجر المجمدة' },
  { to: '/hot-inactive/all', label: 'غير نشطة ساخنة' },
  { to: '/hot-inactive/restoring', label: 'جاري الاستعادة' },
  { to: '/hot-inactive/restored', label: 'تمت الاستعادة — المنجزة' },
]

/** كل الروابط المعروفة مرتبة من الأطول فالأقصر — لمطابقة أدق مسار أولاً */
const ALL_LINKS = [
  ...NAV_ALL, ...STORES_SUB, ...ACTIVE_SUB, ...INCUBATION_SUB, ...INACTIVE_SUB, ...STAFF_PERFORMANCE_SUB,
  ...EXTRA_LABELS,
].sort((a, b) => b.to.length - a.to.length)

/** يُرجع تسمية عربية لمسار (pathname) الحالي — تُستخدم لبناء الـbreadcrumb بالهيدر */
export function labelForPath(pathname) {
  if (pathname === '/' || pathname === '') return 'لوحة التحكم'
  const hit = ALL_LINKS.find(item => {
    const base = item.to.split('?')[0]
    return pathname === base || pathname.startsWith(base + '/')
  })
  return hit?.label || ''
}
