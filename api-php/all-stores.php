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

// جلب البيانات (4 مصادر)
$new      = fetchAll(NAWRIS_BASE . '/customers/new?since='          . date('Y-m-d', $now - 60 * 86400), MAX_PAGES_NEW);
$inactive = fetchAll(NAWRIS_BASE . '/customers/inactive?days=10',                                        MAX_PAGES_INACTIVE);
$ord1     = fetchAll(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 30 * 86400) . '&to=' . date('Y-m-d'),                                    MAX_PAGES_ORDERS);
$ord2     = fetchAll(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 61 * 86400) . '&to=' . date('Y-m-d', $now - 31 * 86400),                 MAX_PAGES_ORDERS);

// دمج بدون تكرار
$stores = [];
foreach ([$ord1,$ord2,$new,$inactive] as $src) {
    foreach ($src as $id => $s) {
        if (!isset($stores[$id])) { $stores[$id] = $s; continue; }
        $n = $s['last_shipment_date'] ?? null;
        $o = $stores[$id]['last_shipment_date'] ?? null;
        if ($n && $n !== 'لا يوجد' && (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o)))
            $stores[$id]['last_shipment_date'] = $n;
        if (($s['total_shipments']??0) > ($stores[$id]['total_shipments']??0))
            $stores[$id]['total_shipments'] = $s['total_shipments'];
        if (!empty($s['registered_at']))
            $stores[$id]['registered_at'] = $s['registered_at'];
        if (!empty($s['status']))
            $stores[$id]['status'] = $s['status'];
    }
}

// ===== التصنيف =====
// الاحتضان: مسجل أقل من 14 يوم
// النشطة (1563): كل من status=active في API → مقسمة إلى 3:
//   - نشط يشحن: شحن خلال 14 يوم
//   - غير نشط ساخن: آخر شحنة 15-60 يوم
//   - غير نشط بارد: آخر شحنة 60+ يوم أو لم يشحن أبداً
// الباقي: غير نشط (ليس status=active)

$result = [
    'incubating' => [],
    'active' => [],
    'inactive_hot' => [],
    'inactive_cold' => [],
    'other_inactive' => []
];
$counts = [
    'total' => 0,
    'incubating' => 0,
    'api_active_total' => 0,  // إجمالي active في API (المستهدف 1563)
    'active' => 0,            // منهم: شحن <= 14 يوم
    'inactive_hot' => 0,      // منهم: شحن 15-60 يوم
    'inactive_cold' => 0,     // منهم: شحن 60+ أو لم يشحن
    'other_inactive' => 0     // ليس status=active أصلاً
];

foreach ($stores as $s) {
    $counts['total']++;

    $reg = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $daysReg = $reg ? ($now - $reg) / 86400 : 999;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد') ? strtotime($s['last_shipment_date']) : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : 999;

    $apiStatus = $s['status'] ?? '';

    // 1. احتضان: أقل من 14 يوم
    if ($daysReg < 14) {
        $s['_cat'] = 'incubating';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        continue;
    }

    // 2. المتاجر التي حالتها active في API
    if ($apiStatus === 'active') {
        $counts['api_active_total']++;

        if ($daysShip <= 14) {
            // نشط يشحن
            $s['_cat'] = 'active';
            $result['active'][] = $s;
            $counts['active']++;
        } elseif ($daysShip > 14 && $daysShip <= 60) {
            // غير نشط ساخن
            $s['_cat'] = 'inactive_hot';
            $result['inactive_hot'][] = $s;
            $counts['inactive_hot']++;
        } else {
            // غير نشط بارد (60+ أو لم يشحن أبداً)
            $s['_cat'] = 'inactive_cold';
            $result['inactive_cold'][] = $s;
            $counts['inactive_cold']++;
        }
        continue;
    }

    // 3. الباقي (ليس active في API)
    $s['_cat'] = 'other_inactive';
    $result['other_inactive'][] = $s;
    $counts['other_inactive']++;
}

// تحقق: api_active_total = active + inactive_hot + inactive_cold
$counts['active_check'] = $counts['active'] + $counts['inactive_hot'] + $counts['inactive_cold'];
$counts['match'] = ($counts['active_check'] === $counts['api_active_total']);

echo json_encode([
    'success' => true,
    'counts' => $counts,
    'data' => $result
], JSON_UNESCAPED_UNICODE);
