<?php
/**
 * early-warning.php
 * نظام الإنذار المبكر: يقارن طلبات اليوم بأمس لكل متجر.
 * يُنبّه عند انخفاض طلبات متجر (لديه 10+ طرود أمس) مقارنةً باليوم.
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
define('EW_THRESHOLD',        1);     // أي تراجع ولو طلب واحد
define('EW_TODAY_CACHE_TTL',  900);   // كاش اليوم: 15 دقيقة
define('EW_MAX_PAGES',        200);

$today     = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));

$cacheDir = __DIR__ . '/cache';
if (!is_dir($cacheDir)) {
    @mkdir($cacheDir, 0755, true);
}

$yesterdayFile = $cacheDir . '/ew_yesterday_' . $yesterday . '.json';
$todayFile     = $cacheDir . '/ew_today_'     . $today     . '.json';

// ─── دالة تحليل نتيجة الـ API ─────────────────────────────────────────────────
function ew_extract_counts(array $storeMap): array {
    $out = [];
    foreach ($storeMap as $sid => $store) {
        $out[(int) $sid] = [
            'id'    => (int) $sid,
            'name'  => $store['name'] ?? ('#' . $sid),
            'count' => (int) ($store['total_shipments'] ?? 0),
        ];
    }
    return $out;
}

// ─── جلب أو كاش بيانات يوم معيّن ─────────────────────────────────────────────
function ew_load_day(string $date, string $file, int $ttl): array {
    if (file_exists($file)) {
        $age = time() - (int) filemtime($file);
        if ($ttl === 0 || $age < $ttl) {  // ttl=0 → دائم (أمس)
            $raw = @file_get_contents($file);
            if ($raw !== false) {
                $data = json_decode($raw, true);
                if (is_array($data)) {
                    return $data;
                }
            }
        }
    }

    // جلب من Nawris API
    $result = nawris_orders_summary_fetch_all($date, $date, EW_MAX_PAGES, true);

    // إذا فشل SSL حاول بدون تحقق
    if (!($result['meta']['ok'] ?? false) && !empty($result['meta']['curl_errno'])) {
        $result = nawris_orders_summary_fetch_all($date, $date, EW_MAX_PAGES, false);
    }

    $counts = ew_extract_counts($result['stores'] ?? []);
    @file_put_contents($file, json_encode($counts, JSON_UNESCAPED_UNICODE));
    return $counts;
}

// ─── جلب البيانات ─────────────────────────────────────────────────────────────
$forceRefresh = !empty($_GET['force']) || !empty($_GET['nocache']);
if ($forceRefresh && file_exists($todayFile)) {
    @unlink($todayFile);
}

$yesterdayCounts = ew_load_day($yesterday, $yesterdayFile, 0);
$todayCounts     = ew_load_day($today,     $todayFile,     EW_TODAY_CACHE_TTL);

// ─── بناء قائمة التحذيرات ─────────────────────────────────────────────────────
$warnings = [];

foreach ($yesterdayCounts as $sid => $yData) {
    $yCount = $yData['count'];
    $tCount = isset($todayCounts[$sid]) ? $todayCounts[$sid]['count'] : 0;
    $drop   = $yCount - $tCount;

    if ($drop < EW_THRESHOLD) {
        continue;
    }

    $dropPercent = $yCount > 0 ? (int) round(($drop / $yCount) * 100) : 100;

    $warnings[] = [
        'store_id'        => $sid,
        'store_name'      => $yData['name'],
        'yesterday_count' => $yCount,
        'today_count'     => $tCount,
        'drop'            => $drop,
        'drop_percent'    => $dropPercent,
    ];
}

// ترتيب: الأكبر انخفاضاً أولاً
usort($warnings, fn ($a, $b) => $b['drop'] - $a['drop']);

// ─── إحصائيات ─────────────────────────────────────────────────────────────────
$totalYesterday   = array_sum(array_column($yesterdayCounts, 'count'));
$totalToday       = array_sum(array_column($todayCounts,     'count'));
$cachedTodayFresh = file_exists($todayFile) && (time() - (int) filemtime($todayFile)) < EW_TODAY_CACHE_TTL;

echo json_encode([
    'success'          => true,
    'warnings'         => $warnings,
    'total_warnings'   => count($warnings),
    'threshold'        => EW_THRESHOLD,
    'today'            => $today,
    'yesterday'        => $yesterday,
    'total_yesterday'  => $totalYesterday,
    'total_today'      => $totalToday,
    'cached_today'     => $cachedTodayFresh,
    'cached_yesterday' => file_exists($yesterdayFile),
    'cache_age_today'  => file_exists($todayFile) ? (time() - (int) filemtime($todayFile)) : null,
], JSON_UNESCAPED_UNICODE);
