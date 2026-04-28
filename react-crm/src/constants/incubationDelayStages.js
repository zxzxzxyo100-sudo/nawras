/** يطابق `_inc_stage_key` من all-stores.php */
export const INC_DELAY_STAGE_OPTIONS = [
  { key: 'shipped_no_c1', label: 'شحن دون المكالمة الأولى' },
  { key: 'late_c1', label: 'تأخّر عن المكالمة الأولى (يوم 1)' },
  { key: 'wait_c2', label: 'انتظار المكالمة الثانية (قبل يوم 3)' },
  { key: 'late_c2', label: 'تأخّر عن المكالمة الثانية (يوم 3)' },
  { key: 'wait_c3', label: 'انتظار المكالمة الثالثة (قبل يوم 10)' },
  { key: 'late_c3', label: 'تأخّر عن المكالمة الثالثة (يوم 10)' },
]

export const ALL_STAGE_KEYS = INC_DELAY_STAGE_OPTIONS.map(o => o.key)
