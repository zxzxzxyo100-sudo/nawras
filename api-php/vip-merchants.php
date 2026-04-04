<?php
/**
 * كبار التجار — مسار مستقل: يعتمد فقط على orders-summary من Nawris مع جلب كامل الصفحات.
 * (لا يُقيَّد بحد 200 صفحة داخل all-stores.php)
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/nawris-vip-lib.php';

ini_set('memory_limit', '512M');
ini_set('max_execution_time', '300');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$from = '2020-01-01';
$to = date('Y-m-d');

$os = nawris_fetch_orders_summary_for_vip($from, $to);
$totals = $os['totals'];
$rows = $os['rows'];
$fetchMeta = $os['meta'] ?? [];

$vip = [];
foreach ($totals as $id => $t) {
    $id = (int) $id;
    if ($id <= 0 || $t < 300) {
        continue;
    }
    $row = $rows[$id] ?? null;
    if (!$row || !is_array($row) || !nawris_is_active_status($row)) {
        continue;
    }
    $row['total_shipments'] = $t;
    $vip[] = $row;
}

usort($vip, function ($a, $b) {
    return nawris_total_shipments($b) - nawris_total_shipments($a);
});

echo json_encode([
    'success' => true,
    'data'    => $vip,
    'count'   => count($vip),
    'range'   => [
        'from' => $from,
        'to'   => $to,
    ],
    'fetch'   => $fetchMeta,
    'stores_in_summary' => count($totals),
], JSON_UNESCAPED_UNICODE);
