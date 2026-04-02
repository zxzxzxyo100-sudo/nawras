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
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r  = curl_exec($ch);
        curl_close($ch);
        $d  = json_decode($r, true);
        if (isset($d['data'])) {
            foreach ($d['data'] as $i) {
                $id = $i['id'];
                if (!isset($all[$id])) {
                    $all[$id] = $i;
                } else {
                    // احتفظ بأحدث last_shipment_date وأعلى total_shipments
                    $n = $i['last_shipment_date']          ?? null;
                    $o = $all[$id]['last_shipment_date']   ?? null;
                    if ($n && $n !== 'لا يوجد' && (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o))) {
                        $all[$id]['last_shipment_date'] = $n;
                    }
                    if (($i['total_shipments'] ?? 0) > ($all[$id]['total_shipments'] ?? 0)) {
                        $all[$id]['total_shipments'] = $i['total_shipments'];
                    }
                }
            }
        }
        $cursor = $d['meta']['next_cursor'] ?? null;
        $p++;
    } while ($cursor && $p < $max);
    return $all;
}

$now = time();

// ─── 1. المتاجر الجديدة (احتضان) ──────────────────────────────────────────
$new = fetchAll(
    NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 90 * 86400),
    MAX_PAGES_NEW
);

// ─── 2. كل المتاجر النشطة — نجلب فترتين لضمان التغطية الكاملة لـ 1563 متجر
//    فترة A: آخر 60 يوم  (يشمل Active + Hot Inactive)
//    فترة B: 61–730 يوم (يشمل Cold Inactive)
$orders_recent = fetchAll(
    NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 60 * 86400)
               . '&to=' . date('Y-m-d'),
    MAX_PAGES_ALL
);
$orders_old = fetchAll(
    NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 730 * 86400)
               . '&to=' . date('Y-m-d', $now - 61 * 86400),
    MAX_PAGES_ALL
);

// دمج الفترتين
$all_active = $orders_recent;
foreach ($orders_old as $id => $s) {
    if (!isset($all_active[$id])) {
        $all_active[$id] = $s;
    } else {
        $n = $s['last_shipment_date']             ?? null;
        $o = $all_active[$id]['last_shipment_date'] ?? null;
        if ($n && $n !== 'لا يوجد' && (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o))) {
            $all_active[$id]['last_shipment_date'] = $n;
        }
        if (($s['total_shipments'] ?? 0) > ($all_active[$id]['total_shipments'] ?? 0)) {
            $all_active[$id]['total_shipments'] = $s['total_shipments'];
        }
    }
}

// ─── 3. التصنيف ─────────────────────────────────────────────────────────────
//
//  active_shipping  : آخر شحنة ≤ 14 يوم                  → نشط يشحن
//  hot_inactive     : آخر شحنة 15–60 يوم                  → غير نشط ساخن
//  cold_inactive    : آخر شحنة > 60 يوم أو لا يوجد شحنة  → غير نشط بارد
//
//  incubating       : قادم من /customers/new               → تحت الاحتضان
//
//  الضمان: active_shipping + hot_inactive + cold_inactive = إجمالي all_active
//          (بعد استبعاد المتاجر الجديدة المتداخلة)

$result = [
    'incubating'      => [],
    'active_shipping' => [],
    'hot_inactive'    => [],
    'cold_inactive'   => [],
];
$counts = [
    'incubating'      => 0,
    'active_shipping' => 0,
    'hot_inactive'    => 0,
    'cold_inactive'   => 0,
    'total_active'    => 0,   // active_shipping + hot_inactive + cold_inactive
    'total'           => 0,   // الإجمالي الكلي
];

$newIds = array_keys($new);

// ── احتضان ──
foreach ($new as $id => $s) {
    $s['_cat'] = 'incubating';
    $result['incubating'][] = $s;
    $counts['incubating']++;
    $counts['total']++;
}

// ── المتاجر النشطة (1563) — التصنيف الثلاثي ──
foreach ($all_active as $id => $s) {
    // استبعد المتاجر الجديدة لتجنب التكرار
    if (in_array($id, $newIds)) continue;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
        ? strtotime($s['last_shipment_date'])
        : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : PHP_INT_MAX;

    if ($daysShip <= 14) {
        $s['_cat'] = 'active_shipping';
        $result['active_shipping'][] = $s;
        $counts['active_shipping']++;
    } elseif ($daysShip <= 60) {
        $s['_cat'] = 'hot_inactive';
        $result['hot_inactive'][] = $s;
        $counts['hot_inactive']++;
    } else {
        $s['_cat'] = 'cold_inactive';
        $result['cold_inactive'][] = $s;
        $counts['cold_inactive']++;
    }

    $counts['total_active']++;
    $counts['total']++;
}

// تحقق: مجموع الخانات الثلاث = total_active
$counts['check'] = ($counts['active_shipping'] + $counts['hot_inactive'] + $counts['cold_inactive'] === $counts['total_active']);

echo json_encode([
    'success' => true,
    'counts'  => $counts,
    'data'    => $result,
], JSON_UNESCAPED_UNICODE);
