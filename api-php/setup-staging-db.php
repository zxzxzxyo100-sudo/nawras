<?php
// =========================================================
// تهيئة قاعدة البيانات التجريبية لأول مرة
// شغّل هذا الملف مرة واحدة فقط من المتصفح:
//   staging.nawris-ly.com/api-php/setup-staging-db.php
// أو: nawris-ly.com/staging/api-php/setup-staging-db.php
// =========================================================

require_once __DIR__ . '/db.php';

// تأكد أننا في البيئة التجريبية
if (!defined('IS_STAGING_ENV') || IS_STAGING_ENV !== true) {
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error'   => 'هذا السكريبت يعمل فقط في البيئة التجريبية',
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$pdo = getDB();

// جداول المستخدمين
$pdo->exec("CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    fullname VARCHAR(200) NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('incubation_manager','active_manager','inactive_manager','executive') NOT NULL DEFAULT 'incubation_manager',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// حالات المتاجر
$pdo->exec("CREATE TABLE IF NOT EXISTS store_states (
    store_id INT PRIMARY KEY,
    store_name VARCHAR(300),
    category VARCHAR(50) NOT NULL,
    state_reason VARCHAR(100),
    restore_date DATETIME,
    graduated_at DATETIME,
    freeze_reason TEXT,
    registration_date DATETIME,
    first_shipped_date DATETIME,
    incubation_stage ENUM('day0','day3','day10','graduation_ready','graduated') DEFAULT 'day0',
    next_call_date DATE,
    updated_by VARCHAR(200),
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// سجل التدقيق
$pdo->exec("CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    store_name VARCHAR(300),
    action_type VARCHAR(100) NOT NULL,
    action_detail TEXT,
    old_status VARCHAR(50),
    new_status VARCHAR(50),
    performed_by VARCHAR(200) NOT NULL,
    performed_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store (store_id),
    INDEX idx_date (created_at),
    INDEX idx_user (performed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// سجل المكالمات
$pdo->exec("CREATE TABLE IF NOT EXISTS call_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    store_name VARCHAR(300),
    call_type VARCHAR(50) NOT NULL,
    note TEXT NOT NULL,
    outcome VARCHAR(32) NULL DEFAULT NULL,
    performed_by VARCHAR(200) NOT NULL,
    performed_role VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store (store_id),
    INDEX idx_date (created_at),
    INDEX idx_user (performed_by)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// مكالمات الاستعادة
$pdo->exec("CREATE TABLE IF NOT EXISTS recovery_calls (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    call_number TINYINT NOT NULL,
    note TEXT NOT NULL,
    performed_by VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_call (store_id, call_number),
    INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// الاستبيانات
$pdo->exec("CREATE TABLE IF NOT EXISTS surveys (
    id INT AUTO_INCREMENT PRIMARY KEY,
    store_id INT NOT NULL,
    q1_delivery TINYINT NOT NULL,
    q2_collection TINYINT NOT NULL,
    q3_support TINYINT NOT NULL,
    q4_app TINYINT NOT NULL,
    q5_payments TINYINT NOT NULL,
    q6_returns TINYINT NOT NULL,
    suggestions TEXT,
    performed_by VARCHAR(200) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_store (store_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// التعيينات
$pdo->exec("CREATE TABLE IF NOT EXISTS store_assignments (
    store_id     VARCHAR(50)  PRIMARY KEY,
    store_name   VARCHAR(255) DEFAULT '',
    assigned_to  VARCHAR(100) NOT NULL,
    assigned_by  VARCHAR(100) DEFAULT '',
    assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    notes        TEXT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

// مستخدم admin افتراضي للـ staging
$stmt = $pdo->prepare("SELECT id FROM users WHERE username = 'admin'");
$stmt->execute();
if (!$stmt->fetch()) {
    $pdo->prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)")
        ->execute(['admin', 'مدير تجريبي', 'admin123', 'executive']);
}

jsonResponse([
    'success' => true,
    'env'     => 'staging',
    'db'      => DB_NAME,
    'message' => '✅ تم إنشاء جميع الجداول في قاعدة البيانات التجريبية بنجاح',
    'tables'  => ['users', 'store_states', 'audit_logs', 'call_logs', 'recovery_calls', 'surveys', 'store_assignments'],
]);
