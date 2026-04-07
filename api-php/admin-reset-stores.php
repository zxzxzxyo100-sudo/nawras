<?php
/**
 * إعادة ضبط متاجر محددة: حذف التعيين + إعادة فئة store_states إلى 'active_shipping'
 * الاستخدام: admin-reset-stores.php?secret=SECRET&ids=9214,9205
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

$secret = defined('CRON_QUEUE_FILL_SECRET') ? (string) CRON_QUEUE_FILL_SECRET : '';
$token  = isset($_GET['secret']) ? (string) $_GET['secret'] : '';
if ($secret === '' || !hash_equals($secret, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

$idsRaw = isset($_GET['ids']) ? (string) $_GET['ids'] : '';
if ($idsRaw === '') {
    echo json_encode(['success' => false, 'error' => 'ids مطلوب (مثال: ?ids=9214,9205)']);
    exit;
}

$ids = array_filter(array_map('trim', explode(',', $idsRaw)));
if (empty($ids)) {
    echo json_encode(['success' => false, 'error' => 'لا توجد معرّفات صالحة']);
    exit;
}

$pdo = getDB();
$results = [];

foreach ($ids as $rawId) {
    $sid = (string) $rawId;
    // حذف التعيين
    $del = $pdo->prepare("DELETE FROM store_assignments WHERE store_id = ?");
    $del->execute([$sid]);
    $deletedAssignment = $del->rowCount();

    // إعادة حالة المتجر إلى active_shipping
    $upd = $pdo->prepare("UPDATE store_states SET category = 'active_shipping' WHERE store_id = ? AND category IN ('completed','active_pending_calls','active','unreachable')");
    $upd->execute([$sid]);
    $updatedCategory = $upd->rowCount();

    $results[$sid] = [
        'assignment_deleted' => $deletedAssignment > 0,
        'category_reset'     => $updatedCategory > 0,
    ];
}

header('Content-Type: application/json; charset=utf-8');
echo json_encode(['success' => true, 'results' => $results], JSON_UNESCAPED_UNICODE);
