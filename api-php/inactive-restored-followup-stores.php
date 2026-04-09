<?php
/**
 * متابعة غير النشط بعد «تمت الاستعادة»: تعيينات طابور inactive بحالة تم التواصل (completed)
 * أو لم يرد (no_answer). الهدف اليومي (50) يُحتسب «تم التواصل» فقط — مثل مسؤول المتاجر النشطة.
 *
 * المصادر: تعيينات الطابور + (احتياطي) سجلات مكالمات + صفوف store_states منجزة.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/workflow-queue-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

/** يوم عرض للمتابعة: يفضّل تاريخ آخر تحديث للمهمة ثم التسجيل (حد أقصى 90 للعرض). */
function irfs_followup_cycle_day($regTs, $wfTs, $now) {
    $base = false;
    if ($wfTs !== false && $wfTs > 0) {
        $base = $wfTs;
    } elseif ($regTs !== false && $regTs > 0) {
        $base = $regTs;
    }
    if ($base === false) {
        return 1;
    }
    $d = (int) floor(($now - $base) / 86400);

    return min(90, max(1, $d + 1));
}

function irfs_pick_merchant(array $merchants, $mid) {
    if (isset($merchants[$mid])) {
        return $merchants[$mid];
    }
    $s = (string) $mid;
    if (isset($merchants[$s])) {
        return $merchants[$s];
    }
    foreach ($merchants as $k => $v) {
        if ((int) $k === (int) $mid) {
            return $v;
        }
    }

    return null;
}

/**
 * بيانات المتجر للصف: واجهة العملاء الجدد ثم store_states ثم التعيين (إن غاب من النورس).
 */
function irfs_resolve_merchant(PDO $pdo, array $merchants, int $mid, $fallbackStoreName = '') {
    $m = irfs_pick_merchant($merchants, $mid);
    if ($m !== null) {
        return $m;
    }
    $st = $pdo->prepare('SELECT store_name, registration_date FROM store_states WHERE store_id = ? LIMIT 1');
    $st->execute([$mid]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $regRaw = $row['registration_date'] ?? null;
        $regAt  = '';
        if ($regRaw) {
            $ts = strtotime((string) $regRaw);
            $regAt = $ts > 0 ? date('Y-m-d H:i:s', $ts) : '';
        }

        return [
            'id'                 => $mid,
            'name'               => (string) ($row['store_name'] ?? $fallbackStoreName ?? ''),
            'registered_at'      => $regAt,
            'total_shipments'    => 0,
            'last_shipment_date' => null,
            'status'             => null,
        ];
    }
    $asn = $pdo->prepare('SELECT store_name FROM store_assignments WHERE store_id = ? ORDER BY assigned_at DESC LIMIT 1');
    $asn->execute([$mid]);
    $arow = $asn->fetch(PDO::FETCH_ASSOC);
    if ($arow) {
        return [
            'id'                 => $mid,
            'name'               => (string) ($arow['store_name'] ?? $fallbackStoreName ?? ''),
            'registered_at'      => '',
            'total_shipments'    => 0,
            'last_shipment_date' => null,
            'status'             => null,
        ];
    }

    return null;
}

/** مسؤول الاستعادة: يطابق الاسم في السجل أو وجود تعيين لهذا المتجر */
function irfs_inactive_manager_sees_call(PDO $pdo, $role, $username, $fullname, $performedBy, $storeId) {
    if ($role !== 'inactive_manager' || $username === '') {
        return true;
    }
    if (irfs_pb_matches($performedBy, $username, $fullname)) {
        return true;
    }
    $sid = (int) $storeId;
    if ($sid <= 0) {
        return false;
    }
    $chk = $pdo->prepare('SELECT 1 FROM store_assignments WHERE store_id = ? AND assigned_to = ? LIMIT 1');
    $chk->execute([$sid, $username]);

    return (bool) $chk->fetchColumn();
}

