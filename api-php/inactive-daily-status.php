<?php
/**
 * حالة هدف الـ 50 اتصالاً يومياً لمسؤولي الاستعادة — للمدير التنفيذي (لوحة المستخدمين / المزامنة)
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$userRole = $_GET['user_role'] ?? '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
ensure_inactive_daily_stats_schema($pdo);

$rows = [];
try {
    $st = $pdo->query("
        SELECT u.username, u.fullname, COALESCE(s.successful_contacts, 0) AS successful_contacts
        FROM users u
        LEFT JOIN inactive_manager_daily_stats s
            ON s.username = u.username AND s.work_date = CURDATE()
        WHERE u.role = 'inactive_manager'
        ORDER BY u.username ASC
    ");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $c = (int) ($r['successful_contacts'] ?? 0);
        $rows[] = [
            'username' => $r['username'],
            'fullname' => $r['fullname'] ?? '',
            'successful_contacts' => $c,
            'daily_goal_met' => $c >= INACTIVE_DAILY_SUCCESS_TARGET,
        ];
    }
} catch (Throwable $e) {
    $rows = [];
}

echo json_encode(['success' => true, 'data' => $rows, 'inactive_daily_target' => INACTIVE_DAILY_SUCCESS_TARGET], JSON_UNESCAPED_UNICODE);
