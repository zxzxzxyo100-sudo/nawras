<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

function fetchAll($url, $max = MAX_PAGES_ALL) {
    $all    = [];
    $cursor = null;
    $p      = 0;
    do {
        $u  = $cursor ? $url . (strpos($url, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor) : $url;
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $u,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r  = curl_exec($ch);
        curl_close($ch);
        $d  = json_decode($r, true);
        if (isset($d['data'])) foreach ($d['data'] as $i) $all[$i['id']] = $i;
        $cursor = $d['meta']['next_cursor'] ?? null;
        $p++;
    } while ($cursor && $p < $max);
    return $all;
}

$now = time();

// جلب البيانات من API مباشرة (بدون شروط محلية)
$new      = fetchAll(NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 60 * 86400), MAX_PAGES_NEW);
$inactive = fetchAll(NAWRIS_BASE . '/customers/inactive?days=14', MAX_PAGES_INACTIVE);
$orders   = fetchAll(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 60 * 86400) . '&to=' . date('Y-m-d'), MAX_PAGES_ORDERS);

$result = [
    'incubating' => [],  // متاجر جديدة — كما تُعيدها /customers/new
    'active'     => [],  // متاجر نشطة — كما تُعيدها /customers/orders-summary
    'inactive'   => [],  // متاجر غير نشطة — كما تُعيدها /customers/inactive
];
$counts = [
    'incubating' => 0,
    'active'     => 0,
    'inactive'   => 0,
    'total'      => 0,
];

$seen = [];

// احتضان: مباشرة من /customers/new
foreach ($new as $id => $s) {
    $s['_cat'] = 'incubating';
    $result['incubating'][] = $s;
    $counts['incubating']++;
    $counts['total']++;
    $seen[$id] = true;
}

// غير نشط: مباشرة من /customers/inactive
foreach ($inactive as $id => $s) {
    if (isset($seen[$id])) continue;
    $s['_cat'] = 'inactive';
    $result['inactive'][] = $s;
    $counts['inactive']++;
    $counts['total']++;
    $seen[$id] = true;
}

// نشط: من /customers/orders-summary (ما لم يرد في القائمتين السابقتين)
foreach ($orders as $id => $s) {
    if (isset($seen[$id])) continue;
    $s['_cat'] = 'active';
    $result['active'][] = $s;
    $counts['active']++;
    $counts['total']++;
    $seen[$id] = true;
}

echo json_encode([
    'success' => true,
    'counts'  => $counts,
    'data'    => $result,
], JSON_UNESCAPED_UNICODE);
