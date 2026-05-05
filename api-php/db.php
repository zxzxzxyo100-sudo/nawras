<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit', MEMORY_LIGHT);
ini_set('max_execution_time', TIME_SHORT);

function getDB() {
    $passwords = [];
    $seen = [];

    $addPass = function ($v) use (&$passwords, &$seen) {
        if (!is_string($v) || $v === '') return;
        if (isset($seen[$v])) return;
        $seen[$v] = true;
        $passwords[] = $v;
    };

    $addPass(DB_PASS);

    $envAlt = getenv('NAWRAS_DB_PASS_ALT');
    if (is_string($envAlt) && $envAlt !== '') {
        $addPass($envAlt);
    }

    // Production fallback if password changed by adding '@'
    if (defined('IS_STAGING_ENV') && IS_STAGING_ENV === false && substr(DB_PASS, -1) !== '@') {
        $addPass(DB_PASS . '@');
    }

    foreach ($passwords as $pwd) {
        try {
            $pdo = new PDO(
                'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
                DB_USER,
                $pwd,
                [
                    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_TIMEOUT => 5,
                ]
            );
            return $pdo;
        } catch (PDOException $e) {
            // Try next candidate password.
        }
    }

    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'Database connection failed'], JSON_UNESCAPED_UNICODE);
    exit;
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