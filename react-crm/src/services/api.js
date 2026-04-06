import axios from 'axios'

const BASE = '/api-php'

const http = axios.create({ baseURL: BASE })


// ─── Auth ────────────────────────────────────────────────────────────────────
/** يستخرج نص الخطأ من جسم الاستجابة (JSON كائن، أو نص JSON، أو حقول شائعة) */
function parseApiErrorBody(data) {
  if (data == null) return ''
  if (typeof data === 'string') {
    const t = data.trim()
    if (t.startsWith('{')) {
      try {
        const o = JSON.parse(t)
        return parseApiErrorBody(o)
      } catch {
        return t.length > 200 ? '' : t
      }
    }
    return t.length > 200 ? '' : t
  }
  if (typeof data === 'object') {
    const err = data.error ?? data.message ?? data.detail
    if (err != null && String(err).trim() !== '') return String(err)
  }
  return ''
}

const FALLBACK_401_AR =
  'بيانات الدخول غير صحيحة. تحقق من اسم المستخدم وكلمة المرور؛ على التجريبي تأكد أن الحساب موجود في قاعدة بيانات التجريب وليس الإنتاج فقط.'

/** تسجيل الدخول — يمرّر رسالة الخادم العربية بدل رسالة axios الافتراضية */
export async function login(username, password) {
  try {
    const r = await http.post('/auth.php?action=login', { username, password })
    return r.data
  } catch (e) {
    const status = e.response?.status
    const fromBody = parseApiErrorBody(e.response?.data)
    let msg = fromBody
    if (!msg && status === 401) msg = FALLBACK_401_AR
    if (!msg && /status code 401/i.test(String(e.message))) msg = FALLBACK_401_AR
    if (!msg) msg = e.message || 'تعذّر الاتصال بالخادم'
    if (/^Request failed with status code \d+$/i.test(msg) && status === 401) msg = FALLBACK_401_AR
    if (/^Request failed with status code \d+$/i.test(msg) && status) msg = `حدث خطأ (${status}). حاول مرة أخرى.`
    throw new Error(msg)
  }
}

/** للعرض في الواجهة إن وصل خطأ axios مباشرة دون تمرير عبر login() */
export function formatAuthError(err) {
  const m = err?.message || String(err)
  if (/Request failed with status code 401|status code 401/i.test(m)) return FALLBACK_401_AR
  return m
}

export const listUsers = () =>
  http.get('/auth.php?action=list_users').then(r => r.data)

export const addUser = (data) =>
  http.post('/auth.php?action=add_user', data).then(r => r.data)

export const updateUser = (data) =>
  http.post('/auth.php?action=update_user', data).then(r => r.data)

export const deleteUser = (id) =>
  http.post('/auth.php?action=delete_user', { id }).then(r => r.data)

// ─── Stores ──────────────────────────────────────────────────────────────────
export const getAllStores = () =>
  http.get('/all-stores.php').then(r => r.data)

/** بحث متاجر للـ Autocomplete (يُغذّى من cache بعد تشغيل all-stores.php) */
export const searchStores = (q, axiosConfig = {}) =>
  http.get('/search-stores.php', { params: { q }, ...axiosConfig }).then(r => r.data)

/** كبار التجار — مسار مستقل (جلب كامل orders-summary) */
export const getVipMerchants = () =>
  http.get('/vip-merchants.php').then(r => r.data)

/** ملخص الطرود لكل متجر ضمن نطاق تاريخ (يُستخدم لـ shipments_in_range) */
export const getOrdersSummaryRange = (from, to) =>
  http
    .get(`/orders-summary.php?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`)
    .then(r => r.data)

export const getStoreStates = () =>
  http.get('/store-actions.php?action=get_states').then(r => r.data)

export const setStoreStatus = (data) =>
  http.post('/store-actions.php?action=set_status', data).then(r => r.data)

// ─── Calls ───────────────────────────────────────────────────────────────────
export const logCall = (data) =>
  http.post('/store-actions.php?action=log_call', data).then(r => r.data)

export const getAllCallLogs = () =>
  http.get('/store-actions.php?action=get_all_calllogs').then(r => r.data)

export const getAllRecoveryCalls = () =>
  http.get('/store-actions.php?action=get_all_recovery_calls').then(r => r.data)

// ─── Audit ───────────────────────────────────────────────────────────────────
export const getAuditLog = (storeId) =>
  http.get(`/store-actions.php?action=get_audit_log&store_id=${storeId}`).then(r => r.data)

// ─── Bulk reset ──────────────────────────────────────────────────────────────
export const resetCategory = (storeIds, user, userRole, reason) =>
  http.post('/store-actions.php?action=reset_category', {
    store_ids: storeIds, user, user_role: userRole, reason,
  }).then(r => r.data)

