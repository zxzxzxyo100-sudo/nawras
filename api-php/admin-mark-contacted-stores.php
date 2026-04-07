<?php
/**
 * تعليم متاجر محددة كـ "تم التواصل" لمستخدم معيّن:
 * - ينشئ/يحدّث التعيين بحالة completed
 * - يعيد فئة المتجر إلى active_shipping إن لزم
 *
 * الاستخدام:
 * admin-mark-contacted-stores.php?secret=SECRET&username=rasha&ids=9214,9205
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

$secret = defined('CRON_QUEUE_FILL_SECRET') ? (string) CRON_QUEUE_FILL_SECRET : '';
$token  = isset($_GET['secret']) ? (string) $_GET['secret'] : '';
if ($secret === '' || !hash_equals($secret, $token)) {
    http_response_code(403);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

$username = trim((string) ($_GET['username'] ?? ''));
$idsRaw = isset($_GET['ids']) ? (string) $_GET['ids'] : '';
if ($username === '' || $idsRaw === '') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'username و ids مطلوبان'], JSON_UNESCAPED_UNICODE);
    exit;
}

$ids = array_values(array_filter(array_map('trim', explode(',', $idsRaw))));
if ($ids === []) {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode(['success' => false, 'error' => 'لا توجد معرّفات صالحة'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
$results = [];

foreach ($ids as $sid) {
    $storeName = '';
    $st = $pdo->prepare("SELECT store_name FROM store_states WHERE CAST(store_id AS CHAR) = CAST(? AS CHAR) LIMIT 1");
    $st->execute([$sid]);
    $storeName = (string) ($st->fetchColumn() ?: '');

    $pdo->prepare("
        INSERT INTO store_assignments
            (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue, assigned_at, workflow_updated_at)
        VALUES (?, ?, ?, 'admin_mark_contacted', '', 'completed', 'active', NOW(), NOW())
        ON DUPLICATE KEY UPDATE
            store_name = VALUES(store_name),
            assigned_to = VALUES(assigned_to),
            assigned_by = 'admin_mark_contacted',
            workflow_status = 'completed',
            assignment_queue = 'active',
            assigned_at = NOW(),
            workflow_updated_at = NOW()
    ")->execute([$sid, $storeName, $username]);

    $pdo->prepare("
        UPDATE store_states
        SET category = 'active_shipping'
        WHERE CAST(store_id AS CHAR) = CAST(? AS CHAR)
    ")->execute([$sid]);

    $results[$sid] = [
        'assigned_to' => $username,
        'workflow_status' => 'completed',
    ];
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_UNICODE);
