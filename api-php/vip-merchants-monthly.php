<?php
/**
 * كبار التجار — معيار شهري:
 *  المتجر يُعدّ VIP إذا تجاوز شهر واحد على الأقل من آخر N شهراً عتبة 300 طرد.
 *
 *  GET ?months=12&threshold=300
 *  - months: عدد الأشهر للخلف (الافتراضي 12، الحد الأقصى 36)
 *  - threshold: عتبة الشهر الواحد (الافتراضي 300)
 *
 * الاستجابة:
 *  {
 *    success: true,
 *    threshold: 300,
 *    months: ['2026-04', '2026-03', ...],
 *    data: [
 *      {
 *        id, name, phone, status, registered_at, registered_by,
 *        last_shipment_date,
 *        monthly: { '2026-04': 412, '2026-03': 287, ... },
 *        monthly_max: 412,
 *        monthly_max_month: '2026-04',
 *        qualifying_months: 1,
 *        total_shipments: 5230  // مجموع الأشهر المسحوبة
 *      },
 *      ...
 *    ]
 *  }
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/nawris-vip-lib.php';
require_once __DIR__ . '/nawris-orders-summary-core.php';

ini_set('memory_limit', '512M');
ini_set('max_execution_time', '600');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$threshold = (int) ($_GET['threshold'] ?? 300);
if ($threshold < 1) {
    $threshold = 300;
}

$tz = new DateTimeZone('Asia/Baghdad');
$today = new DateTimeImmutable('today', $tz);

/**
 * نطاق الأشهر المخصّص: ?from_month=YYYY-MM&to_month=YYYY-MM
 * يفضّلان معاً؛ وإلا يُستخدم ?months=N (افتراضي 2) للخلف من هذا الشهر.
 */
$fromMonthIn = trim((string) ($_GET['from_month'] ?? ''));
$toMonthIn = trim((string) ($_GET['to_month'] ?? ''));
$monthList = [];
$useCustomRange = $fromMonthIn !== '' && $toMonthIn !== '';

