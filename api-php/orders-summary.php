<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

// جلب شهرين: الشهر الحالي + الشهر السابق (لالتقاط كل المتاجر النشطة)
$periods = [
    [date('Y-m-d', strtotime('-30 days')), date('Y-m-d')],
    [date('Y-m-d', strtotime('-61 days')), date('Y-m-d', strtotime('-31 days'))]
];

$storeMap = [];

foreach ($periods as $period) {
    $cursor    = null;
    $page      = 0;
    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . $period[0] . '&to=' . $period[1];
        if ($cursor) $url .= '&cursor=' . urlencode($cursor);

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
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
                    $existing = $storeMap[$sid];
                    if (($store['total_shipments'] ?? 0) > ($existing['total_shipments'] ?? 0)) {
                        $storeMap[$sid]['total_shipments'] = $store['total_shipments'];
                    }
                    $newDate = $store['last_shipment_date'] ?? null;
                    $oldDate = $existing['last_shipment_date'] ?? null;
                    if ($newDate && $newDate !== 'لا يوجد' && (!$oldDate || $oldDate === 'لا يوجد' || strtotime($newDate) > strtotime($oldDate))) {
                        $storeMap[$sid]['last_shipment_date'] = $newDate;
                    }
                }
            }
        }

        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;
    } while ($cursor && $page < MAX_PAGES_ORDERS);
}

$allData = array_values($storeMap);
echo json_encode(['success' => true, 'data' => $allData, 'total' => count($allData)], JSON_UNESCAPED_UNICODE);
