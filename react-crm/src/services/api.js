import axios from 'axios'

const BASE = '/api-php'

const http = axios.create({ baseURL: BASE })


// ─── Auth ────────────────────────────────────────────────────────────────────
export const login = (username, password) =>
  http.post('/auth.php?action=login', { username, password }).then(r => r.data)

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
