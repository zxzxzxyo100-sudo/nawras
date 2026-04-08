<?php
/**
 * حساب التأخير التقويمي لمسار الاحتضان (مطابقة تقريبية لـ all-stores.php + نوافذ التعيين).
 */
require_once __DIR__ . '/onboarding-config.php';

/**
 * @return array{is_delayed:bool, delay_days:int}
 */
function wf_incubation_calendar_delay_meta(
    ?int $regTs,
    int $now,
    $inc1,
    $inc2,
    $inc3,
    bool $hasShipped
): array {
    $c2d = NAWRAS_ONBOARD_CYCLE_CALL2_DAY;
    $c3d = NAWRAS_ONBOARD_CYCLE_CALL3_DAY;
    if (!$regTs || $regTs <= 0) {
        return ['is_delayed' => false, 'delay_days' => 0];
    }
    $regHrs = ($now - $regTs) / 3600;
    $cd = min(14, max(1, (int) floor(($now - $regTs) / 86400) + 1));

    if (!$inc1) {
        if ($regHrs >= NAWRAS_ONBOARD_FIRST_CALL_HOURS) {
            $days = max(0, (int) floor($regHrs / 24));

            return ['is_delayed' => true, 'delay_days' => $days];
        }

        return ['is_delayed' => false, 'delay_days' => 0];
    }
    if (!$inc2) {
        if ($cd > $c2d && $hasShipped) {
            return ['is_delayed' => true, 'delay_days' => max(0, $cd - $c2d)];
        }

        return ['is_delayed' => false, 'delay_days' => 0];
    }
    if (!$inc3) {
        if ($cd > $c3d) {
            return ['is_delayed' => true, 'delay_days' => max(0, $cd - $c3d)];
        }

        return ['is_delayed' => false, 'delay_days' => 0];
    }

    return ['is_delayed' => false, 'delay_days' => 0];
}

/**
 * هل التعيين متأخر تشغيلياً (يوم سابق أو محاولة اتصال اليوم دون «تم الرد») — كما في active-workflow.php.
 */
function wf_assignment_operational_delayed(PDO $pdo, string $username, string $storeId): bool {
    $st = $pdo->prepare('
        SELECT CASE
            WHEN DATE(sa.assigned_at) < CURDATE() THEN 1
            WHEN EXISTS (
                SELECT 1 FROM call_logs cl
                WHERE CAST(cl.store_id AS CHAR) = CAST(sa.store_id AS CHAR)
                AND cl.performed_by = ?
                AND DATE(cl.created_at) = CURDATE()
                AND (cl.outcome IS NULL OR cl.outcome <> ?)
            ) THEN 1
            ELSE 0
        END AS is_delayed
        FROM store_assignments sa
        WHERE CAST(sa.store_id AS CHAR) = CAST(? AS CHAR)
        AND sa.assigned_to = ?
        AND sa.assignment_queue = ?
        AND sa.workflow_status = ?
        LIMIT 1
    ');
    $st->execute([$username, 'answered', $storeId, $username, 'active', 'active']);
    $v = $st->fetchColumn();

    return (int) $v === 1;
}

/**
 * قائمة متأخرات مسؤول المتاجر النشطة: تأخير تقويمي للاحتضان أو تأخير تعيين، مرتبة بالأشد تأخيراً ثم الأقدم تسجيلاً.
 *
 * @return list<array<string,mixed>>
 */
function wf_build_active_manager_delayed_task_list(PDO $pdo, string $username): array {
    $now = time();
    $u = trim($username);
    if ($u === '') {
        return [];
    }
    $st = $pdo->prepare("
        SELECT
            sa.store_id,
            sa.store_name,
            sa.assigned_to,
            sa.assigned_at,
            sa.workflow_status,
            sa.assignment_queue,
            ss.registration_date,
            ss.first_shipped_date,
            ss.inc_call1_at,
            ss.inc_call2_at,
            ss.inc_call3_at
        FROM store_assignments sa
        LEFT JOIN store_states ss ON CAST(ss.store_id AS CHAR) = CAST(sa.store_id AS CHAR)
        WHERE sa.assigned_to = ?
        AND sa.assignment_queue = 'active'
        AND sa.workflow_status = 'active'
    ");
    $st->execute([$u]);
    $candidates = [];
    while ($row = $st->fetch(PDO::FETCH_ASSOC)) {
        $sid = (string) ($row['store_id'] ?? '');
        if ($sid === '') {
            continue;
        }
        $regStr = $row['registration_date'] ?? null;
        $regTs = $regStr ? strtotime((string) $regStr) : false;
        if ($regTs === false) {
            $regTs = null;
        } else {
            $regTs = (int) $regTs;
        }
        $hasShipped = !empty($row['first_shipped_date']);
        $incMeta = wf_incubation_calendar_delay_meta(
            $regTs,
            $now,
            $row['inc_call1_at'] ?? null,
            $row['inc_call2_at'] ?? null,
            $row['inc_call3_at'] ?? null,
            $hasShipped
        );
        $opDel = wf_assignment_operational_delayed($pdo, $u, $sid);
        $isDelayed = $incMeta['is_delayed'] || $opDel;
        if (!$isDelayed) {
            continue;
        }
        $assignLag = 0;
        if ($opDel) {
            $at = strtotime((string) ($row['assigned_at'] ?? ''));
            if ($at && date('Y-m-d', $at) < date('Y-m-d', $now)) {
                $assignLag = max(1, (int) floor(($now - $at) / 86400));
            } else {
                $assignLag = 1;
            }
        }
        $delayDays = max((int) ($incMeta['delay_days'] ?? 0), $assignLag);
        $candidates[] = [
            '_sort_delay' => $delayDays,
            '_sort_reg' => $regTs ?? 0,
            'row' => [
                'store_id' => $sid,
                'store_name' => (string) ($row['store_name'] ?? ''),
                'assigned_to' => (string) ($row['assigned_to'] ?? ''),
                'assigned_at' => $row['assigned_at'] ?? null,
                'workflow_status' => (string) ($row['workflow_status'] ?? 'active'),
                'assignment_queue' => (string) ($row['assignment_queue'] ?? 'active'),
                'is_delayed' => true,
                'incubation_delay_days' => (int) ($incMeta['delay_days'] ?? 0),
                'assignment_delayed' => $opDel,
            ],
        ];
    }
    usort($candidates, static function ($a, $b) {
        $da = (int) ($a['_sort_delay'] ?? 0);
        $db = (int) ($b['_sort_delay'] ?? 0);
        if ($db !== $da) {
            return $db <=> $da;
        }
        $ra = (int) ($a['_sort_reg'] ?? 0);
        $rb = (int) ($b['_sort_reg'] ?? 0);
        if ($ra !== $rb) {
            return $ra <=> $rb;
        }

        return strcmp((string) ($a['row']['store_id'] ?? ''), (string) ($b['row']['store_id'] ?? ''));
    });
    $lim = (int) ACTIVE_QUEUE_TARGET;
    if ($lim < 1) {
        $lim = 50;
    }
    $candidates = array_slice($candidates, 0, $lim);
    $out = [];
    foreach ($candidates as $c) {
        $out[] = $c['row'];
    }

    return $out;
}
