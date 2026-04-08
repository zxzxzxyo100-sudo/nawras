<?php
/**
 * مسار الاحتضان — نافذة المكالمة 2 و 3 من يوم التسجيل (دورة 14 يوماً): اليوم 3 واليوم 10.
 * (بعد تسجيل المكالمة السابقة؛ المكالمة 2 لا تظهر إلا مع شحن مسجّل.)
 */
if (!defined('NAWRAS_ONBOARD_CYCLE_CALL2_DAY')) {
    define('NAWRAS_ONBOARD_CYCLE_CALL2_DAY', 3);
}
if (!defined('NAWRAS_ONBOARD_CYCLE_CALL3_DAY')) {
    define('NAWRAS_ONBOARD_CYCLE_CALL3_DAY', 10);
}

/** مهلة المكالمة الأولى من لحظة التسجيل (ساعات) */
if (!defined('NAWRAS_ONBOARD_FIRST_CALL_HOURS')) {
    define('NAWRAS_ONBOARD_FIRST_CALL_HOURS', 48);
}

// للتوافق مع واجهات قديمة (عرض نصوص) — لم يعد يُستخدم لتوجيه الطوابير
$_h = $_SERVER['HTTP_HOST'] ?? '';
$_devLocalApi = (PHP_SAPI === 'cli-server')
    || stripos($_h, 'localhost') !== false
    || strpos($_h, '127.0.0.1') !== false;

if (!defined('NAWRAS_ONBOARD_DAYS_AFTER_CALL1')) {
    define('NAWRAS_ONBOARD_DAYS_AFTER_CALL1', $_devLocalApi ? 3 : 2);
}
if (!defined('NAWRAS_ONBOARD_DAYS_AFTER_CALL2')) {
    define('NAWRAS_ONBOARD_DAYS_AFTER_CALL2', $_devLocalApi ? 10 : 7);
}

/** تاريخ Y-m-d بعد إضافة أيام إلى datetime من MySQL */
function nawras_date_plus_days(?string $mysqlDatetime, int $days): ?string {
    if (!$mysqlDatetime) {
        return null;
    }
    $ts = strtotime($mysqlDatetime);
    if ($ts === false) {
        return null;
    }
    return date('Y-m-d', $ts + $days * 86400);
}
