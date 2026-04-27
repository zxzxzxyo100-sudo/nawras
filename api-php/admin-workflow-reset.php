<?php
/**
 * إعادة ضبط طوابير المهام / الحصص اليومية / التدوير — للإنتاج أو التجريبي بعد النسخ الاحتياطي.
 *
 * الأمان: نفس سرّ cron (CRON_QUEUE_FILL_SECRET / NAWRAS_CRON_SECRET). إن كان فارغاً يُرفض الطلب.
 *
 * أمثلة (استبدل SECRET والنطاق):
 *   curl "https://DOMAIN/api-php/admin-workflow-reset.php?secret=SECRET&confirm=RESET_WORKFLOW&target=all"
 *   curl "https://DOMAIN/api-php/admin-workflow-reset.php?secret=SECRET&confirm=RESET_WORKFLOW&target=user&username=المسؤول"
 *
 * بعد التنفيذ: شغّل cron-daily-queue-fill.php (أو انتظر الجدولة) لتعبئة الطوابير آلياً دون تعارض مع التعيين اليدوي
 * (نفس جدول store_assignments — لا يُعاد تعيين نفس store_id مرتين).
 *
 * لا يحذف: call_logs، surveys، audit_logs، store_states.
 */
declare(strict_types=1);

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/daily-quota-lib.php';
require_once __DIR__ . '/workflow-queue-lib.php';

function admin_workflow_reset_allowed(): bool {
    if (PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg') {
        return true;
    }
    $secret = defined('CRON_QUEUE_FILL_SECRET') ? (string) CRON_QUEUE_FILL_SECRET : '';
    if ($secret === '') {
        return false;
    }
    $t = isset($_GET['secret']) ? (string) $_GET['secret'] : (isset($_POST['secret']) ? (string) $_POST['secret'] : '');
    return hash_equals($secret, $t);
}

if (!admin_workflow_reset_allowed()) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden — عرّف NAWRAS_CRON_SECRET أو CRON_QUEUE_FILL_SECRET'], JSON_UNESCAPED_UNICODE);
    exit;
}

$confirm = isset($_GET['confirm']) ? (string) $_GET['confirm'] : (isset($_POST['confirm']) ? (string) $_POST['confirm'] : '');
if ($confirm !== 'RESET_WORKFLOW') {
    http_response_code(400);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error' => 'أرسل confirm=RESET_WORKFLOW',
        'hint'  => 'target=all | target=user&username=...',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$target = isset($_GET['target']) ? (string) $_GET['target'] : (isset($_POST['target']) ? (string) $_POST['target'] : 'all');
$username = trim((string) (isset($_GET['username']) ? $_GET['username'] : (isset($_POST['username']) ? $_POST['username'] : '')));

$clearCache = isset($_GET['clear_cache']) ? (string) $_GET['clear_cache'] : '1';
$clearCache = $clearCache === '1' || strtolower($clearCache) === 'true';

$pdo = getDB();
ensure_workflow_schema($pdo);
nawras_ensure_daily_quota_schema($pdo);
ensure_inactive_daily_stats_schema($pdo);
ensure_active_daily_stats_schema($pdo);

$report = ['steps' => []];

try {
    if ($target === 'user') {
        if ($username === '') {
            throw new RuntimeException('مع target=user يجب تمرير username');
        }
        $st = $pdo->prepare('DELETE FROM store_assignments WHERE assigned_to = ?');
        $st->execute([$username]);
        $report['steps']['delete_assignments_for_user'] = $st->rowCount();
    } elseif ($target === 'all') {
        $n = $pdo->exec('DELETE FROM store_assignments');
        $report['steps']['delete_all_assignments'] = $n !== false ? (int) $n : 0;
    } else {
        throw new RuntimeException('target يجب أن يكون all أو user');
    }

    $pdo->exec('TRUNCATE TABLE employee_daily_processed_stores');
    $report['steps']['truncate_employee_daily_processed_stores'] = 'ok';

    $pdo->exec('TRUNCATE TABLE inactive_manager_daily_stats');
    $report['steps']['truncate_inactive_manager_daily_stats'] = 'ok';

    $pdo->exec('TRUNCATE TABLE active_manager_daily_stats');
    $report['steps']['truncate_active_manager_daily_stats'] = 'ok';

    ensure_active_pool_rotation_schema($pdo);
    $pdo->exec('TRUNCATE TABLE active_manager_pool_rotation');
    $report['steps']['truncate_active_manager_pool_rotation'] = 'ok';

    ensure_active_queue_reset_schema($pdo);
    $pdo->exec('TRUNCATE TABLE active_manager_queue_resets');
    $report['steps']['truncate_active_manager_queue_resets'] = 'ok';

    if ($clearCache) {
        $cacheDir = __DIR__ . '/cache';
        $cleared = 0;
        if (is_dir($cacheDir)) {
            foreach (glob($cacheDir . '/*.json') ?: [] as $file) {
                if (is_file($file) && @unlink($file)) {
                    $cleared++;
                }
            }
        }
        $report['steps']['cache_json_removed'] = $cleared;
    }

    $report['success'] = true;
    $report['next'] = 'شغّل cron-daily-queue-fill.php (نفس سرّ cron) لتعبئة الطوابير تلقائياً.';
} catch (Throwable $e) {
    http_response_code(500);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => false,
        'error'   => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode($report, JSON_UNESCAPED_UNICODE);
