<?php
/**
 * تعبئة فورية لطابور مسؤول الاستعادة: يضيف متاجر غير نشطة حتى 50 لكل مستخدم بدور inactive_manager.
 *
 * الاستدعاء (مرة أو عند الحاجة):
 *   curl "https://YOUR-DOMAIN/api-php/fill-inactive-queues-now.php?token=SECRET"
 *
 * نفس سر الـ cron: CRON_QUEUE_FILL_SECRET / NAWRAS_CRON_SECRET في config.
 * من CLI بدون token:
 *   php fill-inactive-queues-now.php
 */
declare(strict_types=1);

date_default_timezone_set('Africa/Tripoli');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

function fill_inactive_queues_http_allowed(): bool {
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

if (!fill_inactive_queues_http_allowed()) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden — ضبط NAWRAS_CRON_SECRET أو استخدم PHP CLI'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
$label = 'fill_inactive_now_' . date('Y-m-d_H:i:s');
$out = fill_all_inactive_managers_only($pdo, $label);
$out['success'] = true;
$out['ran_at'] = date('Y-m-d H:i:s T');

jsonResponse($out);
