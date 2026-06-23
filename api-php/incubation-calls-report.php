<?php
declare(strict_types=1);

/**
 * تقرير مكالمات الاحتضان (الأولى / الثانية / الثالثة)
 * يعرض إحصائيات call_logs لأنواع: inc_call1, inc_call2, inc_call3
 * مع تفصيل حسب الموظف والنتيجة (outcome) وخيار تصفية بالتاريخ.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$userRole = isset($_GET['user_role']) ? trim((string) $_GET['user_role']) : '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح'], JSON_UNESCAPED_UNICODE);
    exit;
}

$fromParam = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$toParam   = isset($_GET['to'])   ? trim((string) $_GET['to'])   : '';

$isYmd = static function (string $v): bool {
    return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $v);
};

if (($fromParam !== '' && !$isYmd($fromParam)) || ($toParam !== '' && !$isYmd($toParam))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'], JSON_UNESCAPED_UNICODE);
    exit;
}

$tz = new DateTimeZone('Asia/Riyadh');
if ($fromParam === '' && $toParam === '') {
    $today    = new DateTimeImmutable('now', $tz);
    $fromDate = $today->modify('first day of this month')->format('Y-m-d');
    $toDate   = $today->format('Y-m-d');
} else {
    $fromDate = $fromParam !== '' ? $fromParam : $toParam;
    $toDate   = $toParam   !== '' ? $toParam   : $fromParam;
}

if (strcmp($fromDate, $toDate) > 0) {
    [$fromDate, $toDate] = [$toDate, $fromDate];
}

$fromStart  = (new DateTimeImmutable($fromDate . ' 00:00:00', $tz))->format('Y-m-d H:i:s');
$toExclusive = (new DateTimeImmutable($toDate . ' 00:00:00', $tz))->modify('+1 day')->format('Y-m-d H:i:s');

$pdo = getDB();
try {
    $pdo->exec("SET time_zone = '+03:00'");
} catch (Throwable $e) {}

$callTypes  = ['inc_call1', 'inc_call2', 'inc_call3'];
$typeLabels = [
    'inc_call1' => 'المكالمة الأولى',
    'inc_call2' => 'المكالمة الثانية',
    'inc_call3' => 'المكالمة الثالثة',
];
$outcomeLabels = [
    'answered'    => 'تم الرد',
    'no_answer'   => 'لم يرد',
    'busy'        => 'مشغول',
    'callback'    => 'طلب معاودة',
    'wrong_number'=> 'رقم خاطئ',
    ''            => 'غير محدد',
];

/**
 * ──────────────────────────────────────────────────────────────────
 * 1) إجماليات لكل نوع مكالمة
 * ──────────────────────────────────────────────────────────────────
 */
$summaryByType = [];
foreach ($callTypes as $ct) {
    $summaryByType[$ct] = [
        'total'    => 0,
        'outcomes' => [],
        'label'    => $typeLabels[$ct],
    ];
}

try {
    $st = $pdo->prepare("
        SELECT
            call_type,
            COALESCE(outcome, '') AS outcome,
            COUNT(*)             AS cnt
        FROM call_logs
        WHERE call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND created_at >= ?
          AND created_at <  ?
        GROUP BY call_type, outcome
        ORDER BY call_type, cnt DESC
    ");
    $st->execute([$fromStart, $toExclusive]);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $ct      = (string) ($row['call_type'] ?? '');
        $outcome = (string) ($row['outcome']   ?? '');
        $cnt     = (int)    ($row['cnt']        ?? 0);
        if (!isset($summaryByType[$ct])) continue;
        $summaryByType[$ct]['total'] += $cnt;
        $summaryByType[$ct]['outcomes'][$outcome] = ($summaryByType[$ct]['outcomes'][$outcome] ?? 0) + $cnt;
    }
} catch (Throwable $e) {
    // تجاهل هادئ — يُعاد مصفوفة فارغة
}

/**
 * ──────────────────────────────────────────────────────────────────
 * 2) تفصيل حسب الموظف لكل نوع مكالمة
 * ──────────────────────────────────────────────────────────────────
 */
