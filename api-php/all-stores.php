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

/** أفضل تقدير لعدد الطرود من صف orders-summary (قد يختلف اسم الحقل بين إصدارات الـ API) */
function nawris_best_shipment_total_from_summary_row(array $store): int {
    $parts = [nawris_total_shipments($store)];
    foreach (['shipments_in_range', 'total_in_range', 'orders_in_range'] as $k) {
        if (isset($store[$k]) && is_numeric($store[$k])) {
            $parts[] = (int) $store[$k];
        }
    }

    return max($parts ?: [0]);
}

/**
 * نشط للـ VIP: يُفضَّل حقل status من orders-summary إن وُجد (نفس Postman)، وإلا من customers/new.
 */
function nawris_vip_is_active(?array $orderRow, ?array $allStoreRow): bool {
    if (is_array($orderRow) && array_key_exists('status', $orderRow)
        && $orderRow['status'] !== null && $orderRow['status'] !== '') {
        return nawris_is_active_status($orderRow);
    }
    if (is_array($allStoreRow)) {
        return nawris_is_active_status($allStoreRow);
    }

    return false;
}

/**
 * جلب orders-summary من Nawris (نطاق واسع) — نفس مصدر Postman.
 *
 * @return array{totals: array<int,int>, rows: array<int,array>, meta: array}
 */
function nawris_fetch_orders_summary_for_vip(string $from, string $to): array {
    $totals = [];
    $rows = [];
    $cursor = null;
    $page = 0;
    $lastHttp = 0;
    $curlErr = 0;
    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . urlencode($from) . '&to=' . urlencode($to);
        if ($cursor) {
            $url .= '&cursor=' . urlencode($cursor);
        }
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $response = curl_exec($ch);
        $curlErr = curl_errno($ch);
        $lastHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($curlErr || !$response) {
            return [
                'totals' => $totals,
                'rows'   => $rows,
                'meta'   => [
                    'ok' => false,
                    'curl_errno' => $curlErr,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                ],
            ];
        }
        $data = json_decode($response, true);
        if (!is_array($data)) {
            return [
                'totals' => $totals,
                'rows'   => $rows,
                'meta'   => [
                    'ok' => false,
                    'json_error' => true,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                ],
            ];
        }
        if (empty($data['data']) || !is_array($data['data'])) {
            break;
        }
        foreach ($data['data'] as $store) {
            if (!is_array($store)) {
                continue;
            }
            $sid = isset($store['id']) ? (int) $store['id'] : 0;
            if ($sid <= 0) {
                continue;
            }
            $t = nawris_best_shipment_total_from_summary_row($store);
            if (!isset($totals[$sid]) || $t > $totals[$sid]) {
                $totals[$sid] = $t;
                $rows[$sid] = $store;
            }
        }
        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;
    } while ($cursor && $page < MAX_PAGES_ALL);

    return [
        'totals' => $totals,
        'rows'   => $rows,
        'meta'   => [
            'ok'         => true,
            'http_code'  => $lastHttp,
            'pages'      => $page,
            'curl_errno' => $curlErr,
        ],
    ];
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

// ── كبار التجار (VIP): أولوية status وعدد الطرود من orders-summary (Postman)، ثم دمج customers/new
$vipSummaryFrom = '2020-01-01';
$vipSummaryTo = date('Y-m-d');
$osVip = nawris_fetch_orders_summary_for_vip($vipSummaryFrom, $vipSummaryTo);
$ordersSummaryTotals = $osVip['totals'];
$ordersSummaryRows = $osVip['rows'];
$vipFetchMeta = $osVip['meta'] ?? [];

$vipIdSet = [];
foreach (array_keys($allStores) as $k) {
    $vipIdSet[(int) $k] = true;
}
foreach (array_keys($ordersSummaryTotals) as $k) {
    $vipIdSet[(int) $k] = true;
}

$vip_merchants = [];
foreach (array_keys($vipIdSet) as $id) {
    $id = (int) $id;
    if ($id <= 0) {
        continue;
    }
    $aRow = $allStores[$id] ?? null;
    $oRow = $ordersSummaryRows[$id] ?? null;

    $tAll = is_array($aRow) ? nawris_total_shipments($aRow) : 0;
    $tOrd = $ordersSummaryTotals[$id] ?? 0;
    $total = max($tAll, $tOrd);

    if ($total < 300) {
        continue;
    }
    if (!nawris_vip_is_active($oRow, $aRow)) {
        continue;
    }

    if (is_array($aRow) && is_array($oRow)) {
        $merged = array_merge($aRow, $oRow);
    } elseif (is_array($aRow)) {
        $merged = $aRow;
    } else {
        $merged = $oRow;
    }
    $merged['total_shipments'] = $total;
    $vip_merchants[] = $merged;
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
        'vip_orders_summary_range' => [
            'from' => $vipSummaryFrom,
            'to'   => $vipSummaryTo,
            'stores_in_summary' => count($ordersSummaryTotals),
            'fetch'             => $vipFetchMeta,
        ],
        'generated_at'      => date('Y-m-d H:i:s'),
    ],
], JSON_UNESCAPED_UNICODE);
