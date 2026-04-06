<?php
/**
 * أتمتة مسار الاحتضان / مسؤول المتاجر الجديدة (تجريبي): يوم 14 بدون شحن → غير نشط ساخن؛
 * يوم 11 مع شحن وبدون مكالمات مجابة → نشط + علامة أداء.
 */
require_once __DIR__ . '/db.php';
header('Content-Type: application/json; charset=utf-8');

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$userRole = $input['user_role'] ?? '';
if ($userRole !== 'incubation_manager') {
    echo json_encode(['success' => false, 'error' => 'غير مصرح — مسؤول المتاجر الجديدة فقط.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$storeId = (int) ($input['store_id'] ?? 0);
$storeName = trim((string) ($input['store_name'] ?? ''));
$username = trim((string) ($input['username'] ?? ''));
$days = (int) ($input['days_in_system'] ?? 0);
$shipments = (int) ($input['total_shipments'] ?? 0);
$answeredCalls = (int) ($input['answered_call_count'] ?? 0);

if ($storeId <= 0) {
    echo json_encode(['success' => false, 'error' => 'معرّف المتجر غير صالح.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

try {
    $pdo->exec('ALTER TABLE store_states ADD COLUMN officer_performance_error TINYINT(1) NOT NULL DEFAULT 0');
} catch (Throwable $e) {
}

$rule = 'none';

// قاعدة 1: اليوم 14+ ولا شحن → غير نشط ساخن
if ($days >= 14 && $shipments <= 0) {
    $stmt = $pdo->prepare(
        "INSERT INTO store_states (store_id, store_name, category, state_reason, updated_by)
         VALUES (?, ?, 'hot_inactive', 'mo_d14_no_ship', ?)
         ON DUPLICATE KEY UPDATE category = 'hot_inactive', state_reason = VALUES(state_reason), updated_by = VALUES(updated_by), store_name = VALUES(store_name)"
    );
    $stmt->execute([$storeId, $storeName !== '' ? $storeName : (string) $storeId, $username !== '' ? $username : 'system']);
    $rule = 'd14_hot_inactive';
    echo json_encode(['success' => true, 'rule' => $rule], JSON_UNESCAPED_UNICODE);
    exit;
}

// قاعدة 2: يوم 11+ مع شحن و0 مكالمات مجابة → نشط يشحن + علامة أداء
if ($days >= 11 && $shipments > 0 && $answeredCalls <= 0) {
    $stmt = $pdo->prepare(
        "INSERT INTO store_states (store_id, store_name, category, officer_performance_error, state_reason, updated_by)
         VALUES (?, ?, 'active_shipping', 1, 'mo_d11_no_answered_calls', ?)
         ON DUPLICATE KEY UPDATE category = 'active_shipping', officer_performance_error = 1, state_reason = VALUES(state_reason), updated_by = VALUES(updated_by), store_name = VALUES(store_name)"
    );
    $stmt->execute([$storeId, $storeName !== '' ? $storeName : (string) $storeId, $username !== '' ? $username : 'system']);
    $rule = 'd11_performance';
    echo json_encode(['success' => true, 'rule' => $rule], JSON_UNESCAPED_UNICODE);
    exit;
}

echo json_encode(['success' => true, 'rule' => $rule], JSON_UNESCAPED_UNICODE);
