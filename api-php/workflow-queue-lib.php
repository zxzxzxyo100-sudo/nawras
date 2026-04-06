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
/** هدف اتصالات ناجحة (تم) يومياً لمسؤول الاستعادة — بعدها لا تُعبَّأ قوائم جديدة */
if (!defined('INACTIVE_DAILY_SUCCESS_TARGET')) {
    define('INACTIVE_DAILY_SUCCESS_TARGET', 50);
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
    ensure_inactive_daily_stats_schema($pdo);
    $done = true;
}

function ensure_inactive_daily_stats_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inactive_manager_daily_stats (
            username VARCHAR(191) NOT NULL,
            work_date DATE NOT NULL,
            successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (username, work_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

function get_inactive_daily_success_count(PDO $pdo, $username) {
    ensure_inactive_daily_stats_schema($pdo);
    $st = $pdo->prepare('SELECT COALESCE(successful_contacts, 0) FROM inactive_manager_daily_stats WHERE username = ? AND work_date = CURDATE()');
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

function increment_inactive_daily_success(PDO $pdo, $username) {
    ensure_inactive_daily_stats_schema($pdo);
    $pdo->prepare("
        INSERT INTO inactive_manager_daily_stats (username, work_date, successful_contacts)
        VALUES (?, CURDATE(), 1)
        ON DUPLICATE KEY UPDATE successful_contacts = successful_contacts + 1
    ")->execute([$username]);
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

/**
 * نفس مصدر الواجهة: ملف يُحدَّث عند كل تشغيل لـ all-stores.php
 * (تصنيف ساخن/بارد يُحسب من API وليس مخزّناً في store_states لكل متجر).
 */
function pick_next_inactive_pool_store(PDO $pdo) {
    $cacheFile = __DIR__ . '/cache/inactive_recovery_pool.json';
    if (is_readable($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $j = is_string($raw) ? json_decode($raw, true) : null;
        $stores = is_array($j) && isset($j['stores']) && is_array($j['stores']) ? $j['stores'] : [];
        if ($stores !== []) {
            $stmt = $pdo->query("SELECT store_id FROM store_assignments WHERE assignment_queue = 'inactive'");
            $assigned = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $assigned[(string) ($row['store_id'] ?? '')] = true;
            }
            foreach ($stores as $row) {
                $sid = isset($row['store_id']) ? (string) $row['store_id'] : '';
                if ($sid === '' || isset($assigned[$sid])) {
                    continue;
                }
                return [
                    'store_id'   => $row['store_id'],
                    'store_name' => $row['store_name'] ?? '',
                ];
            }
            return null;
        }
    }
    return pick_next_inactive_pool_store_from_store_states($pdo);
}

/** احتياطي: متاجر مسجّلة في store_states كساخن/بارد فقط */
function pick_next_inactive_pool_store_from_store_states(PDO $pdo) {
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
    ensure_inactive_daily_stats_schema($pdo);
    if (get_inactive_daily_success_count($pdo, $username) >= INACTIVE_DAILY_SUCCESS_TARGET) {
        return 0;
    }
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
