<?php
/**
 * بورصة الرضا اليوم — مسار خفيف للداشبورد فقط (لا يُدمج مع manager-analytics.php).
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/daily-staff-missions-lib.php';

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
$missions = nawras_build_daily_staff_missions($pdo);

echo json_encode([
    'success' => true,
    'daily_staff_missions' => $missions,
], JSON_UNESCAPED_UNICODE);
