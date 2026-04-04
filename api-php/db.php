<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

function getDB() {
    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_TIMEOUT => 5,
                // استعلامات مُخزَّنة (افتراضي) — مطلوب لعدة SELECT متتالية في نفس الطلب (مثل get_my_stats)
            ]
        );
        return $pdo;
    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'فشل الاتصال بقاعدة البيانات'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function jsonResponse($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-cache');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
