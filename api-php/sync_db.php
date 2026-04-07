<?php
/**
 * ترحيل مخطط قاعدة البيانات — آمن وقابل للإعادة (بدون حذف بيانات).
 *
 * - لا يُدرج صفوف اختبار ولا متاجر وهمية.
 * - يستخدم CREATE IF NOT EXISTS و ALTER مع تجاهل الخطأ إن وُجد العمود.
 * - جدول تذاكر الانحراف في المنتج = executive_private_tickets (عمود ticket_type).
 *   يُنشأ عرض (VIEW) اختياري اسمه deviation_tickets للقراءة فقط.
 *
 * التشغيل:
 *   HTTP:  GET /api-php/sync_db.php?token=YOUR_SECRET
 *   CLI:   php sync_db.php --token=YOUR_SECRET
 *
 * الأمان: عرّف NAWRAS_SYNC_DB_SECRET على السيرفر أو SYNC_DB_SECRET في config.php
 *
 * بعد نجاح التشغيل يُعاد تسمية هذا الملف إلى sync_db.php.bak إن أمكن، وإلا يُكتب ملف قفل.
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

require_once __DIR__ . '/config.php';

$secret = '';
if (defined('SYNC_DB_SECRET')) {
    $secret = (string) SYNC_DB_SECRET;
} else {
    $e = getenv('NAWRAS_SYNC_DB_SECRET');
    $secret = is_string($e) ? $e : '';
}

$isCli = PHP_SAPI === 'cli';
$tokenIn = '';
if ($isCli) {
    foreach ($_SERVER['argv'] ?? [] as $arg) {
        if (strpos($arg, '--token=') === 0) {
            $tokenIn = substr($arg, 8);
            break;
        }
    }
} else {
    $tokenIn = isset($_GET['token']) ? (string) $_GET['token'] : '';
}

function sync_fail(int $code, string $msg): void
{
    http_response_code($code);
    echo json_encode(['success' => false, 'error' => $msg], JSON_UNESCAPED_UNICODE);
    exit(1);
}

function sync_ok(array $payload): void
{
    echo json_encode(['success' => true] + $payload, JSON_UNESCAPED_UNICODE);
}

if ($secret === '') {
    sync_fail(503, 'لم يُعرّف NAWRAS_SYNC_DB_SECRET على السيرفر — رفض التشغيل.');
}

if (!hash_equals($secret, $tokenIn)) {
    sync_fail(403, 'رمز غير صالح.');
}

$lockPath = __DIR__ . '/.sync_db_lock.json';
if (is_file($lockPath)) {
    $prev = json_decode((string) file_get_contents($lockPath), true);
    if (is_array($prev) && ($prev['status'] ?? '') === 'completed') {
        sync_ok([
            'message' => 'تم الترحيل مسبقاً. احذف .sync_db_lock.json أو sync_db.php.bak لإعادة التشغيل اليدوي.',
            'skipped' => true,
            'previous_at' => $prev['at'] ?? null,
        ]);
        exit(0);
    }
}

require_once __DIR__ . '/db.php';

/** @var PDO $pdo */
$pdo = getDB();
$steps = [];

function tryExec(PDO $pdo, string $sql, string $label, array &$steps): void
{
    try {
        $pdo->exec($sql);
        $steps[] = ['ok' => true, 'step' => $label];
    } catch (Throwable $e) {
        $steps[] = ['ok' => true, 'step' => $label, 'note' => 'skipped (likely exists)'];
    }
}

