<?php
/**
 * early-warning.php
 * نظام الإنذار المبكر: يقارن طلبات أمس بقبل أمس لكل متجر.
 * يُنبّه عند انخفاض طلبات أمس عن قبل أمس.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/nawris-orders-summary-core.php';

ini_set('memory_limit',       MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ─── إعدادات ──────────────────────────────────────────────────────────────────
define('EW_THRESHOLD',     5);    // تراجع 5 طلبات أو أكثر
define('EW_CACHE_TTL',     0);    // كلا اليومين كاش دائم (أيام كاملة منتهية)
define('EW_MAX_PAGES',     200);

$yesterday  = date('Y-m-d', strtotime('-1 day'));
$dayBefore  = date('Y-m-d', strtotime('-2 days'));

$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$yesterdayFile = $cacheDir . '/ew_v2_' . $yesterday . '.json';
$dayBeforeFile = $cacheDir . '/ew_v2_' . $dayBefore . '.json';

// ─── دالة تحليل نتيجة الـ API ─────────────────────────────────────────────────
function ew_extract_counts(array $storeMap): array {
    $out = [];
    foreach ($storeMap as $sid => $store) {
        $out[(int) $sid] = [
            'id'    => (int) $sid,
            'name'  => $store['name'] ?? ('#' . $sid),
            'count' => (int) ($store['shipments_in_range'] ?? 0),
        ];
    }
    return $out;
}

// ─── جلب أو كاش بيانات يوم معيّن ─────────────────────────────────────────────
function ew_load_day(string $date, string $file, bool $force = false): array {
    if (!$force && file_exists($file)) {
        $raw = @file_get_contents($file);
        if ($raw !== false) {
            $data = json_decode($raw, true);
            if (is_array($data)) return $data;
        }
    }

    $result = nawris_orders_summary_fetch_all($date, $date, EW_MAX_PAGES, true);
    if (!($result['meta']['ok'] ?? false) && !empty($result['meta']['curl_errno'])) {
        $result = nawris_orders_summary_fetch_all($date, $date, EW_MAX_PAGES, false);
    }

    $counts = ew_extract_counts($result['stores'] ?? []);
    @file_put_contents($file, json_encode($counts, JSON_UNESCAPED_UNICODE));
    return $counts;
}

// ─── جلب البيانات ─────────────────────────────────────────────────────────────
$forceRefresh = !empty($_GET['force']) || !empty($_GET['nocache']);

// أمس وقبل أمس — كلاهما يوم منتهٍ، الكاش دائم إلا عند force
$yesterdayCounts = ew_load_day($yesterday, $yesterdayFile, $forceRefresh);
$dayBeforeCounts = ew_load_day($dayBefore, $dayBeforeFile, false);

// ─── بناء قائمة التحذيرات ─────────────────────────────────────────────────────
// المرجع: قبل أمس | المقارنة: أمس
$warnings = [];

foreach ($dayBeforeCounts as $sid => $dbData) {
    $dbCount = $dbData['count'];                                        // قبل أمس
    $yCount  = isset($yesterdayCounts[$sid]) ? $yesterdayCounts[$sid]['count'] : 0; // أمس
    $drop    = $dbCount - $yCount;

    if ($drop < EW_THRESHOLD) continue;

    $dropPercent = $dbCount > 0 ? (int) round(($drop / $dbCount) * 100) : 100;

    $warnings[] = [
        'store_id'          => $sid,
        'store_name'        => $dbData['name'],
        'day_before_count'  => $dbCount,
        'yesterday_count'   => $yCount,
        'drop'              => $drop,
        'drop_percent'      => $dropPercent,
    ];
}

usort($warnings, fn ($a, $b) => $b['drop'] - $a['drop']);

// ─── إحصائيات ─────────────────────────────────────────────────────────────────
$totalDayBefore  = array_sum(array_column($dayBeforeCounts,  'count'));
$totalYesterday  = array_sum(array_column($yesterdayCounts,  'count'));

echo json_encode([
    'success'         => true,
    'warnings'        => $warnings,
    'total_warnings'  => count($warnings),
    'threshold'       => EW_THRESHOLD,
    'yesterday'       => $yesterday,
    'day_before'      => $dayBefore,
    'total_yesterday' => $totalYesterday,
    'total_day_before'=> $totalDayBefore,
], JSON_UNESCAPED_UNICODE);
