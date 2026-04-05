<?php
// =========================================================
// orders-summary.php
// يجلب إحصائيات الطرود لجميع المتاجر النشطة
// النطاق: من 2023-01-01 حتى اليوم (يشمل كل التاريخ)
// =========================================================
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

// نطاق التاريخ: يمكن تمريره عبر GET أو استخدام الافتراضي
$from = isset($_GET['from']) ? $_GET['from'] : '2023-01-01';
$to   = isset($_GET['to'])   ? $_GET['to']   : date('Y-m-d');

$storeMap  = [];
$cursor    = null;
$page      = 0;
$truncated = false;

do {
    $url = NAWRIS_BASE . '/customers/orders-summary?from=' . $from . '&to=' . $to;
    if ($cursor) $url .= '&cursor=' . urlencode($cursor);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-API-TOKEN: ' . NAWRIS_TOKEN,
        ],
    ]);
    $response = curl_exec($ch);
    $curlErr  = curl_errno($ch);
    curl_close($ch);

    if ($curlErr || !$response) break;

    $data = json_decode($response, true);
    if (!is_array($data)) break;

    if (isset($data['data']) && is_array($data['data'])) {
        foreach ($data['data'] as $store) {
            $sid = $store['id'];
            if (!isset($storeMap[$sid])) {
                $storeMap[$sid] = $store;
            } else {
                // نحتفظ بأعلى total_shipments وأحدث last_shipment_date
                if (($store['total_shipments'] ?? 0) > ($storeMap[$sid]['total_shipments'] ?? 0)) {
                    $storeMap[$sid]['total_shipments'] = $store['total_shipments'];
                }
                $newDate = $store['last_shipment_date'] ?? null;
                $oldDate = $storeMap[$sid]['last_shipment_date'] ?? null;
                if ($newDate && $newDate !== 'لا يوجد' &&
                    (!$oldDate || $oldDate === 'لا يوجد' || strtotime($newDate) > strtotime($oldDate))) {
                    $storeMap[$sid]['last_shipment_date'] = $newDate;
                }
            }
        }
    }

    $cursor = $data['meta']['next_cursor'] ?? null;
    $page++;

    if ($page >= MAX_PAGES_ALL) {
        $truncated = true;
        break;
    }
} while ($cursor);

$allData      = array_values($storeMap);
$totalShips   = array_sum(array_column($allData, 'total_shipments'));

echo json_encode([
    'success'          => true,
    'data'             => $allData,
    'total_stores'     => count($allData),
    'total_shipments'  => $totalShips,
    'pages_fetched'    => $page,
    'truncated'        => $truncated,
    'from'             => $from,
    'to'               => $to,
], JSON_UNESCAPED_UNICODE);
