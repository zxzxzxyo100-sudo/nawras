<?php
ini_set('memory_limit', '128M');
ini_set('max_execution_time', '45');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';

// جلب شهرين: الشهر الحالي + الشهر السابق (لالتقاط كل المتاجر النشطة)
$periods = [
    [date('Y-m-d', strtotime('-30 days')), date('Y-m-d')],
    [date('Y-m-d', strtotime('-61 days')), date('Y-m-d', strtotime('-31 days'))]
];

$storeMap = [];

foreach ($periods as $period) {
    $cursor = null;
    $page = 0;
    do {
        $url = $BASE . '/customers/orders-summary?from=' . $period[0] . '&to=' . $period[1];
        if ($cursor) $url .= '&cursor=' . $cursor;

        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $TOKEN]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        $response = curl_exec($ch);
        curl_close($ch);

        $data = json_decode($response, true);
        if (isset($data['data']) && is_array($data['data'])) {
            foreach ($data['data'] as $store) {
                $sid = $store['id'];
                if (!isset($storeMap[$sid])) {
                    $storeMap[$sid] = $store;
                } else {
                    // دمج: نحتفظ بأحدث تاريخ شحنة وأعلى عدد شحنات
                    $existing = $storeMap[$sid];
                    if (($store['total_shipments'] ?? 0) > ($existing['total_shipments'] ?? 0)) {
                        $storeMap[$sid]['total_shipments'] = $store['total_shipments'];
                    }
                    // أحدث تاريخ شحنة
                    $newDate = $store['last_shipment_date'] ?? null;
                    $oldDate = $existing['last_shipment_date'] ?? null;
                    if ($newDate && $newDate !== 'لا يوجد' && (!$oldDate || $oldDate === 'لا يوجد' || strtotime($newDate) > strtotime($oldDate))) {
                        $storeMap[$sid]['last_shipment_date'] = $newDate;
                    }
                }
            }
        }

        $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;
        $page++;
    } while ($cursor && $page < 20);
}

$allData = array_values($storeMap);
echo json_encode(['success' => true, 'data' => $allData, 'total' => count($allData)], JSON_UNESCAPED_UNICODE);
