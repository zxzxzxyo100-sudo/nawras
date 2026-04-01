<?php
// ===== API موحد: يجلب كل المتاجر ويقسمها حسب الحالة =====
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';

function fetchAllPages($url, $token, $maxPages = 100) {
    $allData = [];
    $cursor = null;
    $page = 0;
    do {
        $fetchUrl = $cursor ? $url . (strpos($url,'?')!==false?'&':'?') . 'cursor=' . $cursor : $url;
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $fetchUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $token]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 10);
        curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
        $response = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($response, true);
        if (isset($data['data']) && is_array($data['data'])) {
            foreach ($data['data'] as $item) {
                $allData[$item['id']] = $item; // key by ID لمنع التكرار
            }
        }
        $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;
        $page++;
    } while ($cursor && $page < $maxPages);
    return $allData;
}

// ===== جلب البيانات من 3 مصادر =====
$now = time();
$today = date('Y-m-d');

// 1. المتاجر الجديدة (آخر 60 يوم)
$since = date('Y-m-d', $now - 60*86400);
$newStores = fetchAllPages($BASE . '/customers/new?since=' . $since, $TOKEN, 30);

// 2. المتاجر الخاملة
$inactiveStores = fetchAllPages($BASE . '/customers/inactive?days=10', $TOKEN, 30);

// 3. إحصائيات الطرود (شهرين: الحالي + السابق)
$ordersMonth1 = fetchAllPages($BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 30*86400) . '&to=' . $today, $TOKEN, 60);
$ordersMonth2 = fetchAllPages($BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 61*86400) . '&to=' . date('Y-m-d', $now - 31*86400), $TOKEN, 60);

// ===== دمج كل المتاجر في قائمة واحدة =====
$allStores = [];

// دمج orders (الأهم - فيه بيانات الشحن)
foreach ($ordersMonth1 as $id => $s) { $allStores[$id] = $s; }
foreach ($ordersMonth2 as $id => $s) {
    if (!isset($allStores[$id])) {
        $allStores[$id] = $s;
    } else {
        // أحدث تاريخ شحنة
        $new = $s['last_shipment_date'] ?? null;
        $old = $allStores[$id]['last_shipment_date'] ?? null;
        if ($new && $new !== 'لا يوجد' && (!$old || $old === 'لا يوجد' || strtotime($new) > strtotime($old))) {
            $allStores[$id]['last_shipment_date'] = $new;
        }
        if (($s['total_shipments'] ?? 0) > ($allStores[$id]['total_shipments'] ?? 0)) {
            $allStores[$id]['total_shipments'] = $s['total_shipments'];
        }
    }
}

// دمج new-customers (قد لا يكون في orders)
foreach ($newStores as $id => $s) {
    if (!isset($allStores[$id])) {
        $allStores[$id] = $s;
    } else {
        // تحديث registered_at إذا أحدث
        if (!empty($s['registered_at'])) $allStores[$id]['registered_at'] = $s['registered_at'];
    }
}

// دمج inactive
foreach ($inactiveStores as $id => $s) {
    if (!isset($allStores[$id])) {
        $allStores[$id] = $s;
    }
}

// ===== تصنيف المتاجر =====
$categories = [
    'incubating' => [],  // أقل من 14 يوم من التسجيل
    'active' => [],      // شحن خلال آخر 14 يوم
    'inactive_hot' => [], // آخر شحنة 14-60 يوم
    'cold' => [],        // آخر شحنة 60+ يوم
    'never_shipped' => [] // لم يشحن أبداً (48+ ساعة)
];

$counts = ['total' => 0, 'incubating' => 0, 'active' => 0, 'inactive_hot' => 0, 'cold' => 0, 'never_shipped' => 0];

foreach ($allStores as $id => $store) {
    $regDate = !empty($store['registered_at']) ? strtotime($store['registered_at']) : null;
    $daysSinceReg = $regDate ? ($now - $regDate) / 86400 : 999;

    $lastShip = (!empty($store['last_shipment_date']) && $store['last_shipment_date'] !== 'لا يوجد') ? strtotime($store['last_shipment_date']) : null;
    $daysSinceShip = $lastShip ? ($now - $lastShip) / 86400 : 999;

    $hasShipped = $lastShip || (isset($store['total_shipments']) && $store['total_shipments'] > 0);

    // التصنيف
    if ($daysSinceReg < 14) {
        $store['_category'] = 'incubating';
        $categories['incubating'][] = $store;
        $counts['incubating']++;
    } elseif ($hasShipped && $daysSinceShip <= 14) {
        $store['_category'] = 'active';
        $categories['active'][] = $store;
        $counts['active']++;
    } elseif ($hasShipped && $daysSinceShip > 14 && $daysSinceShip <= 60) {
        $store['_category'] = 'inactive_hot';
        $categories['inactive_hot'][] = $store;
        $counts['inactive_hot']++;
    } elseif ($hasShipped && $daysSinceShip > 60) {
        $store['_category'] = 'cold';
        $categories['cold'][] = $store;
        $counts['cold']++;
    } else {
        $store['_category'] = 'never_shipped';
        $categories['never_shipped'][] = $store;
        $counts['never_shipped']++;
    }
    $counts['total']++;
}

echo json_encode([
    'success' => true,
    'counts' => $counts,
    'data' => [
        'incubating' => array_values($categories['incubating']),
        'active' => array_values($categories['active']),
        'inactive_hot' => array_values($categories['inactive_hot']),
        'cold' => array_values($categories['cold']),
        'never_shipped' => array_values($categories['never_shipped'])
    ]
], JSON_UNESCAPED_UNICODE);
