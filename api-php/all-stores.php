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

// ── مسار الاحتضان: ثلاث مكالمات (بعد كل مكالمة مرور 72 ساعة للتالية؛ الثالثة تخرج حسب الشحن) ──
$incubation_path = [
    'call_1' => [],
    'call_2' => [],
    'call_3' => [],
];
$incubation_counts = [
    'call_1' => 0,
    'call_2' => 0,
    'call_3' => 0,
    'total'  => 0,
];

$newIds = array_fill_keys(array_keys($new), true);

/** مرور 3 أيام (72 ساعة) من الطابع الزمني */
function incubation_elapsed_3d($mysqlAt, $nowTs) {
    if (!$mysqlAt) {
        return false;
    }
    $t = strtotime($mysqlAt);

    return $t !== false && ($nowTs - $t) >= 3 * 86400;
}

$dbMap = [];
if (!empty($new)) {
    try {
        require_once __DIR__ . '/db.php';
        $pdoDb = getDB();
        foreach (['inc_call1_at', 'inc_call2_at', 'inc_call3_at'] as $col) {
            try {
                $pdoDb->exec("ALTER TABLE store_states ADD COLUMN {$col} DATETIME NULL DEFAULT NULL");
            } catch (Throwable $e) {
                // موجود
            }
        }
        $ids = array_keys($new);
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $pdoDb->prepare("SELECT store_id, inc_call1_at, inc_call2_at, inc_call3_at, category FROM store_states WHERE store_id IN ($ph)");
        $stmt->execute(array_map('intval', $ids));
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $dbMap[(int) $row['store_id']] = $row;
        }
    } catch (Throwable $e) {
        $dbMap = [];
    }
}

// ── تصنيف المتاجر الجديدة (مسار الاحتضان) ───────────────────────
foreach ($new as $id => $s) {
    $db = $dbMap[$id] ?? null;
    $regTs   = !empty($s['registered_at']) ? strtotime($s['registered_at']) : null;
    $regHrs  = $regTs ? ($now - $regTs) / 3600 : PHP_INT_MAX;
    $regDays = $regHrs / 24;

    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    $s['_hours'] = round($regHrs, 1);
    $s['_days']  = round($regDays, 1);

    $inc1 = $db['inc_call1_at'] ?? null;
    $inc2 = $db['inc_call2_at'] ?? null;
    $inc3 = $db['inc_call3_at'] ?? null;
    $dbCat = $db['category'] ?? '';

    // تخريج يدوي إلى نشط من الواجهة
    if ($db && in_array($dbCat, ['active', 'active_shipping'], true) && empty($inc3)) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $lastShip = (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد')
            ? strtotime($s['last_shipment_date']) : null;
        $daysShip = $lastShip ? ($now - $lastShip) / 86400 : PHP_INT_MAX;
        if ($hasShipped) {
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
        } else {
            $s['_cat'] = 'cold_inactive';
            $s['_inc'] = 'never_started';
            $result['cold_inactive'][] = $s;
            $counts['cold_inactive']++;
        }
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // بعد المكالمة الثالثة — تصنيف حسب الشحن
    if (!empty($inc3)) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        if ($hasShipped) {
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
        } else {
            $s['_cat'] = 'cold_inactive';
            $s['_inc'] = 'never_started';
            $result['cold_inactive'][] = $s;
            $counts['cold_inactive']++;
        }
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // المكالمة الثالثة
    if ($inc2 && !$inc3 && incubation_elapsed_3d($inc2, $now)) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_3';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_3'][] = $s;
        $incubation_counts['call_3']++;
        $incubation_counts['total']++;
        continue;
    }

    // المكالمة الثانية (بلا شرط شحن)
    if ($inc1 && !$inc2 && incubation_elapsed_3d($inc1, $now)) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_2';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_2'][] = $s;
        $incubation_counts['call_2']++;
        $incubation_counts['total']++;
        continue;
    }

    // المكالمة الأولى — جديدة < 48 ساعة
    if ($regHrs < 48 && !$inc1) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_1';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_1'][] = $s;
        $incubation_counts['call_1']++;
        $incubation_counts['total']++;
        continue;
    }

    // انتظار 3 أيام بين المكالمات
    if ($inc1 && !$inc2 && !incubation_elapsed_3d($inc1, $now)) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'waiting_call2';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        continue;
    }
    if ($inc2 && !$inc3 && !incubation_elapsed_3d($inc2, $now)) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'waiting_call3';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        continue;
    }

    // بعد 48 ساعة بدون مكالمة أولى وبدون شحن → بارد
    if (!$inc1 && $regHrs >= 48 && !$hasShipped) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $s['_cat'] = 'cold_inactive';
        $s['_inc'] = 'never_started';
        $s['_never_started'] = true;
        $result['cold_inactive'][] = $s;
        $counts['cold_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // ترحيل: شحن ضمن 14 يوم دون سجل مكالمة أولى
    if (!$inc1 && $hasShipped && $regDays <= 14 && $regHrs >= 48) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_2';
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_2'][] = $s;
        $incubation_counts['call_2']++;
        $incubation_counts['total']++;
        continue;
    }

    // ترحيل: شحن بعد 14 يوم من التسجيل
    if ($hasShipped && $regDays > 14) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
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
        continue;
    }

    // احتياطي — شحن
    if ($hasShipped) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
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
        continue;
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

// كبار التجار: يُجلب عبر vip-merchants.php (جلب كامل الصفحات) — يُترك هنا فارغاً للتوافق
$vip_merchants = [];

// ذاكرة بحث خفيفة لـ search-stores.php
function nawras_lite_store_row($s, $fallbackId = null) {
    $id = $s['id'] ?? $fallbackId;
    return [
        'id'    => $id,
        'name'  => isset($s['name']) ? (string) $s['name'] : '',
        'phone' => isset($s['phone']) ? (string) $s['phone'] : '',
    ];
}
$search_lite_map = [];
foreach ($new as $id => $s) {
    $row = nawras_lite_store_row($s, $id);
    if ($row['id'] !== null) {
        $search_lite_map[(string) $row['id']] = $row;
    }
}
foreach ($allStores as $id => $s) {
    $row = nawras_lite_store_row($s, $id);
    if ($row['id'] !== null) {
        $search_lite_map[(string) $row['id']] = $row;
    }
}
foreach ($inactive as $id => $s) {
    $row = nawras_lite_store_row($s, $id);
    if ($row['id'] !== null) {
        $search_lite_map[(string) $row['id']] = $row;
    }
}
$search_lite = array_values($search_lite_map);
$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}
@file_put_contents(
    $cacheDir . '/stores_search_lite.json',
    json_encode($search_lite, JSON_UNESCAPED_UNICODE)
);

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
        'vip_endpoint'      => 'vip-merchants.php',
        'generated_at'      => date('Y-m-d H:i:s'),
    ],
], JSON_UNESCAPED_UNICODE);
