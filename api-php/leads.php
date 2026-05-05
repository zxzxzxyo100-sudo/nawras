<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$pdo = getDB();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

function ensure_leads_table(PDO $pdo) {
    static $done = false;
    if ($done) return;

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS leads (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
            store_name VARCHAR(255) NOT NULL,
            phone_number VARCHAR(64) NOT NULL,
            source ENUM('social_media','field_visit','referral') NOT NULL DEFAULT 'social_media',
            contact_status ENUM('pending','answered','no_answer') NOT NULL DEFAULT 'pending',
            requires_field_visit TINYINT(1) NOT NULL DEFAULT 0,
            field_visit_done TINYINT(1) NOT NULL DEFAULT 0,
            account_opened TINYINT(1) NOT NULL DEFAULT 0,
            assigned_to INT NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_leads_assigned_to (assigned_to),
            INDEX idx_leads_created_at (created_at),
            INDEX idx_leads_status (contact_status, account_opened)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");

    $done = true;
}

function normalize_bool($v) {
    if (is_bool($v)) return $v ? 1 : 0;
    if (is_numeric($v)) return ((int) $v) ? 1 : 0;
    $s = strtolower(trim((string) $v));
    return in_array($s, ['1', 'true', 'yes', 'on'], true) ? 1 : 0;
}

try {
    ensure_leads_table($pdo);

    if ($action === 'list') {
        $assignedTo = (int) ($_GET['assigned_to'] ?? 0);
        if ($assignedTo > 0) {
            $st = $pdo->prepare("SELECT * FROM leads WHERE assigned_to = ? ORDER BY created_at DESC");
            $st->execute([$assignedTo]);
        } else {
            $st = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC");
        }
        jsonResponse(['success' => true, 'data' => $st->fetchAll(PDO::FETCH_ASSOC)]);
    }

    if ($action === 'create') {
        $storeName = trim((string) ($input['store_name'] ?? ''));
        $phoneNumber = trim((string) ($input['phone_number'] ?? ''));
        $source = trim((string) ($input['source'] ?? 'social_media'));
        $assignedTo = (int) ($input['assigned_to'] ?? 0);

        if ($storeName === '' || $phoneNumber === '') {
            jsonResponse(['success' => false, 'error' => 'اسم المتجر ورقم الهاتف مطلوبان.'], 400);
        }
        if (!in_array($source, ['social_media', 'field_visit', 'referral'], true)) {
            $source = 'social_media';
        }
        if ($assignedTo <= 0) {
            jsonResponse(['success' => false, 'error' => 'الموظف المكلّف غير صالح.'], 400);
        }

        $st = $pdo->prepare("
            INSERT INTO leads (store_name, phone_number, source, assigned_to)
            VALUES (?, ?, ?, ?)
        ");
        $st->execute([$storeName, $phoneNumber, $source, $assignedTo]);
        jsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId()]);
    }

    if ($action === 'update') {
        $leadId = (int) ($input['id'] ?? 0);
        if ($leadId <= 0) {
            jsonResponse(['success' => false, 'error' => 'معرّف العميل المحتمل غير صالح.'], 400);
        }

        $allowed = ['contact_status', 'requires_field_visit', 'field_visit_done', 'account_opened'];
        $sets = [];
        $vals = [];

        foreach ($allowed as $field) {
            if (!array_key_exists($field, $input)) continue;
            $val = $input[$field];
            if ($field === 'contact_status') {
                $v = trim((string) $val);
                if (!in_array($v, ['pending', 'answered', 'no_answer'], true)) {
                    jsonResponse(['success' => false, 'error' => 'حالة التواصل غير صالحة.'], 400);
                }
                $sets[] = "$field = ?";
                $vals[] = $v;
                continue;
            }
            $sets[] = "$field = ?";
            $vals[] = normalize_bool($val);
        }

        if (!$sets) {
            jsonResponse(['success' => false, 'error' => 'لا توجد حقول محدثة.'], 400);
        }

        $vals[] = $leadId;
        $sql = "UPDATE leads SET " . implode(', ', $sets) . " WHERE id = ?";
        $st = $pdo->prepare($sql);
        $st->execute($vals);
        jsonResponse(['success' => true]);
    }

    jsonResponse(['success' => false, 'error' => 'Unknown action'], 400);
} catch (Throwable $e) {
    jsonResponse(['success' => false, 'error' => 'Lead API failed'], 500);
}
