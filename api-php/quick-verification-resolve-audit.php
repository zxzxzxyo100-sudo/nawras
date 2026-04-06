<?php
/**
 * تسجيل حل مشكلة تدقيق — استبيان اليوم في التحقق السريع (للمدير التنفيذي).
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'طريقة غير مسموحة.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = [];
}

$userRole = trim((string) ($input['user_role'] ?? ''));
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$surveyId = (int) ($input['survey_id'] ?? 0);
if ($surveyId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'معرّف الاستبيان مطلوب.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$resolvedBy = trim((string) ($input['resolved_by'] ?? ''));

$pdo = getDB();

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_resolutions (
        survey_id INT NOT NULL PRIMARY KEY,
        resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_by VARCHAR(100) NULL DEFAULT NULL,
        INDEX idx_resolved_at (resolved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر تهيئة التخزين.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $st = $pdo->prepare('
        SELECT id FROM surveys
        WHERE id = ? AND DATE(created_at) = CURDATE()
        LIMIT 1
    ');
    $st->execute([$surveyId]);
    if (!$st->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'الاستبيان غير موجود أو ليس من اليوم.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ins = $pdo->prepare('
        INSERT INTO quick_verification_resolutions (survey_id, resolved_at, resolved_by)
        VALUES (?, NOW(), ?)
        ON DUPLICATE KEY UPDATE
            resolved_at = VALUES(resolved_at),
            resolved_by = VALUES(resolved_by)
    ');
    $ins->execute([$surveyId, $resolvedBy !== '' ? $resolvedBy : null]);

    echo json_encode([
        'success' => true,
        'survey_id' => $surveyId,
        'resolved' => true,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر حفظ الحل.'], JSON_UNESCAPED_UNICODE);
}
