<?php
/**
 * مسار الاحتضان — جدولة المكالمات بعد إكمال السابقة (وليس فقط يوم الدورة من التسجيل).
 *
 * Call 2 تظهر بعد مرور X يوماً كاملة من تاريخ تسجيل المكالمة الأولى (تم).
 * Call 3 تظهر بعد مرور Y يوماً كاملة من تاريخ تسجيل المكالمة الثانية (تم).
 */
if (!defined('NAWRAS_ONBOARD_DAYS_AFTER_CALL1')) {
    define('NAWRAS_ONBOARD_DAYS_AFTER_CALL1', 2);
}
if (!defined('NAWRAS_ONBOARD_DAYS_AFTER_CALL2')) {
    define('NAWRAS_ONBOARD_DAYS_AFTER_CALL2', 7);
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
