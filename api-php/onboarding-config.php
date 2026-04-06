<?php
/**
 * مسار الاحتضان — جدولة المكالمات بعد إكمال السابقة (وليس فقط يوم الدورة من التسجيل).
 *
 * Call 2 تظهر بعد مرور X يوماً كاملة من تاريخ تسجيل المكالمة الأولى (تم).
 * Call 3 تظهر بعد مرور Y يوماً كاملة من تاريخ تسجيل المكالمة الثانية (تم).
 */
// بيئة التطوير المحلي (localhost): 3 يوماً بعد المكالمة الأولى، 10 أيام بعد الثانية — كما في مواصفات DEV
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
