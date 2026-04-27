/**
 * استبيان المتاجر النشطة — لوحة «نشط يشحن — قيد المكالمة»
 * 5 أسئلة بنجوم 1–5 + سؤال نصي للمقترحات
 */

export const ACTIVE_DASHBOARD_STAR_QUESTIONS = [
  { id: 'q1_delivery', text: 'تقييم سرعة التوصيل لدى الشركة.' },
  { id: 'q2_collection', text: 'تقييم خدمة التجميع (البيك أب).' },
  { id: 'q3_support', text: 'تقييم الدعم الفني (سرعة الرد على التذاكر والمكالمات).' },
  { id: 'q4_app', text: 'تقييم سهولة استخدام التطبيق والمنظومة.' },
  {
    id: 'q5_payments_returns',
    text: 'تقييم التسويات المالية وسلامة المرتجعات.',
  },
]

export const ACTIVE_DASHBOARD_SUGGESTIONS_PROMPT =
  'هل لديك أي مقترحات أو ملاحظات إضافية لتطوير الخدمة؟'

/**
 * الـ API يخزّن 6 أعمدة رقمية. السادس (مرجوعات تاريخياً) يُشتق هنا كمتوسط
 * تقريبي للخمسة ليتوافق مع الحفظ دون جمع نجمة سادسة من الواجهة.
 */
export function buildSixNumericAnswers(fiveRatings) {
  const nums = fiveRatings.map(n => Number(n))
  if (nums.some(n => n < 1 || n > 5)) return null
  const avg = Math.round(nums.reduce((a, b) => a + b, 0) / 5)
  const q6 = Math.max(1, Math.min(5, avg))
  return [...nums, q6]
}
