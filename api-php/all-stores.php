<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/onboarding-config.php';
require_once __DIR__ . '/store-lifecycle-lib.php';

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
    'incubating'            => [],
    'active_shipping'       => [],
    'completed_merchants'   => [],
    'unreachable_merchants' => [],
    'frozen_merchants'      => [],
    'hot_inactive'          => [],
    'cold_inactive'         => [],
];
$counts = [
    'incubating'            => 0,
    'active_shipping'       => 0,
    'completed_merchants'   => 0,
    'unreachable_merchants' => 0,
    'frozen_merchants'      => 0,
    'hot_inactive'          => 0,
    'cold_inactive'         => 0,
    'total_active'         => 0,
    'total'                => 0,
];

// ── مسار الاحتضان: م1 خلال 48 ساعة؛ متأخّرو الم1 → call_delay؛ م2 من يوم 3 التقويمي مع شحن؛ م3 من يوم 10 ──
$incubation_path = [
    'call_1' => [],
    'call_delay' => [],
    'call_2' => [],
    'call_3' => [],
    'between' => [],
];
$incubation_counts = [
    'call_1' => 0,
    'call_delay' => 0,
    'call_2' => 0,
    'call_3' => 0,
    'between' => 0,
    'total'  => 0,
];

/** متاجر تُحدَّث فوراً: م1 مسجّلة ويوم 3+ بدون شحنة → غير نشط ساخن */
$syncMoNoShipBeforeC2Ids = [];
/** مزامنة DB: 48 ساعة بدون شحن وبدون م1 → بارد */
$syncMoNoShip48hIds = [];

$newIds = array_fill_keys(array_keys($new), true);

/**
 * يوم الدورة من 1 إلى 14 (اليوم الأول من التسجيل = 1) للعرض داخل نافذة الاحتضان.
 * بدون تاريخ تسجيل صالح: 15 — خارج النافذة حتى لا يُعامَل المتجر كيوم 1 وهمياً.
 */
function incubation_cycle_day($regTs, $now) {
    if (!$regTs || $regTs <= 0) {
        return 15;
    }
    $d = (int) floor(($now - $regTs) / 86400);

    return min(14, max(1, $d + 1));
}

