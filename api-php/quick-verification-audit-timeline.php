<?php
/**
 * جدول زمني للتحقق السريع — دمج سجلات المكالمات + سجل التدقيق للمتجر.
 * للمدير التنفيذي فقط.
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

$storeId = (int) ($_GET['store_id'] ?? 0);
if ($storeId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'معرّف المتجر مطلوب.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

function nawras_outcome_ar($o) {
    $o = (string) $o;
    $map = [
        'answered' => 'تم الرد',
        'no_answer' => 'لم يتم الرد',
        'busy' => 'مشغول',
        'callback' => 'طلب معاودة',
    ];

    return $map[$o] ?? ($o !== '' ? $o : '—');
}

function nawras_timeline_tone_call($outcome) {
    $outcome = (string) $outcome;
    if ($outcome === 'answered') {
        return 'success';
    }
    if ($outcome === 'no_answer' || $outcome === 'busy') {
        return 'danger';
    }

    return 'neutral';
}

$events = [];
$latestCallNote = null;

try {
    $st = $pdo->prepare('
        SELECT id, store_id, store_name, call_type, note, outcome, performed_by, performed_role, created_at
        FROM call_logs
        WHERE store_id = ?
        ORDER BY created_at ASC
        LIMIT 120
    ');
    $st->execute([$storeId]);
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $note = trim((string) ($r['note'] ?? ''));
        $out = (string) ($r['outcome'] ?? '');
        $detail = nawras_outcome_ar($out);
        if ($note !== '') {
            $detail .= ' — ' . $note;
        }
        $ct = (string) ($r['call_type'] ?? '');
        $events[] = [
            'at' => $r['created_at'],
            'kind' => 'call',
            'label' => 'تسجيل مكالمة',
            'sub' => $ct !== '' ? $ct : 'عام',
            'detail' => $detail,
            'actor' => trim((string) ($r['performed_by'] ?? '')),
            'tone' => nawras_timeline_tone_call($out),
        ];
    }
    $stN = $pdo->prepare("
        SELECT note, performed_by, created_at FROM call_logs
        WHERE store_id = ? AND note IS NOT NULL AND TRIM(note) <> ''
        ORDER BY created_at DESC LIMIT 1
    ");
    $stN->execute([$storeId]);
    $nr = $stN->fetch(PDO::FETCH_ASSOC);
    if ($nr) {
        $latestCallNote = [
            'at' => $nr['created_at'],
            'text' => trim((string) ($nr['note'] ?? '')),
            'by' => trim((string) ($nr['performed_by'] ?? '')),
        ];
    }
} catch (Throwable $e) {
}

try {
    $st2 = $pdo->prepare('
        SELECT store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role, created_at
        FROM audit_logs
        WHERE store_id = ?
        ORDER BY created_at ASC
        LIMIT 120
    ');
    $st2->execute([$storeId]);
    while ($r = $st2->fetch(PDO::FETCH_ASSOC)) {
        $detail = trim((string) ($r['action_detail'] ?? ''));
        if ($detail === '') {
            $detail = trim((string) ($r['action_type'] ?? ''));
        }
        $events[] = [
            'at' => $r['created_at'],
            'kind' => 'audit',
            'label' => trim((string) ($r['action_type'] ?? 'حدث')),
            'sub' => '',
            'detail' => $detail,
            'actor' => trim((string) ($r['performed_by'] ?? '')),
            'tone' => 'neutral',
        ];
    }
} catch (Throwable $e) {
}

try {
    $st3 = $pdo->prepare("
        SELECT survey_kind, satisfaction_score, created_at, performed_by
        FROM surveys
        WHERE store_id = ?
        ORDER BY created_at ASC
        LIMIT 60
    ");
    $st3->execute([$storeId]);
    while ($r = $st3->fetch(PDO::FETCH_ASSOC)) {
        $sk = (string) ($r['survey_kind'] ?? '');
        if ($sk === 'inactive_feedback') {
            $lab = 'ملاحظة متجر غير نشط';
        } elseif ($sk === 'new_merchant_onboarding') {
            $lab = 'استبيان تهيئة متجر جديد';
        } elseif ($sk === 'active_csat') {
            $lab = 'استبيان رضا (تاجر نشط)';
        } else {
            $lab = 'استبيان';
        }
        $sc = (string) ($r['satisfaction_score'] ?? '');
        $detail = $sc !== '' ? ('مؤشر الرضا: ' . $sc) : 'تم الحفظ';
        $events[] = [
            'at' => $r['created_at'],
            'kind' => 'survey',
            'label' => $lab,
            'sub' => $sk,
            'detail' => $detail,
            'actor' => trim((string) ($r['performed_by'] ?? '')),
            'tone' => ($sc === 'up') ? 'success' : (($sc === 'down') ? 'danger' : 'neutral'),
        ];
    }
} catch (Throwable $e) {
}

usort($events, function ($a, $b) {
    return strcmp((string) $a['at'], (string) $b['at']);
});

echo json_encode([
    'success' => true,
    'events' => $events,
    'latest_call_note' => $latestCallNote,
], JSON_UNESCAPED_UNICODE);
