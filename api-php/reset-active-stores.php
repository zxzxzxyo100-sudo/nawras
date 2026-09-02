<?php
/**
 * reset-active-stores.php
 * إعادة متاجر «منجز» و/أو «unreachable» إلى «active_pending_calls» يدوياً.
 * POST { type: 'completed' | 'unreachable' | 'all', username: string }
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Nawras-Resume');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

ini_set('memory_limit', MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$type     = trim((string) ($input['type']     ?? 'all'));
$username = trim((string) ($input['username'] ?? ''));

$allowedTypes = ['completed', 'unreachable', 'all'];
if (!in_array($type, $allowedTypes, true)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'نوع غير صحيح. المقبول: completed | unreachable | all'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

// بناء شرط WHERE حسب النوع المطلوب
if ($type === 'all') {
    $categories = ['completed', 'unreachable'];
} else {
    $categories = [$type];
}

$placeholders = implode(',', array_fill(0, count($categories), '?'));

$sql = "UPDATE store_states
        SET category       = 'active_pending_calls',
            last_call_date = NULL,
            updated_by     = ?
        WHERE category IN ($placeholders)";

$params = array_merge([$username ?: 'manual_reset'], $categories);
$stmt   = $pdo->prepare($sql);
$stmt->execute($params);
$n = (int) $stmt->rowCount();

$typeLabel = match($type) {
    'completed'   => 'المنجزة',
    'unreachable' => 'لم يتم الوصول',
    default       => 'المنجزة + لم يتم الوصول',
};

echo json_encode([
    'success'    => true,
    'updated'    => $n,
    'type'       => $type,
    'message'    => "تمت إعادة {$n} متجر من «{$typeLabel}» إلى «قيد المتابعة»",
    'reset_at'   => date('Y-m-d H:i:s'),
], JSON_UNESCAPED_UNICODE);
