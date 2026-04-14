<?php
/**
 * أهداف اليوم لكل موظف تشغيلي — للمدير التنفيذي فقط.
 * نشط: نفس عدّاد الحصة اليومية (employee_daily_processed_stores) — يتوافق مع «الحصة 1/50» في المهام
 * استعادة: اتصالات ناجحة مسجّلة في inactive_manager_daily_stats / 50
 * احتضان: مكالمات المسار (inc_call1–3 و day0/3/10) + مكالمة «عامة» من الواجهة (call_type=general و performed_role=incubation_manager) / اليوم
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';
require_once __DIR__ . '/daily-quota-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$userRole = isset($_GET['user_role']) ? trim((string) $_GET['user_role']) : '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
ensure_workflow_schema($pdo);
ensure_inactive_daily_stats_schema($pdo);
nawras_ensure_daily_quota_schema($pdo);

/** يوم العمل «اليوم» بتوقيت الرياض — يتوافق مع CURDATE() بعد ضبط الجلسة */
try {
    $pdo->exec("SET time_zone = '+03:00'");
} catch (Throwable $e) {
    // إن لم يُسمح بضبط المنطقة الزمنية نعتمد توقيت الخادم
}

$targetActive = (int) ACTIVE_DAILY_SUCCESS_TARGET;
$targetInactive = (int) INACTIVE_DAILY_SUCCESS_TARGET;
$targetInc = 50;

