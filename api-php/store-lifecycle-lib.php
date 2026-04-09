<?php
declare(strict_types=1);

/**
 * تصنيف دورة حياة المتجر — شروط حصرية (أول تطابق يُعتمد).
 *
 * يعادل منطق SQL التالي عند توفر الأعمدة المناسبة (مثال توثيقي):
 *
 * CASE
 *   WHEN TIMESTAMPDIFF(HOUR, registered_at, NOW()) <= 48
 *        AND COALESCE(total_shipments,0) = 0
 *        AND (last_shipment_date IS NULL OR last_shipment_date IN ('','لا يوجد'))
 *     THEN 'new'
 *   WHEN TIMESTAMPDIFF(DAY, registered_at, NOW()) < 14 THEN 'incubating'
 *   WHEN first_shipment_at IS NOT NULL
 *        AND TIMESTAMPDIFF(DAY, first_shipment_at, NOW()) <= 14 THEN 'incubating'
 *   WHEN COALESCE(total_shipments,0) > 300
 *        OR COALESCE(weekly_shipments_7d,0) > 20 THEN 'hot'
 *   WHEN last_shipment_at IS NOT NULL
 *        AND TIMESTAMPDIFF(DAY, last_shipment_at, NOW()) <= 7 THEN 'active'
 *   WHEN last_shipment_at IS NOT NULL
 *        AND TIMESTAMPDIFF(DAY, last_shipment_at, NOW()) BETWEEN 15 AND 60 THEN 'recovery_warm' → hot_inactive
 *   WHEN last_shipment_at IS NOT NULL
 *        AND TIMESTAMPDIFF(DAY, last_shipment_at, NOW()) > 60 THEN 'inactive' → cold_inactive
 *   WHEN last_shipment_at IS NOT NULL
 *        AND TIMESTAMPDIFF(DAY, last_shipment_at, NOW()) > 7
 *        AND TIMESTAMPDIFF(DAY, last_shipment_at, NOW()) < 15 THEN 'at_risk'
 *   ELSE 'inactive'
 * END
 */

/** @return array<string,int> */
function nawras_lifecycle_constants(): array
{
    return [
        'new_hours'       => 48,
        'incubation_days' => 14,
        'active_days'     => 7,
        /** أكثر من هذا العدد من الأيام منذ آخر شحنة → حاوية cold_inactive («غير نشط بارد»). */
        'recovery_cold_inactive_days' => 60,
        'hot_total'       => 300,
        'hot_weekly'      => 20,
    ];
}

function nawras_parse_shipment_date_ts($raw): ?int
{
    if ($raw === null || $raw === '' || $raw === 'لا يوجد') {
        return null;
    }
    $t = strtotime((string) $raw);

    return $t !== false ? $t : null;
}

/** أول شحنة معروفة من واجهة Nawris أو حقول إضافية */
function nawras_first_shipment_ts(array $s): ?int
{
    foreach (['first_shipment_date', 'first_shipped_at', 'first_ship_date'] as $k) {
        if (empty($s[$k])) {
            continue;
        }
        $t = nawras_parse_shipment_date_ts($s[$k]);
        if ($t !== null) {
            return $t;
        }
    }

    return null;
}

/** معدل أسبوعي: حقول اختيارية من API؛ وإلا 0 (يُعتمد عندها total > 300 فقط للساخن) */
function nawras_weekly_shipments_7d(array $s): int
{
    $keys = ['shipments_last_7_days', 'shipments_last_7d', 'parcels_last_week', 'weekly_shipments', 'shipments_week'];
    foreach ($keys as $k) {
        if (isset($s[$k]) && is_numeric($s[$k])) {
            return (int) $s[$k];
        }
        if (isset($s['stats'][$k]) && is_numeric($s['stats'][$k])) {
            return (int) $s['stats'][$k];
        }
    }

    return 0;
}

/**
 * @return string new|incubating|hot|active|at_risk|cold|inactive
 */
