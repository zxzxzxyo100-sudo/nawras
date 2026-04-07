<?php
// =========================================================
// إعدادات مركزية لـ Nawras CRM API
// =========================================================

// --- API الخارجي (Nawris) ---
define('NAWRIS_TOKEN', 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703');
define('NAWRIS_BASE',  'https://backoffice.nawris.algoriza.com/external-api');

// --- حدود الصفحات (Pagination) ---
define('MAX_PAGES_NEW',      50);
define('MAX_PAGES_INACTIVE', 80);
define('MAX_PAGES_ORDERS',   80);
define('MAX_PAGES_RECOVERY', 30);
define('MAX_PAGES_ALL',     200);

// --- حدود زمن وذاكرة PHP ---
define('MEMORY_LIGHT',  '96M');
define('MEMORY_MEDIUM', '128M');
define('MEMORY_HEAVY',  '256M');
define('TIME_SHORT',    '30');
define('TIME_MEDIUM',   '60');
define('TIME_LONG',     '120');

// =========================================================
// اختيار قاعدة البيانات: إنتاج أم تجريبية
// يتم الكشف تلقائياً عبر الرابط أو اسم النطاق
// =========================================================
$_host = $_SERVER['HTTP_HOST']     ?? '';
$_uri  = $_SERVER['REQUEST_URI']   ?? '';

$_isStaging = (
    stripos($_host, 'staging') !== false ||   // staging.domain.com
    strpos($_uri,  '/staging/') !== false      // domain.com/staging/
);

if ($_isStaging) {
    // ── قاعدة البيانات التجريبية ──────────────────────────────
    // أنشئ قاعدة بيانات جديدة في Hostinger وضع بياناتها هنا:
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u495355717_nawras_stg');
    define('DB_USER', 'u495355717_nawras_stg');
    define('DB_PASS', 'Zidona11@');
    define('IS_STAGING_ENV', true);
} else {
    // ── قاعدة البيانات الإنتاجية ──────────────────────────────
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u495355717_nawras_crm');
    define('DB_USER', 'u495355717_nawras_admin');
    define('DB_PASS', 'Zidona11');
    define('IS_STAGING_ENV', false);
}

// --- Cron: تعبئة طوابير 50/50 يومياً (cron-daily-queue-fill.php) ---
// عرّف NAWRAS_CRON_SECRET على السيرفر أو ضع قيمة هنا للإنتاج فقط
if (!defined('CRON_QUEUE_FILL_SECRET')) {
    $cronFromEnv = getenv('NAWRAS_CRON_SECRET');
    define('CRON_QUEUE_FILL_SECRET', is_string($cronFromEnv) && $cronFromEnv !== '' ? $cronFromEnv : '');
}

// --- ترحيل المخطط (sync_db.php) — عرّف السر على السيرفر فقط؛ لا تُرفع القيمة للمستودع ---
if (!defined('SYNC_DB_SECRET')) {
    $syncEnv = getenv('NAWRAS_SYNC_DB_SECRET');
    define('SYNC_DB_SECRET', is_string($syncEnv) && $syncEnv !== '' ? $syncEnv : '');
}
