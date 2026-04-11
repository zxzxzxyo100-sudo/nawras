<?php
/**
 * إحصائيات الرضا والمكالمات ضمن فترة (الشهر الحالي بتوقيت الرياض، أو ?from=&to=).
 *
 * - المكالمات: عدد صفوف call_logs في الفترة.
 * - استبيان نشط (CSAT): active_csat أو سجلات قديمة بلا survey_kind — متوسط التقييم 1–5 ونسبة «إيجابي» (up).
 * - تهيئة متجر جديد: new_merchant_onboarding — متوسط أول 3 أسئلة منفصل.
 * يُستبعد inactive_feedback (ملاحظة نصية وليس تقييماً حقيقياً).
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$detail = isset($_GET['detail']) && ($_GET['detail'] === '1' || $_GET['detail'] === 'true');

$tz = new DateTimeZone('Asia/Riyadh');
$fromParam = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$toParam = isset($_GET['to']) ? trim((string) $_GET['to']) : '';

if ($fromParam !== '' xor $toParam !== '') {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error'   => 'date_params_incomplete',
        'hint'    => 'مرّر من وإلى معاً بصيغة YYYY-MM-DD، أو اتركهما فارغين للشهر الحالي.',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($fromParam !== '' && $toParam !== '') {
    $fromD = DateTimeImmutable::createFromFormat('!Y-m-d', $fromParam, $tz);
    $toD = DateTimeImmutable::createFromFormat('!Y-m-d', $toParam, $tz);
    if ($fromD === false || $toD === false) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'invalid_date_params',
            'hint'    => 'صيغة التاريخ: YYYY-MM-DD',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    if ($fromD > $toD) {
        http_response_code(400);
        echo json_encode([
            'success' => false,
            'error'   => 'invalid_range',
            'hint'    => 'تاريخ البداية يجب أن يكون قبل أو يساوي تاريخ النهاية.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
    $rangeStart = $fromD->setTime(0, 0, 0);
    $rangeEndEx = $toD->modify('+1 day')->setTime(0, 0, 0);
    $rangeFromStr = $fromD->format('Y-m-d');
    $rangeToStr = $toD->format('Y-m-d');
    $monthLabel = $rangeFromStr . ' — ' . $rangeToStr;
    $periodKind = 'range';
} else {
    $now = new DateTimeImmutable('now', $tz);
    $rangeStart = $now->modify('first day of this month')->setTime(0, 0, 0);
    $rangeEndEx = $now->modify('first day of next month')->setTime(0, 0, 0);
    $rangeFromStr = $rangeStart->format('Y-m-d');
    $rangeToStr = $rangeEndEx->modify('-1 day')->format('Y-m-d');
    $monthLabel = $rangeStart->format('Y-m');
    $periodKind = 'month';
}

$startSql = $rangeStart->format('Y-m-d H:i:s');
$endSql = $rangeEndEx->format('Y-m-d H:i:s');

$pdo = getDB();

$callsStmt = $pdo->prepare('SELECT COUNT(*) FROM call_logs WHERE created_at >= ? AND created_at < ?');
$callsStmt->execute([$startSql, $endSql]);
$callsLogged = (int) $callsStmt->fetchColumn();

/** CSAT: نشط — يشمل القديم بدون نوع */
$csatSql = "
    SELECT id, store_id, q1_delivery, q2_collection, q3_support, q4_app, q5_payments, q6_returns,
           satisfaction_score, survey_kind, performed_by, created_at
    FROM surveys
    WHERE created_at >= ? AND created_at < ?
      AND COALESCE(survey_kind, '') NOT IN ('inactive_feedback', 'new_merchant_onboarding')
      AND (survey_kind IS NULL OR survey_kind = '' OR survey_kind = 'active_csat')
";
$csatStmt = $pdo->prepare($csatSql);
$csatStmt->execute([$startSql, $endSql]);
$csatRows = $csatStmt->fetchAll(PDO::FETCH_ASSOC);

$csatN = count($csatRows);
$csatSumAvg = 0.0;
$csatUp = 0;
$csatMid = 0;
$csatDown = 0;
$csatDetail = [];