function irfs_call_type_label_ar($t) {
    $t = (string) $t;
    switch ($t) {
        case 'periodic_followup':
            return 'متابعة دورية (المهام اليومية)';
        case 'inc_call1':
            return 'المكالمة الأولى';
        case 'inc_call2':
            return 'المكالمة الثانية';
        case 'inc_call3':
            return 'المكالمة الثالثة';
        case 'general':
            return 'تواصل عام';
        case 'rcall1':
            return 'مكالمة استعادة — الأولى';
        case 'rcall2':
            return 'مكالمة استعادة — الثانية';
        case 'rcall3':
            return 'مكالمة استعادة — الثالثة';
        default:
            return $t !== '' ? $t : '—';
    }
}

/** نتيجة مكالمة تُعد «تم الرد» في الواجهة */
function irfs_answered_outcome($o) {
    $x = trim((string) $o);

    return $x === 'answered' || $x === 'callback' || $x === '';
}

/** احتياطي من call_logs: لا نعدّ الفراغ «تم تواصل» حتى لا يُستبعد «لم يرد» خطأً */
function irfs_log_explicit_success($o) {
    $x = strtolower(trim((string) $o));

    return $x === 'answered' || $x === 'callback';
}

/** لم يتم التواصل — يظهر في تبويب «لم يرد» */
function irfs_no_success_outcome($o) {
    $x = strtolower(trim((string) $o));

    return $x === 'no_answer' || $x === 'busy';
}

function irfs_pb_matches($pb, $username, $fullname) {
    $w = mb_strtolower(trim((string) $pb), 'UTF-8');
    if ($w === '') {
        return false;
    }
    $u = mb_strtolower(trim((string) $username), 'UTF-8');
    $f = mb_strtolower(trim((string) $fullname), 'UTF-8');
    if ($u !== '' && $w === $u) {
        return true;
    }
    if ($f !== '' && $w === $f) {
        return true;
    }

    return false;
}

/**
 * @param array<string,mixed> $m
 * @param array{assigned_to?:string,assigned_at?:?string,workflow_updated_at?:?string,store_name?:string} $meta
 * @param array<string,mixed>|null $lc
 */
function irfs_try_build_row(
    int $mid,
    array $m,
    array $meta,
    $lc,
    string $followupStatus,
    $now,
    string $regFrom,
    string $regTo,
    string $q,
    int $maxDaysReg
) {
    $regAt = !empty($m['registered_at']) ? (string) $m['registered_at'] : '';
    $regTs = $regAt !== '' ? strtotime($regAt) : false;
    $daysReg = ($regTs !== false && $regTs > 0) ? ($now - $regTs) / 86400 : 0;
    if ($daysReg > $maxDaysReg) {
        return null;
    }

    if ($regFrom !== '') {
        $fromTs = strtotime($regFrom . ' 00:00:00');
        if ($regTs !== false && $regTs < $fromTs) {
            return null;
        }
    }
    if ($regTo !== '') {
        $toTs = strtotime($regTo . ' 23:59:59');
        if ($regTs !== false && $regTs > $toTs) {
            return null;
        }
    }

    if ($q !== '') {
        $needle = mb_strtolower($q, 'UTF-8');
        $name   = mb_strtolower((string) ($m['name'] ?? $meta['store_name'] ?? ''), 'UTF-8');
        $idStr  = (string) $mid;
        if (mb_strpos($name, $needle, 0, 'UTF-8') === false && mb_strpos($idStr, $needle, 0, 'UTF-8') === false) {
            return null;
        }
    }

    $wfAt = !empty($meta['workflow_updated_at']) ? (string) $meta['workflow_updated_at'] : '';
    $wfTs = $wfAt !== '' ? strtotime($wfAt) : false;
    $cycleDay = irfs_followup_cycle_day($regTs !== false ? $regTs : false, $wfTs, $now);
    $stageLabel = $lc ? irfs_call_type_label_ar($lc['call_type'] ?? '') : '—';

    return [
        'id'                     => $mid,
        'name'                   => (string) ($m['name'] ?? $meta['store_name'] ?? ''),
        'registered_at'          => $regAt,
        '_cycle_day'             => $cycleDay,
        '_days_since_reg'        => round($daysReg, 2),
        'assigned_to'            => (string) ($meta['assigned_to'] ?? ''),
        'assigned_at'            => $meta['assigned_at'] ?? null,
        'workflow_updated_at'    => $meta['workflow_updated_at'] ?? null,
        'followup_status'        => $followupStatus,
        'last_call_type'         => $lc['call_type'] ?? null,
        'last_call_stage_label'  => $stageLabel,
        'last_call_at'           => $lc['created_at'] ?? null,
        'is_onboarding'          => false,
        'total_shipments'        => $m['total_shipments'] ?? 0,
        'last_shipment_date'     => $m['last_shipment_date'] ?? null,
        'status'                 => $m['status'] ?? null,
    ];
}

