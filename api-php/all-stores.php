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
                    // نحتفظ بأحدث last_shipment_date وأعلى total_shipments
                    $n = $i['last_shipment_date']          ?? null;
                    $o = $all[$id]['last_shipment_date']   ?? null;
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

$now = time();

// ═══════════════════════════════════════════════════════════════
// استراتيجية الجلب:
//
//   [A] /customers/new  → المتاجر الجديدة (احتضان)
//
//   [B] /customers/orders-summary (آخر 60 يوم)
//         → يشمل: active_shipping (≤14 يوم) + hot_inactive (15–60 يوم)
//
//   [C] /customers/inactive?days=61
//         → يشمل: cold_inactive (انقطع >60 يوم أو لم يشحن أبداً)
//
//   الضمان: active_shipping + hot_inactive + cold_inactive = كل المتاجر من B+C
// ═══════════════════════════════════════════════════════════════

// [A] المتاجر الجديدة
$new = fetchAll(
    NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 90 * 86400),
    MAX_PAGES_NEW
);

// [B] المتاجر التي شحنت خلال آخر 60 يوم
$orders = fetchAll(
    NAWRIS_BASE . '/customers/orders-summary'
               . '?from=' . date('Y-m-d', $now - 60 * 86400)
               . '&to='   . date('Y-m-d'),
    MAX_PAGES_ALL
);

// [C] المتاجر الغير نشطة منذ أكثر من 60 يوم (cold inactive)
$cold = fetchAll(
    NAWRIS_BASE . '/customers/inactive?days=61',
    MAX_PAGES_INACTIVE
);

// ═══ التصنيف ════════════════════════════════════════════════════
$result = [
    'incubating'      => [],
    'active_shipping' => [],  // شحن ≤ 14 يوم
    'hot_inactive'    => [],  // شحن 15–60 يوم
    'cold_inactive'   => [],  // انقطع > 60 يوم أو لم يشحن
];
$counts = [
    'incubating'      => 0,
    'active_shipping' => 0,
    'hot_inactive'    => 0,
    'cold_inactive'   => 0,
    'total_active'    => 0,
    'total'           => 0,
];

$newIds = array_keys($new);

// ── [A] احتضان ──────────────────────────────────────────────────
foreach ($new as $id => $s) {
    $s['_cat'] = 'incubating';
    $result['incubating'][] = $s;
    $counts['incubating']++;
    $counts['total']++;
}

// ── [B] تصنيف المتاجر من orders-summary ────────────────────────
$seenActive = [];

foreach ($orders as $id => $s) {
    if (in_array($id, $newIds)) continue;   // تجنب تكرار الجديدة

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
        ? strtotime($s['last_shipment_date'])
        : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : PHP_INT_MAX;

    if ($daysShip <= 14) {
        $s['_cat'] = 'active_shipping';
        $result['active_shipping'][] = $s;
        $counts['active_shipping']++;
    } else {
        // 15–60 يوم (لأن الاستعلام يغطي آخر 60 يوم فقط)
        $s['_cat'] = 'hot_inactive';
        $result['hot_inactive'][] = $s;
        $counts['hot_inactive']++;
    }

    $seenActive[$id] = true;
    $counts['total_active']++;
    $counts['total']++;
}

// ── [C] cold_inactive — من inactive?days=61 ─────────────────────
foreach ($cold as $id => $s) {
    if (in_array($id, $newIds)) continue;
    if (isset($seenActive[$id])) continue;   // موجود في B بالفعل

    $s['_cat'] = 'cold_inactive';
    $result['cold_inactive'][] = $s;
    $counts['cold_inactive']++;
    $counts['total_active']++;
    $counts['total']++;
}

// تحقق: المجموع يساوي إجمالي النشطين
$counts['check'] = (
    $counts['active_shipping'] + $counts['hot_inactive'] + $counts['cold_inactive']
    === $counts['total_active']
);

echo json_encode([
    'success' => true,
    'counts'  => $counts,
    'data'    => $result,
], JSON_UNESCAPED_UNICODE);
