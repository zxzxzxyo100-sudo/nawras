<?php
ini_set('memory_limit', '256M');
ini_set('max_execution_time', '120');

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';

function fetchAll($url, $token, $max = 100) {
    $all = [];
    $cursor = null;
    $p = 0;
    do {
        $u = $cursor ? $url . (strpos($url,'?')!==false?'&':'?') . 'cursor=' . $cursor : $url;
        $ch = curl_init();
        curl_setopt_array($ch, [CURLOPT_URL=>$u, CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>10, CURLOPT_CONNECTTIMEOUT=>5, CURLOPT_HTTPHEADER=>['Accept: application/json','X-API-TOKEN:'.$token]]);
        $r = curl_exec($ch);
        curl_close($ch);
        $d = json_decode($r, true);
        if (isset($d['data'])) foreach ($d['data'] as $i) $all[$i['id']] = $i;
        $cursor = $d['meta']['next_cursor'] ?? null;
        $p++;
    } while ($cursor && $p < $max);
    return $all;
}

$now = time();

// جلب من الـ 3 APIs
$new = fetchAll($BASE.'/customers/new?since='.date('Y-m-d', $now-60*86400), $TOKEN, 30);
$inactive = fetchAll($BASE.'/customers/inactive?days=10', $TOKEN, 30);
$ord1 = fetchAll($BASE.'/customers/orders-summary?from='.date('Y-m-d',$now-30*86400).'&to='.date('Y-m-d'), $TOKEN, 60);
$ord2 = fetchAll($BASE.'/customers/orders-summary?from='.date('Y-m-d',$now-61*86400).'&to='.date('Y-m-d',$now-31*86400), $TOKEN, 60);

// دمج الكل بدون تكرار
$stores = [];
foreach ([$ord1,$ord2,$new,$inactive] as $src) {
    foreach ($src as $id => $s) {
        if (!isset($stores[$id])) { $stores[$id] = $s; continue; }
        // تحديث أحدث شحنة
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

// تصنيف بسيط: 3 فئات فقط
$result = ['incubating'=>[], 'active'=>[], 'inactive'=>[]];
$counts = ['incubating'=>0, 'active'=>0, 'inactive'=>0, 'total'=>0];

foreach ($stores as $s) {
    $reg = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $daysReg = $reg ? ($now - $reg) / 86400 : 999;

    $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد') ? strtotime($s['last_shipment_date']) : null;
    $daysShip = $lastShip ? ($now - $lastShip) / 86400 : 999;

    if ($daysReg < 14) {
        $s['_cat'] = 'incubating';
        $result['incubating'][] = $s;
        $counts['incubating']++;
    } elseif ($daysShip <= 14) {
        $s['_cat'] = 'active';
        $result['active'][] = $s;
        $counts['active']++;
    } else {
        $s['_cat'] = 'inactive';
        $result['inactive'][] = $s;
        $counts['inactive']++;
    }
    $counts['total']++;
}

echo json_encode(['success'=>true, 'counts'=>$counts, 'data'=>$result], JSON_UNESCAPED_UNICODE);
