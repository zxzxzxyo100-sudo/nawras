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
// استراتيجية الجلب (4 مصادر — لا تكرار، أسرع وأضمن):
//
//   [A] /customers/new?since=90d
//         → المتاجر الجديدة (احتضان)
//
//   [B] /customers/orders-summary?from=14d&to=today
//         → فقط من شحن في آخر 14 يوم → active_shipping
//         نطاق قصير جداً = سريع الاستجابة
//
//   [C] /customers/inactive?days=15
//         → غير نشط منذ 15+ يوم → مرشحو hot_inactive + cold_inactive
//
//   [D] /customers/inactive?days=61
//         → غير نشط منذ 61+ يوم → cold_inactive
//
//   المنطق:
//     active_shipping = [B]  ∖ [A]
//     cold_inactive   = [D]  ∖ [A]
//     hot_inactive    = [C]  ∖ [D] ∖ [A] ∖ active_shipping_ids
// ═══════════════════════════════════════════════════════════════

// [A] المتاجر الجديدة
$new = fetchAll(
    NAWRIS_BASE . '/customers/new?since=' . date('Y-m-d', $now - 90 * 86400),
    MAX_PAGES_NEW
);

// [B] من شحن خلال آخر 14 يوم فقط (نطاق صغير = سريع)
$orders = fetchAll(
    NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 14 * 86400) . '&to=' . date('Y-m-d'),
    MAX_PAGES_ORDERS
);

// [C] غير نشط منذ 15+ يوم
$hot_candidates = fetchAll(
    NAWRIS_BASE . '/customers/inactive?days=15',
    MAX_PAGES_INACTIVE
);

// [D] غير نشط منذ 61+ يوم (مجموعة فرعية من [C])
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

// hash map للبحث السريع O(1) بدلاً من in_array O(n)
$newIds = array_fill_keys(array_keys($new), true);

// ═══════════════════════════════════════════════════════════════════
// مسار الاحتضان — تصنيف سداسي للمتاجر من /customers/new
//
//  new_48h        : سُجّل < 48 ساعة                              → جديدة
//  incubating     : سُجّل < 14 يوم + بدأ بالشحن                 → تحت الاحتضان (نشطة)
//  watching       : سُجّل < 14 يوم + لم يشحن بعد                → تحت الاحتضان (تُراقَب)
//  hot_14_20      : 14–20 يوم + لم يشحن                         → غير نشطة ساخنة
//  inactive_incub : > 20 يوم + لم يشحن                          → غير نشطة
//  restored       : >= 14 يوم + شحن فعلاً (تلقائي)             → تمت الاستعادة
//  restoring      : يُضبط يدوياً من DB بواسطة الوكيل            → جاري الاستعادة
//
//  ملاحظة: restoring تُحسم في الواجهة من DB (store_states)
// ═══════════════════════════════════════════════════════════════════
$incubation_path = [
    'new_48h'  => [],   // جديدة
    'incubating' => [], // تحت الاحتضان (شحن)
    'watching'   => [], // تحت الاحتضان (لم يشحن بعد < 14 يوم)
    'hot_14_20'  => [], // ساخنة 14-20 يوم
    'inactive'   => [], // غير نشطة > 20 يوم
    'restoring'  => [], // جاري الاستعادة (من DB)
    'restored'   => [], // تمت الاستعادة (تلقائي)
];
$incubation_counts = [
    'new_48h'    => 0, 'incubating' => 0, 'watching'  => 0,
    'hot_14_20'  => 0, 'inactive'   => 0, 'restoring' => 0, 'restored' => 0,
    'total'      => 0,
];

// ── [A] الاحتضان + تصنيف مسار الاحتضان ─────────────────────────
foreach ($new as $id => $s) {
    $s['_cat'] = 'incubating';
    $result['incubating'][] = $s;
    $counts['incubating']++;
    $counts['total']++;

    // ── حساب الأيام / الساعات منذ التسجيل ──
    $regTs    = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $hours    = $regTs ? ($now - $regTs) / 3600  : PHP_INT_MAX;
    $days     = $hours / 24;

    // ── هل شحن المتجر فعلاً؟ ──
    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    // ── التصنيف ──
    if ($hours < 48) {
        $sub = 'new_48h';                         // جديدة (< 48 ساعة)
    } elseif ($days < 14 && $hasShipped) {
        $sub = 'incubating';                      // < 14 يوم + شحن → تحت الاحتضان نشط
    } elseif ($days < 14 && !$hasShipped) {
        $sub = 'watching';                        // < 14 يوم + لم يشحن → مراقبة
    } elseif ($days >= 14 && $hasShipped) {
        $sub = 'restored';                        // >= 14 يوم + شحن → تمت الاستعادة (تلقائي)
    } elseif ($days >= 14 && $days <= 20 && !$hasShipped) {
        $sub = 'hot_14_20';                       // 14-20 يوم + لم يشحن → ساخنة
    } else {
        $sub = 'inactive';                        // > 20 يوم + لم يشحن → غير نشطة
    }

    $s['_inc']   = $sub;
    $s['_hours'] = round($hours, 1);
    $s['_days']  = round($days, 1);
    $incubation_path[$sub][] = $s;
    $incubation_counts[$sub]++;
    $incubation_counts['total']++;
}

// hash maps للبحث السريع
$coldIds         = array_fill_keys(array_keys($cold), true);
$activeShipIds   = [];

// ── [B] active_shipping — من شحن في آخر 14 يوم ─────────────────
foreach ($orders as $id => $s) {
    if (isset($newIds[$id])) continue;          // تجنب تكرار الجديدة

    $s['_cat'] = 'active_shipping';
    $result['active_shipping'][] = $s;
    $counts['active_shipping']++;
    $counts['total_active']++;
    $counts['total']++;
    $activeShipIds[$id] = true;
}

// ── [C] hot_inactive — غير نشط 15-60 يوم ──────────────────────
foreach ($hot_candidates as $id => $s) {
    if (isset($newIds[$id]))       continue;    // تجنب الجديدة
    if (isset($coldIds[$id]))      continue;    // سيُعالَج في [D]
    if (isset($activeShipIds[$id])) continue;   // شحن مؤخراً = نشط

    $s['_cat'] = 'hot_inactive';
    $result['hot_inactive'][] = $s;
    $counts['hot_inactive']++;
    $counts['total_active']++;
    $counts['total']++;
}

// ── [D] cold_inactive — غير نشط 61+ يوم ───────────────────────
foreach ($cold as $id => $s) {
    if (isset($newIds[$id]))        continue;
    if (isset($activeShipIds[$id])) continue;   // شحن مؤخراً = نشط فعلاً

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
    'success'           => true,
    'counts'            => $counts,
    'incubation_counts' => $incubation_counts,
    'data'              => $result,
    'incubation_path'   => $incubation_path,
    'meta'              => [
        'fetched_orders'       => count($orders),
        'fetched_hot_candidates' => count($hot_candidates),
        'fetched_cold'         => count($cold),
        'fetched_new'          => count($new),
        'orders_from'          => date('Y-m-d', $now - 14 * 86400),
        'orders_to'            => date('Y-m-d'),
        'generated_at'    => date('Y-m-d H:i:s'),
    ],
], JSON_UNESCAPED_UNICODE);
