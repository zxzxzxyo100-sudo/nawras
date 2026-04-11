<?php
/**
 * أهداف اليوم لكل موظف تشغيلي — للمدير التنفيذي فقط.
 * نشط: تعيينات مكتملة اليوم (تم التواصل + استبيان) / 50
 * استعادة: اتصالات ناجحة مسجّلة في inactive_manager_daily_stats / 50
 * احتضان: مكالمات مسار الاحتضان (inc_call1–3 و day0/3/10) المسجّلة اليوم (توقيت الرياض) / 50
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

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

/** يوم العمل «اليوم» بتوقيت الرياض — يتوافق مع CURDATE() بعد ضبط الجلسة */
try {
    $pdo->exec("SET time_zone = '+03:00'");
} catch (Throwable $e) {
    // إن لم يُسمح بضبط المنطقة الزمنية نعتمد توقيت الخادم
}

$targetActive = (int) ACTIVE_DAILY_SUCCESS_TARGET;
$targetInactive = (int) INACTIVE_DAILY_SUCCESS_TARGET;
$targetInc = 50;

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
        $entry['target'] = $targetActive;
        $c = $pdo->prepare("
            SELECT COUNT(*) FROM store_assignments
            WHERE assigned_to = ?
            AND assignment_queue = 'active'
            AND workflow_status = 'completed'
            AND DATE(COALESCE(workflow_updated_at, assigned_at)) = CURDATE()
        ");
        $c->execute([$un]);
        $n = (int) $c->fetchColumn();
        $entry['done_today'] = $n;
    } elseif ($role === 'inactive_manager') {
        $entry['role_label_ar'] = 'مسؤول الاستعادة';
        $entry['metric_key'] = 'inactive_success_today';
        $entry['target'] = $targetInactive;
        $c = $pdo->prepare('SELECT COALESCE(successful_contacts, 0) FROM inactive_manager_daily_stats WHERE username = ? AND work_date = CURDATE()');
        $c->execute([$un]);
        $n = (int) $c->fetchColumn();
        $entry['done_today'] = $n;
    } else {
        $entry['role_label_ar'] = 'مسؤول المتاجر (احتضان)';
        $entry['metric_key'] = 'incubation_calls_today';
        $entry['target'] = $targetInc;
        /**
         * اليوم فقط — DATE(created_at)=CURDATE() مع جلسة +03:00 (الرياض).
         * الأنواع: inc_call1–3 + day0/day3/day10 (مسار قديم).
         * مطابقة المنفّذ: username / fullname مع TRIM و LOWER للاتينية.
         */
        $unTrim = trim($un);
        $fnTrim = trim($fn);
        $unLower = mb_strtolower($unTrim, 'UTF-8');
        $fnLower = $fnTrim !== '' ? mb_strtolower($fnTrim, 'UTF-8') : '';
        $c = $pdo->prepare("
            SELECT COUNT(*) FROM call_logs
            WHERE DATE(created_at) = CURDATE()
            AND call_type IN (
                'inc_call1', 'inc_call2', 'inc_call3',
                'day0', 'day3', 'day10'
            )
            AND (
                TRIM(performed_by) = ?
                OR ( ? <> '' AND TRIM(performed_by) = ? )
                OR LOWER(TRIM(performed_by)) = ?
                OR ( ? <> '' AND LOWER(TRIM(performed_by)) = ? )
            )
        ");
        $c->execute([
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

echo json_encode([
    'success' => true,
    'data'    => $rows,
    'targets' => [
        'active_daily'   => $targetActive,
        'inactive_daily' => $targetInactive,
        'incubation_daily' => $targetInc,
    ],
    'note_ar' => 'النشط والاستعادة: الهدف اليومي حسب الطابور. الاحتضان: مكالمات المسار (1–3 و day0/3/10) المسجّلة اليوم بتوقيت الرياض؛ المنفّذ يُطابق اسم المستخدم أو الاسم الكامل.',
], JSON_UNESCAPED_UNICODE);
