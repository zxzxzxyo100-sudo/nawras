<?php
/**
 * التحقق السريع — للمدير التنفيذي:
 * - استبيان تهيئة المتاجر الجديدة (3 أسئلة نعم/لا): أسهم من save_survey
 * - استبيان تجار نشطون CSAT (6 نجوم): متوسط 6 تقييمات + تفاصيل المحاور
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$userRole = trim((string) ($_GET['user_role'] ?? ''));
$requestUsername = trim((string) ($_GET['username'] ?? ''));
$allowedRoles = ['executive', 'incubation_manager', 'active_manager', 'inactive_manager'];
if (!in_array($userRole, $allowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح.'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($userRole !== 'executive' && $requestUsername === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'اسم المستخدم مطلوب.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_resolutions (
        survey_id INT NOT NULL PRIMARY KEY,
        resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_by VARCHAR(100) NULL DEFAULT NULL,
        INDEX idx_resolved_at (resolved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    // ignore; SELECT may fail below if DB unavailable
}

$labelsOnb = ['إدخال الشحنات', 'أداء التطبيق', 'المهام اللوجستية'];
$labelsCsat = [
    'سرعة التوصيل',
    'التجميع والمندوب',
    'الدعم الفني',
    'سهولة التطبيق',
    'التسويات المالية',
    'المرجوعات',
];
$rows = [];
$activeCsatRows = [];

try {
    $st = $pdo->query("
        SELECT s.id, s.store_id, COALESCE(ss.store_name, '') AS store_name,
          COALESCE(ss.category, '') AS store_category,
          s.q1_delivery, s.q2_collection, s.q3_support,
          s.satisfaction_score, s.satisfaction_gap_tags,
          s.suggestions,
          s.performed_by, s.submitted_username, s.created_at,
          qvr.resolved_at AS qv_resolved_at, qvr.resolved_by AS qv_resolved_by
        FROM surveys s
        LEFT JOIN store_states ss ON ss.store_id = s.store_id
        LEFT JOIN quick_verification_resolutions qvr ON qvr.survey_id = s.id
        WHERE DATE(s.created_at) = CURDATE()
        AND COALESCE(s.survey_kind, '') = 'new_merchant_onboarding'
        ORDER BY s.created_at DESC
    ");
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $q = [(int) ($r['q1_delivery'] ?? 0), (int) ($r['q2_collection'] ?? 0), (int) ($r['q3_support'] ?? 0)];
        $answers = [];
        for ($i = 0; $i < 3; $i++) {
            $val = $q[$i];
            $answers[] = [
                'label' => $labelsOnb[$i],
                'yes' => $val >= 4,
                'value' => $val,
            ];
        }
        $tags = [];
        $j = $r['satisfaction_gap_tags'] ?? '';
        if ($j !== '' && $j !== null) {
            $dec = json_decode((string) $j, true);
            if (is_array($dec)) {
                foreach ($dec as $t) {
                    if ($t !== '' && $t !== null) {
                        $tags[] = (string) $t;
                    }
                }
            }
        }
        $uname = trim((string) ($r['submitted_username'] ?? ''));
        $staffKey = $uname !== '' ? $uname : trim((string) ($r['performed_by'] ?? ''));
        $fullname = $staffKey;
        if ($staffKey !== '') {
            $st2 = $pdo->prepare('SELECT fullname FROM users WHERE username = ? LIMIT 1');
            $st2->execute([$staffKey]);
            $ur = $st2->fetch(PDO::FETCH_ASSOC);
            if ($ur && trim((string) ($ur['fullname'] ?? '')) !== '') {
                $fullname = $ur['fullname'];
            }
        }
        $score = (string) ($r['satisfaction_score'] ?? '');
        $qvAt = $r['qv_resolved_at'] ?? null;
        $resolved = $qvAt !== null && trim((string) $qvAt) !== '';
        $rows[] = [
            'id' => (int) $r['id'],
            'survey_kind' => 'new_merchant_onboarding',
            'store_id' => (int) $r['store_id'],
            'store_name' => $r['store_name'] !== '' ? $r['store_name'] : ('#' . $r['store_id']),
            'store_category' => trim((string) ($r['store_category'] ?? '')),
            'staff_username' => $staffKey,
            'staff_fullname' => $fullname,
            'answers' => $answers,
            'arrow' => $score === 'up' ? 'up' : 'down',
            'gap_tags' => array_values(array_unique($tags)),
            'suggestions' => trim((string) ($r['suggestions'] ?? '')),
            'created_at' => $r['created_at'],
            'resolved' => $resolved,
            'resolved_at' => $resolved ? $r['qv_resolved_at'] : null,
            'resolved_by' => $resolved ? trim((string) ($r['qv_resolved_by'] ?? '')) : null,
        ];
    }

    $stA = $pdo->query("
        SELECT s.id, s.store_id, COALESCE(ss.store_name, '') AS store_name,
          COALESCE(ss.category, '') AS store_category,
          s.q1_delivery, s.q2_collection, s.q3_support, s.q4_app, s.q5_payments, s.q6_returns,
          s.satisfaction_score, s.satisfaction_gap_tags,
          s.suggestions,
          s.performed_by, s.submitted_username, s.created_at,
          qvr.resolved_at AS qv_resolved_at, qvr.resolved_by AS qv_resolved_by
        FROM surveys s
        LEFT JOIN store_states ss ON ss.store_id = s.store_id
        LEFT JOIN quick_verification_resolutions qvr ON qvr.survey_id = s.id
        WHERE DATE(s.created_at) = CURDATE()
        AND COALESCE(s.survey_kind, '') = 'active_csat'
        ORDER BY s.created_at DESC
    ");
    while ($r = $stA->fetch(PDO::FETCH_ASSOC)) {
        $qs = [
            (int) ($r['q1_delivery'] ?? 0),
            (int) ($r['q2_collection'] ?? 0),
            (int) ($r['q3_support'] ?? 0),
            (int) ($r['q4_app'] ?? 0),
            (int) ($r['q5_payments'] ?? 0),
            (int) ($r['q6_returns'] ?? 0),
        ];
        $sum = array_sum($qs);
        $avg = $sum / 6.0;
        $tier = $avg >= 4.0 ? 'green' : ($avg >= 3.0 ? 'yellow' : 'red');
        $questions = [];
        for ($i = 0; $i < 6; $i++) {
            $v = $qs[$i];
            $risk = 'ok';
            if ($v <= 2) {
                $risk = 'high';
            } elseif ($v <= 3) {
                $risk = 'mid';
            }
            $questions[] = [
                'label' => $labelsCsat[$i],
                'value' => $v,
                'risk' => $risk,
            ];
        }
        $tags = [];
        $j = $r['satisfaction_gap_tags'] ?? '';
        if ($j !== '' && $j !== null) {
            $dec = json_decode((string) $j, true);
            if (is_array($dec)) {
                foreach ($dec as $t) {
                    if ($t !== '' && $t !== null) {
                        $tags[] = (string) $t;
                    }
                }
            }
        }
        $uname = trim((string) ($r['submitted_username'] ?? ''));
        $staffKey = $uname !== '' ? $uname : trim((string) ($r['performed_by'] ?? ''));
        $fullname = $staffKey;
        if ($staffKey !== '') {
            $st2 = $pdo->prepare('SELECT fullname FROM users WHERE username = ? LIMIT 1');
            $st2->execute([$staffKey]);
            $ur = $st2->fetch(PDO::FETCH_ASSOC);
            if ($ur && trim((string) ($ur['fullname'] ?? '')) !== '') {
                $fullname = $ur['fullname'];
            }
        }
        $score = (string) ($r['satisfaction_score'] ?? '');
        $arrow = $score === 'up' ? 'up' : ($score === 'mid' ? 'mid' : 'down');
        $qvAt = $r['qv_resolved_at'] ?? null;
        $resolved = $qvAt !== null && trim((string) $qvAt) !== '';
        $activeCsatRows[] = [
            'id' => (int) $r['id'],
            'survey_kind' => 'active_csat',
            'store_id' => (int) $r['store_id'],
            'store_name' => $r['store_name'] !== '' ? $r['store_name'] : ('#' . $r['store_id']),
            'store_category' => trim((string) ($r['store_category'] ?? '')),
            'staff_username' => $staffKey,
            'staff_fullname' => $fullname,
            'avg' => round($avg, 2),
            'tier' => $tier,
            'arrow' => $arrow,
            'questions' => $questions,
            'gap_tags' => array_values(array_unique($tags)),
            'suggestions' => trim((string) ($r['suggestions'] ?? '')),
            'created_at' => $r['created_at'],
            'resolved' => $resolved,
            'resolved_at' => $resolved ? $r['qv_resolved_at'] : null,
            'resolved_by' => $resolved ? trim((string) ($r['qv_resolved_by'] ?? '')) : null,
        ];
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر قراءة الاستبيانات.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($userRole !== 'executive') {
    $rows = array_values(array_filter($rows, function ($r) use ($requestUsername) {
        $u = isset($r['staff_username']) ? trim((string) $r['staff_username']) : '';
        return $u !== '' && $u === $requestUsername;
    }));
    $activeCsatRows = array_values(array_filter($activeCsatRows, function ($r) use ($requestUsername) {
        $u = isset($r['staff_username']) ? trim((string) $r['staff_username']) : '';
        return $u !== '' && $u === $requestUsername;
    }));
}

// تجميع حسب الموظف — تهيئة جديدة
$byStaff = [];
foreach ($rows as $r) {
    $key = $r['staff_username'] !== '' ? $r['staff_username'] : '_';
    if (!isset($byStaff[$key])) {
        $byStaff[$key] = [
            'username' => $r['staff_username'],
            'fullname' => $r['staff_fullname'],
            'surveys' => [],
        ];
    }
    $byStaff[$key]['surveys'][] = $r;
}
$staff_summary = [];
foreach ($byStaff as $pack) {
    $anyDown = false;
    $allTags = [];
    foreach ($pack['surveys'] as $s) {
        if (($s['arrow'] ?? '') === 'down') {
            $anyDown = true;
        }
        foreach ($s['gap_tags'] ?? [] as $t) {
            if ($t !== '') {
                $allTags[] = $t;
            }
        }
    }
    $allTags = array_values(array_unique($allTags));
    $uname = $pack['username'];
    $role = '';
    if ($uname !== '' && $uname !== '_') {
        $st3 = $pdo->prepare('SELECT role FROM users WHERE username = ? LIMIT 1');
        $st3->execute([$uname]);
        $rr = $st3->fetch(PDO::FETCH_ASSOC);
        if ($rr) {
            $role = (string) ($rr['role'] ?? '');
        }
    }
    $staff_summary[] = [
        'username' => $uname !== '_' ? $uname : '',
        'fullname' => $pack['fullname'],
        'role' => $role,
        'satisfaction_arrow' => $anyDown ? 'down' : 'up',
        'gap_tags' => $allTags,
        'answered_surveys_today' => count($pack['surveys']),
    ];
}

// تجميع حسب الموظف — تجار نشطون CSAT
$byStaffA = [];
foreach ($activeCsatRows as $r) {
    $key = $r['staff_username'] !== '' ? $r['staff_username'] : '_';
    if (!isset($byStaffA[$key])) {
        $byStaffA[$key] = [
            'username' => $r['staff_username'],
            'fullname' => $r['staff_fullname'],
            'surveys' => [],
        ];
    }
    $byStaffA[$key]['surveys'][] = $r;
}
$active_csat_staff_summary = [];
foreach ($byStaffA as $pack) {
    $anyDown = false;
    $anyMid = false;
    $allTags = [];
    foreach ($pack['surveys'] as $s) {
        $ar = $s['arrow'] ?? '';
        if ($ar === 'down') {
            $anyDown = true;
        }
        if ($ar === 'mid') {
            $anyMid = true;
        }
        foreach ($s['gap_tags'] ?? [] as $t) {
            if ($t !== '') {
                $allTags[] = $t;
            }
        }
    }
    $allTags = array_values(array_unique($allTags));
    $uname = $pack['username'];
    $role = '';
    if ($uname !== '' && $uname !== '_') {
        $st3 = $pdo->prepare('SELECT role FROM users WHERE username = ? LIMIT 1');
        $st3->execute([$uname]);
        $rr = $st3->fetch(PDO::FETCH_ASSOC);
        if ($rr) {
            $role = (string) ($rr['role'] ?? '');
        }
    }
    $aggArrow = $anyDown ? 'down' : ($anyMid ? 'mid' : 'up');
    $active_csat_staff_summary[] = [
        'username' => $uname !== '_' ? $uname : '',
        'fullname' => $pack['fullname'],
        'role' => $role,
        'satisfaction_arrow' => $aggArrow,
        'gap_tags' => $allTags,
        'answered_surveys_today' => count($pack['surveys']),
    ];
}

echo json_encode([
    'success' => true,
    'rows' => $rows,
    'staff_summary' => $staff_summary,
    'active_csat_rows' => $activeCsatRows,
    'active_csat_staff_summary' => $active_csat_staff_summary,
], JSON_UNESCAPED_UNICODE);
