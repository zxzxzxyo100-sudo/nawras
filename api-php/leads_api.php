<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$pdo = getDB();

function ensure_leads_schema(PDO $pdo) {
    static $done = false;
    if ($done) return;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leads (
            id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            store_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(50) NOT NULL,
            source ENUM('social_media','field_visit','other') NOT NULL DEFAULT 'social_media',
            contact_status ENUM('pending','answered','no_answer') NOT NULL DEFAULT 'pending',
            requires_field_visit TINYINT(1) NOT NULL DEFAULT 0,
            field_visit_done TINYINT(1) NOT NULL DEFAULT 0,
            account_opened TINYINT(1) NOT NULL DEFAULT 0,
            assigned_to_id INT NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT fk_leads_assigned_to_user FOREIGN KEY (assigned_to_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
            INDEX idx_leads_assigned (assigned_to_id),
            INDEX idx_leads_created (created_at),
            INDEX idx_leads_status (contact_status, account_opened)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $done = true;
}

function current_user_from_session() {
    $u = $_SESSION['nawras_user'] ?? null;
    if (!is_array($u)) return null;
    $id = isset($u['id']) ? (int) $u['id'] : 0;
    $role = strtolower(trim((string) ($u['role'] ?? '')));
    if ($id <= 0 || $role === '') return null;
    return ['id' => $id, 'role' => $role, 'username' => (string) ($u['username'] ?? '')];
}

function require_leads_access() {
    $u = current_user_from_session();
    if (!$u) {
        jsonResponse(['success' => false, 'error' => 'غير مصرح: الجلسة غير صالحة.'], 401);
    }
    if (!in_array($u['role'], ['admin', 'data_collector'], true)) {
        jsonResponse(['success' => false, 'error' => 'غير مصرح لهذا الدور.'], 403);
    }
    return $u;
}

function to_bool_int($v) {
    if (is_bool($v)) return $v ? 1 : 0;
    if (is_numeric($v)) return ((int) $v) ? 1 : 0;
    $s = strtolower(trim((string) $v));
    return in_array($s, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

try {
    ensure_leads_schema($pdo);
    $user = require_leads_access();
    $method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
    $input = json_decode(file_get_contents('php://input'), true);
    if (!is_array($input)) $input = $_POST;

    if ($method === 'GET') {
        if ($user['role'] === 'admin') {
            $st = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC");
            jsonResponse(['success' => true, 'data' => $st->fetchAll(PDO::FETCH_ASSOC)]);
        }
        $st = $pdo->prepare("SELECT * FROM leads WHERE assigned_to_id = ? ORDER BY created_at DESC");
        $st->execute([$user['id']]);
        jsonResponse(['success' => true, 'data' => $st->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($method === 'POST') {
        $storeName = trim((string) ($input['store_name'] ?? ''));
        $phoneNumber = trim((string) ($input['phone_number'] ?? ''));
        $source = trim((string) ($input['source'] ?? 'social_media'));

        if ($storeName === '' || $phoneNumber === '') {
            jsonResponse(['success' => false, 'error' => 'اسم المتجر ورقم الهاتف مطلوبان.'], 400);
        }
        if (!in_array($source, ['social_media', 'field_visit', 'other'], true)) {
            $source = 'other';
        }

        $assignedTo = $user['id'];
        if ($user['role'] === 'admin' && isset($input['assigned_to_id'])) {
            $cand = (int) $input['assigned_to_id'];
            if ($cand > 0) $assignedTo = $cand;
        }

        $st = $pdo->prepare("
            INSERT INTO leads (store_name, phone_number, source, assigned_to_id)
            VALUES (?, ?, ?, ?)
        ");
        $st->execute([$storeName, $phoneNumber, $source, $assignedTo]);
        jsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($method === 'PATCH') {
        $leadId = (int) ($input['id'] ?? 0);
        if ($leadId <= 0) {
            jsonResponse(['success' => false, 'error' => 'معرف العميل غير صالح.'], 400);
        }

        $ownStmt = $pdo->prepare("SELECT assigned_to_id FROM leads WHERE id = ? LIMIT 1");
        $ownStmt->execute([$leadId]);
        $row = $ownStmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) jsonResponse(['success' => false, 'error' => 'العميل غير موجود.'], 404);
        if ($user['role'] !== 'admin' && (int) $row['assigned_to_id'] !== $user['id']) {
            jsonResponse(['success' => false, 'error' => 'غير مصرح بتعديل هذا السجل.'], 403);
        }

        $allowed = ['contact_status', 'requires_field_visit', 'field_visit_done', 'account_opened'];
        $set = [];
        $vals = [];
        foreach ($allowed as $k) {
            if (!array_key_exists($k, $input)) continue;
            if ($k === 'contact_status') {
                $status = trim((string) $input[$k]);
                if (!in_array($status, ['pending', 'answered', 'no_answer'], true)) {
                    jsonResponse(['success' => false, 'error' => 'حالة التواصل غير صالحة.'], 400);
                }
                $set[] = "$k = ?";
                $vals[] = $status;
            } else {
                $set[] = "$k = ?";
                $vals[] = to_bool_int($input[$k]);
            }
        }
        if (!$set) jsonResponse(['success' => false, 'error' => 'لا يوجد تغيير.'], 400);

        $vals[] = $leadId;
        $sql = "UPDATE leads SET " . implode(', ', $set) . " WHERE id = ?";
        $up = $pdo->prepare($sql);
        $up->execute($vals);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['success' => false, 'error' => 'Method not allowed'], 405);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Lead API internal error'], 500);
}
