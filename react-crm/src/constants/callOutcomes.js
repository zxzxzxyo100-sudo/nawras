/** تسميات نتيجة المكالمة (متطابقة مع CallModal) */
export const CALL_OUTCOME_LABELS = {
  answered: 'تم الرد',
  /** مطابقة مسار العمل: لم يتم الرد */
  no_answer: 'لم يتم الرد',
  busy: 'مشغول',
  callback: 'طلب معاودة الاتصال',
}

export function formatCallOutcome(outcome) {
  if (!outcome || typeof outcome !== 'string') return ''
  return CALL_OUTCOME_LABELS[outcome] || outcome
}