if ($useCustomRange) {
    if (!preg_match('/^\d{4}-\d{2}$/', $fromMonthIn) || !preg_match('/^\d{4}-\d{2}$/', $toMonthIn)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'صيغة الشهر يجب أن تكون YYYY-MM.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $fromDt = DateTimeImmutable::createFromFormat('Y-m-d', $fromMonthIn . '-01', $tz);
    $toDt = DateTimeImmutable::createFromFormat('Y-m-d', $toMonthIn . '-01', $tz);
    if (!$fromDt || !$toDt) {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'تاريخ غير صالح.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($fromDt > $toDt) {
        $tmp = $fromDt; $fromDt = $toDt; $toDt = $tmp;
    }
    /** سقف 36 شهراً لتجنّب استدعاءات API هائلة */
    $cur = $toDt;
    while ($cur >= $fromDt && count($monthList) < 36) {
        $monthList[] = $cur->format('Y-m');
        $cur = $cur->modify('-1 month');
    }
} else {
    $months = (int) ($_GET['months'] ?? 2);
    if ($months < 1) {
        $months = 2;
    }
    if ($months > 36) {
        $months = 36;
    }
    $cur = $today->modify('first day of this month');
    for ($i = 0; $i < $months; $i++) {
        $monthList[] = $cur->format('Y-m');
        $cur = $cur->modify('-1 month');
    }
}

$monthly = [];   // [storeId => ['YYYY-MM' => count]]
$rows = [];      // [storeId => meta]
$fetchMeta = []; // [YYYY-MM => http_code]

foreach ($monthList as $ym) {
    $monthStart = DateTimeImmutable::createFromFormat('Y-m-d', $ym . '-01', $tz);
    if (!$monthStart) {
        continue;
    }
    $monthEnd = $monthStart->modify('last day of this month');
    /** آخر شهر: لا تتجاوز اليوم */
    if ($monthEnd > $today) {
        $monthEnd = $today;
    }
    $from = $monthStart->format('Y-m-d');
    $to = $monthEnd->format('Y-m-d');

    $res = ['stores' => [], 'meta' => ['ok' => false]];
    foreach ([true, false] as $verifySsl) {
        $r = nawris_orders_summary_fetch_all($from, $to, VIP_ORDERS_SUMMARY_MAX_PAGES, $verifySsl);
        if (!empty($r['meta']['ok'])) {
            $res = $r;
            break;
        }
        $code = (int) ($r['meta']['http_code'] ?? 0);
        if ($code !== 0 && $code !== 500 && $code !== 502 && $code !== 503 && $code !== 504) {
            $res = $r;
            break;
        }
        $res = $r;
    }
    $fetchMeta[$ym] = [
        'from' => $from,
        'to' => $to,
        'ok' => !empty($res['meta']['ok']),
        'http_code' => (int) ($res['meta']['http_code'] ?? 0),
        'stores' => is_array($res['stores'] ?? null) ? count($res['stores']) : 0,
    ];

    if (empty($res['meta']['ok']) || !is_array($res['stores'] ?? null)) {
        continue;
    }

    foreach ($res['stores'] as $sid => $store) {
        $sid = (int) $sid;
        if ($sid <= 0 || !is_array($store)) {
            continue;
        }
        /**
         * عدد طرود الشهر = shipments_in_range فقط (نطاق محدد).
         * total_shipments هو الإجمالي مدى الحياة — لا يُستخدم هنا.
         */
        $monthCount = 0;
        foreach (['shipments_in_range', 'total_in_range', 'orders_in_range'] as $k) {
            if (isset($store[$k]) && is_numeric($store[$k])) {
                $monthCount = (int) $store[$k];
                break;
            }
        }
        if (!isset($monthly[$sid])) {
            $monthly[$sid] = [];
        }
        $monthly[$sid][$ym] = $monthCount;
        /** نحتفظ بأحدث صف للميتاداتا (الأحدث أولاً في الحلقة) */
        if (!isset($rows[$sid])) {
            $rows[$sid] = $store;
        }
    }
}

$out = [];
foreach ($monthly as $sid => $byMonth) {
    if (!isset($rows[$sid])) {
        continue;
    }
    $row = $rows[$sid];
    if (!nawris_is_active_status($row)) {
        continue;
    }
    $maxMonth = '';
    $maxCount = 0;
    $qualifyingMonths = 0;
    $sumAll = 0;
    foreach ($byMonth as $ym => $count) {
        $sumAll += $count;
        if ($count > $maxCount) {
            $maxCount = $count;
            $maxMonth = $ym;
        }
        if ($count >= $threshold) {
            $qualifyingMonths++;
        }
    }
    if ($maxCount < $threshold) {
        continue;
    }
    $out[] = [
        'id' => $sid,
        'name' => isset($row['name']) ? (string) $row['name'] : '',
        'phone' => isset($row['phone']) ? (string) $row['phone'] : '',
        'city' => isset($row['city']) ? (string) $row['city'] : '',
        'status' => isset($row['status']) ? (string) $row['status'] : '',
        'registered_at' => $row['registered_at'] ?? null,
        'registered_by' => $row['registered_by'] ?? '',
        'last_shipment_date' => $row['last_shipment_date'] ?? null,
        'total_shipments' => $sumAll,
        'monthly' => $byMonth,
        'monthly_max' => $maxCount,
        'monthly_max_month' => $maxMonth,
        'qualifying_months' => $qualifyingMonths,
    ];
}

usort($out, function ($a, $b) {
    return $b['monthly_max'] - $a['monthly_max'];
});

echo json_encode([
    'success' => true,
    'threshold' => $threshold,
    'months' => $monthList,
    'count' => count($out),
    'data' => $out,
    'fetch' => $fetchMeta,
], JSON_UNESCAPED_UNICODE);
