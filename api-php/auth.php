<?php
header('Cache-Control: no-cache, no-store, must-revalidate');

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/session-resume-lib.php';
require_once __DIR__ . '/workflow-queue-lib.php';
nawras_configure_session_cookie();
if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

try {
    $pdo = getDB();
} catch (Exception $e) {
    jsonResponse(['success' => false, 'error' => 'Database connection failed: ' . $e->getMessage()], 500);
}

/** يضيف عمود email إلى users مرة واحدة فقط (عبر ملف علامة) — تسجيل الدخول أصبح بالبريد بدل اسم المستخدم */
function ensure_users_email_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    if (nawras_schema_marker_done('users_email')) {
        $done = true;
        return;
    }
    try {
        $pdo->exec('ALTER TABLE users ADD COLUMN email VARCHAR(190) NULL DEFAULT NULL AFTER username');
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE users ADD UNIQUE INDEX idx_users_email (email)');
    } catch (Throwable $e) {
    }
    nawras_schema_marker_set('users_email');
    $done = true;
}
ensure_users_email_schema($pdo);

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

if ($action === 'login') {
    try {
        $email    = strtolower(trim((string) ($input['email'] ?? '')));
        $password = (string) ($input['password'] ?? '');

        if ($email === '') {
            jsonResponse(['success' => false, 'error' => 'البريد الإلكتروني مطلوب'], 400);
        }

        /**
         * أثناء فترة انتقال الحسابات القديمة (التي لم يُضَف لها بريد بعد عبر
         * صفحة إدارة المستخدمين): إن لم يوجد تطابق بالبريد، يُقبل نفس الحقل
         * كاسم مستخدم أيضاً — حتى لا يُقفَل أي حساب قبل أن يُستكمَل تعيين
         * البريد لجميع الحسابات. لا يظهر أي حقل "اسم مستخدم" بالواجهة —
         * هذا فقط شبكة أمان خلفية تُزال لاحقاً بعد اكتمال الترحيل.
         */
        $stmt = $pdo->prepare('SELECT id, username, fullname, role, password FROM users WHERE LOWER(email) = ? OR LOWER(username) = ? LIMIT 1');
        $stmt->execute([$email, $email]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$row) {
            jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
        }

        $stored = $row['password'] ?? '';
        $ok = false;
        if (is_string($stored) && strlen($stored) >= 60 && strncmp($stored, '$2', 2) === 0) {
            $ok = password_verify($password, $stored);
        } else {
            $ok = hash_equals((string) $stored, $password);
        }

        if (!$ok) {
            jsonResponse(['success' => false, 'error' => 'Invalid credentials'], 401);
        }

        unset($row['password']);
        $_SESSION['nawras_user'] = [
            'id' => (int) ($row['id'] ?? 0),
            'username' => (string) ($row['username'] ?? ''),
            'fullname' => (string) ($row['fullname'] ?? ''),
            'role' => (string) ($row['role'] ?? ''),
        ];
        $resume = nawras_build_session_resume_token($row);
        if ($resume !== '') {
            nawras_set_resume_cookie($resume);
        }
        jsonResponse([
            'success'        => true,
            'user'           => $row,
            'session_resume' => $resume,
        ]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

elseif ($action === 'issue_resume_token') {
    $u = $_SESSION['nawras_user'] ?? null;
    if (!is_array($u) || empty($u['id'])) {
        jsonResponse(['success' => false, 'error' => 'الجلسة غير صالحة'], 401);
    }
    try {
        $stmt = $pdo->prepare('SELECT id, username, fullname, role FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([(int) $u['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            jsonResponse(['success' => false, 'error' => 'المستخدم غير موجود'], 401);
        }
        $resume = nawras_build_session_resume_token($row);
        if ($resume !== '') {
            nawras_set_resume_cookie($resume);
        }
        jsonResponse(['success' => true, 'session_resume' => $resume]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'Database error: ' . $e->getMessage()], 500);
    }
}

elseif ($action === 'logout') {
    nawras_clear_resume_cookie();
    if (session_status() === PHP_SESSION_ACTIVE) {
        $_SESSION = [];
        $p = session_get_cookie_params();
        $secure = !empty($p['secure']);
        if (ini_get('session.use_cookies') && session_name()) {
            setcookie(session_name(), '', time() - 42000, (string) ($p['path'] ?? '/'), (string) ($p['domain'] ?? ''), $secure, (bool) ($p['httponly'] ?? true));
        }
        session_destroy();
    }
    jsonResponse(['success' => true]);
}

elseif ($action === 'list_users') {
    $stmt = $pdo->query("SELECT id, username, email, fullname, role, created_at FROM users ORDER BY id");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

elseif ($action === 'add_user') {
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'يجب إدخال بريد إلكتروني صالح'], 400);
    }
    $stmt = $pdo->prepare("INSERT INTO users (username, email, fullname, password, role) VALUES (?, ?, ?, ?, ?)");
    try {
        $stmt->execute([$input['username'], $email, $input['fullname'], $input['password'], $input['role']]);
        jsonResponse(['success' => true, 'id' => $pdo->lastInsertId()]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'idx_users_email') !== false) {
            jsonResponse(['success' => false, 'error' => 'البريد الإلكتروني مستخدم بالفعل'], 400);
        }
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم موجود بالفعل'], 400);
    }
}

