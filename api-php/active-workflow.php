<?php
/**
 * سير عمل المتاجر النشطة: 50 بلا مكالمة اليوم، عدم الرد، منجز بعد الاستبيان، تعبئة من المجمع.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';
require_once __DIR__ . '/daily-quota-lib.php';

/** عمود outcome في call_logs (قواعد قديمة) */
function wf_ensure_call_logs_outcome(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec('ALTER TABLE call_logs ADD COLUMN outcome VARCHAR(32) NULL DEFAULT NULL AFTER note');
    } catch (Throwable $e) {
    }
    $done = true;
}

/**
 * يدمج هاتف/تسجيل/شحن من cache/stores_search_lite.json (يُحدَّث عند تشغيل all-stores.php)
 * حتى لا تظهر مهام الطابور بصفوف فارغة عندما لا يكون المتجر ضمن active_shipping في الواجهة.
 *
 * @param list<array<string,mixed>> $tasks
 * @return list<array<string,mixed>>
 */
function wf_enrich_workflow_tasks_from_lite(array $tasks): array {
    static $liteById = null;
    if ($liteById === null) {
        $liteById = [];
        $path = __DIR__ . '/cache/stores_search_lite.json';
        if (is_readable($path)) {
            $raw = file_get_contents($path);
            $list = json_decode($raw !== false ? $raw : '', true);
            if (is_array($list)) {
                foreach ($list as $row) {
                    if (!is_array($row) || !isset($row['id'])) {
                        continue;
                    }
                    $id = (string) (int) $row['id'];
                    if ($id === '0') {
                        continue;
                    }
                    $liteById[$id] = $row;
                }
            }
        }
    }
    if ($liteById === []) {
        return $tasks;
    }
    foreach ($tasks as &$t) {
        if (!is_array($t)) {
            continue;
        }
        $rawSid = $t['store_id'] ?? '';
        $sid = (string) (int) preg_replace('/\D+/', '', (string) $rawSid);
        if ($sid === '0' || $sid === '' || !isset($liteById[$sid])) {
            continue;
        }
        $L = $liteById[$sid];
        $t['phone'] = isset($L['phone']) ? (string) $L['phone'] : '';
        $t['registered_at'] = isset($L['registered_at']) ? (string) $L['registered_at'] : '';
        $t['last_shipment_date'] = isset($L['last_shipment_date']) ? (string) $L['last_shipment_date'] : '';
        $t['total_shipments'] = (int) ($L['total_shipments'] ?? 0);
    }
    unset($t);

    return $tasks;
}

$pdo = getDB();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

ensure_workflow_schema($pdo);

// ========== GET: حصة يومية (50 متجر) ==========
if ($action === 'get_daily_quota') {
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400);
    }
    nawras_ensure_daily_quota_schema($pdo);
    jsonResponse([
        'success' => true,
        'daily_quota' => getDailyProgress($pdo, $username),
    ]);
}

