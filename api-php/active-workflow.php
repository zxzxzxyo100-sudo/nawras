<?php
/**
 * سير عمل المتاجر النشطة: طابور 50، عدم الرد، تعبئة من المجمع (استبيان +30 يوم)
 */
require_once __DIR__ . '/db.php';

const ACTIVE_QUEUE_TARGET = 50;
const SURVEY_COOLDOWN_DAYS = 30;

$pdo = getDB();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

function ensure_workflow_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec("ALTER TABLE store_assignments ADD COLUMN workflow_status ENUM('active','no_answer') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE store_assignments ADD COLUMN workflow_updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL AFTER performed_by');
    } catch (Throwable $e) {
    }
    $done = true;
}

function active_pipeline_where_sql() {
    return "ss.category IN ('active','active_shipping','active_pending_calls')";
}

/** متاجر مؤهلة للمجمع: نشطة في المسار، غير مُعيَّنة، ولا استبيان خلال 30 يوماً */
function pick_next_pool_store(PDO $pdo) {
    $sql = "
        SELECT ss.store_id, ss.store_name
        FROM store_states ss
        WHERE " . active_pipeline_where_sql() . "
        AND CAST(ss.store_id AS CHAR) NOT IN (SELECT store_id FROM store_assignments)
        AND NOT EXISTS (
            SELECT 1 FROM surveys s
            WHERE s.store_id = ss.store_id
            AND s.created_at >= DATE_SUB(NOW(), INTERVAL " . SURVEY_COOLDOWN_DAYS . " DAY)
        )
        ORDER BY ss.store_id ASC
        LIMIT 1
    ";
    $stmt = $pdo->query($sql);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function count_active_queue(PDO $pdo, $username) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM store_assignments WHERE assigned_to = ? AND workflow_status = 'active'");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

function assign_store_to_user(PDO $pdo, $storeId, $storeName, $username, $assignedBy) {
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status)
        VALUES (?, ?, ?, ?, '', 'active')
        ON DUPLICATE KEY UPDATE
            assigned_to = VALUES(assigned_to),
            assigned_by = VALUES(assigned_by),
            store_name = VALUES(store_name),
            workflow_status = 'active',
            assigned_at = CURRENT_TIMESTAMP
    ")->execute([$sid, $storeName, $username, $assignedBy]);
}

/** تعبئة طابور موظف حتى TARGET أو نفاد المجمع */
function fill_slots_for_user(PDO $pdo, $username, $assignedBy, $maxToAdd = null) {
    ensure_workflow_schema($pdo);
    $have = count_active_queue($pdo, $username);
    $need = ACTIVE_QUEUE_TARGET - $have;
    if ($need <= 0) {
        return 0;
    }
    if ($maxToAdd !== null) {
        $need = min($need, (int) $maxToAdd);
    }
    $added = 0;
    while ($need > 0) {
        $row = pick_next_pool_store($pdo);
        if (!$row) {
            break;
        }
        assign_store_to_user($pdo, $row['store_id'], $row['store_name'] ?? '', $username, $assignedBy);
        $added++;
        $need--;
    }
    return $added;
}

ensure_workflow_schema($pdo);

// ========== GET: طابوري + عدم الرد ==========
if ($action === 'get_my_workflow') {
    $username = trim((string) ($_GET['username'] ?? ''));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400);
    }
    $st = $pdo->prepare("
        SELECT store_id, store_name, assigned_to, assigned_at, workflow_status
        FROM store_assignments
        WHERE assigned_to = ?
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
    jsonResponse([
        'success' => true,
        'target' => ACTIVE_QUEUE_TARGET,
        'cooldown_days' => SURVEY_COOLDOWN_DAYS,
        'active_tasks' => $active,
        'no_answer_tasks' => $noAnswer,
        'active_count' => count($active),
        'no_answer_count' => count($noAnswer),
    ]);
}

// ========== POST: عدم الرد — نقل للمتابعة + استبدال من المجمع ==========
elseif ($action === 'mark_no_answer') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    $sid = (string) $storeId;
    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'no_answer', workflow_updated_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND workflow_status = 'active'
    ");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين نشط لهذا المتجر أو تمت معالجته مسبقاً.'], 400);
    }
    $pdo->prepare("
        INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, 'استبيان — عدم الرد', 'نُقل المتجر إلى قائمة المتابعة (عدم رد)', ?, 'active_manager')
    ")->execute([$storeId, $input['store_name'] ?? '', $username]);

    $added = fill_slots_for_user($pdo, $username, $username, null);
    jsonResponse(['success' => true, 'replacement_added' => $added]);
}

// ========== POST: بعد إكمال الاستبيان — إزالة من الطابور + تعبئة ==========
elseif ($action === 'release_after_survey') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $username = trim((string) ($input['username'] ?? ''));
    if ($storeId <= 0 || $username === '') {
        jsonResponse(['success' => false, 'error' => 'store_id و username مطلوبان'], 400);
    }
    $sid = (string) $storeId;
    $del = $pdo->prepare("DELETE FROM store_assignments WHERE store_id = ? AND assigned_to = ?");
    $del->execute([$sid, $username]);
    if ($del->rowCount() === 0) {
        jsonResponse(['success' => false, 'error' => 'لا يوجد تعيين لهذا المتجر.'], 400);
    }
    $fill = fill_slots_for_user($pdo, $username, $username, null);
    jsonResponse(['success' => true, 'filled' => $fill]);
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

else {
    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
}
