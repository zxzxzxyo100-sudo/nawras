<?php
/**
 * مهمة مجدولة (Cron): تُعيد جميع المتاجر المنجزة إلى «نشط قيد المكالمة» عند التشغيل.
 * لا يوجد شرط زمني — يُشغَّل بالجدولة المطلوبة مباشرةً.
 * مثال crontab (أول كل شهر الساعة 03:00):
 * 0 3 1 * * php /path/to/check-completed-merchants.php
 */
require_once __DIR__ . '/config.php';

ini_set('memory_limit', MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

require_once __DIR__ . '/db.php';

$pdo = getDB();

try {
    $pdo->exec('ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL AFTER inc_call3_at');
} catch (Throwable $e) {
    // موجود مسبقاً
}

$sql = "UPDATE store_states
    SET category       = 'active_pending_calls',
        last_call_date = NULL
    WHERE category IN ('completed', 'unreachable')
      AND (last_call_date IS NULL OR DATE(last_call_date) < CURDATE())";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$n = (int) $stmt->rowCount();

jsonResponse([
    'success'    => true,
    'message'    => 'تمت إعادة المتاجر المنجزة وغير المتاحة إلى قيد المكالمة',
    'updated'    => $n,
    'checked_at' => date('Y-m-d H:i:s'),
]);
