<?php
/**
 * تفريغ سجلات التعيين المكتملة/لم يرد لطابور الاستعادة + إعادة ملء الطوابير.
 * POST { user_role: 'executive', assigned_by: string }
 * يُشغَّل يدوياً من المدير التنفيذي عند استنزاف مجمع الاستعادة.
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/workflow-queue-lib.php';

ini_set('memory_limit', MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods', 'POST, OPTIONS');
header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Nawras-Resume');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$input = json_decode(file_get_contents('php://input'), true) ?: [];
$role  = trim((string) ($input['user_role'] ?? ''));
$by    = trim((string) ($input['assigned_by'] ?? 'system'));

if ($role !== 'executive') {
    jsonResponse(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], 403);
}

$pdo = getDB();
ensure_workflow_schema($pdo);

// 1. حذف كل التعيينات المكتملة + «لم يرد» لطابور الاستعادة (كل المستخدمين)
$stmtDel = $pdo->prepare("
    DELETE FROM store_assignments
    WHERE assignment_queue = 'inactive'
    AND workflow_status IN ('completed', 'no_answer')
");
$stmtDel->execute();
$cleared = (int) $stmtDel->rowCount();

// 2. إعادة ملء طوابير كل مسؤولي الاستعادة من المجمع
$stmtUsers = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
$users = $stmtUsers->fetchAll(PDO::FETCH_COLUMN);
$report = [];
foreach ($users as $u) {
    $n = fill_inactive_slots_for_user($pdo, $u, $by, null);
    $report[$u] = $n;
}
$totalFilled = array_sum($report);

jsonResponse([
    'success'       => true,
    'cleared'       => $cleared,
    'filled'        => $totalFilled,
    'filled_per_user' => $report,
    'message'       => "تم تحرير {$cleared} سجل وإضافة {$totalFilled} متجر للطوابير",
]);
