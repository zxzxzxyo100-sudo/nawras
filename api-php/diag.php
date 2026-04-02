<?php
require_once __DIR__ . '/config.php';
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$now = time();

// جلب أول صفحة من orders-summary (الـ endpoint المشكل)
$url = NAWRIS_BASE . '/customers/orders-summary?from=2026-01-01&to=' . date('Y-m-d');
$ch  = curl_init();
curl_setopt_array($ch, [
    CURLOPT_URL            => $url,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_SSL_VERIFYPEER => false,
    CURLOPT_SSL_VERIFYHOST => false,
    CURLOPT_HTTPHEADER     => [
        'Accept: application/json',
        'X-API-TOKEN: ' . NAWRIS_TOKEN,
    ],
]);
$raw = curl_exec($ch);
$info = curl_getinfo($ch);
curl_close($ch);

$d = json_decode($raw, true);
$records = $d['data'] ?? [];

// تحليل أول 20 متجر
$analysis = [];
$counts = ['active_shipping'=>0,'hot_inactive'=>0,'cold_inactive'=>0,'no_date'=>0];

foreach (array_slice($records, 0, 20) as $s) {
    $regTs    = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $regDays  = $regTs ? round(($now - $regTs) / 86400, 1) : null;
    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
                ? strtotime($s['last_shipment_date']) : null;
    $daysShip = $lastShip ? round(($now - $lastShip) / 86400, 1) : null;

    if ($regDays !== null && $regDays < 90) {
        $cat = 'incubating';
    } elseif ($daysShip === null) {
        $cat = 'cold_inactive(no_date)';
        $counts['no_date']++;
    } elseif ($daysShip <= 14) {
        $cat = 'active_shipping ✅';
        $counts['active_shipping']++;
    } elseif ($daysShip <= 60) {
        $cat = 'hot_inactive 🔥';
        $counts['hot_inactive']++;
    } else {
        $cat = 'cold_inactive ❄️';
        $counts['cold_inactive']++;
    }

    $analysis[] = [
        'id'                 => $s['id'],
        'name'               => $s['name'] ?? '?',
        'registered_at'      => $s['registered_at'] ?? null,
        'reg_days_ago'       => $regDays,
        'last_shipment_date' => $s['last_shipment_date'] ?? null,
        'ship_days_ago'      => $daysShip,
        'total_shipments'    => $s['total_shipments'] ?? null,
        'category'           => $cat,
    ];
}

// اختبار أيضاً أول صفحة من inactive?days=61
$ch2 = curl_init();
curl_setopt_array($ch2, [
    CURLOPT_URL            => NAWRIS_BASE . '/customers/inactive?days=61',
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 20,
    CURLOPT_HTTPHEADER     => ['Accept: application/json', 'X-API-TOKEN: ' . NAWRIS_TOKEN],
]);
$raw2  = curl_exec($ch2);
curl_close($ch2);
$d2    = json_decode($raw2, true);
$cold1 = isset($d2['data'][0]) ? $d2['data'][0] : null;

echo json_encode([
    'http_code'         => $info['http_code'],
    'total_in_page'     => count($records),
    'has_next_page'     => !empty($d['meta']['next_cursor']),
    'fields_available'  => isset($records[0]) ? array_keys($records[0]) : [],
    'sample_counts_in_this_page' => $counts,
    'sample_20_stores'  => $analysis,
    'cold_api_sample'   => $cold1,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