// ─── Assignments ─────────────────────────────────────────────────────────────
export const getAssignments = () =>
  http.get('/store-actions.php?action=get_assignments').then(r => r.data)

export const assignStore = (data) =>
  http.post('/store-actions.php?action=assign_store', data).then(r => r.data)

// ─── استبيان رضا العميل (متاجر نشط) ───────────────────────────────────────
export const getSurveys = () =>
  http.get('/store-actions.php?action=get_surveys').then(r => r.data)

export const saveSurvey = (data) =>
  http.post('/store-actions.php?action=save_survey', data).then(r => r.data)

// ─── سير عمل المتاجر النشطة (طابور 50، عدم الرد) ───────────────────────────
/** queue: 'active' | 'inactive' — طابور المسؤول النشط أو موظف الاستعادة (50 متجر) */
export const getMyWorkflow = (username, extra = {}) =>
  http
    .get('/active-workflow.php', { params: { action: 'get_my_workflow', username, ...extra } })
    .then(r => r.data)

export const fillAllInactiveQueues = (data) =>
  http.post('/active-workflow.php?action=fill_all_inactive_queues', data).then(r => r.data)

export const markSurveyNoAnswer = (data) =>
  http.post('/active-workflow.php?action=mark_no_answer', data).then(r => r.data)

/** اتصال ناجح (تم) — طابور استعادة غير النشط: حذف من الطابور + عدّ يومي + تعبئة */
export const completeInactiveQueueSuccess = (data) =>
  http.post('/active-workflow.php?action=complete_inactive_success', data).then(r => r.data)

/** تعبئة متجر واحد من المجمع (يُحترم هدف 50 نجاحاً يومياً) */
export const fetchNextInactiveMerchant = (username) =>
  http
    .get('/active-workflow.php', { params: { action: 'fetch_next_inactive_merchant', username } })
    .then(r => r.data)

export const releaseAfterSurvey = (data) =>
  http.post('/active-workflow.php?action=release_after_survey', data).then(r => r.data)

export const fillAllActiveQueues = (data) =>
  http.post('/active-workflow.php?action=fill_all_queues', data).then(r => r.data)

export const listAllNoAnswerWorkflow = (userRole) =>
  http.get('/active-workflow.php', { params: { action: 'list_all_no_answer', user_role: userRole } }).then(r => r.data)

export const getAssignmentStatus = (storeId, username) =>
  http
    .get('/active-workflow.php', { params: { action: 'get_assignment_status', store_id: storeId, username } })
    .then(r => r.data)

/** لوحة تحليلات المدير — يتطلب user_role=executive */
export const getManagerAnalytics = (params) =>
  http.get('/manager-analytics.php', { params }).then(r => r.data)

/** بورصة الرضا اليوم — للداشبورد فقط (مسار خفيف، منفصل عن التحليلات) */
export const getDailyStaffSatisfaction = () =>
  http.get('/daily-staff-satisfaction.php', { params: { user_role: 'executive' } }).then(r => r.data)

/** التحقق السريع — استبيانات تهيئة المتاجر الجديدة اليوم (تفاصيل الصفوف) */
export const getQuickVerificationBourse = () =>
  http.get('/quick-verification-bourse.php', { params: { user_role: 'executive' } }).then(r => r.data)

/** جدول زمني + آخر ملاحظة مكالمة — للدرج التفصيلي (تجريبي) */
export const getQuickVerificationAuditTimeline = (storeId) =>
  http
    .get('/quick-verification-audit-timeline.php', {
      params: { user_role: 'executive', store_id: storeId },
    })
    .then(r => r.data)

/** هدف 50 اتصالاً — مسؤولو الاستعادة (للمدير التنفيذي) */
export const getInactiveRecoveryDailyStatus = () =>
  http
    .get('/inactive-daily-status.php', { params: { user_role: 'executive' } })
    .then(r => r.data)

// ─── مهام يومية (إخفاء «تم») ────────────────────────────────────────────────
export const getDailyTaskDismissals = (username, date) =>
  http
    .get('/daily-tasks.php', { params: { action: 'dismissals', username, date } })
    .then(r => r.data)

export const markDailyTaskDone = (data) =>
  http.post('/daily-tasks.php?action=mark_done', data).then(r => r.data)

// ─── Incubation ──────────────────────────────────────────────────────────────
export const getIncubationData = () =>
  http.get('/store-actions.php?action=get_incubation_data').then(r => r.data)

export const updateIncubation = (data) =>
  http.post('/store-actions.php?action=update_incubation', data).then(r => r.data)

// ─── Points & Gamification ────────────────────────────────────────────────────
export const getMyStats = (username) =>
  http.get(`/store-actions.php?action=get_my_stats&username=${encodeURIComponent(username)}`).then(r => r.data)

export const awardBonus = (data) =>
  http.post('/store-actions.php?action=award_bonus', data).then(r => r.data)
