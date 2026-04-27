<?php
// ============================================================
// سكريبت استعادة مستخدم — استخدام مرة واحدة فقط ثم احذفه
// ============================================================
require_once __DIR__ . '/db.php';

$pdo = getDB();

// بيانات المستخدم المراد استعادته
$username = 'sufian';
$fullname = 'سفيان التليادي';
$password = 'Sufian123';          // كلمة مرور مؤقتة — غيّرها بعد الدخول
$role     = 'inactive_manager';   // مسؤول استعادة

// تحقق إن كان موجوداً
$check = $pdo->prepare("SELECT id FROM users WHERE username = ?");
$check->execute([$username]);

if ($check->fetch()) {
    jsonResponse([
        'success' => false,
        'message' => "المستخدم '$username' موجود مسبقاً",
    ]);
}

// أضف المستخدم
$pdo->prepare("INSERT INTO users (username, fullname, password, role) VALUES (?, ?, ?, ?)")
    ->execute([$username, $fullname, $password, $role]);

jsonResponse([
    'success'  => true,
    'message'  => "✅ تم استعادة المستخدم بنجاح",
    'username' => $username,
    'fullname' => $fullname,
    'role'     => $role,
    'temp_password' => $password,
    'warning'  => '⚠️ احذف هذا الملف من السيرفر فوراً بعد الاستخدام',
]);