/** مرحلة المسار + أيام التأخير (عرض وبين المكالمات وتأخير المكالمة وجميع خانات المكالمات) */
function incubation_fill_between_meta(&$s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs = null) {
    $cd = min(14, max(1, (int) $cycleDay));
    $s['_cycle_day'] = $cd;
    $s['_inc_stage_key'] = '';
    $s['_delay_days'] = 0;
    $c2d = NAWRAS_ONBOARD_CYCLE_CALL2_DAY;
    $c3d = NAWRAS_ONBOARD_CYCLE_CALL3_DAY;
    if (!$inc1) {
        $hrs = $regHrs !== null ? (float) $regHrs : PHP_INT_MAX;
        if ($hrs < NAWRAS_ONBOARD_FIRST_CALL_HOURS) {
            $s['_inc_phase'] = 'المكالمة الأولى — ضمن 48 ساعة من التسجيل';
            $s['_days_until_window'] = max(0, (int) ceil(NAWRAS_ONBOARD_FIRST_CALL_HOURS - $hrs));
            $s['_next_window_hint'] = 'بعد 48 ساعة دون تسجيل تُعرَض في «تأخير المكالمة»';
            $s['_inc_stage_key'] = '';
            $s['_delay_days'] = 0;
        } else {
            $s['_inc_phase'] = $hasShipped
                ? 'شحن مسجّل — لم تُسجَّل المكالمة الأولى بعد'
                : 'تجاوز 48 ساعة دون مكالمة أولى';
            $s['_days_until_window'] = max(0, $c2d - $cd);
            $s['_next_window_hint'] = 'المكالمة الثانية (يوم ' . $c2d . ' من 14) بعد تسجيل الأولى';
            $s['_inc_stage_key'] = $hasShipped ? 'shipped_no_c1' : 'late_c1';
            $s['_delay_days'] = max(0, (int) floor($hrs / 24));
        }

        return;
    }
    if (!$inc2) {
        if ($cd < $c2d) {
            $s['_inc_phase'] = 'بين المكالمة الأولى والثانية — حتى يوم ' . $c2d . ' من التسجيل';
            $s['_days_until_window'] = max(0, $c2d - $cd);
            $s['_next_window_hint'] = 'خانة المكالمة الثانية (يوم ' . $c2d . ' من 14، يشترط شحن)';
            $s['_inc_stage_key'] = 'wait_c2';
            $s['_delay_days'] = 0;
        } else {
            $s['_inc_phase'] = $cd > $c2d
                ? 'تأخّر عن نافذة المكالمة الثانية (يوم ' . $c2d . ' من 14)'
                : '';
            $s['_days_until_window'] = max(0, $c3d - $cd);
            $s['_next_window_hint'] = 'خانة المكالمة الثالثة (يوم ' . $c3d . ' من 14)';
            $s['_inc_stage_key'] = $cd > $c2d ? 'late_c2' : 'wait_c2';
            $s['_delay_days'] = $cd > $c2d ? max(0, $cd - $c2d) : 0;
        }

        return;
    }
    if (!$inc3) {
        $s['_inc_phase'] = $cd < $c3d
            ? 'بين المكالمة الثانية والثالثة — حتى يوم ' . $c3d . ' من التسجيل'
            : 'تأخّر عن نافذة المكالمة الثالثة (يوم ' . $c3d . ' من 14)';
        $s['_days_until_window'] = max(0, $c3d - $cd);
        $s['_next_window_hint'] = 'خانة المكالمة الثالثة (يوم ' . $c3d . ' من 14)';
        $s['_inc_stage_key'] = $cd < $c3d ? 'wait_c3' : 'late_c3';
        $s['_delay_days'] = $cd > $c3d ? max(0, $cd - $c3d) : 0;
    }
}

/**
 * تصنيف متجر (مسار احتضان / نشط يدوي) حسب آخر شحنة — يستبدل شرائح 14/60 يوماً.
 *
 * @param array<string,array|int> $result
 * @param array<string,int>       $counts
 */
