/**
 * استبيان تهيئة المتاجر الجديدة — يُعرض فقط من لوحة «متاجر جديدة» (/new)
 * ثلاثة أسئلة بتقييم 1–5 مع إرشاد للموظف
 */
export const NEW_MERCHANT_ONBOARDING_QUESTIONS = [
  {
    id: 'order_entry',
    section: 'إدخال الطلبات',
    text: 'هل واجهت صعوبة في إدخال بيانات الشحنات لأول مرة؟',
    tooltip:
      'تأكد أن التاجر عرف كيف يعبّي بيانات الزبون وطباعة الباركود ووضعه على الشحنة.',
  },
  {
    id: 'tracking',
    section: 'تتبع الشحنات',
    text: 'هل تتبع مكان الشحنة وحالتها في التطبيق مريح وواضح؟',
    tooltip:
      'تأكد أن التاجر نزّل التطبيق وعرف كيف يتابع الحالات (قيد التوصيل، تم، راجع) لتجنب الاتصالات المتكررة.',
  },
  {
    id: 'task_types',
    section: 'أنواع المهام (Pickup/Settlement/Return)',
    text: 'هل آلية إضافة المهام (تجميع، تسوية مالية، استلام راجع) واضحة؟',
    tooltip:
      'اشرح للتاجر: تجميع (بضاعة جديدة)، تسوية (طلب مبيعاته المالية)، راجع (استلام بضاعته الملغية).',
  },
]

/** يُحوّل 3 تقييمات إلى صيغة الخادم (6 أعمدة: الثلاثة الأخيرة محايدة 3) */
export function buildOnboardingAnswersForApi(ratings3) {
  if (!Array.isArray(ratings3) || ratings3.length !== 3) return null
  const out = []
  for (let i = 0; i < 3; i++) {
    const n = Number(ratings3[i])
    if (n < 1 || n > 5) return null
    out.push(n)
  }
  return [...out, 3, 3, 3]
}

export function needsNewMerchantOnboardingSurvey(store, newMerchantOnboardingDoneIds) {
  if (!store || store.bucket !== 'incubating') return false
  const sid = store.id
  if (sid == null) return false
  if (!newMerchantOnboardingDoneIds) return true
  if (newMerchantOnboardingDoneIds instanceof Set) {
    return !newMerchantOnboardingDoneIds.has(sid) && !newMerchantOnboardingDoneIds.has(String(sid))
  }
  return !newMerchantOnboardingDoneIds[sid] && !newMerchantOnboardingDoneIds[String(sid)]
}
