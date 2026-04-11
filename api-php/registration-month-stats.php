<?php
/**
 * إحصاء: متاجر سُجّلت في الشهر التقويمي الحالي، وكم منها «شحنت»، ونسبة التحويل.
 *
 * «شحن» هنا يعتمد على تاريخ آخر شحنة فقط — لا يُكفي إجمالي الطرود بدون تاريخ
 * (قد يشمل هدايا أو طلبات لم تصل بعد لشركة الشحن).
 *
 * المصدر: cache/stores_search_lite.json (يُحدَّث عند تشغيل all-stores.php).
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$tz = new DateTimeZone('Asia/Riyadh');
$now = new DateTimeImmutable('now', $tz);
$monthStart = $now->modify('first day of this month')->setTime(0, 0, 0);
$monthEnd = $now->modify('first day of next month')->setTime(0, 0, 0);
$startTs = $monthStart->getTimestamp();
$endTs = $monthEnd->getTimestamp();

/**
 * شحن فعلي = تاريخ آخر شحنة معروف وصالح (لا يُعتمد على إجمالي الطرود وحده).
 *
 * @param array<string,mixed> $row
 */
function registration_month_row_has_shipped(array $row): bool
{
    $lsd = trim((string) ($row['last_shipment_date'] ?? ''));
    if ($lsd === '' || $lsd === 'لا يوجد') {
        return false;
    }
    $ts = strtotime($lsd);

    return $ts !== false && $ts > 0;
}

$path = __DIR__ . '/cache/stores_search_lite.json';
if (!is_readable($path)) {
    echo json_encode([
        'success'                 => false,
        'error'                   => 'cache_missing',
        'hint'                    => 'شغّل all-stores.php مرة لبناء الذاكرة',
        'registered_this_month'   => 0,
        'shipped_among_registered'=> 0,
        'conversion_percent'      => null,
        'month_label'             => $monthStart->format('Y-m'),
        'cache_stale'             => true,
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents($path);
$list = json_decode($raw, true);
if (!is_array($list)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cache_invalid'], JSON_UNESCAPED_UNICODE);
    exit;
}

$registered = 0;
$shipped = 0;
$cacheStale = false;
foreach ($list as $probe) {
    if (is_array($probe) && !array_key_exists('registered_at', $probe)) {
        $cacheStale = true;
        break;
    }
}

if (!$cacheStale) {
    foreach ($list as $row) {
        if (!is_array($row)) {
            continue;
        }
        $regRaw = trim((string) ($row['registered_at'] ?? ''));
        if ($regRaw === '') {
            continue;
        }
        $regTs = strtotime($regRaw);
        if ($regTs === false) {
            continue;
        }
        if ($regTs < $startTs || $regTs >= $endTs) {
            continue;
        }
        $registered++;
        if (registration_month_row_has_shipped($row)) {
            $shipped++;
        }
    }
}

$pct = (!$cacheStale && $registered > 0)
    ? (int) round(100 * $shipped / $registered)
    : null;

echo json_encode([
    'success'                  => true,
    'registered_this_month'    => $registered,
    'shipped_among_registered' => $shipped,
    'conversion_percent'       => $pct,
    'month_label'              => $monthStart->format('Y-m'),
    'cache_stale'              => $cacheStale,
    'hint'                     => $cacheStale
        ? 'حدّث الذاكرة بتشغيل all-stores.php (نسخة البحث القديمة لا تتضمّن تواريخ التسجيل).'
        : null,
], JSON_UNESCAPED_UNICODE);
