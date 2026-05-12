<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-resume-lib.php';

nawras_configure_session_cookie();
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$pdo = getDB();
nawras_apply_session_resume($pdo, nawras_read_resume_token_from_request());

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Nawras-Resume');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

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

    try { $pdo->exec("ALTER TABLE leads ADD COLUMN media_screenshot VARCHAR(500) NULL DEFAULT NULL"); } catch (Throwable $e) {}
    try { $pdo->exec("ALTER TABLE leads ADD COLUMN website_or_location VARCHAR(500) NULL DEFAULT NULL"); } catch (Throwable $e) {}

    $uploadDir = __DIR__ . '/uploads/leads/';
    if (!is_dir($uploadDir)) {
        @mkdir($uploadDir, 0755, true);
    }

    $done = true;
}

function leads_upload_dir(): string {
    return __DIR__ . '/uploads/leads/';
}

function leads_screenshot_url(string $path): string {
    if ($path === '') return '';
    return '/api-php/' . ltrim($path, '/');
}

function current_user_from_session() {
    $u = $_SESSION['nawras_user'] ?? null;
    if (!is_array($u)) return null;
    $id = isset($u['id']) ? (int) $u['id'] : 0;
    $role = strtolower(trim((string) ($u['role'] ?? '')));
    if ($id <= 0 || $role === '') return null;
    return ['id' => $id, 'role' => $role, 'username' => (string) ($u['username'] ?? '')];
}

function leads_can_manage_all_leads(string $role): bool {
    return in_array($role, ['admin', 'executive', 'incubation_manager'], true);
}

function require_leads_access() {
    $u = current_user_from_session();
    if (!$u) {
        jsonResponse(['success' => false, 'error' => 'غير مصرح: الجلسة غير صالحة.'], 401);
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
        $fetch = static function (array $rows): array {
            foreach ($rows as &$r) {
                $r['media_screenshot_url'] = isset($r['media_screenshot']) && $r['media_screenshot'] !== ''
                    ? leads_screenshot_url($r['media_screenshot'])
                    : '';
            }
            unset($r);
            return $rows;
        };
        if (leads_can_manage_all_leads($user['role'])) {
            $st = $pdo->query("SELECT * FROM leads ORDER BY created_at DESC");
            jsonResponse(['success' => true, 'data' => $fetch($st->fetchAll(PDO::FETCH_ASSOC))]);
        }
        $st = $pdo->prepare("SELECT * FROM leads WHERE assigned_to_id = ? ORDER BY created_at DESC");
        $st->execute([$user['id']]);
        jsonResponse(['success' => true, 'data' => $fetch($st->fetchAll(PDO::FETCH_ASSOC))]);
    }

    if ($method === 'POST') {
        // يدعم multipart/form-data (عند رفع صورة) و application/json
        $post = !empty($_POST) ? $_POST : ($input ?? []);
        $storeName   = trim((string) ($post['store_name']   ?? ''));
        $phoneNumber = trim((string) ($post['phone_number'] ?? ''));
        $source      = trim((string) ($post['source']       ?? 'social_media'));
        $websiteOrLocation = trim((string) ($post['website_or_location'] ?? ''));

        if ($storeName === '' || $phoneNumber === '') {
            jsonResponse(['success' => false, 'error' => 'اسم المتجر ورقم الهاتف مطلوبان.'], 400);
        }
        if (!in_array($source, ['social_media', 'field_visit', 'other'], true)) {
            $source = 'other';
        }

        $assignedTo = $user['id'];
        if (leads_can_manage_all_leads($user['role']) && isset($post['assigned_to_id'])) {
            $cand = (int) $post['assigned_to_id'];
            if ($cand > 0) $assignedTo = $cand;
        }

        $screenshotPath = null;
        if (!empty($_FILES['media_screenshot']) && $_FILES['media_screenshot']['error'] === UPLOAD_ERR_OK) {
            $file = $_FILES['media_screenshot'];
            $allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
            if (!in_array($file['type'], $allowedTypes, true)) {
                jsonResponse(['success' => false, 'error' => 'نوع الملف غير مدعوم. استخدم JPG أو PNG أو WEBP.'], 400);
            }
            if ($file['size'] > 5 * 1024 * 1024) {
                jsonResponse(['success' => false, 'error' => 'حجم الصورة يتجاوز 5 ميغابايت.'], 400);
            }
            $ext      = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION)) ?: 'jpg';
            $filename = 'lead_' . time() . '_' . bin2hex(random_bytes(5)) . '.' . $ext;
            $uploadDir = leads_upload_dir();
            if (!is_dir($uploadDir)) {
                @mkdir($uploadDir, 0755, true);
            }
            if (!move_uploaded_file($file['tmp_name'], $uploadDir . $filename)) {
                jsonResponse(['success' => false, 'error' => 'تعذّر حفظ الصورة على السيرفر.'], 500);
            }
            $screenshotPath = 'uploads/leads/' . $filename;
        }

        $st = $pdo->prepare("
            INSERT INTO leads (store_name, phone_number, source, assigned_to_id, media_screenshot, website_or_location)
            VALUES (?, ?, ?, ?, ?, ?)
        ");
        $st->execute([$storeName, $phoneNumber, $source, $assignedTo, $screenshotPath, $websiteOrLocation ?: null]);
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
        if (!leads_can_manage_all_leads($user['role']) && (int) $row['assigned_to_id'] !== $user['id']) {
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
