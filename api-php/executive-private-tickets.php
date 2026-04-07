<?php
/**
 * تذاكر خاصة — مهام يعيّنها المدير التنفيذي لموظف محدد (إجبارية).
 */
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

$pdo = getDB();

function ensure_executive_private_tickets_table(PDO $pdo): void
{
    $pdo->exec("CREATE TABLE IF NOT EXISTS executive_private_tickets (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(500) NOT NULL,
        body TEXT NOT NULL,
        assignee_username VARCHAR(100) NOT NULL,
        created_by_username VARCHAR(100) NOT NULL,
        is_mandatory TINYINT(1) NOT NULL DEFAULT 1,
        status ENUM('open','done') NOT NULL DEFAULT 'open',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL DEFAULT NULL,
        INDEX idx_assignee_status (assignee_username, status),
        INDEX idx_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

ensure_executive_private_tickets_table($pdo);

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

$userRole = trim((string) ($input['user_role'] ?? $_GET['user_role'] ?? ''));
$username = trim((string) ($input['username'] ?? $_GET['username'] ?? ''));

function require_user(): void
{
    global $username;
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم مطلوب'], 400);
    }
}

if ($action === 'list') {
    require_user();
    if ($userRole === 'executive') {
        $stmt = $pdo->query(
            "SELECT t.*, u.fullname AS assignee_fullname
             FROM executive_private_tickets t
             LEFT JOIN users u ON u.username = t.assignee_username
             ORDER BY (t.status = 'open') DESC, t.created_at DESC
             LIMIT 500"
        );
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        jsonResponse(['success' => true, 'tickets' => $rows]);
    }
    $stmt = $pdo->prepare(
        "SELECT t.*, u.fullname AS assignee_fullname
         FROM executive_private_tickets t
         LEFT JOIN users u ON u.username = t.assignee_username
         WHERE t.assignee_username = ?
         ORDER BY (t.status = 'open') DESC, t.created_at DESC
         LIMIT 200"
    );
    $stmt->execute([$username]);
    jsonResponse(['success' => true, 'tickets' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

if ($action === 'create') {
    if ($userRole !== 'executive') {
        jsonResponse(['success' => false, 'error' => 'غير مصرّح — المدير التنفيذي فقط.'], 403);
    }
    require_user();
    $title = trim((string) ($input['title'] ?? ''));
    $body = trim((string) ($input['body'] ?? ''));
    $assignee = trim((string) ($input['assignee_username'] ?? ''));
    $mandatory = isset($input['is_mandatory']) ? (int) (bool) $input['is_mandatory'] : 1;
    if ($title === '' || $body === '' || $assignee === '') {
        jsonResponse(['success' => false, 'error' => 'العنوان والنص والموظف المكلّف مطلوبة.'], 400);
    }
    $chk = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    $chk->execute([$assignee]);
    if (!$chk->fetch()) {
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم غير موجود.'], 400);
    }
    $ins = $pdo->prepare(
        'INSERT INTO executive_private_tickets (title, body, assignee_username, created_by_username, is_mandatory, status)
         VALUES (?, ?, ?, ?, ?, \'open\')'
    );
    $ins->execute([$title, $body, $assignee, $username, $mandatory]);
    jsonResponse(['success' => true, 'id' => (int) $pdo->lastInsertId()]);
}

if ($action === 'complete') {
    require_user();
    $id = (int) ($input['id'] ?? 0);
    if ($id <= 0) {
        jsonResponse(['success' => false, 'error' => 'معرّف التذكرة غير صالح.'], 400);
    }
    $stmt = $pdo->prepare('SELECT id, assignee_username, status FROM executive_private_tickets WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        jsonResponse(['success' => false, 'error' => 'التذكرة غير موجودة.'], 404);
    }
    if ($row['status'] === 'done') {
        jsonResponse(['success' => true, 'already' => true]);
    }
    if ($userRole !== 'executive' && $row['assignee_username'] !== $username) {
        jsonResponse(['success' => false, 'error' => 'غير مصرّح — هذه التذكرة ليست لك.'], 403);
    }
    $pdo->prepare(
        "UPDATE executive_private_tickets SET status = 'done', completed_at = NOW() WHERE id = ?"
    )->execute([$id]);
    jsonResponse(['success' => true]);
}

jsonResponse(['success' => false, 'error' => 'إجراء غير معروف'], 400);