function nawras_route_new_loop_by_lifecycle(array &$s, int $now, bool $hasShipped, array &$result, array &$counts): void
{
    if (!$hasShipped) {
        $s['_inc'] = $s['_inc'] ?? 'never_started';
    }
    $lc = nawras_apply_lifecycle_tags($s, $now);
    nawras_push_lifecycle_bucket($s, $lc, $result, $counts, false);
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
        $stmt = $pdoDb->prepare("SELECT store_id, inc_call1_at, inc_call2_at, inc_call3_at, category, state_reason, last_call_date FROM store_states WHERE store_id IN ($ph)");
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
    $regRaw = trim((string) ($s['registered_at'] ?? ''));
    $regTs = $regRaw !== '' ? strtotime($regRaw) : null;
    if ($regTs === false) {
        $regTs = null;
    }
    /** بدون تاريخ تسجيل صالح: لا نفترض «ساعة 0» (كان يُدخل كل المتاجر في م1) */
    $regHrs = $regTs !== null ? ($now - $regTs) / 3600 : PHP_INT_MAX;
    $regDays = $regTs !== null ? ($now - $regTs) / 86400 : PHP_INT_MAX;

    $hasShipped = (intval($s['total_shipments'] ?? 0) > 0)
               || (!empty($s['last_shipment_date']) && $s['last_shipment_date'] !== 'لا يوجد');

    $s['_hours'] = round($regHrs, 1);
    $s['_days']  = round($regDays, 1);

    $inc1 = $db['inc_call1_at'] ?? null;
    $inc2 = $db['inc_call2_at'] ?? null;
    $inc3 = $db['inc_call3_at'] ?? null;
    $dbCat = $db['category'] ?? '';

    // مسار مسؤول المتاجر: تصنيف صريح غير نشط ساخن من قاعدة البيانات
    $dbReason = isset($db['state_reason']) ? (string) $db['state_reason'] : '';
    if ($db && $dbCat === 'hot_inactive' && $dbReason === 'mo_d14_no_ship') {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $s['_cat'] = 'hot_inactive';
        $s['_mo_auto_hot'] = true;
        $result['hot_inactive'][] = $s;
        $counts['hot_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }
    if ($db && $dbCat === 'hot_inactive' && $dbReason === 'mo_no_ship_before_c2') {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $s['_cat'] = 'hot_inactive';
        $s['_mo_auto_hot'] = true;
        $result['hot_inactive'][] = $s;
        $counts['hot_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // بارد من قاعدة البيانات (مثلاً no_ship_after_48h)
    if ($db && $dbCat === 'cold_inactive') {
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

    // منجز / تم التواصل من المتابعة الدورية أو الواجهة — إخراج من مسار الاحتضان ونقل لقائمة المنجزين
    if ($db && in_array($dbCat, ['completed', 'contacted'], true)) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $s['_cat'] = $dbCat;
        if (!empty($db['last_call_date'])) {
            $s['last_call_date'] = $db['last_call_date'];
        }
        $result['completed_merchants'][] = $s;
        $counts['completed_merchants']++;
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // تخريج يدوي إلى نشط من الواجهة
    if ($db && in_array($dbCat, ['active', 'active_shipping'], true) && empty($inc3)) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        nawras_route_new_loop_by_lifecycle($s, $now, $hasShipped, $result, $counts);
        continue;
    }

    // بعد المكالمة الثالثة — تصنيف حسب دورة الحياة (بدل 14/60 يوماً)
    if (!empty($inc3)) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        nawras_route_new_loop_by_lifecycle($s, $now, $hasShipped, $result, $counts);
        continue;
    }

    $cycleDay = incubation_cycle_day($regTs, $now);
    $s['_cycle_day'] = $cycleDay;

    $c2d = NAWRAS_ONBOARD_CYCLE_CALL2_DAY;
    $c3d = NAWRAS_ONBOARD_CYCLE_CALL3_DAY;

    $missedC1Window = false;
    if ($inc1 && $regTs) {
        $c1ts = strtotime((string) $inc1);
        if ($c1ts !== false && $c1ts > $regTs + NAWRAS_ONBOARD_FIRST_CALL_HOURS * 3600) {
            $missedC1Window = true;
        }
    }
    $s['_missed_c1_window'] = $missedC1Window;
    $s['_missed_c2_window'] = false;

    // المكالمة الثالثة — من يوم 10 إلى 14: بعد تسجيل المكالمة الثانية، أو (م1 + شحن) حتى لو لم تُسجَّل المكالمة الثانية
    $inCall3Window = !$inc3 && $cycleDay >= $c3d && $cycleDay <= 14;
    $missedSecondCall = false;
    $qualifiesCall3 = false;
    if ($inCall3Window) {
        if ($inc2) {
            $qualifiesCall3 = true;
        } elseif ($inc1 && $hasShipped) {
            $qualifiesCall3 = true;
            $missedSecondCall = true;
        }
    }
    if ($qualifiesCall3) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_3';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $s['_missed_c2_window'] = $missedSecondCall;
        if ($missedSecondCall) {
            $s['_inc_phase'] = 'المكالمة الثالثة — لم تُسجَّل المكالمة الثانية بعد';
        }
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_3'][] = $s;
        $incubation_counts['call_3']++;
        $incubation_counts['total']++;
        continue;
    }

    // م1 مسجّلة ويوم 3+ من التسجيل بدون أي شحنة → لا انتقال للمكالمة الثانية (غير نشط ساخن)
    if ($inc1 && !$inc2 && $cycleDay >= $c2d && !$hasShipped) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $s['_cat'] = 'hot_inactive';
        $s['_mo_auto_hot'] = true;
        $s['_inc'] = 'no_ship_before_stage2';
        $result['hot_inactive'][] = $s;
        $counts['hot_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        $sidSync = (int) $id;
        if ($sidSync > 0) {
            $syncMoNoShipBeforeC2Ids[$sidSync] = true;
        }
        continue;
    }

    // المكالمة الثانية — من يوم 3 حتى قبل يوم 10 (يوم 10+ يُعرَض في المكالمة الثالثة حتى لو لم تُسجَّل م2)
    if ($inc1 && !$inc2 && $cycleDay >= $c2d && $cycleDay < $c3d && $hasShipped) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_2';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_2'][] = $s;
        $incubation_counts['call_2']++;
        $incubation_counts['total']++;
        continue;
    }

    // بعد 14 يوماً تقويمياً من التسجيل بدون مكالمة أولى وبدون شحن → غير نشط بارد
    // (لا نعتمد cycleDay>14 فقط: incubation_cycle_day يقصّ عند 14 فيُستبعد المتاجر القديمة خطأً)
    if (!$inc1 && !$hasShipped && $regTs !== null && $regDays > 14) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        nawras_apply_lifecycle_tags($s, $now);
        $s['_cat'] = 'cold_inactive';
        $s['_inc'] = 'never_started';
        $s['_never_started'] = true;
        $result['cold_inactive'][] = $s;
        $counts['cold_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        continue;
    }

    // ترحيل: شحن بعد 14 يوم من التسجيل — تصنيف دورة حياة
    if ($hasShipped && $regDays > 14) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        nawras_route_new_loop_by_lifecycle($s, $now, true, $result, $counts);
        continue;
    }

    // المكالمة الأولى — خلال 48 ساعة من التسجيل فقط
    if (!$inc1 && $regHrs < NAWRAS_ONBOARD_FIRST_CALL_HOURS) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_1';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_1'][] = $s;
        $incubation_counts['call_1']++;
        $incubation_counts['total']++;
        continue;
    }

    // بعد 48 ساعة بدون شحن وبدون مكالمة أولى — إن كان لا يزال ضمن الاحتضان (<14 يوماً) نُبقي «تأخير المكالمة» بدل البارد
    if (!$inc1 && !$hasShipped && $regHrs >= NAWRAS_ONBOARD_FIRST_CALL_HOURS) {
        if (!empty($s['status']) && $s['status'] !== 'active') {
            continue;
        }
        $lc48 = nawras_compute_lifecycle($s, $now);
        if ($lc48 === 'incubating' || $lc48 === 'new') {
            $s['_cat'] = 'incubating';
            $s['_inc'] = 'call_1_delayed';
            nawras_apply_lifecycle_tags($s, $now);
            incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
            $result['incubating'][] = $s;
            $counts['incubating']++;
            $counts['total']++;
            $incubation_path['call_delay'][] = $s;
            $incubation_counts['call_delay']++;
            $incubation_counts['total']++;
            continue;
        }
        $s['_cat'] = 'cold_inactive';
        $s['_inc'] = 'never_started';
        $s['_never_started'] = true;
        nawras_apply_lifecycle_tags($s, $now);
        $result['cold_inactive'][] = $s;
        $counts['cold_inactive']++;
        $counts['total_active']++;
        $counts['total']++;
        $sidSync48 = (int) $id;
        if ($sidSync48 > 0) {
            $syncMoNoShip48hIds[$sidSync48] = true;
        }
        continue;
    }

    // تأخّر المكالمة الأولى — مرّت 48 ساعة، يوجد شحن، دون تسجيل المكالمة الأولى
    if (!$inc1 && $regHrs >= NAWRAS_ONBOARD_FIRST_CALL_HOURS) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'call_1_delayed';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['call_delay'][] = $s;
        $incubation_counts['call_delay']++;
        $incubation_counts['total']++;
        continue;
    }

    // بين المكالمة 1 و 2 — قبل يوم 3 (م1 مسجّلة)
    if ($inc1 && !$inc2 && $cycleDay < $c2d) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'between_calls';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['between'][] = $s;
        $incubation_counts['between']++;
        $incubation_counts['total']++;
        continue;
    }

    // بين المكالمة 2 و 3 — قبل يوم 10
    if ($inc2 && !$inc3 && $cycleDay < $c3d) {
        $s['_cat'] = 'incubating';
        $s['_inc'] = 'between_calls';
        incubation_fill_between_meta($s, $cycleDay, $inc1, $inc2, $inc3, $hasShipped, $regHrs);
        $result['incubating'][] = $s;
        $counts['incubating']++;
        $counts['total']++;
        $incubation_path['between'][] = $s;
        $incubation_counts['between']++;
        $incubation_counts['total']++;
        continue;
    }
}