// ========== GET: طابوري + عدم الرد ==========
if ($action === 'get_my_workflow') {
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400);
    }
    nawras_ensure_daily_quota_schema($pdo);
    $dailyQuota = getDailyProgress($pdo, $username);
    $queue = trim((string) ($_GET['queue'] ?? 'active'));
    $listType = trim((string) ($_GET['type'] ?? ''));
    if ($queue === 'inactive') {
        fill_inactive_slots_for_user($pdo, $username, $username, null);
        $st = $pdo->prepare("
            SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, assignment_queue
            FROM store_assignments
            WHERE assigned_to = ? AND assignment_queue = 'inactive' AND workflow_status IN ('active', 'no_answer')
            ORDER BY workflow_status ASC, assigned_at ASC
        ");
        $st->execute([$username]);
        $rows = $st->fetchAll(PDO::FETCH_ASSOC);
        $active = [];
        $noAnswer = [];
        foreach ($rows as $r) {
            if (($r['workflow_status'] ?? 'active') === 'no_answer') {
                $noAnswer[] = $r;
            } else {
                $active[] = $r;
            }
        }
        $active = wf_enrich_workflow_tasks_from_lite($active);
        $noAnswer = wf_enrich_workflow_tasks_from_lite($noAnswer);
        $active = array_values(array_filter($active, static function (array $r): bool {
            return wf_inactive_queue_parcel_eligible($r);
        }));
        $noAnswer = array_values(array_filter($noAnswer, static function (array $r): bool {
            return wf_inactive_queue_parcel_eligible($r);
        }));
        $active = wf_sort_inactive_manager_task_rows($active);
        $noAnswer = wf_sort_inactive_manager_task_rows($noAnswer);
        $inactiveDailySuccess = get_inactive_daily_success_count($pdo, $username);
        /** إخفاء الطابور عند 50 «تم التواصل» يومياً — لا يعتمد على حصة الـ50 معالجة العامة. */
        if ($inactiveDailySuccess >= INACTIVE_DAILY_SUCCESS_TARGET) {
            $active = [];
            $noAnswer = [];
        }
        /** متابعة بعد إكمال المهمة: تعيينات منجزة (تم التواصل / لم يرد) — نفس مصدر الواجهة دون ملف PHP إضافي */
        $stFollow = $pdo->prepare("
            SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, workflow_updated_at
            FROM store_assignments
            WHERE assigned_to = ? AND assignment_queue = 'inactive'
            AND workflow_status IN ('completed', 'no_answer')
            ORDER BY workflow_updated_at DESC, assigned_at DESC
        ");
        $stFollow->execute([$username]);
        $followRows = $stFollow->fetchAll(PDO::FETCH_ASSOC);
        $inactive_followup_contacted = [];
        $inactive_followup_no_answer = [];
        foreach ($followRows as $fr) {
            if (($fr['workflow_status'] ?? '') === 'completed') {
                $inactive_followup_contacted[] = $fr;
            } else {
                $inactive_followup_no_answer[] = $fr;
            }
        }
        $inactive_followup_contacted = wf_enrich_workflow_tasks_from_lite($inactive_followup_contacted);
        $inactive_followup_no_answer = wf_enrich_workflow_tasks_from_lite($inactive_followup_no_answer);
        jsonResponse([
            'success' => true,
            'queue' => 'inactive',
            'target' => INACTIVE_QUEUE_TARGET,
            'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_successful_contacts' => $inactiveDailySuccess,
            'daily_target_reached' => $inactiveDailySuccess >= INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_quota' => $dailyQuota,
            'cooldown_days' => SURVEY_COOLDOWN_DAYS,
            'active_tasks' => $active,
            'no_answer_tasks' => $noAnswer,
            'active_count' => count($active),
            'no_answer_count' => count($noAnswer),
            'inactive_followup_contacted' => $inactive_followup_contacted,
            'inactive_followup_no_answer' => $inactive_followup_no_answer,
            'inactive_followup_contacted_count' => count($inactive_followup_contacted),
            'inactive_followup_no_answer_count' => count($inactive_followup_no_answer),
        ]);
    }
    require_once __DIR__ . '/workflow-retroactive-lib.php';
    workflow_retroactive_complete_from_csat_and_answered($pdo, 80);

    fill_slots_for_user($pdo, $username, $username, null);

    /** تبويب «تأخيرات المكالمات»: ?type=delayed — نوافذ احتضان متجاوزة أو تعيين متأخر، حتى 50، مرتبة بالأشد تأخيراً */
    if ($listType === 'delayed') {
        require_once __DIR__ . '/incubation-delay-lib.php';
        $delayed = wf_build_active_manager_delayed_task_list($pdo, $username);
        $delayed = wf_enrich_workflow_tasks_from_lite($delayed);
        if ($dailyQuota['quota_reached']) {
            $delayed = [];
        }
        $dailyActive = get_active_daily_success_count($pdo, $username);
        jsonResponse([
            'success' => true,
            'queue' => 'active',
            'type' => 'delayed',
            'target' => ACTIVE_QUEUE_TARGET,
            'delayed_tasks' => $delayed,
            'delayed_count' => count($delayed),
            'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
            'daily_successful_contacts' => $dailyActive,
            'daily_target_reached' => $dailyActive >= ACTIVE_DAILY_SUCCESS_TARGET,
            'daily_quota' => $dailyQuota,
            'cooldown_days' => SURVEY_COOLDOWN_DAYS,
        ]);
    }

    // المتابعة الدورية: حتى 50 — تعيين نشط ولم تُسجَّل له أي مكالمة اليوم
    $stActive = $pdo->prepare("
        SELECT
            sa.store_id,
            sa.store_name,
            sa.assigned_to,
            sa.assigned_at,
            sa.workflow_status,
            sa.assignment_queue,
            (
                SELECT MAX(cl.created_at)
                FROM call_logs cl
                WHERE CAST(cl.store_id AS CHAR) = CAST(sa.store_id AS CHAR)
                  AND cl.performed_by = sa.assigned_to
            ) AS last_contact_at
        FROM store_assignments sa
        WHERE sa.assigned_to = ?
          AND sa.assignment_queue = 'active'
          AND sa.workflow_status IN ('active','no_answer')
        ORDER BY
            (last_contact_at IS NULL) DESC,
            last_contact_at ASC,
            sa.assigned_at ASC
        LIMIT " . (int) ACTIVE_QUEUE_TARGET . "
    ");
    $stActive->execute([$username]);
    $active = $stActive->fetchAll(PDO::FETCH_ASSOC);
    $vipThreshold = (int) ACTIVE_VIP_SHIPMENTS_THRESHOLD;
    $active = wf_enrich_workflow_tasks_from_lite($active);
    $active = array_values(array_filter($active, static function (array $row) use ($vipThreshold): bool {
        return ((int) ($row['total_shipments'] ?? 0)) < $vipThreshold;
    }));

    /**
     * «لم يرد» = مجموعة فرعية من نفس القائمة الموحّدة (100 متجر) — لا استعلام مستقل ولا فلتر اليوم.
     * الواجهة تستطيع عرضها كتبويب جانبي دون إخفاء أي متجر من العهدة.
     */
    $noAnswer = array_values(array_filter($active, static function (array $row): bool {
        return ($row['workflow_status'] ?? '') === 'no_answer';
    }));

    /**
     * تثبيت القائمة: حصة اليوم لا تُفرغ القائمة. المتجر يبقى ظاهراً حتى يكتمل استبيانه أو يصل 301 شحنة.
     * عداد الحصة يبقى للعرض فقط في daily_quota.
     */

    $stCompleted = $pdo->prepare("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, assignment_queue, workflow_updated_at
        FROM store_assignments
        WHERE assigned_to = ? AND assignment_queue = 'active' AND workflow_status = 'completed'
        AND DATE(COALESCE(workflow_updated_at, assigned_at)) = CURDATE()
        ORDER BY workflow_updated_at DESC
        LIMIT 200
    ");
    $stCompleted->execute([$username]);
    $completedTasks = $stCompleted->fetchAll(PDO::FETCH_ASSOC);

    /** كل التعيينات (يشمل active بمكالمة اليوم بانتظار الاستبيان — لا يُصفّى كقائمة المتابعة الدورية) */
    $stAllAssigned = $pdo->prepare("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, assignment_queue, workflow_updated_at
        FROM store_assignments
        WHERE assigned_to = ? AND assignment_queue = 'active'
        ORDER BY
            CASE workflow_status
                WHEN 'active' THEN 0
                WHEN 'no_answer' THEN 1
                WHEN 'completed' THEN 2
                ELSE 3
            END,
            assigned_at ASC
        LIMIT 500
    ");
    $stAllAssigned->execute([$username]);
    $allAssignedTasks = $stAllAssigned->fetchAll(PDO::FETCH_ASSOC);

    $dailyActive = get_active_daily_success_count($pdo, $username);
    jsonResponse([
        'success' => true,
        'queue' => 'active',
        'target' => ACTIVE_QUEUE_TARGET,
        'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
        'daily_successful_contacts' => $dailyActive,
        'daily_target_reached' => $dailyActive >= ACTIVE_DAILY_SUCCESS_TARGET,
        'daily_quota' => $dailyQuota,
        'cooldown_days' => SURVEY_COOLDOWN_DAYS,
        'active_tasks' => $active,
        'no_answer_tasks' => $noAnswer,
        'active_count' => count($active),
        'no_answer_count' => count($noAnswer),
        'completed_tasks' => $completedTasks,
        'completed_count' => count($completedTasks),
        'all_assigned_tasks' => $allAssignedTasks,
        'all_assigned_count' => count($allAssignedTasks),
        'productivity_note' => 'daily_successful_contacts = تعيينات مكتملة اليوم (تم الرد + استبيان).',
    ]);
}

// ========== POST: عدم الرد — نقل للحالة + إحلال فوري من المجمع ==========
elseif ($action === 'mark_no_answer') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    $queue = trim((string) ($input['queue'] ?? 'active'));
    if (!in_array($queue, ['active', 'inactive'], true)) {
        $queue = 'active';
    }
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    nawras_ensure_daily_quota_schema($pdo);
    /** «لم يرد» لا يُحتسب ضمن حصة الـ50 — لا نمنع التسجيل عند بلوغ الحد */
    $sid = (string) $storeId;
    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'no_answer', workflow_updated_at = NOW(), assigned_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND workflow_status = 'active' AND assignment_queue = ?
    ");
    $upd->execute([$sid, $username, $queue]);
    if ($upd->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين نشط لهذا المتجر أو تمت معالجته مسبقاً.'], 400);
    }
    $roleLabel = $queue === 'inactive' ? 'inactive_manager' : 'active_manager';
    $detail = $queue === 'inactive'
        ? 'طابور الاستعادة — عدم رد — يُستبدل من المجمع'
        : 'نُقل المتجر إلى قائمة المتابعة (عدم رد)';
    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([$storeId, $input['store_name'] ?? '', $queue === 'inactive' ? 'استعادة — عدم رد' : 'استبيان — عدم الرد', $detail, $username, $roleLabel]);

    if ($queue === 'active') {
        wf_ensure_call_logs_outcome($pdo);
        $roleStmt = $pdo->prepare('SELECT role FROM users WHERE username = ? LIMIT 1');
        $roleStmt->execute([$username]);
        $performedRole = (string) ($roleStmt->fetchColumn() ?: 'active_manager');
        $sn = trim((string) ($input['store_name'] ?? ''));
        $pdo->prepare('
            INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ')->execute([
            $storeId,
            $sn,
            'periodic_followup',
            'متابعة دورية — لم يرد (يُصنَّف كـ لم يتم الوصول للمتجر)',
            'no_answer',
            $username,
            $performedRole,
        ]);
        workflow_mark_active_store_no_answer_unreachable($pdo, $storeId, $sn, $username);
    }

    /** لا تسجيل في employee_daily_processed_stores لـ«لم يرد» — الحصة للاستبيان/الإكمال فقط */

    $added = $queue === 'inactive'
        ? fill_inactive_slots_for_user($pdo, $username, $username, null)
        : fill_slots_for_user($pdo, $username, $username, null);
    $payload = ['success' => true, 'replacement_added' => $added, 'queue' => $queue];
    if ($queue === 'inactive') {
        $payload['daily_successful_contacts'] = get_inactive_daily_success_count($pdo, $username);
        $payload['daily_target_reached'] = $payload['daily_successful_contacts'] >= INACTIVE_DAILY_SUCCESS_TARGET;
        if ($added > 0) {
            $payload['notify_ar'] = 'تم نقل المتجر إلى «لم يرد». تمت إضافة متجر جديد من المجمع. «لم يرد» لا يُحتسب ضمن حصة الـ50.';
        } else {
            $payload['notify_ar'] = 'تم نقل المتجر إلى «لم يرد». لا يُحتسب ضمن حصة الـ50. '
                . (getDailyProgress($pdo, $username)['quota_reached']
                    ? 'تعذّر إضافة بديل (الحصة مكتملة أو لا يوجد متجر في طابور الاستعادة).'
                    : 'لم يُعثَر على متجر بديل في المجمع.');
        }
    } elseif ($queue === 'active') {
        $payload['daily_successful_contacts'] = get_active_daily_success_count($pdo, $username);
        $payload['active_daily_target'] = ACTIVE_DAILY_SUCCESS_TARGET;
        $payload['daily_target_reached'] = $payload['daily_successful_contacts'] >= ACTIVE_DAILY_SUCCESS_TARGET;
        if ($added > 0) {
            $payload['notify_ar'] = 'تم تسجيل «لم يرد». تمت إضافة متجر جديد إلى متابعتك من المتاجر غير المعيّنة (لا يُحتسب «لم يرد» ضمن حصة الـ50).';
        } else {
            $payload['notify_ar'] = 'تم تسجيل «لم يرد» — يظهر المتجر في خانة «لم يرد». لا يُحتسب ضمن حصة الـ50. '
                . (getDailyProgress($pdo, $username)['quota_reached']
                    ? 'تعذّر إضافة بديل تلقائياً (الحصة اليومية مكتملة أو لا يوجد متجر متاح في المجمع).'
                    : 'لم يُعثَر على متجر نشط آخر غير معيّن لإضافته.');
        }
    }
    $payload['daily_quota'] = getDailyProgress($pdo, $username);
    jsonResponse($payload);
}

// ========== POST: متابعة دورية — تم التواصل (معطّل: الإكمال فقط عبر مكالمة + استبيان) ==========
elseif ($action === 'mark_active_contacted') {
    jsonResponse([
        'success' => false,
        'error' => 'لم يعد هذا المسار مستخدماً. أكمل المتجر عبر «حفظ المكالمة» مع «تم الرد» ثم استبيان الرضا.',
    ], 400);
}

// ========== POST: اتصال ناجح (تم) — إزالة من الطابور النشط + عدّ اليوم + تعبئة ==========
elseif ($action === 'complete_inactive_success') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    /** طابور الاستعادة: الحدّ عبر INACTIVE_DAILY_SUCCESS_TARGET وليس حصّة الـ50 العامة (مثل مسار «لم يرد»). */
    nawras_ensure_daily_quota_schema($pdo);
    ensure_inactive_daily_stats_schema($pdo);
    $sid = (string) $storeId;
    $upd = $pdo->prepare("
        UPDATE store_assignments SET workflow_status = 'completed'
        WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' AND workflow_status IN ('active','no_answer')
    ");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين نشط لهذا المتجر في طابور الاستعادة.'], 400);
    }
    register_daily_store_processed($pdo, $username, $storeId, 'recovery_success');
    increment_inactive_daily_success($pdo, $username);
    $filled = fill_inactive_slots_for_user($pdo, $username, $username, 1);
    $count = get_inactive_daily_success_count($pdo, $username);
    $reached = $count >= INACTIVE_DAILY_SUCCESS_TARGET;
    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([
        $storeId,
        $input['store_name'] ?? '',
        'استعادة — اتصال ناجح (يومي)',
        'عدّ اتصال ناجح نحو هدف اليوم (' . $count . '/' . INACTIVE_DAILY_SUCCESS_TARGET . '). تعبئة: +' . (int) $filled,
        $username,
        'inactive_manager',
    ]);
    jsonResponse([
        'success' => true,
        'replacement_added' => $filled,
        'daily_successful_contacts' => $count,
        'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
        'daily_target_reached' => $reached,
        'goal_just_met' => $count === INACTIVE_DAILY_SUCCESS_TARGET,
        'daily_quota' => getDailyProgress($pdo, $username),
    ]);
}

// ========== POST: متابعة «المتاجر غير النشطة المنجزة» — تم التواصل + استبيان (يُستدعى بعد log_call) ==========
elseif ($action === 'inactive_followup_success') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    $storeName = trim((string) ($input['store_name'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    $sid = (string) $storeId;
    $chk = $pdo->prepare("SELECT workflow_status FROM store_assignments WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' LIMIT 1");
    $chk->execute([$sid, $username]);
    $ws = (string) ($chk->fetchColumn() ?: '');
    if ($ws === '') {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين غير نشط لهذا المتجر.'], 400);
    }

    if ($ws === 'active' || $ws === 'no_answer') {
        nawras_ensure_daily_quota_schema($pdo);
        ensure_inactive_daily_stats_schema($pdo);
        $upd = $pdo->prepare("
            UPDATE store_assignments SET workflow_status = 'completed', workflow_updated_at = NOW()
            WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' AND workflow_status IN ('active','no_answer')
        ");
        $upd->execute([$sid, $username]);
        if ($upd->rowCount() === 0) {
            jsonResponse(['success' => false, 'error' => 'تعذّر تحديث التعيين.'], 400);
        }
        register_daily_store_processed($pdo, $username, $storeId, 'inactive_followup');
        increment_inactive_daily_success($pdo, $username);
        $filled = fill_inactive_slots_for_user($pdo, $username, $username, 1);
        $count = get_inactive_daily_success_count($pdo, $username);
        $reached = $count >= INACTIVE_DAILY_SUCCESS_TARGET;
        $pdo->prepare("
            INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
            VALUES (?, ?, ?, ?, ?, ?)
        ")->execute([
            $storeId,
            $storeName,
            'متابعة غير نشط — تم التواصل',
            'تسجيل ناجح نحو هدف اليوم (' . $count . '/' . INACTIVE_DAILY_SUCCESS_TARGET . ') بعد مكالمة واستبيان. تعبئة: +' . (int) $filled,
            $username,
            'inactive_manager',
        ]);
        jsonResponse([
            'success' => true,
            'mode' => 'first_completion',
            'replacement_added' => $filled,
            'daily_successful_contacts' => $count,
            'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_target_reached' => $reached,
            'goal_just_met' => $count === INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_quota' => getDailyProgress($pdo, $username),
        ]);
    }

    if ($ws === 'completed') {
        nawras_ensure_daily_quota_schema($pdo);
        ensure_inactive_daily_stats_schema($pdo);
        register_daily_store_processed($pdo, $username, $storeId, 'inactive_followup_repeat');
        increment_inactive_daily_success($pdo, $username);
        $pdo->prepare("
            UPDATE store_assignments SET workflow_updated_at = NOW()
            WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' AND workflow_status = 'completed'
        ")->execute([$sid, $username]);
        $count = get_inactive_daily_success_count($pdo, $username);
        $reached = $count >= INACTIVE_DAILY_SUCCESS_TARGET;
        $pdo->prepare("
            INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
            VALUES (?, ?, ?, ?, ?, ?)
        ")->execute([
            $storeId,
            $storeName,
            'متابعة غير نشط — تم التواصل (منجزة)',
            'إتمام متابعة دورية نحو هدف اليوم (' . $count . '/' . INACTIVE_DAILY_SUCCESS_TARGET . ') — السجل يشمل المكالمة المحفوظة مسبقاً.',
            $username,
            'inactive_manager',
        ]);
        jsonResponse([
            'success' => true,
            'mode' => 'repeat_completed',
            'daily_successful_contacts' => $count,
            'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_target_reached' => $reached,
            'goal_just_met' => $count === INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_quota' => getDailyProgress($pdo, $username),
        ]);
    }

    jsonResponse(['success' => false, 'error' => 'حالة التعيين لا تسمح بتسجيل «تم التواصل» من المتابعة.'], 400);
}

// ========== POST: من تبويب «تم التواصل» — تحويل إلى «لم يرد» (لا يُحتسب نحو الـ50) ==========
elseif ($action === 'inactive_followup_to_no_answer') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    $storeName = trim((string) ($input['store_name'] ?? ''));
    $note = trim((string) ($input['note'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    wf_ensure_call_logs_outcome($pdo);
    $sid = (string) $storeId;
    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'no_answer', workflow_updated_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' AND workflow_status = 'completed'
    ");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين بحالة «تم التواصل» لهذا المتجر أو تمت معالجته.'], 400);
    }
    $performedBy = trim((string) ($input['performed_by'] ?? $username));
    $performedRole = trim((string) ($input['performed_role'] ?? 'inactive_manager'));
    $pdo->prepare("
        INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role)
        VALUES (?, ?, 'general', ?, 'no_answer', ?, ?)
    ")->execute([$storeId, $storeName, $note !== '' ? $note : 'متابعة منجزة — تحويل إلى لم يرد', $performedBy, $performedRole]);
    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([
        $storeId,
        $storeName,
        'متابعة غير نشط — تحويل إلى لم يرد',
        'نقل من تبويب تم التواصل إلى لم يرد (بدون احتساب نحو الـ50).',
        $username,
        'inactive_manager',
    ]);
    jsonResponse(['success' => true]);
}

// ========== POST: تبويب «لم يرد» — تسجيل لم يرد إضافي (لا يُحتسب نحو الـ50) ==========
elseif ($action === 'inactive_followup_no_answer_log') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    $storeName = trim((string) ($input['store_name'] ?? ''));
    $note = trim((string) ($input['note'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    wf_ensure_call_logs_outcome($pdo);
    $sid = (string) $storeId;
    $chk = $pdo->prepare("SELECT workflow_status FROM store_assignments WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive' LIMIT 1");
    $chk->execute([$sid, $username]);
    $ws = (string) ($chk->fetchColumn() ?: '');
    if ($ws !== 'no_answer') {
        jsonResponse(['success' => false, 'error' => 'المتجر ليس في حالة «لم يرد» ضمن المتابعة.'], 400);
    }
    $pdo->prepare("UPDATE store_assignments SET workflow_updated_at = NOW() WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'inactive'")->execute([$sid, $username]);
    $performedBy = trim((string) ($input['performed_by'] ?? $username));
    $performedRole = trim((string) ($input['performed_role'] ?? 'inactive_manager'));
    $pdo->prepare("
        INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role)
        VALUES (?, ?, 'general', ?, 'no_answer', ?, ?)
    ")->execute([$storeId, $storeName, $note !== '' ? $note : 'متابعة منجزة — تسجيل لم يرد', $performedBy, $performedRole]);
    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([
        $storeId,
        $storeName,
        'متابعة غير نشط — لم يرد (منجزة)',
        'تسجيل لم يرد من قائمة المتابعة — بدون احتساب نحو الـ50.',
        $username,
        'inactive_manager',
    ]);
    jsonResponse(['success' => true]);
}

// ========== POST: بعد إكمال الاستبيان — إتمام المتجر + إحلال فوري ==========
elseif ($action === 'release_after_survey') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    $sid = (string) $storeId;
    $upd = $pdo->prepare("UPDATE store_assignments SET workflow_status = 'completed' WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'active' AND workflow_status IN ('active','no_answer')");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        $chk = $pdo->prepare("SELECT workflow_status FROM store_assignments WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'active' LIMIT 1");
        $chk->execute([$sid, $username]);
        $ws = (string) ($chk->fetchColumn() ?: '');
        if ($ws === 'completed') {
            $count = get_active_daily_success_count($pdo, $username);
            jsonResponse([
                'success' => true,
                'filled' => 0,
                'daily_successful_contacts' => $count,
                'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
                'daily_target_reached' => $count >= ACTIVE_DAILY_SUCCESS_TARGET,
                'goal_just_met' => false,
                'already_completed' => true,
            ]);
        }
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين لهذا المتجر.'], 400);
    }
    fill_slots_for_user($pdo, $username, $username, null);
    $count = get_active_daily_success_count($pdo, $username);
    $sn = trim((string) ($input['store_name'] ?? ''));
    workflow_mark_active_store_contacted_completed($pdo, $storeId, $sn, $username);
    jsonResponse([
        'success' => true,
        'filled' => 0,
        'daily_successful_contacts' => $count,
        'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
        'daily_target_reached' => $count >= ACTIVE_DAILY_SUCCESS_TARGET,
        'goal_just_met' => $count === ACTIVE_DAILY_SUCCESS_TARGET,
    ]);
}

// ========== POST: تعبئة كل مسؤولي المتاجر النشطة (المدير التنفيذي) ==========
elseif ($action === 'fill_all_queues') {
    $role = trim((string) ($input['user_role'] ?? ''));
    if ($role !== 'executive') {
        jsonResponse(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], 403);
    }
    $by = trim((string) ($input['assigned_by'] ?? 'system'));
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'active_manager'");
    $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $report = [];
    foreach ($users as $u) {
        $n = fill_slots_for_user($pdo, $u, $by, null);
        $report[$u] = $n;
    }
    jsonResponse([
        'success' => true,
        'filled_per_user' => $report,
        'note' => 'تعيين المتابعة النشطة يدوي؛ لا تُضاف متاجر تلقائياً من المجمع.',
    ]);
}

elseif ($action === 'fill_all_inactive_queues') {
    $role = trim((string) ($input['user_role'] ?? ''));
    if ($role !== 'executive') {
        jsonResponse(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], 403);
    }
    $by = trim((string) ($input['assigned_by'] ?? 'system'));
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
    $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $report = [];
    foreach ($users as $u) {
        $n = fill_inactive_slots_for_user($pdo, $u, $by, null);
        $report[$u] = $n;
    }
    jsonResponse(['success' => true, 'filled_inactive_per_user' => $report]);
}

// ========== GET: كل متاجر عدم الرد (للمدير) ==========
elseif ($action === 'list_all_no_answer') {
    $role = trim((string) ($_GET['user_role'] ?? ''));
    if ($role !== 'executive') {
        jsonResponse(['success' => false, 'error' => 'غير مصرّح'], 403);
    }
    $st = $pdo->query("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_updated_at
        FROM store_assignments
        WHERE workflow_status = 'no_answer' AND assignment_queue = 'active'
        ORDER BY workflow_updated_at DESC
    ");
    jsonResponse(['success' => true, 'data' => $st->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== GET: حالة التعيين لمتجر + مستخدم (للتحقق من تجميد عدم الرد) ==========
elseif ($action === 'get_assignment_status') {
    $storeId = (int) ($_GET['store_id'] ?? 0);
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => true, 'assignment' => null]);
    }
    $sid = (string) $storeId;
    $st = $pdo->prepare('SELECT workflow_status, assigned_to FROM store_assignments WHERE store_id = ? AND assigned_to = ?');
    $st->execute([$sid, $username]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    jsonResponse(['success' => true, 'assignment' => $row ?: null]);
}

// ========== GET: تعبئة متجر واحد من المجمع (fetchNextMerchant — يدوي/تكميلي) ==========
elseif ($action === 'fetch_next_inactive_merchant') {
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400);
    }
    ensure_inactive_daily_stats_schema($pdo);
    $added = fill_inactive_slots_for_user($pdo, $username, $username, 1);
    $dc = get_inactive_daily_success_count($pdo, $username);
    jsonResponse([
        'success' => true,
        'added' => $added,
        'daily_successful_contacts' => $dc,
        'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
        'daily_target_reached' => $dc >= INACTIVE_DAILY_SUCCESS_TARGET,
    ]);
}

else {
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
