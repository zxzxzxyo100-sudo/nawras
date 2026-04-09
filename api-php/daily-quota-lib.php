<?php
declare(strict_types=1);

/**
 * حد يومي صارم: عدد المتاجر المُعالَجة لكل موظف (استبيان محفوظ + لم يرد/مشغول من الطابور)
 * منذ 00:00:00 بتوقيت خادم MySQL (CURDATE).
 */

if (!defined('NAWRAS_DAILY_STORE_QUOTA')) {
    define('NAWRAS_DAILY_STORE_QUOTA', 50);
}

function nawras_ensure_daily_quota_schema(PDO $pdo): void
{
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS employee_daily_processed_stores (
            username VARCHAR(191) NOT NULL,
            work_date DATE NOT NULL,
            store_id INT NOT NULL,
            source VARCHAR(32) NOT NULL DEFAULT 'survey',
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, work_date, store_id),
            KEY idx_user_date (username, work_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

function nawras_daily_quota_normalize_username(?string $username): string
{
    return trim((string) $username);
}

/**
 * هل سُجِّل لهذا المتجر إنجاز اليوم لهذا الموظف (منع الازدواجية).
 */
function nawras_user_processed_store_today(PDO $pdo, string $username, int $storeId): bool
{
    nawras_ensure_daily_quota_schema($pdo);
    $u = nawras_daily_quota_normalize_username($username);
    if ($u === '' || $storeId <= 0) {
        return false;
    }
    $st = $pdo->prepare(
        'SELECT 1 FROM employee_daily_processed_stores
         WHERE username = ? AND work_date = CURDATE() AND store_id = ? LIMIT 1'
    );
    $st->execute([$u, $storeId]);

    return (bool) $st->fetchColumn();
}

/**
 * تسجيل متجر كمُعالَج اليوم (مرة واحدة لكل متجر) — استدعاء بعد حفظ استبيان أو لم يرد من الطابور أو إكمال استعادة.
 *
 * @return bool true إن أُدخل صف جديد
 */
function register_daily_store_processed(PDO $pdo, string $username, int $storeId, string $source = 'survey'): bool
{
    nawras_ensure_daily_quota_schema($pdo);
    $u = nawras_daily_quota_normalize_username($username);
    if ($u === '' || $storeId <= 0) {
        return false;
    }
    $src = preg_replace('/[^a-z0-9_]/i', '', $source) ?: 'survey';
    if (strlen($src) > 31) {
        $src = substr($src, 0, 31);
    }
    $ins = $pdo->prepare(
        'INSERT IGNORE INTO employee_daily_processed_stores (username, work_date, store_id, source)
         VALUES (?, CURDATE(), ?, ?)'
    );
    $ins->execute([$u, $storeId, $src]);

    return $ins->rowCount() > 0;
}

/**
 * @return array{count:int,limit:int,remaining:int,quota_reached:bool,message_en:string,message_ar:string}
 */
function getDailyProgress(PDO $pdo, string $username): array
{
    nawras_ensure_daily_quota_schema($pdo);
    $u = nawras_daily_quota_normalize_username($username);
    $limit = (int) NAWRAS_DAILY_STORE_QUOTA;
    if ($u === '') {
        return [
            'count'         => 0,
            'limit'         => $limit,
            'remaining'     => $limit,
            'quota_reached' => false,
            'message_en'    => '',
            'message_ar'    => '',
        ];
    }
    $st = $pdo->prepare(
        'SELECT COUNT(*) FROM employee_daily_processed_stores
         WHERE username = ? AND work_date = CURDATE()'
    );
    $st->execute([$u]);
    $count = (int) $st->fetchColumn();
    $remaining = max(0, $limit - $count);
    $reached = $count >= $limit;

    return [
        'count'         => $count,
        'limit'         => $limit,
        'remaining'     => $remaining,
        'quota_reached' => $reached,
        'message_en'    => $reached
            ? 'You have completed your daily quota of 50 stores. Great job!'
            : '',
        'message_ar'    => $reached
            ? 'أكملت حصتك اليومية البالغة 50 متجراً. أحسنت!'
            : '',
    ];
}

/**
 * منع معالجة متجر جديد عند بلوغ الحد (ما عدا إن كان نفس المتجر مُسجَّلاً مسبقاً اليوم — إعادة محاولة آمنة).
 */
function nawras_daily_quota_blocks_new_store(PDO $pdo, string $username, int $storeId): bool
{
    $dq = getDailyProgress($pdo, $username);
    if (!$dq['quota_reached']) {
        return false;
    }

    return !nawras_user_processed_store_today($pdo, $username, $storeId);
}
