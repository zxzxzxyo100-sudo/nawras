# مواصفة استبيان تهيئة المتاجر الجديدة — البيئة التجريبية (staging)

هذا الملف يوثّق البرومبت المعتمد للميزة ويُرفَع مع المستودع (بما فيه فرع `staging`).  
**اتفاق عمل:** أي تحديث لاحق على نصوص الأسئلة أو الإرشادات يُدار **سؤالاً بسؤال** بين صاحب المنتج والمطوّر/المساعد حتى لا تختلط النسخ.

---

## 1) النطاق (حصرية لوحة «متاجر جديدة»)

- الوحدة موجودة **فقط** في **لوحة المتاجر الجديدة** (`NewStores.jsx`، مسار `/new`).
- **لا** تُعرض في لوحات المبيعات النشطة، المالية، أو غيرها.
- التفعيل في الجدول عبر `eliteNeedsNewMerchantOnboarding` + `onEliteNewMerchantOnboardingClick` **فقط** من `NewStores.jsx`.

## 2) المحتوى — ثلاثة أسئلة (عربي) + إرشاد للموظف

### إدخال الطلبات (Order Entry)

- **السؤال:** هل واجهت صعوبة في إدخال بيانات الشحنات لأول مرة؟
- **Tooltip:** تأكد أن التاجر عرف كيف يعبّي بيانات الزبون وطباعة الباركود ووضعه على الشحنة.

### تتبع الشحنات (Tracking)

- **السؤال:** هل تتبع مكان الشحنة وحالتها في التطبيق مريح وواضح؟
- **Tooltip:** تأكد أن التاجر نزّل التطبيق وعرف كيف يتابع الحالات (قيد التوصيل، تم، راجع) لتجنب الاتصالات المتكررة.

### أنواع المهام (Pickup / Settlement / Return)

- **السؤال:** هل آلية إضافة المهام (تجميع، تسوية مالية، استلام راجع) واضحة؟
- **Tooltip:** اشرح للتاجر: تجميع (بضاعة جديدة)، تسوية (طلب مبيعاته المالية)، راجع (استلام بضاعته الملغية).

**المرجع البرمجي للنصوص:** `react-crm/src/constants/newMerchantOnboardingSurvey.js`

## 3) الواجهة والسلوك

- نفس **Look & Feel** تقريبياً لاستبيان المتاجر النشطة (`ActiveStoreSurveyModal`): مودال، تدرج بنفسجي، نجوم 1–5.
- التلميحات: أيقونة معلومات + `title` للتمرير (`NewMerchantOnboardingModal.jsx`).
- زر الإكمال: **تم** — يحفظ عبر API.

## 4) الثبات والمهام اليومية

- **API:** `save_survey` مع `survey_kind: new_merchant_onboarding`؛ الحفظ في جدول `surveys`.
- **عدم العودة بعد التحديث:** `get_surveys` يعيد `new_merchant_onboarding_done_ids`؛ السياق يحوّلها إلى `Set` في `StoresContext`.
- **المهام اليومية:** نوع `new_merchant_onboarding` في `Tasks.jsx`؛ عند الحفظ من المودال مع `dailyTaskKey` يُستدعى `markDailyTaskDone` ثم `reload`.

## 5) مراجع سريعة

| جزء | الملف |
|-----|--------|
| أسئلة + شروط الظهور | `react-crm/src/constants/newMerchantOnboardingSurvey.js` |
| المودال | `react-crm/src/components/NewMerchantOnboardingModal.jsx` |
| لوحة جديدة فقط | `react-crm/src/pages/NewStores.jsx` |
| جدول (زر الاستبيان) | `react-crm/src/components/StoreTable.jsx` |
| مهام يومية | `react-crm/src/pages/Tasks.jsx` |
| الخادم | `api-php/store-actions.php` (`save_survey`, `get_surveys`) |

---

## النسخة الإنجليزية الأصلية (مرجع)

1. **EXCLUSIVE DASHBOARD:** Survey module ONLY on New Merchants Dashboard; hidden elsewhere.
2. **3 Arabic questions** with professional tooltips as listed above.
3. **PERSISTENCE:** On Done (تم), persist via API; remove from Daily Tasks; no reappear after refresh.
4. **UI/UX:** Same look & feel as Active Merchants survey; tooltips via hover or info icon.
