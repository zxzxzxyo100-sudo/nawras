<?php
/**
 * تعبئة تلقائية يومية: يصلّح طابور مسؤول المتاجر النشطة ومسؤول الاستعادة حتى 50 لكل مستخدم.
 *
 * الجدولة (9:00 صباحاً بتوقيت ليبيا):
 *   - Hostinger / cPanel → Cron Jobs:
 *     0 9 * * * curl -fsS "https://YOUR-DOMAIN/api-php/cron-daily-queue-fill.php?token=SECRET"
 *   - أو مع TZ (إن كان cron الخادم بـ UTC ولا تثق بالمنطقة):
 *     0 7 * * * curl ...   (9 ليبيا = UTC+2 → 7 UTC)
 *   - أو PHP-CLI بدون token:
 *     0 9 * * * TZ=Africa/Tripoli /usr/bin/php /path/to/api-php/cron-daily-queue-fill.php
 *
 * الـ token: نفس قيمة CRON_QUEUE_FILL_SECRET في config أو متغير البيئة NAWRAS_CRON_SECRET.
 */
declare(strict_types=1);

date_default_timezone_set('Africa/Tripoli');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

function cron_daily_queue_fill_allowed(): bool {
    if (PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg') {
        return true;
    }
    $secret = defined('CRON_QUEUE_FILL_SECRET') ? (string) CRON_QUEUE_FILL_SECRET : '';
    if ($secret === '') {
        return false;
    }
    $t = isset($_GET['token']) ? (string) $_GET['token'] : (isset($_POST['token']) ? (string) $_POST['token'] : '');
    return hash_equals($secret, $t);
}

if (!cron_daily_queue_fill_allowed()) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden — ضبط CRON_QUEUE_FILL_SECRET أو استخدم PHP CLI'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
$label = 'cron_' . date('Y-m-d_H:i:s') . '_Africa/Tripoli';
$result = fill_all_active_and_inactive_queues($pdo, $label);
$result['success'] = true;
$result['timezone'] = 'Africa/Tripoli';
$result['ran_at_local'] = date('Y-m-d H:i:s');

jsonResponse($result);