// مزامنة: يوم 3+ بعد المكالمة الأولى بدون شحن → hot_inactive + سبب ثابت (للتقارير ولوحة المسؤول)
if (!empty($syncMoNoShipBeforeC2Ids)) {
    try {
        if (!isset($pdoDb)) {
            require_once __DIR__ . '/db.php';
            $pdoDb = getDB();
        }
        $stMo = $pdoDb->prepare(
            'INSERT INTO store_states (store_id, store_name, category, state_reason, updated_by)
             VALUES (?, ?, \'hot_inactive\', \'mo_no_ship_before_c2\', \'system\')
             ON DUPLICATE KEY UPDATE category = \'hot_inactive\', state_reason = VALUES(state_reason), store_name = VALUES(store_name)'
        );
        foreach (array_keys($syncMoNoShipBeforeC2Ids) as $sidMo) {
            $nm = isset($new[$sidMo]['name']) ? (string) $new[$sidMo]['name'] : '';
            $stMo->execute([$sidMo, $nm !== '' ? $nm : (string) $sidMo]);
        }
    } catch (Throwable $e) {
        // تجاهل — العرض يبقى صحيحاً من التصنيف أعلاه
    }
}

if (!empty($syncMoNoShip48hIds)) {
    try {
        if (!isset($pdoDb)) {
            require_once __DIR__ . '/db.php';
            $pdoDb = getDB();
        }
        try {
            $pdoDb->exec('ALTER TABLE store_states ADD COLUMN state_reason VARCHAR(100) NULL DEFAULT NULL');
        } catch (Throwable $e) {
        }
        $st48 = $pdoDb->prepare(
            'INSERT INTO store_states (store_id, store_name, category, state_reason, updated_by)
             VALUES (?, ?, \'cold_inactive\', \'no_ship_after_48h\', \'system\')
             ON DUPLICATE KEY UPDATE category = \'cold_inactive\', state_reason = VALUES(state_reason), store_name = COALESCE(VALUES(store_name), store_name)'
        );
        foreach (array_keys($syncMoNoShip48hIds) as $sid48) {
            $nm = isset($new[$sid48]['name']) ? (string) $new[$sid48]['name'] : '';
            $st48->execute([$sid48, $nm !== '' ? $nm : (string) $sid48]);
        }
    } catch (Throwable $e) {
    }
}

// ── تصنيف بقية المتاجر (من allStores) — دورة حياة حصرية ────────
foreach ($allStores as $id => $s) {
    if (isset($newIds[$id])) {
        continue;
    }
    if (!empty($s['status']) && $s['status'] !== 'active') {
        continue;
    }

    nawras_classify_mature_store_row($s, $now, $result, $counts);
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
            $unreachable = [];
            foreach ($result['active_shipping'] as $s) {
                $id = (int) ($s['id'] ?? 0);
                $row = $catById[$id] ?? null;
                $cat = $row['category'] ?? '';
                if ($cat === 'completed' || $cat === 'contacted') {
                    if (!empty($row['last_call_date'])) {
                        $s['last_call_date'] = $row['last_call_date'];
                    }
                    $completed[] = $s;
                } elseif ($cat === 'unreachable') {
                    if (!empty($row['last_call_date'])) {
                        $s['last_call_date'] = $row['last_call_date'];
                    }
                    $unreachable[] = $s;
                } else {
                    $activePending[] = $s;
                }
            }
            $result['active_shipping'] = $activePending;
            $mergedCompleted = array_merge($result['completed_merchants'] ?? [], $completed);
            $seenC = [];
            $dedupCompleted = [];
            foreach ($mergedCompleted as $row) {
                $cid = (int) ($row['id'] ?? 0);
                if ($cid <= 0 || isset($seenC[$cid])) {
                    continue;
                }
                $seenC[$cid] = true;
                $dedupCompleted[] = $row;
            }
            $result['completed_merchants'] = $dedupCompleted;
            $result['unreachable_merchants'] = $unreachable;
            $counts['active_shipping'] = count($activePending);
            $counts['completed_merchants'] = count($dedupCompleted);
            $counts['unreachable_merchants'] = count($unreachable);
        }
    }
} catch (Throwable $e) {
    // بدون DB لا نفصل القائمة
}

