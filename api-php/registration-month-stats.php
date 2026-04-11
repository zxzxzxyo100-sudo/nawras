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

/** تقرير تفصيلي: ?detail=1 — قائمة المتاجر المسجّلة في الشهر مع حقول الشحن */
$detail = isset($_GET['detail']) && ($_GET['detail'] === '1' || $_GET['detail'] === 'true');

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
$reportRows = [];
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
        $byDate = registration_month_row_has_shipped($row);
        if ($byDate) {
            $shipped++;
        }
        if ($detail) {
            $sid = $row['id'] ?? null;
            $reportRows[] = [
                'store_id'             => $sid,
                'name'                 => isset($row['name']) ? (string) $row['name'] : '',
                'phone'                => isset($row['phone']) ? (string) $row['phone'] : '',
                'registered_at'        => $regRaw,
                'last_shipment_date'   => trim((string) ($row['last_shipment_date'] ?? '')),
                'total_shipments'      => (int) ($row['total_shipments'] ?? 0),
                'shipped_by_last_date' => $byDate,
            ];
        }
    }
}

if ($detail && !$cacheStale) {
    usort($reportRows, static function (array $a, array $b): int {
        $ta = strtotime((string) ($a['registered_at'] ?? '')) ?: 0;
        $tb = strtotime((string) ($b['registered_at'] ?? '')) ?: 0;

        return $tb <=> $ta;
    });
}

$pct = (!$cacheStale && $registered > 0)
    ? (int) round(100 * $shipped / $registered)
    : null;

$out = [
    'success'                  => true,
    'registered_this_month'    => $registered,
    'shipped_among_registered' => $shipped,
    'conversion_percent'       => $pct,
    'month_label'              => $monthStart->format('Y-m'),
    'month_title_ar'           => $monthStart->format('Y') . '/' . $monthStart->format('m'),
    'cache_stale'              => $cacheStale,
    'hint'                     => $cacheStale
        ? 'حدّث الذاكرة بتشغيل all-stores.php (نسخة البحث القديمة لا تتضمّن تواريخ التسجيل).'
        : null,
    'rule'                     => 'شحن = تاريخ آخر شحنة صالح (لا يُكفي إجمالي الطرود بدون تاريخ)',
    'generated_at'             => date('c'),
];

if ($detail) {
    $out['report_rows'] = $cacheStale ? [] : $reportRows;
    $out['report_row_count'] = count($out['report_rows']);
}

echo json_encode($out, JSON_UNESCAPED_UNICODE);
