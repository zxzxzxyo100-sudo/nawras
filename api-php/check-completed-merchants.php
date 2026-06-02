<?php
/**
 * مهمة مجدولة (Cron): في اليوم 30 من كل شهر (أو آخر يوم إذا كان الشهر أقصر)
 * تُعاد جميع المتاجر المنجزة (category='completed') إلى «نشط قيد المكالمة».
 *
 * مثال crontab (يومياً الساعة 03:00 — يتحقق داخلياً من أنه يوم 30):
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
    // موجود مسبقاً
}

// ─── حساب يوم العودة الشهري ───────────────────────────────────────────────────
// اليوم المستهدف هو 30، إلا إذا كان الشهر أقصر (مثل فبراير) فيُستخدم آخر يوم فيه.
$lastDayOfMonth = (int) date('d', strtotime('last day of this month'));
$targetDay      = min(30, $lastDayOfMonth);
$todayDay       = (int) date('j');

if ($todayDay < $targetDay) {
    // لم يحن وقت العودة الشهرية بعد
    jsonResponse([
        'success'          => true,
        'message'          => 'ليس يوم العودة الشهرية بعد',
        'updated'          => 0,
        'target_day'       => $targetDay,
        'today_day'        => $todayDay,
        'checked_at'       => date('Y-m-d H:i:s'),
    ]);
    exit;
}

// ─── نقل المنجزات إلى قيد المكالمة ──────────────────────────────────────────
// يُستثنى ما أُكمل اليوم (last_call_date = CURDATE) حتى لا يُعاد فوراً.
$sql = "UPDATE store_states
    SET category       = 'active_pending_calls',
        last_call_date = NULL
    WHERE category = 'completed'
      AND (last_call_date IS NULL OR DATE(last_call_date) < CURDATE())";

$stmt = $pdo->prepare($sql);
$stmt->execute();
$n = $stmt->rowCount();

jsonResponse([
    'success'    => true,
    'message'    => "تمت إعادة المتاجر المنجزة في يوم {$targetDay} من الشهر",
    'updated'    => $n !== false ? (int) $n : 0,
    'target_day' => $targetDay,
    'today_day'  => $todayDay,
    'checked_at' => date('Y-m-d H:i:s'),
]);