elseif ($action === 'update_user') {
    $email = strtolower(trim((string) ($input['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['success' => false, 'error' => 'يجب إدخال بريد إلكتروني صالح'], 400);
    }
    try {
        if (!empty($input['password'])) {
            $stmt = $pdo->prepare("UPDATE users SET username=?, email=?, fullname=?, password=?, role=? WHERE id=?");
            $stmt->execute([$input['username'], $email, $input['fullname'], $input['password'], $input['role'], $input['id']]);
        } else {
            $stmt = $pdo->prepare("UPDATE users SET username=?, email=?, fullname=?, role=? WHERE id=?");
            $stmt->execute([$input['username'], $email, $input['fullname'], $input['role'], $input['id']]);
        }
        jsonResponse(['success' => true]);
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'idx_users_email') !== false) {
            jsonResponse(['success' => false, 'error' => 'البريد الإلكتروني مستخدم بالفعل'], 400);
        }
        jsonResponse(['success' => false, 'error' => 'اسم المستخدم موجود بالفعل'], 400);
    }
}

elseif ($action === 'delete_user') {
    $pdo->prepare("DELETE FROM users WHERE id = ? AND id != 1")->execute([$input['id']]);
    jsonResponse(['success' => true]);
}

/**
 * تغيير كلمة مرور المستخدم الحالي (وليس أي مستخدم آخر) — يعتمد على الجلسة فقط
 * (session id)، لا على id يُرسله الطرف الأمامي، ويتحقق من كلمة المرور الحالية
 * قبل السماح بالتغيير. يخزّن كلمة المرور الجديدة مُشفّرة (password_hash) —
 * على عكس add_user/update_user اللتين تخزّنان القيمة كما وصلت (نص صريح تاريخياً).
 */
elseif ($action === 'change_password') {
    $sessUser = $_SESSION['nawras_user'] ?? null;
    if (!is_array($sessUser) || empty($sessUser['id'])) {
        jsonResponse(['success' => false, 'error' => 'يجب تسجيل الدخول'], 401);
    }
    $current = (string) ($input['current_password'] ?? '');
    $new     = (string) ($input['new_password'] ?? '');
    if ($new === '' || strlen($new) < 6) {
        jsonResponse(['success' => false, 'error' => 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'], 400);
    }
    try {
        $stmt = $pdo->prepare('SELECT password FROM users WHERE id = ? LIMIT 1');
        $stmt->execute([(int) $sessUser['id']]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            jsonResponse(['success' => false, 'error' => 'المستخدم غير موجود'], 404);
        }
        $stored = (string) ($row['password'] ?? '');
        if (strlen($stored) >= 60 && strncmp($stored, '$2', 2) === 0) {
            $ok = password_verify($current, $stored);
        } else {
            $ok = hash_equals($stored, $current);
        }
        if (!$ok) {
            jsonResponse(['success' => false, 'error' => 'كلمة المرور الحالية غير صحيحة'], 401);
        }
        $hashed = password_hash($new, PASSWORD_DEFAULT);
        $pdo->prepare('UPDATE users SET password = ? WHERE id = ?')->execute([$hashed, (int) $sessUser['id']]);
        jsonResponse(['success' => true]);
    } catch (Exception $e) {
        jsonResponse(['success' => false, 'error' => 'خطأ بقاعدة البيانات: ' . $e->getMessage()], 500);
    }
}

else {
    jsonResponse(['error' => 'Unknown action'], 400);
}