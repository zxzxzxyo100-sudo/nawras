<?php
/**
 * نسخة محسنة: تعتمد على استعلامات مجمعة بدلاً من الحلقات التكرارية
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';

// 1. التحقق من التوكن (كما هو في كودك)
$secret = defined('CRON_QUEUE_FILL_SECRET') ? (string) CRON_QUEUE_FILL_SECRET : '';
$token  = $_GET['secret'] ?? '';
if ($secret === '' || !hash_equals($secret, $token)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden']);
    exit;
}

// 2. تجهيز المعرفات وتنقيتها
$idsRaw = $_GET['ids'] ?? '';
$ids = array_filter(array_map('trim', explode(',', $idsRaw)));

if (empty($ids)) {
    echo json_encode(['success' => false, 'error' => 'No valid IDs provided']);
    exit;
}

$pdo = getDB();

try {
    // تجهيز العلامات النائبة للاستعلام (?)
    $placeholders = implode(',', array_fill(0, count($ids), '?'));

    // 3. حذف التعيينات دفعة واحدة
    $del = $pdo->prepare("DELETE FROM store_assignments WHERE store_id IN ($placeholders)");
    $del->execute($ids);
    $deletedCount = $del->rowCount();

    // 4. تحديث الحالات دفعة واحدة
    // أضفت التصنيفات التي ذكرتها في كودك الأصلي لضمان عدم تغيير حالات أخرى بالخطأ
    $sqlUpd = "UPDATE store_states 
               SET category = 'active_shipping' 
               WHERE store_id IN ($placeholders) 
               AND category IN ('completed','active_pending_calls','active','unreachable')";
    
    $upd = $pdo->prepare($sqlUpd);
    $upd->execute($ids);
    $updatedCount = $upd->rowCount();

    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'summary' => [
            'total_ids_sent' => count($ids),
            'assignments_deleted' => $deletedCount,
            'categories_reset' => $updatedCount
        ]
    ], JSON_UNESCAPED_UNICODE);

} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database error']);
}
