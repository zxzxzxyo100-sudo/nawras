<?php
/**
 * التحقق السريع — تفاصيل استبيانات تهيئة المتاجر الجديدة اليوم (للمدير التنفيذي).
 * أسهم 🔼/🔽 من أول 3 أسئلة: الكل ≥4 = صعود، أي ≤3 = هبوط (يتوافق مع save_survey).
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$userRole = $_GET['user_role'] ?? '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();
$labels = ['إدخال الشحنات', 'أداء التطبيق', 'المهام اللوجستية'];
$rows = [];

try {
    $st = $pdo->query("
        SELECT s.id, s.store_id, COALESCE(ss.store_name, '') AS store_name,
          s.q1_delivery, s.q2_collection, s.q3_support,
          s.satisfaction_score, s.satisfaction_gap_tags,
          s.performed_by, s.submitted_username, s.created_at
        FROM surveys s
        LEFT JOIN store_states ss ON ss.store_id = s.store_id
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
                'label' => $labels[$i],
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
        $rows[] = [
            'id' => (int) $r['id'],
            'store_id' => (int) $r['store_id'],
            'store_name' => $r['store_name'] !== '' ? $r['store_name'] : ('#' . $r['store_id']),
            'staff_username' => $staffKey,
            'staff_fullname' => $fullname,
            'answers' => $answers,
            'arrow' => $score === 'up' ? 'up' : 'down',
            'gap_tags' => array_values(array_unique($tags)),
            'created_at' => $r['created_at'],
        ];
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر قراءة الاستبيانات.'], JSON_UNESCAPED_UNICODE);
    exit;
}

// تجميع حسب الموظف — استبيان التهيئة فقط: أي سهم هبوط → هبوط؛ وإلا صعود
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

echo json_encode(['success' => true, 'rows' => $rows, 'staff_summary' => $staff_summary], JSON_UNESCAPED_UNICODE);
