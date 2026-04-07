<?php
/**
 * إرسال متجر إلى التحقق السريع — خانة «يحتاج تجميد»
 * مسموح: incubation_manager (متاجر جديدة) ، inactive_manager (غير نشطة)
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
$username = trim((string) ($input['username'] ?? ''));
$fullname = trim((string) ($input['fullname'] ?? ''));
$source = trim((string) ($input['source'] ?? ''));

$allowed = [
    'incubation_manager' => 'incubation',
    'inactive_manager' => 'inactive',
];
if (!isset($allowed[$userRole]) || $allowed[$userRole] !== $source) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح بهذا المصدر.'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($username === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'اسم المستخدم مطلوب.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$storeId = (int) ($input['store_id'] ?? 0);
$storeName = trim((string) ($input['store_name'] ?? ''));
$reason = trim((string) ($input['reason'] ?? ''));

if ($storeId <= 0) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'معرّف المتجر غير صالح.'], JSON_UNESCAPED_UNICODE);
    exit;
}
if ($reason === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'اذكر سبب طلب التجميد.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS qv_needs_freeze_requests (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        store_id INT NOT NULL,
        store_name VARCHAR(512) NULL,
        reason TEXT NOT NULL,
        source VARCHAR(32) NOT NULL,
        requested_by_username VARCHAR(100) NULL,
        requested_by_fullname VARCHAR(255) NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_created (created_at),
        INDEX idx_store (store_id),
        INDEX idx_source_created (source, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_needs_freeze_resolutions (
        needs_freeze_id INT NOT NULL PRIMARY KEY,
        resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_by VARCHAR(100) NULL DEFAULT NULL,
        executive_notes TEXT NULL DEFAULT NULL,
        INDEX idx_resolved_at (resolved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    try {
        $pdo->exec('ALTER TABLE quick_verification_needs_freeze_resolutions ADD COLUMN executive_notes TEXT NULL DEFAULT NULL');
    } catch (Throwable $e) {
    }
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر تهيئة التخزين.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $stDup = $pdo->prepare("
        SELECT r.id FROM qv_needs_freeze_requests r
        LEFT JOIN quick_verification_needs_freeze_resolutions res ON res.needs_freeze_id = r.id
        WHERE r.store_id = ? AND DATE(r.created_at) = CURDATE() AND res.needs_freeze_id IS NULL
        LIMIT 1
    ");
    $stDup->execute([$storeId]);
    if ($stDup->fetch(PDO::FETCH_ASSOC)) {
        http_response_code(409);
        echo json_encode(['success' => false, 'error' => 'يوجد طلب «يحتاج تجميد» لهذا المتجر اليوم بانتظار المراجعة.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $ins = $pdo->prepare('
        INSERT INTO qv_needs_freeze_requests
        (store_id, store_name, reason, source, requested_by_username, requested_by_fullname)
        VALUES (?,?,?,?,?,?)
    ');
    $ins->execute([
        $storeId,
        $storeName !== '' ? $storeName : null,
        $reason,
        $source,
        $username,
        $fullname !== '' ? $fullname : null,
    ]);
    $newId = (int) $pdo->lastInsertId();

    echo json_encode([
        'success' => true,
        'needs_freeze_id' => $newId,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر حفظ الطلب.'], JSON_UNESCAPED_UNICODE);
}
