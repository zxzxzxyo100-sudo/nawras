<?php
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');

try {
    $pdo = new PDO(
        'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
        DB_USER,
        DB_PASS,
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
    );
    echo json_encode([
        'ok' => true,
        'host' => DB_HOST,
        'db' => DB_NAME,
        'user' => DB_USER,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    echo json_encode([
        'ok' => false,
        'host' => DB_HOST,
        'db' => DB_NAME,
        'user' => DB_USER,
        'error' => $e->getMessage(),
    ], JSON_UNESCAPED_UNICODE);
}
