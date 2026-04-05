/**
 * استبيان رضا العميل — متاجر نشط يشحن (اللهجة الليبية كما طُلبت)
 * تقييم 1–5 لكل سؤال
 */
export const SATISFACTION_QUESTIONS = [
  {
    id: 'q1_delivery',
    short: 'سرعة التوصيل',
    text:
      'بالنسبة لسرعة وصول الشحنات لزبائنك من وقت ما تطلع من عندك لعند ما توصلهم، قديش تقيمنا من خمسة؟',
  },
  {
    id: 'q2_collection',
    short: 'خدمة التجميع',
    text:
      'وبالنسبة لخدمة التجميع والتزام المندوب في جية الاستلام من محلك أو مخزنك، قديش تقيمنا من خمسة؟',
  },
  {
    id: 'q3_support',
    short: 'الدعم الفني',
    text:
      'لما تتواصل مع خدمة العملاء بخصوص أي إشكالية، سواء مكالمات أو تذاكر دعم، قديش تقيم سرعة الرد وحل المشكلة، قديش تقيمنا من خمسة؟',
  },
  {
    id: 'q4_app',
    short: 'المنظومة',
    text:
      'بخصوص تطبيق النورس ومنظومة التتبع، هل تحس فيهم سهولة ووضوح في إضافة طلباتك ومراقبتها، قديش تقيمنا من خمسة؟',
  },
  {
    id: 'q5_payments',
    short: 'التسويات المالية',
    text:
      'بخصوص انتظام التسويات المالية واستلامك لفلوسك ومستحقاتك في مواعيدها المحددة، قديش تقيمنا من خمسة؟',
  },
  {
    id: 'q6_returns',
    short: 'سلامة المرجوعات',
    text:
      'وبالنسبة لسلامة المرجوعات وحالة البضاعة اللي تردلك للمحل، هل توصلك سليمة وبحالة ممتازة؟ قديش تقيمنا من خمسة؟',
  },
]

/**
 * فئات متاجر تبويب «نشط يشحن — قيد المكالمة» (/active/pending) في الواجهة.
 * (في قاعدة البيانات غالباً `active_shipping` أو `active` وليس فقط `active_pending_calls`.)
 */
export const PENDING_CALL_PIPELINE_CATEGORIES = new Set([
  'active',
  'active_shipping',
  'active_pending_calls',
])

function hasSurveyRecord(storeId, surveyByStoreId) {
  if (storeId == null || !surveyByStoreId) return false
  return !!(
    surveyByStoreId[storeId]
    ?? surveyByStoreId[String(storeId)]
    ?? surveyByStoreId[Number(storeId)]
  )
}

/**
 * هل يجب إظهار استبيان رضا العميل ضمن «تسجيل مكالمة» (مكالمة عامة)؟
 * يُطبَّق على متاجر **قيد المكالمة** (النشطة في مسار الشحن) وليس على منجز / لم يُصل / احتضان…
 */
export function needsActiveSatisfactionSurvey(storeId, category, surveyByStoreId) {
  if (storeId == null) return false
  const cat = category || ''
  if (!PENDING_CALL_PIPELINE_CATEGORIES.has(cat)) return false
  return !hasSurveyRecord(storeId, surveyByStoreId)
}