foreach ($csatRows as $row) {
    $q = [
        (int) ($row['q1_delivery'] ?? 0),
        (int) ($row['q2_collection'] ?? 0),
        (int) ($row['q3_support'] ?? 0),
        (int) ($row['q4_app'] ?? 0),
        (int) ($row['q5_payments'] ?? 0),
        (int) ($row['q6_returns'] ?? 0),
    ];
    $rowAvg = array_sum($q) / 6.0;
    $csatSumAvg += $rowAvg;
    $sc = (string) ($row['satisfaction_score'] ?? '');
    if ($sc === 'up') {
        $csatUp++;
    } elseif ($sc === 'mid') {
        $csatMid++;
    } elseif ($sc === 'down') {
        $csatDown++;
    }
    if ($detail) {
        $csatDetail[] = [
            'survey_id'            => (int) ($row['id'] ?? 0),
            'store_id'             => (int) ($row['store_id'] ?? 0),
            'created_at'           => (string) ($row['created_at'] ?? ''),
            'avg_1_to_5'           => round($rowAvg, 2),
            'satisfaction_score'   => $sc !== '' ? $sc : null,
            'performed_by'         => (string) ($row['performed_by'] ?? ''),
            'q1_delivery'          => $q[0],
            'q2_collection'        => $q[1],
            'q3_support'           => $q[2],
            'q4_app'               => $q[3],
            'q5_payments'          => $q[4],
            'q6_returns'           => $q[5],
        ];
    }
}

$csatAvg = $csatN > 0 ? round($csatSumAvg / $csatN, 2) : null;
/** نسبة من 100 حيث 5 = 100% */
$csatPercentOf100 = $csatAvg !== null ? (int) round($csatAvg * 20.0) : null;
$csatPositivePercent = $csatN > 0 ? (int) round(100 * $csatUp / $csatN) : null;

/** تهيئة متجر جديد — أول 3 أسئلة */
$onbStmt = $pdo->prepare("
    SELECT id, store_id, q1_delivery, q2_collection, q3_support, satisfaction_score, performed_by, created_at
    FROM surveys
    WHERE created_at >= ? AND created_at < ?
      AND survey_kind = 'new_merchant_onboarding'
");
$onbStmt->execute([$startSql, $endSql]);
$onbRows = $onbStmt->fetchAll(PDO::FETCH_ASSOC);
$onbN = count($onbRows);
$onbSum = 0.0;
$onbUp = 0;
$onbDown = 0;
foreach ($onbRows as $row) {
    $a = (int) ($row['q1_delivery'] ?? 0);
    $b = (int) ($row['q2_collection'] ?? 0);
    $c = (int) ($row['q3_support'] ?? 0);
    $onbSum += ($a + $b + $c) / 3.0;
    $sc = (string) ($row['satisfaction_score'] ?? '');
    if ($sc === 'up') {
        $onbUp++;
    } elseif ($sc === 'down') {
        $onbDown++;
    }
}
$onbAvg = $onbN > 0 ? round($onbSum / $onbN, 2) : null;
$onbPercentOf100 = $onbAvg !== null ? (int) round($onbAvg * 20.0) : null;

$surveyCoveragePercent = $callsLogged > 0 && $csatN > 0
    ? (int) round(100 * $csatN / $callsLogged)
    : ($callsLogged > 0 ? 0 : null);

$out = [
    'success'                      => true,
    'calls_logged'                 => $callsLogged,
    'csat_surveys'                 => $csatN,
    'csat_avg_1_to_5'              => $csatAvg,
    'csat_satisfaction_percent'    => $csatPercentOf100,
    'csat_positive_percent'        => $csatPositivePercent,
    'csat_score_counts'            => [
        'up'   => $csatUp,
        'mid'  => $csatMid,
        'down' => $csatDown,
    ],
    'onboarding_surveys'           => $onbN,
    'onboarding_avg_1_to_5'      => $onbAvg,
    'onboarding_satisfaction_percent' => $onbPercentOf100,
    'onboarding_positive_count'    => $onbUp,
    'onboarding_negative_count'    => $onbDown,
    'survey_coverage_percent'      => $surveyCoveragePercent,
    'month_label'                  => $monthLabel,
    'range_from'                   => $rangeFromStr,
    'range_to'                     => $rangeToStr,
    'period_kind'                  => $periodKind,
    'rule'                         => 'الرضا (نشط): متوسط ستة أسئلة 1–5؛ «إيجابي» = تصنيف الخادم up (متوسط ≥ 4). التغطية = استبيانات CSAT ÷ المكالمات.',
    'generated_at'                 => date('c'),
];

if ($detail) {
    usort($csatDetail, static function (array $a, array $b): int {
        $ta = strtotime((string) ($a['created_at'] ?? '')) ?: 0;
        $tb = strtotime((string) ($b['created_at'] ?? '')) ?: 0;

        return $tb <=> $ta;
    });
    $out['csat_report_rows'] = $csatDetail;
    $out['csat_report_row_count'] = count($csatDetail);
}

echo json_encode($out, JSON_UNESCAPED_UNICODE);
