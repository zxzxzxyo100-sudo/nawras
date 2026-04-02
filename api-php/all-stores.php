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

// ── مسار الاحتضان: خانتان فقط ─────────────────────────────────
// Q4 جديدة  : age ≤ 48h                      → incubation
// Q1 احتضان : 48h < age ≤ 14d  AND ships > 0 → incubation
// Q3 نجاح   : age > 14d        AND ships > 0 → active_shipping مباشرةً (لا قائمة تخريج)
// Q2 لم تبدأ: age > 48h        AND ships = 0 → cold_inactive (مع علامة _never_started)
// جاري/تمت الاستعادة: حالة DB تظهر في خانة غير النشطة
$incubation_path = [
    'new_48h'    => [],
    'incubating' => [],
];
$incubation_counts = [
    'new_48h'    => 0,
    'incubating' => 0,
    'total'      => 0,
];

$newIds = array_fill_keys(array_keys($new), true);

// ── تصنيف المتاجر الجديدة (احتضان) ───────────────────────────
foreach ($new as $id => $s) {
    $regTs   = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $regHrs  = $regTs ? ($now - $regTs) / 3600 : PHP_INT_MAX;
    $regDays = $regHrs / 24;

    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    $s['_hours'] = round($regHrs, 1);
    $s['_days']  = round($regDays, 1);

    if ($regHrs < 48) {
        // ── Q4: جديد (فترة مراقبة 48 ساعة) ─────────────────────
        $s['_cat'] = 'incubating'; $s['_inc'] = 'new_48h';
        $result['incubating'][] = $s;
        $counts['incubating']++; $counts['total']++;
        $incubation_path['new_48h'][] = $s;
        $incubation_counts['new_48h']++; $incubation_counts['total']++;

    } elseif ($regDays <= 14 && $hasShipped) {
        // ── Q1: تحت الاحتضان (≤14 يوم + شحن) ───────────────────
        $s['_cat'] = 'incubating'; $s['_inc'] = 'incubating';
        $result['incubating'][] = $s;
        $counts['incubating']++; $counts['total']++;
        $incubation_path['incubating'][] = $s;
        $incubation_counts['incubating']++; $incubation_counts['total']++;

    } elseif ($hasShipped) {
        // ── Q3: نجح الاحتضان (>14 يوم + شحن) → نشط مباشرةً ────
        if (!empty($s['status']) && $s['status'] !== 'active') continue;
        $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
            ? strtotime($s['last_shipment_date']) : null;
        $daysShip = $lastShip ? ($now - $lastShip) / 86400 : PHP_INT_MAX;
        $s['_cat'] = 'active_shipping'; $s['_inc'] = 'graduated';
        if ($daysShip <= 14) {
            $result['active_shipping'][] = $s; $counts['active_shipping']++;
        } elseif ($daysShip <= 60) {
            $s['_cat'] = 'hot_inactive';
            $result['hot_inactive'][] = $s; $counts['hot_inactive']++;
        } else {
            $s['_cat'] = 'cold_inactive';
            $result['cold_inactive'][] = $s; $counts['cold_inactive']++;
        }
        $counts['total_active']++; $counts['total']++;

    } else {
        // ── Q2: لم تبدأ (>48 ساعة + 0 شحنات) → غير نشط بارد ────
        // هذا المتجر خرج من مسار الاحتضان ويظهر في المتاجر الغير نشطة
        if (!empty($s['status']) && $s['status'] !== 'active') continue;
        $s['_cat']           = 'cold_inactive';
        $s['_inc']           = 'never_started';
        $s['_never_started'] = true;
        $result['cold_inactive'][] = $s;
        $counts['cold_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
    }
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
