<?php
/**
 * لوحة تحليلات المدير — KPIs + سلاسل شهرية (استبيانات + Nawris عند الحاجة)
 * الوصول: user_role=executive فقط
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

ini_set('memory_limit', MEMORY_HEAVY);
ini_set('max_execution_time', (string) TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$userRole = $_GET['user_role'] ?? $_POST['user_role'] ?? '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح — لوحة التحليلات للمدير التنفيذي فقط.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$year = isset($_GET['year']) ? (int) $_GET['year'] : (int) date('Y');
if ($year < 2020 || $year > 2100) {
    $year = (int) date('Y');
}

$period = $_GET['period'] ?? 'yearly';
if (!in_array($period, ['monthly', 'quarterly', 'yearly'], true)) {
    $period = 'yearly';
}

$pdo = getDB();

require_once __DIR__ . '/workflow-queue-lib.php';

try {
    $pdo->exec("ALTER TABLE surveys ADD COLUMN survey_kind VARCHAR(32) NULL DEFAULT 'active_csat'");
} catch (Throwable $e) {
}

/** مسؤولو الاستعادة — هدف الاتصالات اليومي للمزامنة مع لوحة المدير */
$inactiveRecoveryDaily = [];
try {
    ensure_inactive_daily_stats_schema($pdo);
    $st = $pdo->query("
        SELECT u.username, u.fullname, COALESCE(s.successful_contacts, 0) AS successful_contacts
        FROM users u
        LEFT JOIN inactive_manager_daily_stats s
            ON s.username = u.username AND s.work_date = CURDATE()
        WHERE u.role = 'inactive_manager'
        ORDER BY u.username ASC
    ");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $c = (int) ($r['successful_contacts'] ?? 0);
        $inactiveRecoveryDaily[] = [
            'username' => $r['username'],
            'fullname' => $r['fullname'] ?? '',
            'successful_contacts' => $c,
            'daily_goal_met' => $c >= INACTIVE_DAILY_SUCCESS_TARGET,
        ];
    }
} catch (Throwable $e) {
    $inactiveRecoveryDaily = [];
}

/** استبيانات تُحتسب في CSAT فقط (استبعاد ملاحظات المتاجر غير النشطة) */
function ma_csat_kind_sql() {
    return " AND (COALESCE(survey_kind, 'active_csat') <> 'inactive_feedback') ";
}

/** جلب متاجر جدد من Nawris منذ تاريخ — نسخة محدودة الصفحات للتحليل */
function ma_fetch_new_customers_since(string $since, int $maxPages = 25) {
    $all = [];
    $cursor = null;
    $p = 0;
    $base = NAWRIS_BASE . '/customers/new?since=' . urlencode($since);
    do {
        $url = $cursor ? $base . '&cursor=' . urlencode($cursor) : $base;
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r = curl_exec($ch);
        curl_close($ch);
        if (!$r) {
            break;
        }
        $d = json_decode($r, true);
        if (!isset($d['data']) || !is_array($d['data'])) {
            break;
        }
        foreach ($d['data'] as $i) {
            $id = $i['id'] ?? null;
            if ($id === null) {
                continue;
            }
            if (!isset($all[$id])) {
                $all[$id] = $i;
            }
        }
        $cursor = $d['meta']['next_cursor'] ?? null;
        $p++;
    } while ($cursor && $p < $maxPages);

    return $all;
}

function ma_parse_reg_date($s) {
    if (empty($s)) {
        return null;
    }
    $t = strtotime(str_replace(' ', 'T', trim($s)));
    return $t ? $t : null;
}

function ma_total_shipments($row) {
    $raw = $row['total_shipments'] ?? 0;
    return max(0, (int) $raw);
}

/** orders-summary لنطاق — طرود في النطاق */
function ma_fetch_orders_summary_range(string $from, string $to, int $maxPages = 40) {
    $storeMap = [];
    $cursor = null;
    $page = 0;
    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . urlencode($from) . '&to=' . urlencode($to);
        if ($cursor) {
            $url .= '&cursor=' . urlencode($cursor);
        }
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 25,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $response = curl_exec($ch);
        curl_close($ch);
        if (!$response) {
            break;
        }
        $data = json_decode($response, true);
        if (!is_array($data) || !isset($data['data'])) {
            break;
        }
        foreach ($data['data'] as $store) {
            $sid = $store['id'];
            if (!isset($storeMap[$sid])) {
                $storeMap[$sid] = $store;
            } else {
                $ts = (int) ($store['total_shipments'] ?? 0);
                if ($ts > (int) ($storeMap[$sid]['total_shipments'] ?? 0)) {
                    $storeMap[$sid]['total_shipments'] = $ts;
                }
            }
        }
        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;
    } while ($cursor && $page < $maxPages);

    return $storeMap;
}

// ─── استبيانات: متوسط CSAT = متوسط الستة أسئلة ───
function ma_csat_expr_sql() {
    return '(q1_delivery + q2_collection + q3_support + q4_app + q5_payments + q6_returns) / 6.0';
}

