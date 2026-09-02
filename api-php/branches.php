<?php
/**
 * قائمة الفروع المعروفة حالياً (من مزامنة store_branch_map) — لقوائم التصفية بالواجهة.
 */
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$pdo = getDB();

$branches = [];
try {
    $st = $pdo->query("
        SELECT DISTINCT responsible_branch
        FROM store_branch_map
        WHERE responsible_branch IS NOT NULL AND responsible_branch <> ''
        ORDER BY responsible_branch ASC
    ");
    $branches = array_column($st->fetchAll(PDO::FETCH_ASSOC) ?: [], 'responsible_branch');
} catch (Throwable $e) {
    // الجدول قد لا يكون موجوداً بعد إن لم يُشغَّل ترحيل قاعدة البيانات — نعيد قائمة فارغة بهدوء
    $branches = [];
}

echo json_encode(['success' => true, 'branches' => $branches], JSON_UNESCAPED_UNICODE);
