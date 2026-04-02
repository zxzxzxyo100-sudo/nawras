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

// جلب البيانات
$new      = fetchAll(NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 60 * 86400), MAX_PAGES_NEW);
$inactive = fetchAll(NAWRIS_BASE . '/customers/inactive?days=10', MAX_PAGES_INACTIVE);
$ord1     = fetchAll(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 30 * 86400) . '&to=' . date('Y-m-d'), MAX_PAGES_ORDERS);
$ord2     = fetchAll(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 61 * 86400) . '&to=' . date('Y-m-d', $now - 31 * 86400), MAX_PAGES_ORDERS);

// دمج بدون تكرار
$stores = [];
foreach ([$ord1, $ord2, $new, $inactive] as $src) {
    foreach ($src as $id => $s) {
        if (!isset($stores[$id])) { $stores[$id] = $s; continue; }
        $n = $s['last_shipment_date'] ?? null;
        $o = $stores[$id]['last_shipment_date'] ?? null;
        if ($n && $n !== 'لا يوجد' && (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o)))
            $stores[$id]['last_shipment_date'] = $n;
        if (($s['total_shipments'] ?? 0) > ($stores[$id]['total_shipments'] ?? 0))
            $stores[$id]['total_shipments'] = $s['total_shipments'];
        if (!empty($s['registered_at']))
            $stores[$id]['registered_at'] = $s['registered_at'];
    }
}

// =====================================================================
// التصنيف الحاسم — 4 خانات منفصلة (لا يظهر متجر في خانتين أبداً)
// =====================================================================
//
// 1. احتضان:   عمره <= 14 يوم  AND  شحن >= 1
// 2. لم تبدأ:  عمره > 48 ساعة  AND  شحن = 0   (تحويل تلقائي لغير نشط)
// 3. تخريج:    عمره > 14 يوم   AND  شحن >= 1   AND  آخر شحنة <= 14 يوم
// 4. نشط:      آخر شحنة <= 14 يوم  (تخرّج بالفعل أو قديم ويشحن)
// 5. غير نشط:  الباقي
//
// الترتيب مهم: أول شرط يتحقق يأخذ المتجر

$result = [
    'incubating'   => [],  // تحت الاحتضان (< 14 يوم + شحن)
    'not_started'  => [],  // لم تبدأ (48h+ بدون شحن)
    'graduation'   => [],  // جاهز للتخريج (14+ يوم + شحن + نشط)
    'active'       => [],  // نشط (شحن خلال 14 يوم)
    'inactive'     => [],  // غير نشط (انقطع > 14 يوم)
];
$counts = [
    'incubating'  => 0,
    'not_started' => 0,
    'graduation'  => 0,
    'active'      => 0,
    'inactive'    => 0,
    'total'       => 0,
];

foreach ($stores as $s) {
    $counts['total']++;

    $reg      = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $daysReg  = $reg ? ($now - $reg) / 86400 : 999;
    $hoursReg = $reg ? ($now - $reg) / 3600 : 999;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
        ? strtotime($s['last_shipment_date']) : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : 999;

    $shipped = $lastShip || (isset($s['total_shipments']) && intval($s['total_shipments']) > 0);

    // 1. احتضان: عمره <= 14 يوم + شحن >= 1
    if ($daysReg <= 14 && $shipped) {
        $s['_cat'] = 'incubating';
        $result['incubating'][] = $s;
        $counts['incubating']++;
    }
    // 2. لم تبدأ: عمره > 48 ساعة + لم يشحن أبداً
    elseif ($hoursReg > 48 && !$shipped) {
        $s['_cat'] = 'not_started';
        $result['not_started'][] = $s;
        $counts['not_started']++;
    }
    // 3. تخريج: عمره > 14 يوم + شحن + آخر شحنة <= 14 يوم
    elseif ($daysReg > 14 && $shipped && $daysShip <= 14) {
        $s['_cat'] = 'graduation';
        $result['graduation'][] = $s;
        $counts['graduation']++;
    }
    // 4. نشط: شحن خلال 14 يوم (باقي الحالات)
    elseif ($daysShip <= 14) {
        $s['_cat'] = 'active';
        $result['active'][] = $s;
        $counts['active']++;
    }
    // 5. غير نشط: الباقي (انقطع أكثر من 14 يوم أو لم يشحن)
    else {
        $s['_cat'] = 'inactive';
        $result['inactive'][] = $s;
        $counts['inactive']++;
    }
}

// تحقق: المجموع يساوي الإجمالي
$counts['check_sum'] = $counts['incubating'] + $counts['not_started'] + $counts['graduation'] + $counts['active'] + $counts['inactive'];
$counts['balanced'] = ($counts['check_sum'] === $counts['total']);

echo json_encode([
    'success' => true,
    'counts'  => $counts,
    'data'    => $result,
], JSON_UNESCAPED_UNICODE);
