<?php
/**
 * مهام يومية — إخفاء «تم» حتى نهاية اليوم (persist عبر MySQL)
 */
require_once __DIR__ . '/db.php';

$pdo = getDB();

function ensure_daily_task_dismissals_table(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_task_dismissals (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL,
        task_key VARCHAR(160) NOT NULL,
        dismissed_on DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_user_task_day (username, task_key, dismissed_on),
        INDEX idx_user_day (username, dismissed_on)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

ensure_daily_task_dismissals_table($pdo);

if ($action === 'mark_done') {
    $username = trim((string) ($input['username'] ?? ''));
    $taskKey = trim((string) ($input['task_key'] ?? ''));
    if ($username === '' || $taskKey === '') {
        jsonResponse(['success' => false, 'error' => 'بيانات ناقصة'], 400);
    }
    $today = date('Y-m-d');
    $stmt = $pdo->prepare(
        'INSERT INTO daily_task_dismissals (username, task_key, dismissed_on) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE task_key = VALUES(task_key)'
    );
    $stmt->execute([$username, $taskKey, $today]);
    jsonResponse(['success' => true]);
}

if ($action === 'dismissals') {
    $username = trim((string) ($_GET['username'] ?? ''));
    $on = trim((string) ($_GET['date'] ?? date('Y-m-d')));
    if ($username === '') {
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم مطلوب'], 400);
    }
    $stmt = $pdo->prepare('SELECT task_key FROM daily_task_dismissals WHERE username = ? AND dismissed_on = ?');
    $stmt->execute([$username, $on]);
    $keys = array_column($stmt->fetchAll(PDO::FETCH_ASSOC), 'task_key');
    jsonResponse(['success' => true, 'keys' => $keys]);
}

jsonResponse(['success' => false, 'error' => 'إجراء غير معروف'], 400);