// ── المتاجر المجمدة: قائمة منفصلة وإزالتها من باقي الخانات ─────
/** @param array<int, mixed> $stores */
function nawras_filter_out_store_id(array &$stores, $id) {
    $id = (int) $id;
    $stores = array_values(array_filter($stores, static function ($s) use ($id) {
        return (int) ($s['id'] ?? 0) !== $id;
    }));
}

try {
    if (!isset($pdoDb)) {
        require_once __DIR__ . '/db.php';
        $pdoDb = getDB();
    }
    $stFrozen = $pdoDb->query("SELECT store_id, freeze_reason, updated_by FROM store_states WHERE category = 'frozen'");
    $frozenRows = $stFrozen ? $stFrozen->fetchAll(PDO::FETCH_ASSOC) : [];
    $frozenById = [];
    foreach ($frozenRows as $fr) {
        $fid = (int) ($fr['store_id'] ?? 0);
        if ($fid <= 0) {
            continue;
        }
        $frozenById[$fid] = $fr;
    }
    foreach (array_keys($frozenById) as $fid) {
        nawras_filter_out_store_id($result['active_shipping'], $fid);
        nawras_filter_out_store_id($result['completed_merchants'], $fid);
        nawras_filter_out_store_id($result['unreachable_merchants'], $fid);
        nawras_filter_out_store_id($result['hot_inactive'], $fid);
        nawras_filter_out_store_id($result['cold_inactive'], $fid);
        nawras_filter_out_store_id($result['incubating'], $fid);
        nawras_filter_out_store_id($incubation_path['call_1'], $fid);
        nawras_filter_out_store_id($incubation_path['call_delay'], $fid);
        nawras_filter_out_store_id($incubation_path['call_2'], $fid);
        nawras_filter_out_store_id($incubation_path['call_3'], $fid);
        nawras_filter_out_store_id($incubation_path['between'], $fid);
    }
    $result['frozen_merchants'] = [];
    foreach ($frozenById as $fid => $fr) {
        $s = $allStores[$fid] ?? $new[$fid] ?? $inactive[$fid] ?? null;
        if (!is_array($s)) {
            $s = [];
        }
        $s['id'] = $fid;
        if (empty($s['name'])) {
            $s['name'] = '';
        }
        if (empty($s['phone'])) {
            $s['phone'] = '';
        }
        $s['freeze_reason'] = $fr['freeze_reason'] ?? '';
        $s['frozen_updated_by'] = $fr['updated_by'] ?? '';
        $s['_cat'] = 'frozen';
        $result['frozen_merchants'][] = $s;
    }
    $counts['frozen_merchants'] = count($result['frozen_merchants']);
    $counts['active_shipping'] = count($result['active_shipping']);
    $counts['completed_merchants'] = count($result['completed_merchants']);
    $counts['unreachable_merchants'] = count($result['unreachable_merchants']);
    $counts['hot_inactive'] = count($result['hot_inactive']);
    $counts['cold_inactive'] = count($result['cold_inactive']);
    $counts['incubating'] = count($result['incubating']);
    $incubation_counts['call_1'] = count($incubation_path['call_1']);
    $incubation_counts['call_delay'] = count($incubation_path['call_delay']);
    $incubation_counts['call_2'] = count($incubation_path['call_2']);
    $incubation_counts['call_3'] = count($incubation_path['call_3']);
    $incubation_counts['between'] = count($incubation_path['between']);
    $incubation_counts['total'] = $incubation_counts['call_1'] + $incubation_counts['call_delay'] + $incubation_counts['call_2'] + $incubation_counts['call_3'] + $incubation_counts['between'];
    $counts['total_active'] = $counts['active_shipping'] + $counts['completed_merchants'] + $counts['unreachable_merchants']
        + $counts['hot_inactive'] + $counts['cold_inactive'];
} catch (Throwable $e) {
    if (!isset($result['frozen_merchants'])) {
        $result['frozen_merchants'] = [];
    }
    $counts['frozen_merchants'] = count($result['frozen_merchants']);
}

