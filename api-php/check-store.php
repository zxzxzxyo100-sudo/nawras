<?php
// =========================================================
// check-store.php — تشخيص متجر بعينه + هيكل بيانات API
// الوصول: /api-php/check-store.php?id=8130
// =========================================================
require_once __DIR__ . '/config.php';

ini_set('memory_limit',       MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$targetId = $_GET['id'] ?? '8130';
$now      = time();
$today    = date('Y-m-d');

function apiFetch($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-API-TOKEN: ' . NAWRIS_TOKEN,
        ],
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_errno($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    if ($err) return ['_error' => curl_strerror($err), '_code' => $err];
    $d = json_decode($raw, true);
    if (!$d)  return ['_error' => 'JSON parse failed', '_raw' => substr($raw, 0, 300)];
    $d['_http_code'] = $info['http_code'];
    return $d;
}

// ═══════════════════════════════════════════════════════════
// 1. جلب صفحة واحدة من orders-summary وفحص هيكل الحقول
// ═══════════════════════════════════════════════════════════
$ordersPage = apiFetch(
    NAWRIS_BASE . '/customers/orders-summary?from=2023-01-01&to=' . $today
);

$firstRecord = isset($ordersPage['data'][0]) ? $ordersPage['data'][0] : null;
$fieldNames  = $firstRecord ? array_keys($firstRecord) : [];

// ═══════════════════════════════════════════════════════════
// 2. البحث عن المتجر المطلوب في الصفحات الأولى
// ═══════════════════════════════════════════════════════════
$found = null;
$cursor = null;
$pagesScanned = 0;
$maxScan = 10; // نفحص أول 10 صفحات فقط

do {
    $url = NAWRIS_BASE . '/customers/orders-summary?from=2023-01-01&to=' . $today;
    if ($cursor) $url .= '&cursor=' . urlencode($cursor);
    $res = apiFetch($url);
    foreach ($res['data'] ?? [] as $s) {
        if ((string)$s['id'] === (string)$targetId) {
            $found = $s;
            break 2;
        }
    }
    $cursor = $res['meta']['next_cursor'] ?? null;
    $pagesScanned++;
} while ($cursor && $pagesScanned < $maxScan);

// ═══════════════════════════════════════════════════════════
// 3. فحص نفس المتجر في /customers/new
// ═══════════════════════════════════════════════════════════
$foundInNew = null;
$cursor2    = null;
$pages2     = 0;

do {
    $url2 = NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 90 * 86400);
    if ($cursor2) $url2 .= '&cursor=' . urlencode($cursor2);
    $res2 = apiFetch($url2);
    foreach ($res2['data'] ?? [] as $s) {
        if ((string)$s['id'] === (string)$targetId) {
            $foundInNew = $s;
            break 2;
        }
    }
    $cursor2 = $res2['meta']['next_cursor'] ?? null;
    $pages2++;
} while ($cursor2 && $pages2 < $maxScan);

// ═══════════════════════════════════════════════════════════
// 4. تشخيص التصنيف لو كانت البيانات متاحة
// ═══════════════════════════════════════════════════════════
$classification = null;
$storeData = $found ?? $foundInNew ?? null;

if ($storeData) {
    // اكتشف الحقل الصحيح لتاريخ الشحن
    $lastShipKeys = ['last_shipment_date', 'last_order_date', 'last_shipped_at', 'last_delivery_date'];
    $lastShip = null;
    $usedKey  = null;
    foreach ($lastShipKeys as $k) {
        if (!empty($storeData[$k]) && $storeData[$k] !== 'لا يوجد') {
            $lastShip = strtotime($storeData[$k]);
            $usedKey  = $k;
            break;
        }
    }
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : null;

    // اكتشف حقل total_shipments
    $shipCountKeys = ['total_shipments', 'shipments_count', 'orders_count', 'total_orders'];
    $shipCount = null;
    $shipKey   = null;
    foreach ($shipCountKeys as $k) {
        if (isset($storeData[$k])) {
            $shipCount = intval($storeData[$k]);
            $shipKey   = $k;
            break;
        }
    }

    $classification = [
        'detected_shipment_key'   => $usedKey,
        'detected_shipcount_key'  => $shipKey,
        'last_shipment_value'     => $usedKey ? ($storeData[$usedKey] ?? null) : null,
        'days_since_last_ship'    => $daysShip !== null ? round($daysShip, 1) : null,
        'total_shipments_value'   => $shipCount,
        'would_be_classified_as'  => null,
    ];

    if ($daysShip !== null) {
        if ($daysShip <= 14)      $cat = 'active_shipping ✅';
        elseif ($daysShip <= 60)  $cat = 'hot_inactive';
        else                      $cat = 'cold_inactive';
    } else {
        $cat = 'cold_inactive (no shipment detected)';
    }
    $classification['would_be_classified_as'] = $cat;
}

// ═══════════════════════════════════════════════════════════
// الناتج
// ═══════════════════════════════════════════════════════════
echo json_encode([
    'target_store_id'  => $targetId,
    'today'            => $today,

    // هيكل الحقول في الصفحة الأولى من orders-summary
    'orders_api_fields'  => $fieldNames,
    'orders_first_record'=> $firstRecord,
    'orders_http_code'   => $ordersPage['_http_code'] ?? null,
    'orders_page_count'  => count($ordersPage['data'] ?? []),

    // نتيجة البحث عن المتجر
    'store_in_orders'  => $found      ? 'موجود ✅' : "غير موجود في أول $pagesScanned صفحة",
    'store_in_new'     => $foundInNew ? 'موجود ✅' : "غير موجود في أول $pages2 صفحة",
    'store_raw_data'   => $storeData,
    'classification'   => $classification,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