$byStaff = [];   // [ call_type ][ performed_by ] = [ total, outcomes ]
try {
    $st = $pdo->prepare("
        SELECT
            call_type,
            performed_by,
            COALESCE(outcome, '') AS outcome,
            COUNT(*)              AS cnt
        FROM call_logs
        WHERE call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND created_at >= ?
          AND created_at <  ?
        GROUP BY call_type, performed_by, outcome
        ORDER BY call_type, cnt DESC
    ");
    $st->execute([$fromStart, $toExclusive]);
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $ct      = (string) ($row['call_type']    ?? '');
        $by      = (string) ($row['performed_by'] ?? 'غير معروف');
        $outcome = (string) ($row['outcome']      ?? '');
        $cnt     = (int)    ($row['cnt']           ?? 0);
        if (!in_array($ct, $callTypes, true)) continue;
        if (!isset($byStaff[$ct][$by])) {
            $byStaff[$ct][$by] = ['total' => 0, 'outcomes' => []];
        }
        $byStaff[$ct][$by]['total'] += $cnt;
        $byStaff[$ct][$by]['outcomes'][$outcome] = ($byStaff[$ct][$by]['outcomes'][$outcome] ?? 0) + $cnt;
    }
} catch (Throwable $e) {}

/**
 * ──────────────────────────────────────────────────────────────────
 * 3) سجلّات التفاصيل (آخر 500 إدخال ضمن الفترة لكل نوع)
 * ──────────────────────────────────────────────────────────────────
 */
$rows = [];
try {
    $st = $pdo->prepare("
        SELECT
            id,
            store_id,
            store_name,
            call_type,
            COALESCE(outcome, '') AS outcome,
            note,
            performed_by,
            created_at
        FROM call_logs
        WHERE call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND created_at >= ?
          AND created_at <  ?
        ORDER BY created_at DESC
        LIMIT 500
    ");
    $st->execute([$fromStart, $toExclusive]);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {}

/**
 * ──────────────────────────────────────────────────────────────────
 * 4) تجميع بيانات الاستجابة
 * ──────────────────────────────────────────────────────────────────
 */
$summary = [];
foreach ($callTypes as $ct) {
    $data    = $summaryByType[$ct];
    $total   = $data['total'];
    $answered = (int) ($data['outcomes']['answered'] ?? 0);
    $noAnswer = (int) ($data['outcomes']['no_answer'] ?? 0) + (int) ($data['outcomes']['busy'] ?? 0);
    $rate     = $total > 0 ? round($answered / $total * 100, 1) : 0.0;

    // ترتيب الموظفين تنازلياً حسب الإجمالي
    $staffList = [];
    if (isset($byStaff[$ct])) {
        arsort($byStaff[$ct]);   // PHP arsort على المصفوفة المرتبطة
        uasort($byStaff[$ct], fn($a, $b) => $b['total'] <=> $a['total']);
        foreach ($byStaff[$ct] as $name => $info) {
            $sTotal    = (int) $info['total'];
            $sAnswered = (int) ($info['outcomes']['answered'] ?? 0);
            $sNoAns    = (int) ($info['outcomes']['no_answer'] ?? 0) + (int) ($info['outcomes']['busy'] ?? 0);
            $sRate     = $sTotal > 0 ? round($sAnswered / $sTotal * 100, 1) : 0.0;
            $staffList[] = [
                'name'         => $name,
                'total'        => $sTotal,
                'answered'     => $sAnswered,
                'no_answer'    => $sNoAns,
                'answer_rate'  => $sRate,
                'outcomes'     => $info['outcomes'],
            ];
        }
    }

    $outcomesLabelled = [];
    foreach ($data['outcomes'] as $k => $v) {
        $outcomesLabelled[] = [
            'outcome' => $k,
            'label'   => $outcomeLabels[$k] ?? $k,
            'count'   => (int) $v,
        ];
    }
    usort($outcomesLabelled, fn($a, $b) => $b['count'] <=> $a['count']);

    $summary[] = [
        'call_type'    => $ct,
        'label'        => $typeLabels[$ct],
        'total'        => $total,
        'answered'     => $answered,
        'no_answer'    => $noAnswer,
        'answer_rate'  => $rate,
        'outcomes'     => $outcomesLabelled,
        'staff'        => $staffList,
    ];
}

echo json_encode([
    'success'  => true,
    'from'     => $fromDate,
    'to'       => $toDate,
    'summary'  => $summary,
    'rows'     => $rows,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