$today = date('Y-m-d');
$yesterday = date('Y-m-d', strtotime('-1 day'));

$stmtToday = $pdo->prepare('SELECT AVG(' . ma_csat_expr_sql() . ') AS a, COUNT(*) AS c FROM surveys WHERE DATE(created_at) = ?' . ma_csat_kind_sql());
$stmtToday->execute([$today]);
$rowT = $stmtToday->fetch(PDO::FETCH_ASSOC);
$csatToday = $rowT && $rowT['c'] > 0 ? round((float) $rowT['a'], 3) : null;

$stmtY = $pdo->prepare('SELECT AVG(' . ma_csat_expr_sql() . ') AS a, COUNT(*) AS c FROM surveys WHERE DATE(created_at) = ?' . ma_csat_kind_sql());
$stmtY->execute([$yesterday]);
$rowY = $stmtY->fetch(PDO::FETCH_ASSOC);
$csatYesterday = $rowY && $rowY['c'] > 0 ? round((float) $rowY['a'], 3) : null;

// ─── تحويل يومي: من Nawris (متاجر مسجّلة اليوم ووجود شحنات) ───
$newSince = date('Y-m-d', strtotime('-2 days'));
$newStores = ma_fetch_new_customers_since($newSince, 20);
$todayStart = strtotime($today . ' 00:00:00');
$todayEnd = strtotime($today . ' 23:59:59');
$yStart = strtotime($yesterday . ' 00:00:00');
$yEnd = strtotime($yesterday . ' 23:59:59');

$regToday = 0;
$convToday = 0;
$regYest = 0;
$convYest = 0;
foreach ($newStores as $row) {
    $reg = ma_parse_reg_date($row['registered_at'] ?? '');
    if (!$reg) {
        continue;
    }
    $ship = ma_total_shipments($row);
    if ($reg >= $todayStart && $reg <= $todayEnd) {
        $regToday++;
        if ($ship > 0) {
            $convToday++;
        }
    }
    if ($reg >= $yStart && $reg <= $yEnd) {
        $regYest++;
        if ($ship > 0) {
            $convYest++;
        }
    }
}

$convRateToday = $regToday > 0 ? round(100.0 * $convToday / $regToday, 2) : null;
$convRateYesterday = $regYest > 0 ? round(100.0 * $convYest / $regYest, 2) : null;

// ─── استعادة شهرية: متاجر مجمّدة في DB لها شحنات ضمن الشهر الحالي ───
$stmtF = $pdo->query("SELECT store_id FROM store_states WHERE category = 'frozen'");
$frozenIds = [];
while ($r = $stmtF->fetch(PDO::FETCH_ASSOC)) {
    $frozenIds[(string) $r['store_id']] = true;
}
$frozenTotal = count($frozenIds);
$monthStart = date('Y-m-01');
$monthEnd = date('Y-m-d');
$osMap = ma_fetch_orders_summary_range($monthStart, $monthEnd, 35);
$reactivated = 0;
foreach ($osMap as $sid => $st) {
    $sidStr = (string) $sid;
    if (!isset($frozenIds[$sidStr])) {
        continue;
    }
    $ships = (int) ($st['total_shipments'] ?? 0);
    if ($ships > 0) {
        $reactivated++;
    }
}
$recoveryRateMonth = $frozenTotal > 0 ? round(100.0 * $reactivated / $frozenTotal, 2) : null;