function nawras_compute_lifecycle(array $s, int $now): string
{
    $c = nawras_lifecycle_constants();

    $regRaw = trim((string) ($s['registered_at'] ?? ''));
    $regTs = $regRaw !== '' ? strtotime($regRaw) : null;
    if ($regTs === false) {
        $regTs = null;
    }
    $regHrs = $regTs !== null ? ($now - $regTs) / 3600 : PHP_INT_MAX;
    $regDays = $regTs !== null ? ($now - $regTs) / 86400 : PHP_INT_MAX;

    $total = (int) ($s['total_shipments'] ?? 0);
    $lastTs = nawras_parse_shipment_date_ts($s['last_shipment_date'] ?? null);
    $hasShipped = $total > 0 || $lastTs !== null;

    $daysSinceLast = $lastTs !== null ? ($now - $lastTs) / 86400 : null;

    $firstTs = nawras_first_shipment_ts($s);
    $daysSinceFirst = $firstTs !== null ? ($now - $firstTs) / 86400 : null;
    $firstWithin14 = $firstTs !== null && $daysSinceFirst <= $c['incubation_days'];

    $weekly = nawras_weekly_shipments_7d($s);

    // 1. متجر جديد — 48 ساعة بدون أي شحن
    if ($regHrs <= $c['new_hours'] && !$hasShipped) {
        return 'new';
    }

    // 2. تحت الاحتضان — تسجيل أقل من 14 يوماً، أو أول شحنة ضمن آخر 14 يوماً
    if ($regDays < $c['incubation_days']) {
        return 'incubating';
    }
    if ($firstWithin14) {
        return 'incubating';
    }

    // 3. ساخن / VIP
    if ($total > $c['hot_total'] || $weekly > $c['hot_weekly']) {
        return 'hot';
    }

    $recoveryColdDays = (int) ($c['recovery_cold_inactive_days'] ?? 60);

    // 4. نشط — شحن خلال 7 أيام
    if ($hasShipped && $daysSinceLast !== null && $daysSinceLast <= $c['active_days']) {
        return 'active';
    }

    // 4b. 8–14 يوماً منذ آخر شحنة — يحتاج متابعة عاجلة (ليس «بارد» بعد)
    if ($hasShipped && $daysSinceLast !== null && $daysSinceLast > $c['active_days'] && $daysSinceLast < 15) {
        return 'at_risk';
    }

    // 5. 15–60 يوماً منذ آخر شحنة — غير نشط ساخن (استعادة)، لا يُعرَض كـ«بارد» في الواجهة
    if ($hasShipped && $daysSinceLast !== null && $daysSinceLast >= 15 && $daysSinceLast <= $recoveryColdDays) {
        return 'recovery_warm';
    }

    // 6. أكثر من 60 يوماً منذ آخر شحنة — غير نشط بارد (cold_inactive)
    if ($hasShipped && $daysSinceLast !== null && $daysSinceLast > $recoveryColdDays) {
        return 'inactive';
    }

    // بدون شحنة بعد نافذة الاحتضان: ساخن حتى 60 يوماً من التسجيل، ثم بارد
    if (!$hasShipped && $regDays > $c['incubation_days'] && $regDays <= $recoveryColdDays) {
        return 'recovery_warm';
    }

    return 'inactive';
}

function nawras_lifecycle_label_ar(string $lc): string
{
    $map = [
        'new'        => 'متجر جديد',
        'incubating' => 'تحت الاحتضان',
        'hot'        => 'ساخن / VIP',
        'active'     => 'نشط',
        'at_risk'    => 'يحتاج متابعة عاجلة',
        'recovery_warm' => 'غير نشط ساخن',
        'cold'       => 'بارد',
        'inactive'   => 'غير نشط بارد',
    ];

    return $map[$lc] ?? $lc;
}

/**
 * ربط بحاويات الـ CRM الحالية (بدون كسر الواجهات).
 *
 * @return string incubating|active_shipping|hot_inactive|cold_inactive
 */
function nawras_lifecycle_legacy_bucket(string $lc): string
{
    switch ($lc) {
        case 'new':
        case 'incubating':
            return 'incubating';
        case 'hot':
        case 'active':
            return 'active_shipping';
        case 'at_risk':
        case 'recovery_warm':
        case 'cold':
            return 'hot_inactive';
        case 'inactive':
        default:
            return 'cold_inactive';
    }
}

/**
 * يضيف lifecycle + تسمية عربية + is_hot_vip عند الحاجة.
 *
 * @return string نفس قيمة nawras_compute_lifecycle
 */
function nawras_apply_lifecycle_tags(array &$s, int $now): string
{
    $lc = nawras_compute_lifecycle($s, $now);
    $s['lifecycle'] = $lc;
    $s['lifecycle_label_ar'] = nawras_lifecycle_label_ar($lc);
    if ($lc === 'hot') {
        $s['is_hot_vip'] = true;
    } else {
        unset($s['is_hot_vip']);
    }

    return $lc;
}

/**
 * دفع متجر إلى نتيجة all-stores مع العدّادات الصحيحة.
 *
 * @param array<string,array|int> $result
 * @param array<string,int>       $counts
 */
function nawras_push_lifecycle_bucket(array $s, string $lc, array &$result, array &$counts, bool $incubationAsTotalOnly = false): void
{
    $bucket = nawras_lifecycle_legacy_bucket($lc);
    if ($lc === 'hot') {
        $s['is_hot_vip'] = true;
    }
    $s['lifecycle'] = $lc;
    $s['lifecycle_label_ar'] = nawras_lifecycle_label_ar($lc);
    $s['_cat'] = $bucket;

    $result[$bucket][] = $s;
    $counts[$bucket]++;
    $counts['total']++;

    if ($bucket === 'incubating' && $incubationAsTotalOnly) {
        return;
    }
    if ($bucket !== 'incubating') {
        $counts['total_active']++;
    }
}

/**
 * استبدال تصنيف «أيام منذ آخر شحنة» القديم (14 / 60) بمنطق دورة الحياة.
 *
 * @param array<string,array|int> $result
 * @param array<string,int>       $counts
 */
function nawras_classify_mature_store_row(array $s, int $now, array &$result, array &$counts): void
{
    $lc = nawras_apply_lifecycle_tags($s, $now);
    nawras_push_lifecycle_bucket($s, $lc, $result, $counts, false);
}
