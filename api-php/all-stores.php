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
        $u  = $cursor
            ? $url . (strpos($url, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor)
            : $url;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $u,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,       // تتبع الـ redirects
            CURLOPT_SSL_VERIFYPEER => false,      // تجاهل SSL لمنع blocking
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r   = curl_exec($ch);
        curl_close($ch);
        $d   = json_decode($r, true);

        if (isset($d['data'])) {
            foreach ($d['data'] as $i) {
                $id = $i['id'];
                if (!isset($all[$id])) {
                    $all[$id] = $i;
                } else {
                    $n = $i['last_shipment_date']        ?? null;
                    $o = $all[$id]['last_shipment_date'] ?? null;
                    if ($n && $n !== 'لا يوجد' &&
                        (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o))) {
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

$now    = time();
$days90 = date('Y-m-d', $now - 90 * 86400);

// ═══════════════════════════════════════════════════════════════
// استراتيجية الجلب:
//
//  [A] /customers/new?since=90d
//        → المتاجر الجديدة (احتضان) — موثوق تماماً
//
//  [B] /customers/orders-summary?from=2026-01-01&to=today
//        → كل المتاجر (active + archived) مع last_shipment_date
//        → نفلتر: status == "active" فقط
//        → نصنّف بناءً على last_shipment_date:
//             ≤ 14 يوم  → active_shipping
//             15–60 يوم → hot_inactive
//             > 60 يوم  → cold_inactive
//
//  [C] /customers/new?since=2020-01-01
//        → احتياطي: إن فشل [B]، نُصنّف بنفس المنطق
// ═══════════════════════════════════════════════════════════════

// [A] المتاجر الجديدة
$new = fetchAll(
    NAWRIS_BASE . '/customers/new?since=' . $days90,
    MAX_PAGES_NEW
);

// [B] orders-summary من يناير حتى اليوم (GET نظيف بدون body)
$ordersFrom = date('Y-m-d', mktime(0, 0, 0, 1, 1, (int)date('Y')));
$ordersTo   = date('Y-m-d');
$orders = fetchAll(
    NAWRIS_BASE . '/customers/orders-summary?from=' . $ordersFrom . '&to=' . $ordersTo,
    MAX_PAGES_ORDERS
);

// [C] كل المتاجر عبر new?since=2020 (احتياطي إن فشل [B])
$allStores = [];
if (empty($orders)) {
    $allStores = fetchAll(
        NAWRIS_BASE . '/customers/new?since=2020-01-01',
        300
    );
}

// ═══ هياكل النتيجة ════════════════════════════════════════════
$result = [
    'incubating'      => [],
    'active_shipping' => [],
    'hot_inactive'    => [],
    'cold_inactive'   => [],
];
$counts = [
    'incubating' => 0, 'active_shipping' => 0,
    'hot_inactive' => 0, 'cold_inactive' => 0,
    'total_active' => 0, 'total' => 0,
];

$incubation_path = [
    'new_48h' => [], 'incubating' => [], 'watching' => [],
    'hot_14_20' => [], 'inactive' => [], 'restoring' => [], 'restored' => [],
];
$incubation_counts = [
    'new_48h' => 0, 'incubating' => 0, 'watching' => 0,
    'hot_14_20' => 0, 'inactive' => 0, 'restoring' => 0,
    'restored' => 0, 'total' => 0,
];

$newIds = array_fill_keys(array_keys($new), true);

// ── تصنيف المتاجر الجديدة (احتضان) ───────────────────────────
foreach ($new as $id => $s) {
    $s['_cat'] = 'incubating';
    $result['incubating'][] = $s;
    $counts['incubating']++;
    $counts['total']++;

    $regTs  = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $regHrs = $regTs ? ($now - $regTs) / 3600  : PHP_INT_MAX;
    $regDays = $regHrs / 24;

    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    if      ($regHrs  < 48)                               $sub = 'new_48h';
    elseif  ($regDays < 14  &&  $hasShipped)              $sub = 'incubating';
    elseif  ($regDays < 14  && !$hasShipped)              $sub = 'watching';
    elseif  ($regDays >= 14 &&  $hasShipped)              $sub = 'restored';
    elseif  ($regDays >= 14 && $regDays <= 20 && !$hasShipped) $sub = 'hot_14_20';
    else                                                  $sub = 'inactive';

    $s['_inc'] = $sub; $s['_hours'] = round($regHrs, 1); $s['_days'] = round($regDays, 1);
    $incubation_path[$sub][] = $s;
    $incubation_counts[$sub]++;
    $incubation_counts['total']++;
}

// ── تصنيف مصدر البيانات الرئيسي (orders أو allStores) ─────────
$source = !empty($orders) ? $orders : $allStores;

foreach ($source as $id => $s) {
    if (isset($newIds[$id])) continue;                // تجنب تكرار الجديدة

    // فلتر: نشط فقط (تجاهل archived وغيرها)
    if (!empty($s['status']) && $s['status'] !== 'active') continue;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
        ? strtotime($s['last_shipment_date']) : null;
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

$counts['check'] = (
    $counts['active_shipping'] + $counts['hot_inactive'] + $counts['cold_inactive']
    === $counts['total_active']
);

echo json_encode([
    'success'           => true,
    'counts'            => $counts,
    'incubation_counts' => $incubation_counts,
    'data'              => $result,
    'incubation_path'   => $incubation_path,
    'meta'              => [
        'source'        => !empty($orders) ? 'orders-summary' : 'new_since_2020_fallback',
        'fetched_orders' => count($orders),
        'fetched_new'    => count($new),
        'fetched_all'    => count($allStores),
        'orders_from'    => $ordersFrom,
        'orders_to'      => $ordersTo,
        'generated_at'   => date('Y-m-d H:i:s'),
    ],
], JSON_UNESCAPED_UNICODE);
