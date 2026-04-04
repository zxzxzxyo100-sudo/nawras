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
    'incubating'           => [],
    'active_shipping'      => [],
    'completed_merchants'  => [],
    'hot_inactive'         => [],
    'cold_inactive'        => [],
];
$counts = [
    'incubating'           => 0,
    'active_shipping'      => 0,
    'completed_merchants'  => 0,
    'hot_inactive'         => 0,
    'cold_inactive'        => 0,
    'total_active'         => 0,
    'total'                => 0,
];

// ── مسار الاحتضان: دورة 14 يومًا — المكالمات في الأيام 1 و 3 و 10؛ «بين المكالمات» للباقي ──
$incubation_path = [
    'call_1' => [],
    'call_2' => [],
    'call_3' => [],
    'between' => [],
];
$incubation_counts = [
    'call_1' => 0,
    'call_2' => 0,
    'call_3' => 0,
    'between' => 0,
    'total'  => 0,
];

$newIds = array_fill_keys(array_keys($new), true);

/** يوم الدورة من 1 إلى 14 (اليوم الأول من التسجيل = 1) */
function incubation_cycle_day($regTs, $now) {
    if (!$regTs || $regTs <= 0) {
        return 1;
    }
    $d = (int) floor(($now - $regTs) / 86400);

    return min(14, max(1, $d + 1));
}

/** مرحلة المسار + أيام التأخير (عرض وبين المكالمات وتأخير المكالمة وجميع خانات المكالمات) */
function incubation_fill_between_meta(&$s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped) {
    $cd = min(14, max(1, (int) $cycleDay));
    $s['_cycle_day'] = $cd;
    $s['_inc_stage_key'] = '';
    $s['_delay_days'] = 0;
    if (!$inc1) {
        $s['_inc_phase'] = $hasShipped
            ? 'شحن مسجّل — لم تُسجَّل المكالمة الأولى بعد'
            : ($cd > 1 ? 'تأخّر عن نافذة المكالمة الأولى (يوم 1 من 14)' : '');
        $s['_days_until_window'] = max(0, 3 - $cd);
        $s['_next_window_hint'] = 'خانة المكالمة الثانية (يوم 3 من 14)';
        $s['_inc_stage_key'] = $hasShipped ? 'shipped_no_c1' : 'late_c1';
        $s['_delay_days'] = max(0, $cd - 1);

        return;
    }
    if (!$inc2) {
        if ($cd < 3) {
            $s['_inc_phase'] = 'بين المكالمة الأولى والثانية — انتظار يوم 3 من 14';
            $s['_days_until_window'] = max(0, 3 - $cd);
            $s['_next_window_hint'] = 'خانة المكالمة الثانية (يوم 3 من 14)';
            $s['_inc_stage_key'] = 'wait_c2';
            $s['_delay_days'] = 0;
        } else {
            $s['_inc_phase'] = $cd > 3
                ? 'تأخّر عن نافذة المكالمة الثانية (يوم 3 من 14)'
                : '';
            $s['_days_until_window'] = max(0, 10 - $cd);
            $s['_next_window_hint'] = 'خانة المكالمة الثالثة (يوم 10 من 14)';
            $s['_inc_stage_key'] = $cd > 3 ? 'late_c2' : 'wait_c2';
            $s['_delay_days'] = $cd > 3 ? max(0, $cd - 3) : 0;
        }

        return;
    }
    if (!$inc3) {
        $s['_inc_phase'] = $cd < 10
            ? 'بين المكالمة الثانية والثالثة — انتظار يوم 10 من 14'
            : 'تأخّر عن نافذة المكالمة الثالثة (يوم 10 من 14)';
        $s['_days_until_window'] = max(0, 10 - $cd);
        $s['_next_window_hint'] = 'خانة المكالمة الثالثة (يوم 10 من 14)';
        $s['_inc_stage_key'] = $cd < 10 ? 'wait_c3' : 'late_c3';
        $s['_delay_days'] = $cd > 10 ? max(0, $cd - 10) : 0;
    }
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

    $cycleDay = incubation_cycle_day($regTs, $now);
    $s['_cycle_day'] = $cycleDay;

    // المكالمة الثالثة — من يوم 10 حتى تسجيل المكالمة (يشمل المتأخرين عن يوم 10)
    if ($inc2 && !$inc3 && $cycleDay >= 10) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_3';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_3'][] = $s;
        $incubation_counts['call_3']++;
        $incubation_counts['total']++;
        continue;
    }

    // المكالمة الثانية — من يوم 3 حتى تسجيل المكالمة (يشمل المتأخرين عن يوم 3)
    if ($inc1 && !$inc2 && $cycleDay >= 3) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_2';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_2'][] = $s;
        $incubation_counts['call_2']++;
        $incubation_counts['total']++;
        continue;
    }

    // بعد 14 يومًا بدون مكالمة أولى وبدون شحن → بارد
    if (!$inc1 && !$hasShipped && $cycleDay > 14) {
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

    // المكالمة الأولى — أي متجر لم تُسجَّل مكالمته الأولى بعد (ضمن المسار قبل الترحيل)
    if (!$inc1) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_1';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_1'][] = $s;
        $incubation_counts['call_1']++;
        $incubation_counts['total']++;
        continue;
    }

    // بين المكالمات — انتظار يوم 3 أو 10 فقط (بعد تسجيل المكالمة السابقة، بدون تأخير ولا غياب أولى)
    if (($inc1 && !$inc2 && $cycleDay < 3) || ($inc2 && !$inc3 && $cycleDay < 10)) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'between_calls';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['between'][] = $s;
        $incubation_counts['between']++;
        $incubation_counts['total']++;
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

// فصل «المتاجر المنجزة» عن «نشط قيد المكالمة» (حسب store_states)
try {
    if (!isset($pdoDb)) {
        require_once __DIR__ . '/db.php';
        $pdoDb = getDB();
    }
    try {
        $pdoDb->exec('ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL AFTER inc_call3_at');
    } catch (Throwable $e) {
        // موجود
    }
    if (!empty($result['active_shipping'])) {
        $ids = [];
        foreach ($result['active_shipping'] as $s) {
            if (isset($s['id'])) {
                $ids[] = (int) $s['id'];
            }
        }
        $ids = array_values(array_unique(array_filter($ids)));
        if (!empty($ids)) {
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $st = $pdoDb->prepare("SELECT store_id, category, last_call_date FROM store_states WHERE store_id IN ($ph)");
            $st->execute($ids);
            $catById = [];
            while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
                $catById[(int) $r['store_id']] = $r;
            }
            $activePending = [];
            $completed = [];
            foreach ($result['active_shipping'] as $s) {
                $id = (int) ($s['id'] ?? 0);
                $row = $catById[$id] ?? null;
                $cat = $row['category'] ?? '';
                if ($cat === 'completed') {
                    if (!empty($row['last_call_date'])) {
                        $s['last_call_date'] = $row['last_call_date'];
                    }
                    $completed[] = $s;
                } else {
                    $activePending[] = $s;
                }
            }
            $result['active_shipping'] = $activePending;
            $result['completed_merchants'] = $completed;
            $counts['active_shipping'] = count($activePending);
            $counts['completed_merchants'] = count($completed);
        }
    }
} catch (Throwable $e) {
    // بدون DB لا نفصل القائمة
}

$counts['check'] = (
    $counts['active_shipping'] + $counts['completed_merchants'] + $counts['hot_inactive'] + $counts['cold_inactive']
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
