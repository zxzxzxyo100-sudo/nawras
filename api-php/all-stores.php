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
    }
}

// ===== تصنيف بسيط: شرط واحد فقط =====
// نشط = شحن خلال 14 يوم (شحنة واحدة أو أكثر)
// احتضان = مسجل أقل من 14 يوم
// غير نشط = الباقي (انقطع أكثر من 14 يوم)

$result = ['incubating'=>[], 'active'=>[], 'inactive'=>[]];
$counts = ['incubating'=>0, 'active'=>0, 'inactive'=>0, 'total'=>0];

foreach ($stores as $s) {
    $counts['total']++;

    $reg = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $daysReg = $reg ? ($now - $reg) / 86400 : 999;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد') ? strtotime($s['last_shipment_date']) : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : 999;

    if ($daysReg < 14) {
        $result['incubating'][] = $s;
        $counts['incubating']++;
    } elseif ($lastShip && $daysShip <= 14) {
        $result['active'][] = $s;
        $counts['active']++;
    } else {
        $result['inactive'][] = $s;
        $counts['inactive']++;
    }
}

echo json_encode(['success'=>true, 'counts'=>$counts, 'data'=>$result], JSON_UNESCAPED_UNICODE);
