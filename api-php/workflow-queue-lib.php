<?php
/**
 * مكتبة مشتركة: طوابير المسؤول النشط (50) ومسؤول الاستعادة (50)
 * يُستدعى من active-workflow.php و cron-daily-queue-fill.php
 */
if (!defined('ACTIVE_QUEUE_TARGET')) {
    define('ACTIVE_QUEUE_TARGET', 50);
}
if (!defined('INACTIVE_QUEUE_TARGET')) {
    define('INACTIVE_QUEUE_TARGET', 50);
}
if (!defined('SURVEY_COOLDOWN_DAYS')) {
    define('SURVEY_COOLDOWN_DAYS', 30);
}

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
    try {
        $pdo->exec("ALTER TABLE store_assignments ADD COLUMN assignment_queue ENUM('active','inactive') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {
    }
    $done = true;
}

function active_pipeline_where_sql() {
    return "ss.category IN ('active','active_shipping','active_pending_calls')";
}

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
    $st = $pdo->prepare("SELECT COUNT(*) FROM store_assignments WHERE assigned_to = ? AND workflow_status = 'active' AND assignment_queue = 'active'");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

function count_inactive_queue(PDO $pdo, $username) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM store_assignments WHERE assigned_to = ? AND workflow_status = 'active' AND assignment_queue = 'inactive'");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

function assign_store_to_user(PDO $pdo, $storeId, $storeName, $username, $assignedBy) {
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue)
        VALUES (?, ?, ?, ?, '', 'active', 'active')
        ON DUPLICATE KEY UPDATE
            assigned_to = VALUES(assigned_to),
            assigned_by = VALUES(assigned_by),
            store_name = VALUES(store_name),
            workflow_status = 'active',
            assignment_queue = 'active',
            assigned_at = CURRENT_TIMESTAMP
    ")->execute([$sid, $storeName, $username, $assignedBy]);
}

function inactive_pipeline_where_sql() {
    return "ss.category IN ('hot_inactive','cold_inactive')";
}

function pick_next_inactive_pool_store(PDO $pdo) {
    $sql = "
        SELECT ss.store_id, ss.store_name
        FROM store_states ss
        WHERE " . inactive_pipeline_where_sql() . "
        AND CAST(ss.store_id AS CHAR) NOT IN (
            SELECT store_id FROM store_assignments WHERE assignment_queue = 'inactive'
        )
        ORDER BY ss.store_id ASC
        LIMIT 1
    ";
    $stmt = $pdo->query($sql);
    return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
}

function assign_inactive_store_to_user(PDO $pdo, $storeId, $storeName, $username, $assignedBy) {
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue)
        VALUES (?, ?, ?, ?, '', 'active', 'inactive')
        ON DUPLICATE KEY UPDATE
            assigned_to = VALUES(assigned_to),
            assigned_by = VALUES(assigned_by),
            store_name = VALUES(store_name),
            workflow_status = 'active',
            assignment_queue = 'inactive',
            assigned_at = CURRENT_TIMESTAMP
    ")->execute([$sid, $storeName, $username, $assignedBy]);
}

function fill_inactive_slots_for_user(PDO $pdo, $username, $assignedBy, $maxToAdd = null) {
    ensure_workflow_schema($pdo);
    $have = count_inactive_queue($pdo, $username);
    $need = INACTIVE_QUEUE_TARGET - $have;
    if ($need <= 0) {
        return 0;
    }
    if ($maxToAdd !== null) {
        $need = min($need, (int) $maxToAdd);
    }
    $added = 0;
    while ($need > 0) {
        $row = pick_next_inactive_pool_store($pdo);
        if (!$row) {
            break;
        }
        assign_inactive_store_to_user($pdo, $row['store_id'], $row['store_name'] ?? '', $username, $assignedBy);
        $added++;
        $need--;
    }
    return $added;
}

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

/**
 * تعبئة جميع مسؤولي النشط ثم مسؤولي الاستعادة — للـ cron والمدير التنفيذي
 */
function fill_all_active_and_inactive_queues(PDO $pdo, $assignedByLabel) {
    ensure_workflow_schema($pdo);
    $filled_active = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'active_manager'");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $u) {
        $filled_active[$u] = fill_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    $filled_inactive = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $u) {
        $filled_inactive[$u] = fill_inactive_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    return [
        'filled_active_per_user'   => $filled_active,
        'filled_inactive_per_user' => $filled_inactive,
        'active_queue_target'      => ACTIVE_QUEUE_TARGET,
        'inactive_queue_target'    => INACTIVE_QUEUE_TARGET,
    ];
}

/**
 * تعبئة طابور الاستعادة فقط — حتى INACTIVE_QUEUE_TARGET لكل inactive_manager
 */
function fill_all_inactive_managers_only(PDO $pdo, $assignedByLabel) {
    ensure_workflow_schema($pdo);
    $filled_inactive = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
    $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($users as $u) {
        $filled_inactive[$u] = fill_inactive_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    return [
        'filled_inactive_per_user' => $filled_inactive,
        'inactive_queue_target'    => INACTIVE_QUEUE_TARGET,
        'inactive_managers_found'  => count($users),
    ];
}