$tz = new DateTimeZone('Asia/Riyadh');
$fromParam = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$toParam = isset($_GET['to']) ? trim((string) $_GET['to']) : '';
$isYmd = static function (string $v): bool {
    return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $v);
};
if (($fromParam !== '' && !$isYmd($fromParam)) || ($toParam !== '' && !$isYmd($toParam))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($fromParam === '' && $toParam === '') {
    $today = new DateTimeImmutable('now', $tz);
    $fromDate = $today->format('Y-m-d');
    $toDate = $fromDate;
} else {
    $fromDate = $fromParam !== '' ? $fromParam : $toParam;
    $toDate = $toParam !== '' ? $toParam : $fromParam;
}
if (strcmp($fromDate, $toDate) > 0) {
    $tmp = $fromDate;
    $fromDate = $toDate;
    $toDate = $tmp;
}
$fromStart = (new DateTimeImmutable($fromDate . ' 00:00:00', $tz))->format('Y-m-d H:i:s');
$toExclusive = (new DateTimeImmutable($toDate . ' 00:00:00', $tz))
    ->modify('+1 day')
    ->format('Y-m-d H:i:s');
$rangeDays = max(
    1,
    (int) ((new DateTimeImmutable($fromDate, $tz))->diff(new DateTimeImmutable($toDate, $tz))->days ?? 0) + 1
);

$rows = [];

$stUsers = $pdo->query("
    SELECT username, fullname, role FROM users
    WHERE role IN ('active_manager', 'inactive_manager', 'incubation_manager')
    ORDER BY role ASC, username ASC
");

while ($u = $stUsers->fetch(PDO::FETCH_ASSOC)) {
    $un = (string) ($u['username'] ?? '');
    $fn = (string) ($u['fullname'] ?? '');
    $role = (string) ($u['role'] ?? '');
    if ($un === '') {
        continue;
    }

    $entry = [
        'username'      => $un,
        'fullname'      => $fn,
        'role'          => $role,
        'role_label_ar' => '',
        'metric_key'    => '',
        'done_today'    => 0,
        'target'        => 50,
        'pct'           => 0,
        'goal_met'      => false,
    ];

    if ($role === 'active_manager') {
        $entry['role_label_ar'] = 'مسؤول المتاجر النشطة';
        $entry['metric_key'] = 'active_completed_today';
        $entry['target'] = $targetActive * $rangeDays;
        $c = $pdo->prepare(
            'SELECT COUNT(*) FROM employee_daily_processed_stores
             WHERE username = ? AND work_date BETWEEN ? AND ?'
        );
        $c->execute([$un, $fromDate, $toDate]);
        $entry['done_today'] = (int) $c->fetchColumn();
    } elseif ($role === 'inactive_manager') {
        $entry['role_label_ar'] = 'مسؤول الاستعادة';
        $entry['metric_key'] = 'inactive_success_today';
        $entry['target'] = $targetInactive * $rangeDays;
        $c = $pdo->prepare(
            'SELECT COALESCE(SUM(successful_contacts), 0)
             FROM inactive_manager_daily_stats
             WHERE username = ? AND work_date BETWEEN ? AND ?'
        );
        $c->execute([$un, $fromDate, $toDate]);
        $n = (int) ($c->fetchColumn() ?: 0);
        $entry['done_today'] = $n;
    } else {
        $entry['role_label_ar'] = 'مسؤول المتاجر (احتضان)';
        $entry['metric_key'] = 'incubation_calls_today';
        $entry['target'] = $targetInc * $rangeDays;
        /**
         * اليوم فقط — DATE(created_at)=CURDATE() مع جلسة +03:00 (الرياض).
         * مسار الاحتضان من «مسار الاحتضان»: inc_call1–3 + day0/3/10.
         * من نافذة المتجر/كل المتاجر يُحفظ غالباً general + performed_role=incubation_manager — تُحسب أيضاً.
         * مطابقة المنفّذ: username / fullname مع TRIM و LOWER للاتينية.
         */
        $unTrim = trim($un);
        $fnTrim = trim($fn);
        $unLower = mb_strtolower($unTrim, 'UTF-8');
        $fnLower = $fnTrim !== '' ? mb_strtolower($fnTrim, 'UTF-8') : '';
        $c = $pdo->prepare("
            SELECT COUNT(*) FROM call_logs
            WHERE created_at >= ?
            AND created_at < ?
            AND (
                call_type IN (
                    'inc_call1', 'inc_call2', 'inc_call3',
                    'day0', 'day3', 'day10'
                )
                OR (
                    TRIM(call_type) = 'general'
                    AND TRIM(COALESCE(performed_role, '')) = 'incubation_manager'
                )
            )
            AND (
                TRIM(performed_by) = ?
                OR ( ? <> '' AND TRIM(performed_by) = ? )
                OR LOWER(TRIM(performed_by)) = ?
                OR ( ? <> '' AND LOWER(TRIM(performed_by)) = ? )
            )
        ");
        $c->execute([
            $fromStart,
            $toExclusive,
            $unTrim,
            $fnTrim,
            $fnTrim,
            $unLower,
            $fnTrim,
            $fnLower,
        ]);
        $n = (int) $c->fetchColumn();
        $entry['done_today'] = $n;
    }

    $t = max(1, (int) $entry['target']);
    $entry['pct'] = (int) min(100, round(($entry['done_today'] / $t) * 100));
    $entry['goal_met'] = $entry['done_today'] >= (int) $entry['target'];

    $rows[] = $entry;
}

$restoredCount = 0;
$restoringStartedCount = 0;
try {
    $stRecovered = $pdo->prepare(
        "SELECT COUNT(DISTINCT store_id)
         FROM audit_logs
         WHERE old_status = 'restoring'
           AND new_status IN ('recovered','restored')
           AND created_at >= ?
           AND created_at < ?"
    );
    $stRecovered->execute([$fromStart, $toExclusive]);
    $restoredCount = (int) ($stRecovered->fetchColumn() ?: 0);
} catch (Throwable $e) {
}
try {
    $stStarted = $pdo->prepare(
        "SELECT COUNT(DISTINCT store_id)
         FROM audit_logs
         WHERE new_status = 'restoring'
           AND created_at >= ?
           AND created_at < ?"
    );
    $stStarted->execute([$fromStart, $toExclusive]);
    $restoringStartedCount = (int) ($stStarted->fetchColumn() ?: 0);
} catch (Throwable $e) {
}
$recoveryPct = $restoringStartedCount > 0
    ? round(($restoredCount / $restoringStartedCount) * 100, 1)
    : 0.0;

echo json_encode([
    'success' => true,
    'data'    => $rows,
    'date_range' => [
        'from' => $fromDate,
        'to' => $toDate,
        'days' => $rangeDays,
    ],
    'recovery_stats' => [
        'restored_count' => $restoredCount,
        'restoring_started_count' => $restoringStartedCount,
        'recovery_rate_pct' => $recoveryPct,
    ],
    'targets' => [
        'active_daily'   => $targetActive,
        'inactive_daily' => $targetInactive,
        'incubation_daily' => $targetInc,
    ],
    'note_ar' => 'النشط: متاجر مُعالَجة ضمن الفترة. الاستعادة: اتصالات ناجحة ضمن الفترة. الاحتضان: مكالمات المسار (1–3 و day0/3/10) أو general للدور نفسه ضمن الفترة. نسبة الاستعادة = (المتاجر المستعادة) ÷ (المتاجر التي بدأت الاستعادة) في نفس المدى الزمني.',
], JSON_UNESCAPED_UNICODE);
