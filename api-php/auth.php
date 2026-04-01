<?php
// منع التخزين المؤقت
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'فشل الاتصال بقاعدة البيانات: ' . $e->getMessage()], 500);
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

if ($action === 'login') {
    try {
        $stmt = $pdo->prepare("SELECT id, username, fullname, role FROM users WHERE username = ? AND password = ?");
        $stmt->execute([$input['username'] ?? '', $input['password'] ?? '']);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($user) jsonResponse(['success' => true, 'user' => $user]);
        else jsonResponse(['success' => false, 'error' => 'بيانات الدخول غير صحيحة'], 401);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'خطأ في قاعدة البيانات: ' . $e->getMessage()], 500);
    }
}

elseif ($action === 'list_users') {
    $stmt = $pdo->query("SELECT id, username, fullname, role, created_at FROM users ORDER BY id");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

elseif ($action === 'add_user') {
    $stmt = $pdo->prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)");
    try {
        $stmt->execute([$input['username'], $input['fullname'], $input['password'], $input['role']]);
        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم موجود مسبقاً'], 400);
    }
}

elseif ($action === 'update_user') {
    if (!empty($input['password'])) {
        $stmt = $pdo->prepare("UPDATE users SET username=?, fullname=?, password=?, role=? WHERE id=?");
        $stmt->execute([$input['username'], $input['fullname'], $input['password'], $input['role'], $input['id']]);
    } else {
        $stmt = $pdo->prepare("UPDATE users SET username=?, fullname=?, role=? WHERE id=?");
        $stmt->execute([$input['username'], $input['fullname'], $input['role'], $input['id']]);
    }
    jsonResponse(['success' => true]);
}

elseif ($action === 'delete_user') {
    $pdo->prepare("DELETE FROM users WHERE id = ? AND id != 1")->execute([$input['id']]);
    jsonResponse(['success' => true]);
}

else { jsonResponse(['error' => 'Unknown action'], 400); }
