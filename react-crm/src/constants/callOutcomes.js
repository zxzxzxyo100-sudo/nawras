/** تسميات نتيجة المكالمة (متطابقة مع CallModal) */
export const CALL_OUTCOME_LABELS = {
  answered: 'تم الرد',
  no_answer: 'لم يرد',
  busy: 'مشغول',
  callback: 'طلب معاودة الاتصال',
}

export function formatCallOutcome(outcome) {
  if (!outcome || typeof outcome !== 'string') return ''
  return CALL_OUTCOME_LABELS[outcome] || outcome
}
