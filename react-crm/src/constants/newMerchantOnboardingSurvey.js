/**
 * استبيان تهيئة المتاجر الجديدة — يُعرض فقط من لوحة «متاجر جديدة» (/new)
 * ثلاثة أسئلة بتقييم 1–5 مع إرشاد للموظف
 */
/**
 * نسخة التطوير — أسئلة نعم/لا (تُرسَل كـ 5/1 للخادم)
 */
export const NEW_MERCHANT_ONBOARDING_QUESTIONS_DEV = [
  {
    id: 'order_entry',
    section: 'إدخال الشحنات',
    text: 'هل عرفت كيف تدخل بيانات الشحنات وتطبع الباركود الخاص بالنورس؟',
    tooltip:
      'تأكد أن التاجر عرف كيف يعبّي بيانات الزبون وطباعة الباركود ووضعه على الشحنة.',
  },
  {
    id: 'tracking',
    section: 'أداء التطبيق',
    text: 'هل تطبيق التتبع واضح ومريح ليك في متابعة حالات الشحنات؟',
    tooltip:
      'تأكد أن التاجر نزّل التطبيق وعرف كيف يتابع الحالات.',
  },
  {
    id: 'task_types',
    section: 'المهام اللوجستية',
    text: 'هل فهمت الفرق بين مهمة التجميع، التسوية المالية، واستلام الراجع؟',
    tooltip:
      'اشرح للتاجر: تجميع، تسوية مالية، راجع.',
  },
]

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

/** نعم=true → 5، لا=false → 1 (للمسار التجريبي / التطوير) */
export function buildOnboardingYesNoForApi(yesNo3) {
  if (!Array.isArray(yesNo3) || yesNo3.length !== 3) return null
  const out = []
  for (let i = 0; i < 3; i++) {
    const v = yesNo3[i]
    if (v !== true && v !== false) return null
    out.push(v ? 5 : 1)
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
