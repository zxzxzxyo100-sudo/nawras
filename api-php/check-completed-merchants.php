<?php
/**
 * مهمة مجدولة (Cron): بعد 30 يوماً على last_call_date تُعاد الحالة من «منجز» إلى «نشط قيد المكالمة».
 * لا يمس المتاجر التي أُكملت اليوم: الشرط last_call_date < NOW()-30 يوم AND last_call_date IS NOT NULL.
 * مثال crontab: كل يوم الساعة 03:00
 * 0 3 * * * php /path/to/check-completed-merchants.php
 */
require_once __DIR__ . '/config.php';

ini_set('memory_limit', MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

require_once __DIR__ . '/db.php';

$pdo = getDB();

try {
    $pdo->exec('ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL AFTER inc_call3_at');
} catch (Throwable $e) {
    // موجود
}

$sql = "UPDATE store_states
    SET category = 'active_pending_calls',
        last_call_date = NULL
    WHERE category = 'completed'
      AND last_call_date IS NOT NULL
      AND last_call_date < DATE_SUB(NOW(), INTERVAL 30 DAY)";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$n = $stmt->rowCount();

jsonResponse([
    'success'   => true,
    'message'   => 'تمت معالجة المتاجر المنجزة المنتهية',
    'updated'   => $n !== false ? (int) $n : 0,
    'checked_at'=> date('Y-m-d H:i:s'),
]);
