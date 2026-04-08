<?php
/**
 * متاجر جديدة ضمن دورة الاحتضان (≤14 يوماً) لها سجل في طابور المتابعة الدورية (المهام اليومية):
 * تم التواصل (workflow completed) أو لم يرد (no_answer).
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/onboarding-config.php';
require_once __DIR__ . '/workflow-queue-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

/** نفس منطق all-stores.php */
function ifs_incubation_cycle_day($regTs, $now) {
    if (!$regTs || $regTs <= 0) {
        return 1;
    }
    $d = (int) floor(($now - $regTs) / 86400);

    return min(14, max(1, $d + 1));
}

function ifs_fetch_new_merchants_90d() {
    $now    = time();
    $days90 = date('Y-m-d', $now - 90 * 86400);
    $all    = [];
    $cursor = null;
    $p      = 0;
    $urlBase = NAWRIS_BASE . '/customers/new?since=' . $days90;
    $max     = MAX_PAGES_NEW;
    do {
        $u = $cursor
            ? $urlBase . (strpos($urlBase, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor)
            : $urlBase;
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $u,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $r        = curl_exec($ch);
        $err      = curl_errno($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($err || !$r || $httpCode >= 400) {
            break;
        }
        $d = json_decode($r, true);
        if (!isset($d['data']) || !is_array($d['data'])) {
            break;
        }
        foreach ($d['data'] as $i) {
            $id = $i['id'];
            if (!isset($all[$id])) {
                $all[$id] = $i;
            }
        }
        $cursor = $d['meta']['next_cursor'] ?? null;
        $p++;
    } while ($cursor && $p < $max);

    return $all;
}

function ifs_pick_merchant(array $merchants, $mid) {
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

function ifs_call_type_label_ar($t) {
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
        default:
            return $t !== '' ? $t : '—';
    }
}

$pdo = getDB();
ensure_workflow_schema($pdo);

$role     = trim((string) ($_GET['user_role'] ?? ''));
$username = trim((string) ($_GET['username'] ?? ''));
$q        = trim((string) ($_GET['q'] ?? ''));
$regFrom  = trim((string) ($_GET['reg_from'] ?? ''));
$regTo    = trim((string) ($_GET['reg_to'] ?? ''));

$now = time();

try {
    $merchants = ifs_fetch_new_merchants_90d();
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'تعذّر جلب بيانات المتاجر الجديدة'], 500);
}

$sql = "
    SELECT
        sa.store_id,
        sa.store_name,
        sa.assigned_to,
        sa.assigned_at,
        sa.workflow_updated_at,
        sa.workflow_status
    FROM store_assignments sa
    WHERE sa.assignment_queue = 'active'
    AND sa.workflow_status IN ('completed', 'no_answer')
";
$params = [];
if ($role === 'active_manager' && $username !== '') {
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
            AND call_type IN ('periodic_followup', 'inc_call1', 'inc_call2', 'inc_call3', 'general')
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
    $m = ifs_pick_merchant($merchants, $mid);
    if (!$m) {
        continue;
    }

    $regAt = !empty($m['registered_at']) ? (string) $m['registered_at'] : '';
    $regTs = $regAt !== '' ? strtotime($regAt) : false;
    $daysReg = ($regTs !== false && $regTs > 0) ? ($now - $regTs) / 86400 : 0;
    if ($daysReg > 14) {
        continue;
    }

    if ($regFrom !== '') {
        $fromTs = strtotime($regFrom . ' 00:00:00');
        if ($regTs !== false && $regTs < $fromTs) {
            continue;
        }
    }
    if ($regTo !== '') {
        $toTs = strtotime($regTo . ' 23:59:59');
        if ($regTs !== false && $regTs > $toTs) {
            continue;
        }
    }

    if ($q !== '') {
        $needle = mb_strtolower($q, 'UTF-8');
        $name   = mb_strtolower((string) ($m['name'] ?? $r['store_name'] ?? ''), 'UTF-8');
        $idStr  = (string) $mid;
        if (mb_strpos($name, $needle, 0, 'UTF-8') === false && mb_strpos($idStr, $needle, 0, 'UTF-8') === false) {
            continue;
        }
    }

    $cycleDay = ifs_incubation_cycle_day($regTs !== false ? $regTs : null, $now);
    $lc       = $lastCalls[$sidKey] ?? $lastCalls[(string) $mid] ?? null;
    $stageLabel = $lc ? ifs_call_type_label_ar($lc['call_type'] ?? '') : '—';

    $followupStatus = ($r['workflow_status'] ?? '') === 'completed' ? 'contacted' : 'no_answer';

    $item = [
        'id'                     => $mid,
        'name'                   => (string) ($m['name'] ?? $r['store_name'] ?? ''),
        'registered_at'          => $regAt,
        '_cycle_day'             => $cycleDay,
        '_days_since_reg'        => round($daysReg, 2),
        'assigned_to'            => (string) ($r['assigned_to'] ?? ''),
        'assigned_at'            => $r['assigned_at'] ?? null,
        'workflow_updated_at'    => $r['workflow_updated_at'] ?? null,
        'followup_status'        => $followupStatus,
        'last_call_type'         => $lc['call_type'] ?? null,
        'last_call_stage_label'  => $stageLabel,
        'last_call_at'           => $lc['created_at'] ?? null,
        'is_onboarding'          => true,
        'total_shipments'        => $m['total_shipments'] ?? 0,
        'last_shipment_date'     => $m['last_shipment_date'] ?? null,
        'status'                 => $m['status'] ?? null,
    ];

    if ($followupStatus === 'contacted') {
        $contacted[] = $item;
    } else {
        $noAnswer[] = $item;
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
