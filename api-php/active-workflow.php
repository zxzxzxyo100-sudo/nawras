<?php
/**
 * سير عمل المتاجر النشطة: طابور 50، عدم الرد، تعبئة من المجمع (استبيان +30 يوم)
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

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
    fill_slots_for_user($pdo, $username, $username, null);

    $stActive = $pdo->prepare("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_status, assignment_queue
        FROM store_assignments
        WHERE assigned_to = ? AND assignment_queue = 'active' AND workflow_status = 'active'
        AND DATE(assigned_at) = CURDATE()
        ORDER BY assigned_at ASC
        LIMIT " . ACTIVE_QUEUE_TARGET . "
    ");
    $stActive->execute([$username]);
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
        SET workflow_status = 'no_answer', workflow_updated_at = NOW()
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
