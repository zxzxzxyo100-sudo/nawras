<?php
/**
 * سير عمل المتاجر النشطة: طابور 50، عدم الرد، تعبئة من المجمع (استبيان +30 يوم)
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

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

$pdo = getDB();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

ensure_workflow_schema($pdo);

// ========== GET: طابوري + عدم الرد ==========
if ($action === 'get_my_workflow') {
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400);
    }
    $queue = trim((string) ($_GET['queue'] ?? 'active'));
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
        $dailySuccess = get_inactive_daily_success_count($pdo, $username);
        jsonResponse([
            'success' => true,
            'queue' => 'inactive',
            'target' => INACTIVE_QUEUE_TARGET,
            'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET,
            'daily_successful_contacts' => $dailySuccess,
            'daily_target_reached' => $dailySuccess >= INACTIVE_DAILY_SUCCESS_TARGET,
            'cooldown_days' => SURVEY_COOLDOWN_DAYS,
            'active_tasks' => $active,
            'no_answer_tasks' => $noAnswer,
            'active_count' => count($active),
            'no_answer_count' => count($noAnswer),
        ]);
    }
    reset_active_assignments_as_fresh_once($pdo, $username);

    // تحويل أي تعيين نشط إلى «مكتمل» إذا اتّصل به هذا المستخدم بنجاح خلال آخر 60 يومًا
    $pdo->prepare("
        UPDATE store_assignments sa
        INNER JOIN call_logs cl ON CAST(sa.store_id AS CHAR) = CAST(cl.store_id AS CHAR)
        SET sa.workflow_status = 'completed',
            sa.workflow_updated_at = NOW(),
            sa.assigned_by = 'system_restore'
        WHERE sa.assigned_to = ?
        AND sa.assignment_queue = 'active'
        AND sa.workflow_status = 'active'
        AND cl.performed_by = ?
        AND cl.outcome = 'answered'
        AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
    ")->execute([$username, $username]);

    // إعادة إسناد المتاجر التي حُذف تعيينها لكن سُجّل لها «تم الرد» خلال آخر 60 يومًا
    $pdo->prepare("
        INSERT INTO store_assignments
            (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue, assigned_at, workflow_updated_at)
        SELECT DISTINCT
            cl.store_id,
            COALESCE(ss.store_name, ''),
            ?,
            'system_restore',
            '',
            'completed',
            'active',
            NOW(),
            NOW()
        FROM call_logs cl
        LEFT JOIN store_states ss ON CAST(ss.store_id AS CHAR) = CAST(cl.store_id AS CHAR)
        WHERE cl.performed_by = ?
        AND cl.outcome = 'answered'
        AND cl.created_at >= DATE_SUB(NOW(), INTERVAL 60 DAY)
        AND CAST(cl.store_id AS CHAR) NOT IN (
            SELECT store_id FROM store_assignments
        )
        ON DUPLICATE KEY UPDATE
            workflow_status = 'completed',
            workflow_updated_at = NOW(),
            assigned_by = 'system_restore'
    ")->execute([$username, $username]);

    fill_slots_for_user($pdo, $username, $username, null);

    // طابور المتابعة الدورية: حتى 50 تعيين نشط (يشمل متأخّرات أيام سابقة) — المتأخّر أولاً ثم الأقدم
    $stActive = $pdo->prepare("
        SELECT
            sa.store_id,
            sa.store_name,
            sa.assigned_to,
            sa.assigned_at,
            sa.workflow_status,
            sa.assignment_queue,
            CASE
                WHEN DATE(sa.assigned_at) < CURDATE() THEN 1
                WHEN EXISTS (
                    SELECT 1 FROM call_logs cl
                    WHERE CAST(cl.store_id AS CHAR) = CAST(sa.store_id AS CHAR)
                    AND cl.performed_by = ?
                    AND DATE(cl.created_at) = CURDATE()
                    AND (cl.outcome IS NULL OR cl.outcome <> 'answered')
                ) THEN 1
                ELSE 0
            END AS is_delayed
        FROM store_assignments sa
        WHERE sa.assigned_to = ? AND sa.assignment_queue = 'active' AND sa.workflow_status = 'active'
        ORDER BY is_delayed DESC, sa.assigned_at ASC
        LIMIT " . (int) ACTIVE_QUEUE_TARGET . "
    ");
    $stActive->execute([$username, $username]);
    $active = $stActive->fetchAll(PDO::FETCH_ASSOC);

    $stNoAns = $pdo->prepare("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, assignment_queue
        FROM store_assignments
        WHERE assigned_to = ? AND assignment_queue = 'active' AND workflow_status = 'no_answer'
        ORDER BY assigned_at ASC
    ");
    $stNoAns->execute([$username]);
    $noAnswer = $stNoAns->fetchAll(PDO::FETCH_ASSOC);

    ensure_active_daily_stats_schema($pdo);
    $dailyActive = get_active_daily_success_count($pdo, $username);
    jsonResponse([
        'success' => true,
        'queue' => 'active',
        'target' => ACTIVE_QUEUE_TARGET,
        'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
        'daily_successful_contacts' => $dailyActive,
        'daily_target_reached' => $dailyActive >= ACTIVE_DAILY_SUCCESS_TARGET,
        'cooldown_days' => SURVEY_COOLDOWN_DAYS,
        'active_tasks' => $active,
        'no_answer_tasks' => $noAnswer,
        'active_count' => count($active),
        'no_answer_count' => count($noAnswer),
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

    $added = $queue === 'inactive'
        ? fill_inactive_slots_for_user($pdo, $username, $username, null)
        : fill_slots_for_user($pdo, $username, $username, null);
    $payload = ['success' => true, 'replacement_added' => $added, 'queue' => $queue];
    if ($queue === 'inactive') {
        $payload['daily_successful_contacts'] = get_inactive_daily_success_count($pdo, $username);
        $payload['daily_target_reached'] = $payload['daily_successful_contacts'] >= INACTIVE_DAILY_SUCCESS_TARGET;
        if ($added > 0) {
            $payload['notify_ar'] = 'تم نقل المتجر إلى «لم يرد». تمت إضافة متجر جديد إلى قائمتك.';
        }
    } elseif ($queue === 'active') {
        ensure_active_daily_stats_schema($pdo);
        $payload['daily_successful_contacts'] = get_active_daily_success_count($pdo, $username);
        $payload['active_daily_target'] = ACTIVE_DAILY_SUCCESS_TARGET;
        $payload['daily_target_reached'] = $payload['daily_successful_contacts'] >= ACTIVE_DAILY_SUCCESS_TARGET;
        if ($added > 0) {
            $payload['notify_ar'] = 'تم نقل المتجر إلى «لم يرد». تمت إضافة متجر نشط آخر إلى قائمتك.';
        }
    }
    jsonResponse($payload);
}

// ========== POST: متابعة دورية — تم التواصل (إكمال التعيين + سجل مكالمة + إحلال من المجمع) ==========
elseif ($action === 'mark_active_contacted') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    $sid = (string) $storeId;
    $storeName = trim((string) ($input['store_name'] ?? ''));

    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'completed', workflow_updated_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'active' AND workflow_status = 'active'
    ");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين نشط (قيد المتابعة) لهذا المتجر أو تمت معالجته.'], 400);
    }

    wf_ensure_call_logs_outcome($pdo);
    $roleStmt = $pdo->prepare('SELECT role FROM users WHERE username = ? LIMIT 1');
    $roleStmt->execute([$username]);
    $performedRole = (string) ($roleStmt->fetchColumn() ?: 'active_manager');
    $pdo->prepare('
        INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ')->execute([
        $storeId,
        $storeName,
        'periodic_followup',
        'متابعة دورية — تم التواصل من طابور المهام',
        'answered',
        $username,
        $performedRole,
    ]);

    try {
        $pdo->prepare("
            UPDATE store_states SET category = 'completed', last_call_date = NOW()
            WHERE store_id = ? AND category IN ('active_pending_calls','active','active_shipping','unreachable')
        ")->execute([$storeId]);
    } catch (Throwable $e) {
    }

    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)
    ")->execute([
        $storeId,
        $storeName,
        'متابعة دورية — تم التواصل',
        'إكمال من الطابور النشط وإحلال من المجمع',
        $username,
        $performedRole,
    ]);

    ensure_active_daily_stats_schema($pdo);
    increment_active_daily_success($pdo, $username);
    $filled = fill_slots_for_user($pdo, $username, $username, null);
    $count = get_active_daily_success_count($pdo, $username);
    jsonResponse([
        'success' => true,
        'replacement_added' => $filled,
        'daily_successful_contacts' => $count,
        'active_daily_target' => ACTIVE_DAILY_SUCCESS_TARGET,
        'daily_target_reached' => $count >= ACTIVE_DAILY_SUCCESS_TARGET,
        'goal_just_met' => $count === ACTIVE_DAILY_SUCCESS_TARGET,
    ]);
}

// ========== POST: اتصال ناجح (تم) — إزالة من الطابور النشط + عدّ اليوم + تعبئة ==========
elseif ($action === 'complete_inactive_success') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
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
    ]);
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
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين لهذا المتجر.'], 400);
    }
    ensure_active_daily_stats_schema($pdo);
    increment_active_daily_success($pdo, $username);
    $fill = fill_slots_for_user($pdo, $username, $username, null);
    $count = get_active_daily_success_count($pdo, $username);
    jsonResponse([
        'success' => true,
        'filled' => $fill,
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
    jsonResponse(['success' => true, 'filled_per_user' => $report]);
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
        WHERE workflow_status = 'no_answer'
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