$pdo = getDB();
ensure_workflow_schema($pdo);

$role      = trim((string) ($_GET['user_role'] ?? ''));
$username  = trim((string) ($_GET['username'] ?? ''));
$fullname  = trim((string) ($_GET['user_fullname'] ?? ''));
$q         = trim((string) ($_GET['q'] ?? ''));
$regFrom   = trim((string) ($_GET['reg_from'] ?? ''));
$regTo     = trim((string) ($_GET['reg_to'] ?? ''));
$maxDaysReg = (int) ($_GET['max_days_reg'] ?? 3650);
if ($maxDaysReg < 1) {
    $maxDaysReg = 365;
}
if ($maxDaysReg > 3650) {
    $maxDaysReg = 3650;
}

$now = time();

$merchants = [];

$sql = "
    SELECT
        sa.store_id,
        sa.store_name,
        sa.assigned_to,
        sa.assigned_at,
        sa.workflow_updated_at,
        sa.workflow_status
    FROM store_assignments sa
    WHERE sa.assignment_queue = 'inactive'
    AND sa.workflow_status IN ('completed', 'no_answer')
";
$params = [];
if ($role === 'inactive_manager' && $username !== '') {
    $sql .= ' AND sa.assigned_to = ?';
    $params[] = $username;
}
$sql .= ' ORDER BY sa.workflow_updated_at DESC';

$st = $pdo->prepare($sql);
$st->execute($params);
$rows = $st->fetchAll(PDO::FETCH_ASSOC);

$seen = [];
$deduped = [];
foreach ($rows as $r) {
    $sid = (string) ($r['store_id'] ?? '');
    if ($sid === '' || isset($seen[$sid])) {
        continue;
    }
    $seen[$sid] = true;
    $deduped[] = $r;
}

