<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

// ═══════════════════════════════════════════════════════════════
// استراتيجية الجلب (بدون orders-summary — معطل بـ 500 error):
//
//  [A] /customers/new?since=90d
//        → المتاجر الجديدة للاحتضان (آخر 90 يوم)
//
//  [B] /customers/new?since=2020-01-01
//        → جميع المتاجر المسجلة (المصدر الرئيسي)
//        → يرجع 8,885 متجر كلها status=active
//
//  [C] /customers/inactive?days=365
//        → المتاجر الخاملة (لتحديث last_shipment_date بدقة أكثر)
//        → نُدمجها مع [B] لضمان اكتمال البيانات
// ═══════════════════════════════════════════════════════════════

function fetchAll($url, $max = MAX_PAGES_ALL) {
    $all    = [];
    $cursor = null;
    $p      = 0;
    do {
        $u = $cursor
            ? $url . (strpos($url, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor)
            : $url;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $u,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r  = curl_exec($ch);
        $err = curl_errno($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($err || !$r || $httpCode >= 400) break;

        $d = json_decode($r, true);
        if (!isset($d['data']) || !is_array($d['data'])) break;

        foreach ($d['data'] as $i) {
            $id = $i['id'];
            if (!isset($all[$id])) {
                $all[$id] = $i;
            } else {
                // الاحتفاظ بأحدث last_shipment_date
                $n = $i['last_shipment_date']        ?? null;
                $o = $all[$id]['last_shipment_date'] ?? null;
                if ($n && $n !== 'لا يوجد' &&
                    (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o))) {
                    $all[$id]['last_shipment_date'] = $n;
                }
                // الاحتفاظ بأعلى total_shipments
                if (($i['total_shipments'] ?? 0) > ($all[$id]['total_shipments'] ?? 0)) {
                    $all[$id]['total_shipments'] = $i['total_shipments'];
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

// ── [A] المتاجر الجديدة (آخر 90 يوم) — للاحتضان ─────────────────
$new = fetchAll(
    NAWRIS_BASE . '/customers/new?since=' . $days90,
    MAX_PAGES_NEW
);

// ── [B] جميع المتاجر منذ 2020 ────────────────────────────────────
$allStores = fetchAll(
    NAWRIS_BASE . '/customers/new?since=2020-01-01',
    MAX_PAGES_ALL
);

// ── [C] المتاجر الخاملة (365 يوم) — لتحديث بيانات الشحن ─────────
$inactive = fetchAll(
    NAWRIS_BASE . '/customers/inactive?days=365',
    MAX_PAGES_RECOVERY
);

// ── دمج [C] في [B]: تحديث last_shipment_date وإضافة المتاجر المفقودة
foreach ($inactive as $id => $s) {
    if (!isset($allStores[$id])) {
        // متجر موجود في inactive لكن غير موجود في new?since=2020 — أضفه
        $allStores[$id] = $s;
    } else {
        // تحديث last_shipment_date إن كانت بيانات inactive أدق
        $n = $s['last_shipment_date']          ?? null;
        $o = $allStores[$id]['last_shipment_date'] ?? null;
        if ($n && $n !== 'لا يوجد' &&
            (!$o || $o === 'لا يوجد' || strtotime($n) > strtotime($o))) {
            $allStores[$id]['last_shipment_date'] = $n;
        }
    }
}

/**
 * إجمالي الطرود من واجهة Nawris — المفتاح المعياري total_shipments مع بدائل شائعة.
 */
function nawris_total_shipments(array $s): int {
    $keys = ['total_shipments', 'totalShipments', 'Total_Shipments'];
    foreach ($keys as $k) {
        if (!array_key_exists($k, $s)) {
            continue;
        }
        $v = $s[$k];
        if ($v === null || $v === '') {
            continue;
        }
        if (is_numeric($v)) {
            return (int) $v;
        }
        if (is_string($v)) {
            $clean = preg_replace('/[^\d]/u', '', $v);
            if ($clean !== '') {
                return (int) $clean;
            }
        }
    }
    if (!empty($s['stats']) && is_array($s['stats'])) {
        $st = $s['stats'];
        $v = $st['total_shipments'] ?? $st['totalShipments'] ?? null;
        if ($v !== null && $v !== '') {
            return is_numeric($v) ? (int) $v : (int) preg_replace('/[^\d]/u', '', (string) $v);
        }
    }

    return 0;
}

/** يتوافق مع القيم النصية/الرقمية من الـ API */
function nawris_is_active_status(array $s): bool {
    $st = $s['status'] ?? null;
    if ($st === null || $st === '') {
        return true;
    }
    if (is_bool($st)) {
        return $st;
    }
    if (is_int($st) || is_float($st)) {
        return ((int) $st) === 1;
    }
    $t = strtolower(trim((string) $st));

    return in_array($t, ['active', '1', 'true', 'yes'], true);
}

// ═══ هياكل النتيجة ════════════════════════════════════════════
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
    'total_active'    => 0,
    'total'           => 0,
];

// ── مسار الاحتضان ────────────────────────────────────────────────
$incubation_path = [
    'new_48h'    => [],
    'incubating' => [],
];
$incubation_counts = [
    'new_48h'  => 0,
    'incubating' => 0,
    'total'      => 0,
];

$newIds = array_fill_keys(array_keys($new), true);

// ── تصنيف المتاجر الجديدة (مسار الاحتضان) ───────────────────────
foreach ($new as $id => $s) {
    $regTs   = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $regHrs  = $regTs ? ($now - $regTs) / 3600 : PHP_INT_MAX;
    $regDays = $regHrs / 24;

    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    $s['_hours'] = round($regHrs, 1);
    $s['_days']  = round($regDays, 1);

    if ($regHrs < 48) {
        // Q4: جديد (فترة مراقبة 48 ساعة)
        $s['_cat'] = 'incubating'; $s['_inc'] = 'new_48h';
        $result['incubating'][] = $s;
        $counts['incubating']++; $counts['total']++;
        $incubation_path['new_48h'][] = $s;
        $incubation_counts['new_48h']++; $incubation_counts['total']++;

    } elseif ($regDays <= 14 && $hasShipped) {
        // Q1: تحت الاحتضان (≤14 يوم + شحن)
        $s['_cat'] = 'incubating'; $s['_inc'] = 'incubating';
        $result['incubating'][] = $s;
        $counts['incubating']++; $counts['total']++;
        $incubation_path['incubating'][] = $s;
        $incubation_counts['incubating']++; $incubation_counts['total']++;

    } elseif ($hasShipped) {
        // Q3: نجح الاحتضان (>14 يوم + شحن) → نشط مباشرةً
        if (!empty($s['status']) && $s['status'] !== 'active') continue;
        $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
            ? strtotime($s['last_shipment_date']) : null;
        $daysShip = $lastShip ? ($now - $lastShip) / 86400 : PHP_INT_MAX;
        if ($daysShip <= 14) {
            $s['_cat'] = 'active_shipping';
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
        // Q2: لم تبدأ (>48 ساعة + 0 شحنات) → غير نشط بارد
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

// ── تصنيف بقية المتاجر (من allStores) ───────────────────────────
foreach ($allStores as $id => $s) {
    if (isset($newIds[$id])) continue;                // تجنب تكرار المتاجر الجديدة
    if (!empty($s['status']) && $s['status'] !== 'active') continue; // active فقط

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

// ── كبار التجار (VIP): حصراً من حقول واجهة Nawris — total_shipments >= 300 و status نشط (لا يعتمد تصنيف الكانبان)
$vip_merchants = [];
foreach ($allStores as $id => $s) {
    if (!nawris_is_active_status($s)) {
        continue;
    }
    $total = nawris_total_shipments($s);
    if ($total < 300) {
        continue;
    }
    $row = $s;
    $row['total_shipments'] = $total;
    $vip_merchants[] = $row;
}
usort($vip_merchants, function ($a, $b) {
    return nawris_total_shipments($b) - nawris_total_shipments($a);
});

echo json_encode([
    'success'           => true,
    'counts'            => $counts,
    'incubation_counts' => $incubation_counts,
    'data'              => $result,
    'vip_merchants'     => $vip_merchants,
    'vip_merchants_count' => count($vip_merchants),
    'incubation_path'   => $incubation_path,
    'meta'              => [
        'sources'           => ['new_90d', 'new_since_2020', 'inactive_365'],
        'fetched_new_90d'   => count($new),
        'fetched_all_2020'  => count($allStores),
        'fetched_inactive'  => count($inactive),
        'generated_at'      => date('Y-m-d H:i:s'),
    ],
], JSON_UNESCAPED_UNICODE);
