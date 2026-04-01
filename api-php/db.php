<?php
// Database connection for Nawras CRM
// حماية من Out of Memory
ini_set('memory_limit', '64M');
ini_set('max_execution_time', '15');

$DB_HOST = 'localhost';
$DB_NAME = 'u495355717_nawras_crm';
$DB_USER = 'u495355717_nawras_admin';
$DB_PASS = 'Zidona11';

function getDB() {
    global $DB_HOST, $DB_NAME, $DB_USER, $DB_PASS;
    try {
        $pdo = new PDO("mysql:host=$DB_HOST;dbname=$DB_NAME;charset=utf8mb4", $DB_USER, $DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_TIMEOUT => 5,
            PDO::MYSQL_ATTR_USE_BUFFERED_QUERY => false
        ]);
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
    header('Access-Control-Allow-Headers: Content-Type');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { exit; }
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