$storeIds = array_column($deduped, 'store_id');
$lastCalls = [];
if (!empty($storeIds)) {
    $idsInt = array_map('intval', $storeIds);
    $idsInt = array_values(array_filter($idsInt, static function ($x) {
        return $x > 0;
    }));
    if (!empty($idsInt)) {
        $ph = implode(',', array_fill(0, count($idsInt), '?'));
        $clSt = $pdo->prepare("
            SELECT store_id, call_type, outcome, created_at, performed_by
            FROM call_logs
            WHERE store_id IN ($ph)
            AND call_type IN ('periodic_followup', 'inc_call1', 'inc_call2', 'inc_call3', 'rcall1', 'rcall2', 'rcall3', 'general')
            ORDER BY created_at DESC
        ");
        $clSt->execute($idsInt);
        while ($c = $clSt->fetch(PDO::FETCH_ASSOC)) {
            $k = (string) $c['store_id'];
            if (!isset($lastCalls[$k])) {
                $lastCalls[$k] = $c;
            }
        }
    }
}

$contacted = [];
$noAnswer  = [];

foreach ($deduped as $r) {
    $sidKey = (string) $r['store_id'];
    $mid    = (int) $r['store_id'];
    $m = irfs_resolve_merchant($pdo, $merchants, $mid, (string) ($r['store_name'] ?? ''));
    if (!$m) {
        continue;
    }

    $followupStatus = ($r['workflow_status'] ?? '') === 'completed' ? 'contacted' : 'no_answer';
    $lc = $lastCalls[$sidKey] ?? $lastCalls[(string) $mid] ?? null;
    $meta = [
        'assigned_to'         => (string) ($r['assigned_to'] ?? ''),
        'assigned_at'         => $r['assigned_at'] ?? null,
        'workflow_updated_at' => $r['workflow_updated_at'] ?? null,
        'store_name'          => (string) ($r['store_name'] ?? ''),
    ];
    $item = irfs_try_build_row($mid, $m, $meta, $lc, $followupStatus, $now, $regFrom, $regTo, $q, $maxDaysReg);
    if ($item === null) {
        continue;
    }

    if ($followupStatus === 'contacted') {
        $contacted[] = $item;
    } else {
        $noAnswer[] = $item;
    }
}

$listedIds = [];
foreach ($contacted as $it) {
    $listedIds[(string) $it['id']] = true;
}
foreach ($noAnswer as $it) {
    $listedIds[(string) $it['id']] = true;
}

// ── آخر مكالمة لكل متجر (30 يوماً) — أساس احتياطي «تم التواصل» و«لم يرد» ──
$logStmt = $pdo->query("
    SELECT store_id, call_type, outcome, created_at, performed_by
    FROM call_logs
    WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    AND call_type IN ('periodic_followup', 'inc_call1', 'inc_call2', 'inc_call3', 'rcall1', 'rcall2', 'rcall3', 'general')
    ORDER BY created_at DESC
");
$latestCallByStore = [];
if ($logStmt) {
    while ($row = $logStmt->fetch(PDO::FETCH_ASSOC)) {
        $sk = (string) ($row['store_id'] ?? '');
        if ($sk === '' || isset($latestCallByStore[$sk])) {
            continue;
        }
        $latestCallByStore[$sk] = $row;
    }
}

$latestAnsweredByStore = [];
foreach ($latestCallByStore as $sk => $row) {
    if (irfs_log_explicit_success($row['outcome'] ?? '')) {
        $latestAnsweredByStore[$sk] = $row;
    }
}

foreach ($latestAnsweredByStore as $sk => $lc) {
    if (isset($listedIds[$sk])) {
        continue;
    }
    if (!irfs_inactive_manager_sees_call($pdo, $role, $username, $fullname, $lc['performed_by'] ?? '', $sk)) {
        continue;
    }
    $mid = (int) $sk;
    if ($mid <= 0) {
        continue;
    }
    $m = irfs_resolve_merchant($pdo, $merchants, $mid, '');
    if (!$m) {
        continue;
    }
    $meta = [
        'assigned_to'         => (string) ($lc['performed_by'] ?? ''),
        'assigned_at'         => null,
        'workflow_updated_at' => $lc['created_at'] ?? null,
        'store_name'          => '',
    ];
    $item = irfs_try_build_row($mid, $m, $meta, $lc, 'contacted', $now, $regFrom, $regTo, $q, $maxDaysReg);
    if ($item === null) {
        continue;
    }
    $contacted[] = $item;
    $listedIds[$sk] = true;
}

// ── احتياطي «لم يرد»: آخر مكالمة = no_answer أو مشغول (مثلاً inc_call دون تحديث workflow في التعيين) ──
foreach ($latestCallByStore as $sk => $lc) {
    if (isset($listedIds[$sk])) {
        continue;
    }
    if (!irfs_no_success_outcome($lc['outcome'] ?? '')) {
        continue;
    }
    if (!irfs_inactive_manager_sees_call($pdo, $role, $username, $fullname, $lc['performed_by'] ?? '', $sk)) {
        continue;
    }
    $mid = (int) $sk;
    if ($mid <= 0) {
        continue;
    }
    $m = irfs_resolve_merchant($pdo, $merchants, $mid, '');
    if (!$m) {
        continue;
    }
    $meta = [
        'assigned_to'         => (string) ($lc['performed_by'] ?? ''),
        'assigned_at'         => null,
        'workflow_updated_at' => $lc['created_at'] ?? null,
        'store_name'          => '',
    ];
    $item = irfs_try_build_row($mid, $m, $meta, $lc, 'no_answer', $now, $regFrom, $regTo, $q, $maxDaysReg);
    if ($item === null) {
        continue;
    }
    $noAnswer[] = $item;
    $listedIds[$sk] = true;
}

// ── احتياطي: منجز في store_states ضمن نافذة تسجيل Nawris ──
try {
    $ssStmt = $pdo->query("
        SELECT store_id, store_name, category, updated_by, last_call_date
        FROM store_states
        WHERE category IN ('completed', 'contacted')
    ");
    if ($ssStmt) {
        while ($ss = $ssStmt->fetch(PDO::FETCH_ASSOC)) {
            $sk = (string) ($ss['store_id'] ?? '');
            if ($sk === '' || isset($listedIds[$sk])) {
                continue;
            }
            $mid = (int) $sk;
            if ($mid <= 0) {
                continue;
            }
            $m = irfs_resolve_merchant($pdo, $merchants, $mid, (string) ($ss['store_name'] ?? ''));
            if (!$m) {
                continue;
            }
            if ($role === 'inactive_manager' && $username !== '') {
                $ub = trim((string) ($ss['updated_by'] ?? ''));
                if ($ub !== '' && $ub !== 'system' && $ub !== 'system_no_ship_48h' && !irfs_pb_matches($ub, $username, $fullname)) {
                    continue;
                }
            }
            $lc = $latestAnsweredByStore[$sk] ?? null;
            $wfAt = !empty($ss['last_call_date']) ? (string) $ss['last_call_date'] : null;
            $meta = [
                'assigned_to'         => (string) ($ss['updated_by'] ?? ''),
                'assigned_at'         => null,
                'workflow_updated_at' => $wfAt,
                'store_name'          => (string) ($ss['store_name'] ?? ''),
            ];
            if ($lc === null && $wfAt) {
                $lc = [
                    'call_type'   => 'general',
                    'outcome'     => 'answered',
                    'created_at'  => $wfAt,
                    'performed_by'=> $meta['assigned_to'],
                ];
            }
            $item = irfs_try_build_row($mid, $m, $meta, $lc, 'contacted', $now, $regFrom, $regTo, $q, $maxDaysReg);
            if ($item === null) {
                continue;
            }
            if ($lc === null) {
                $item['last_call_stage_label'] = 'منجز — سجل الحالة';
            }
            $contacted[] = $item;
            $listedIds[$sk] = true;
        }
    }
} catch (Throwable $e) {
    // عمود last_call_date قد يكون غير موجوداً في نسخ قديمة
    try {
        $ssStmt = $pdo->query("
            SELECT store_id, store_name, category, updated_by
            FROM store_states
            WHERE category IN ('completed', 'contacted')
        ");
        if ($ssStmt) {
            while ($ss = $ssStmt->fetch(PDO::FETCH_ASSOC)) {
                $sk = (string) ($ss['store_id'] ?? '');
                if ($sk === '' || isset($listedIds[$sk])) {
                    continue;
                }
                $mid = (int) $sk;
                if ($mid <= 0) {
                    continue;
                }
                $m = irfs_resolve_merchant($pdo, $merchants, $mid, (string) ($ss['store_name'] ?? ''));
                if (!$m) {
                    continue;
                }
                if ($role === 'inactive_manager' && $username !== '') {
                    $ub = trim((string) ($ss['updated_by'] ?? ''));
                    if ($ub !== '' && $ub !== 'system' && $ub !== 'system_no_ship_48h' && !irfs_pb_matches($ub, $username, $fullname)) {
                        continue;
                    }
                }
                $lc = $latestAnsweredByStore[$sk] ?? null;
                $meta = [
                    'assigned_to'         => (string) ($ss['updated_by'] ?? ''),
                    'assigned_at'         => null,
                    'workflow_updated_at' => null,
                    'store_name'          => (string) ($ss['store_name'] ?? ''),
                ];
                $item = irfs_try_build_row($mid, $m, $meta, $lc, 'contacted', $now, $regFrom, $regTo, $q, $maxDaysReg);
                if ($item === null) {
                    continue;
                }
                if ($lc === null) {
                    $item['last_call_stage_label'] = 'منجز — سجل الحالة';
                }
                $contacted[] = $item;
                $listedIds[$sk] = true;
            }
        }
    } catch (Throwable $e2) {
    }
}

jsonResponse([
    'success' => true,
    'contacted' => $contacted,
    'no_answer' => $noAnswer,
    'counts' => [
        'contacted' => count($contacted),
        'no_answer' => count($noAnswer),
    ],
]);
