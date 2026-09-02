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
$branchParam = isset($_GET['branch']) ? trim((string) $_GET['branch']) : '';

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
            cl.call_type,
            COALESCE(cl.outcome, '') AS outcome,
            COUNT(*)             AS cnt
        FROM call_logs cl
        " . ($branchParam !== '' ? 'JOIN store_branch_map sbm ON sbm.store_id = cl.store_id' : '') . "
        WHERE cl.call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND cl.created_at >= ?
          AND cl.created_at <  ?
          " . ($branchParam !== '' ? 'AND sbm.responsible_branch = ?' : '') . "
        GROUP BY cl.call_type, outcome
        ORDER BY cl.call_type, cnt DESC
    ");
    $summaryParams = [$fromStart, $toExclusive];
    if ($branchParam !== '') $summaryParams[] = $branchParam;
    $st->execute($summaryParams);
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
            cl.call_type,
            cl.performed_by,
            COALESCE(cl.outcome, '') AS outcome,
            COUNT(*)              AS cnt
        FROM call_logs cl
        " . ($branchParam !== '' ? 'JOIN store_branch_map sbm ON sbm.store_id = cl.store_id' : '') . "
        WHERE cl.call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND cl.created_at >= ?
          AND cl.created_at <  ?
          " . ($branchParam !== '' ? 'AND sbm.responsible_branch = ?' : '') . "
        GROUP BY cl.call_type, cl.performed_by, outcome
        ORDER BY cl.call_type, cnt DESC
    ");
    $byStaffParams = [$fromStart, $toExclusive];
    if ($branchParam !== '') $byStaffParams[] = $branchParam;
    $st->execute($byStaffParams);
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
            cl.id,
            cl.store_id,
            cl.store_name,
            cl.call_type,
            COALESCE(cl.outcome, '') AS outcome,
            cl.note,
            cl.performed_by,
            cl.created_at
        FROM call_logs cl
        " . ($branchParam !== '' ? 'JOIN store_branch_map sbm ON sbm.store_id = cl.store_id' : '') . "
        WHERE cl.call_type IN ('inc_call1', 'inc_call2', 'inc_call3')
          AND cl.created_at >= ?
          AND cl.created_at <  ?
          " . ($branchParam !== '' ? 'AND sbm.responsible_branch = ?' : '') . "
        ORDER BY cl.created_at DESC
        LIMIT 500
    ");
    $rowsParams = [$fromStart, $toExclusive];
    if ($branchParam !== '') $rowsParams[] = $branchParam;
    $st->execute($rowsParams);
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
    'branch'   => $branchParam !== '' ? $branchParam : null,
    'summary'  => $summary,
    'rows'     => $rows,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
