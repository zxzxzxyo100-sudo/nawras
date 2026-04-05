/** خانات التقسيم من الخادم (all-stores) — للتصفية وعرض التسمية */
export const STORE_BUCKET_KEYS = [
  'incubating',
  'active_shipping',
  'hot_inactive',
  'cold_inactive',
]

export const STORE_BUCKET_LABELS = {
  incubating: 'تحت الاحتضان',
  active_shipping: 'نشط يشحن',
  hot_inactive: 'غير نشط ساخن',
  cold_inactive: 'غير نشط بارد',
}

export function storeBucketLabel(bucket) {
  if (bucket == null) return '—'
  return STORE_BUCKET_LABELS[bucket] || String(bucket)
}