// ─── سلاسل شهرية للسنة المختارة (استبيانات) ───
$stmtM = $pdo->prepare("
    SELECT MONTH(created_at) AS m, AVG(" . ma_csat_expr_sql() . ") AS avg_csat, COUNT(*) AS n
    FROM surveys
    WHERE YEAR(created_at) = ?
    " . ma_csat_kind_sql() . "
    GROUP BY MONTH(created_at)
    ORDER BY m
");
$stmtM->execute([$year]);
$csatByMonth = [];
while ($r = $stmtM->fetch(PDO::FETCH_ASSOC)) {
    $csatByMonth[(int) $r['m']] = [
        'avg' => round((float) $r['avg_csat'], 3),
        'count' => (int) $r['n'],
    ];
}

// ─── تحويل شهري تقريبي: نفس دمج Nawris لسنة كاملة مرة واحدة ───
$sinceYear = $year . '-01-01';
$yearStores = ma_fetch_new_customers_since($sinceYear, min(45, (int) MAX_PAGES_ALL));
$convByMonth = array_fill(1, 12, ['registered' => 0, 'with_shipments' => 0]);
foreach ($yearStores as $row) {
    $reg = ma_parse_reg_date($row['registered_at'] ?? '');
    if (!$reg) {
        continue;
    }
    if ((int) date('Y', $reg) !== $year) {
        continue;
    }
    $m = (int) date('n', $reg);
    $convByMonth[$m]['registered']++;
    if (ma_total_shipments($row) > 0) {
        $convByMonth[$m]['with_shipments']++;
    }
}

$recoveryByMonth = array_fill(1, 12, null);
for ($m = 1; $m <= 12; $m++) {
    $fm = sprintf('%04d-%02d-01', $year, $m);
    $last = date('Y-m-t', strtotime($fm));
    if (strtotime($last) > time()) {
        $last = date('Y-m-d');
    }
    if (strtotime($fm) > time()) {
        continue;
    }
    $omap = ma_fetch_orders_summary_range($fm, $last, 25);
    $react = 0;
    foreach ($omap as $sid => $st) {
        if (!isset($frozenIds[(string) $sid])) {
            continue;
        }
        if ((int) ($st['total_shipments'] ?? 0) > 0) {
            $react++;
        }
    }
    $recoveryByMonth[$m] = $frozenTotal > 0 ? round(100.0 * $react / $frozenTotal, 2) : 0;
}

$monthsSeries = [];
$monthNames = ['', 'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
for ($m = 1; $m <= 12; $m++) {
    $regM = $convByMonth[$m]['registered'];
    $convM = $convByMonth[$m]['with_shipments'];
    $convPct = $regM > 0 ? round(100.0 * $convM / $regM, 2) : null;
    $csatM = isset($csatByMonth[$m]) ? $csatByMonth[$m]['avg'] : null;
    $recM = $recoveryByMonth[$m];
    $monthsSeries[] = [
        'month' => $m,
        'month_label' => $monthNames[$m] ?? (string) $m,
        'conversion_rate' => $convPct,
        'recovery_rate' => $recM,
        'csat_avg' => $csatM,
        'survey_count' => $csatByMonth[$m]['count'] ?? 0,
        'registrations' => $regM,
    ];
}

$quarters = [];
if ($period === 'quarterly') {
    for ($q = 1; $q <= 4; $q++) {
        $startM = ($q - 1) * 3 + 1;
        $sumCsat = 0;
        $nCsat = 0;
        $wConv = 0;
        $rReg = 0;
        $rShip = 0;
        for ($k = 0; $k < 3; $k++) {
            $mm = $startM + $k;
            if (isset($csatByMonth[$mm])) {
                $sumCsat += $csatByMonth[$mm]['avg'] * $csatByMonth[$mm]['count'];
                $nCsat += $csatByMonth[$mm]['count'];
            }
            $rReg += $convByMonth[$mm]['registered'];
            $rShip += $convByMonth[$mm]['with_shipments'];
        }
        $avgQ = $nCsat > 0 ? round($sumCsat / $nCsat, 3) : null;
        $convQ = $rReg > 0 ? round(100.0 * $rShip / $rReg, 2) : null;
        $recVals = [];
        for ($k = 0; $k < 3; $k++) {
            $mm = $startM + $k;
            if (isset($recoveryByMonth[$mm]) && $recoveryByMonth[$mm] !== null) {
                $recVals[] = $recoveryByMonth[$mm];
            }
        }
        $recQ = null;
        $valid = $recVals;
        if (count($valid)) {
            $recQ = round(array_sum($valid) / count($valid), 2);
        }
        $quarters[] = [
            'quarter' => $q,
            'label' => 'الربع ' . $q,
            'csat_avg' => $avgQ,
            'conversion_rate' => $convQ,
            'recovery_rate' => $recQ,
        ];
    }
}

echo json_encode([
    'success' => true,
    'year' => $year,
    'period' => $period,
    'kpis' => [
        'daily_conversion_rate' => $convRateToday,
        'daily_conversion_rate_yesterday' => $convRateYesterday,
        'daily_conversion_trend_pct' => ($convRateToday !== null && $convRateYesterday !== null)
            ? round($convRateToday - $convRateYesterday, 2)
            : null,
        'registrations_today' => $regToday,
        'registrations_yesterday' => $regYest,
        'daily_csat' => $csatToday,
        'daily_csat_yesterday' => $csatYesterday,
        'daily_csat_trend' => ($csatToday !== null && $csatYesterday !== null) ? round($csatToday - $csatYesterday, 3) : null,
        'monthly_recovery_rate' => $recoveryRateMonth,
        'frozen_stores_total' => $frozenTotal,
        'frozen_reactivated_this_month' => $reactivated,
    ],
    'months' => $monthsSeries,
    'quarters' => $period === 'quarterly' ? $quarters : null,
    'inactive_recovery_daily' => $inactiveRecoveryDaily,
    'inactive_daily_target' => defined('INACTIVE_DAILY_SUCCESS_TARGET') ? INACTIVE_DAILY_SUCCESS_TARGET : 50,
    'notes' => [
        'conversion' => 'نسبة التحويل اليومية: من متاجر Nawris المسجّلة في ذلك اليوم والتي لديها shipments > 0.',
        'recovery' => 'نسبة الاستعادة الشهرية: من متاجر مجمّدة في قاعدة النظام وظهرت لها طرود في orders-summary ضمن نطاق الشهر.',
        'csat' => 'متوسط تقييم 1–5 من متوسط الستة أسئلة في جدول surveys.',
    ],
], JSON_UNESCAPED_UNICODE);