$counts['check'] = (
    $counts['active_shipping'] + $counts['completed_merchants'] + $counts['unreachable_merchants'] + $counts['hot_inactive'] + $counts['cold_inactive']
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

// طابور مهام الاستعادة (50) — نفس تصنيف ساخن/بارد كالواجهة (ليس من store_states فقط)
$inactiveRecoveryPool = [];
foreach ($result['hot_inactive'] ?? [] as $s) {
    if (!isset($s['id'])) {
        continue;
    }
    $inactiveRecoveryPool[] = [
        'store_id'   => $s['id'],
        'store_name' => isset($s['name']) ? (string) $s['name'] : '',
        'bucket'     => 'hot_inactive',
    ];
}
foreach ($result['cold_inactive'] ?? [] as $s) {
    if (!isset($s['id'])) {
        continue;
    }
    $inactiveRecoveryPool[] = [
        'store_id'   => $s['id'],
        'store_name' => isset($s['name']) ? (string) $s['name'] : '',
        'bucket'     => 'cold_inactive',
    ];
}
@file_put_contents(
    $cacheDir . '/inactive_recovery_pool.json',
    json_encode([
        'generated_at' => date('c'),
        'count'        => count($inactiveRecoveryPool),
        'stores'         => $inactiveRecoveryPool,
    ], JSON_UNESCAPED_UNICODE)
);

try {
    if (!isset($pdoDb)) {
        require_once __DIR__ . '/db.php';
        $pdoDb = getDB();
    }
    require_once __DIR__ . '/workflow-queue-lib.php';
    purge_active_manager_assignments_for_exited_incubation($pdoDb, $result);
} catch (Throwable $e) {
}

/** @return array<string,int> */
function nawras_aggregate_lifecycle_counts(array $result): array
{
    $keys = ['new', 'incubating', 'hot', 'active', 'at_risk', 'cold', 'inactive'];
    $out = array_fill_keys($keys, 0);
    foreach ($result as $rows) {
        if (!is_array($rows)) {
            continue;
        }
        foreach ($rows as $s) {
            if (!is_array($s)) {
                continue;
            }
            $lc = $s['lifecycle'] ?? '';
            if ($lc !== '' && isset($out[$lc])) {
                $out[$lc]++;
            }
        }
    }

    return $out;
}

$lifecycle_counts = nawras_aggregate_lifecycle_counts($result);

echo json_encode([
    'success'           => true,
    'counts'            => $counts,
    'incubation_counts' => $incubation_counts,
    'lifecycle_counts'  => $lifecycle_counts,
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
        'lifecycle_counts'  => $lifecycle_counts,
    ],
], JSON_UNESCAPED_UNICODE);