// ── executive_private_tickets (تذاكر خاصة + انحراف) ─────────────────
tryExec($pdo, "CREATE TABLE IF NOT EXISTS executive_private_tickets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(500) NOT NULL,
    body TEXT NOT NULL,
    assignee_username VARCHAR(100) NOT NULL,
    created_by_username VARCHAR(100) NOT NULL,
    is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
    status ENUM('open','done') NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL DEFAULT NULL,
    INDEX idx_assignee_status (assignee_username, status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'CREATE executive_private_tickets', $steps);

tryExec($pdo, "ALTER TABLE executive_private_tickets ADD COLUMN ticket_type VARCHAR(40) NOT NULL DEFAULT 'general' AFTER body", 'ADD ticket_type', $steps);
tryExec($pdo, 'ALTER TABLE executive_private_tickets ADD COLUMN store_id INT NULL DEFAULT NULL AFTER ticket_type', 'ADD store_id', $steps);
tryExec($pdo, 'ALTER TABLE executive_private_tickets ADD COLUMN meta_json TEXT NULL DEFAULT NULL AFTER store_id', 'ADD meta_json', $steps);
tryExec($pdo, 'CREATE INDEX idx_assignee_type_open ON executive_private_tickets (assignee_username, status, ticket_type)', 'INDEX idx_assignee_type_open', $steps);

// عرض قراءة فقط — لا يكرر البيانات
try {
    $pdo->exec('DROP VIEW IF EXISTS deviation_tickets');
} catch (Throwable $e) {
}
try {
    $pdo->exec("CREATE VIEW deviation_tickets AS
        SELECT * FROM executive_private_tickets WHERE ticket_type = 'deviation_alert'");
    $steps[] = ['ok' => true, 'step' => 'CREATE VIEW deviation_tickets'];
} catch (Throwable $e) {
    $steps[] = ['ok' => false, 'step' => 'CREATE VIEW deviation_tickets', 'error' => $e->getMessage()];
}

// ── store_states — أعمدة الاستعادة / المكالمات (بدون مسح) ───────────
tryExec($pdo, 'ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL', 'ADD store_states.last_call_date', $steps);
tryExec($pdo, 'ALTER TABLE store_states ADD COLUMN inc_call1_at DATETIME NULL DEFAULT NULL', 'ADD inc_call1_at', $steps);
tryExec($pdo, 'ALTER TABLE store_states ADD COLUMN inc_call2_at DATETIME NULL DEFAULT NULL', 'ADD inc_call2_at', $steps);
tryExec($pdo, 'ALTER TABLE store_states ADD COLUMN inc_call3_at DATETIME NULL DEFAULT NULL', 'ADD inc_call3_at', $steps);
tryExec($pdo, 'ALTER TABLE store_states ADD COLUMN officer_performance_error TINYINT(1) NOT NULL DEFAULT 0', 'ADD officer_performance_error', $steps);

// ── store_assignments + surveys + call_logs (طوابير / استعادة) ───
tryExec($pdo, "CREATE TABLE IF NOT EXISTS store_assignments (
    store_id     VARCHAR(50)  PRIMARY KEY,
    store_name   VARCHAR(255) DEFAULT '',
    assigned_to  VARCHAR(100) NOT NULL,
    assigned_by  VARCHAR(100) DEFAULT '',
    assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4", 'CREATE store_assignments', $steps);

tryExec($pdo, "ALTER TABLE store_assignments ADD COLUMN workflow_status ENUM('active','no_answer') NOT NULL DEFAULT 'active'", 'ADD workflow_status', $steps);
tryExec($pdo, 'ALTER TABLE store_assignments ADD COLUMN workflow_updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP', 'ADD workflow_updated_at', $steps);
tryExec($pdo, "ALTER TABLE store_assignments ADD COLUMN assignment_queue ENUM('active','inactive') NOT NULL DEFAULT 'active'", 'ADD assignment_queue', $steps);
tryExec($pdo, 'ALTER TABLE call_logs ADD COLUMN outcome VARCHAR(32) NULL DEFAULT NULL', 'ADD call_logs.outcome', $steps);
tryExec($pdo, 'ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL', 'ADD surveys.submitted_username', $steps);
tryExec($pdo, 'ALTER TABLE surveys ADD COLUMN satisfaction_score VARCHAR(16) NULL DEFAULT NULL', 'ADD satisfaction_score', $steps);
tryExec($pdo, 'ALTER TABLE surveys ADD COLUMN satisfaction_gap_tags JSON NULL DEFAULT NULL', 'ADD satisfaction_gap_tags', $steps);
tryExec($pdo, "ALTER TABLE surveys ADD COLUMN survey_kind VARCHAR(32) NULL DEFAULT 'active_csat'", 'ADD survey_kind', $steps);

// ── جداول إحصاءات الطوابير اليومية (نظام الاستعادة / النشط) ────────
tryExec($pdo, "
    CREATE TABLE IF NOT EXISTS active_manager_daily_stats (
        username VARCHAR(191) NOT NULL,
        work_date DATE NOT NULL,
        successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (username, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", 'CREATE active_manager_daily_stats', $steps);

tryExec($pdo, "
    CREATE TABLE IF NOT EXISTS inactive_manager_daily_stats (
        username VARCHAR(191) NOT NULL,
        work_date DATE NOT NULL,
        successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
        updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (username, work_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
", 'CREATE inactive_manager_daily_stats', $steps);

// ── points_log (نقاط / أداء) — نفس تعريف store-actions ─────────────
tryExec($pdo, "
    CREATE TABLE IF NOT EXISTS points_log (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        username   VARCHAR(100) NOT NULL,
        fullname   VARCHAR(200) DEFAULT '',
        points     INT          NOT NULL DEFAULT 10,
        reason     VARCHAR(200) DEFAULT 'مكالمة',
        store_id   INT,
        store_name VARCHAR(300) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (username),
        INDEX idx_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
", 'CREATE points_log', $steps);

$at = date('c');
file_put_contents($lockPath, json_encode(['status' => 'completed', 'at' => $at, 'env' => IS_STAGING_ENV ? 'staging' : 'production'], JSON_UNESCAPED_UNICODE));

$renamed = false;
$bak = __DIR__ . '/sync_db.php.bak';
if (is_file(__FILE__) && @rename(__FILE__, $bak)) {
    $renamed = true;
}

sync_ok([
    'message' => 'اكتمل ترحيل المخطط دون تعديل بيانات المستخدمين أو السجلات.',
    'steps' => $steps,
    'lock_file' => basename($lockPath),
    'script_renamed_to_bak' => $renamed,
    'completed_at' => $at,
    'database' => defined('DB_NAME') ? DB_NAME : '',
]);
