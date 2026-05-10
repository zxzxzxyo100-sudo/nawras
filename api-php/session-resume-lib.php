<?php
declare(strict_types=1);

/** إعدادات cookie الجلسة — قبل session_start (مسار / وSameSite=Lax لنفس النطاق). */
function nawras_configure_session_cookie(): void {
    static $done = false;
    if ($done) {
        return;
    }
    $done = true;
    if (session_status() !== PHP_SESSION_NONE) {
        return;
    }
    $secure = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $params = session_get_cookie_params();
    $life = (int) ($params['lifetime'] ?? 0);
    if ($life < 86400) {
        $life = 86400 * 14;
    }
    if (PHP_VERSION_ID >= 70300) {
        session_set_cookie_params([
            'lifetime' => $life,
            'path'     => '/',
            'domain'   => '',
            'secure'   => $secure,
            'httponly' => true,
            'samesite' => 'Lax',
        ]);
    } else {
        session_set_cookie_params($life, '/', '', $secure, true);
    }
}

/**
 * استئناف جلسة PHP للـ API عندما تكون الواجهة ما زالت «مسجّلة» عبر localStorage
 * بينما انتهت أو فُقدت cookie الجلسة (شائع مع SPA + leads_api).
 */
function nawras_resume_hmac_key(): string {
    static $k = null;
    if ($k !== null) {
        return $k;
    }
    $env = getenv('NAWRAS_SESSION_RESUME_SECRET');
    if (is_string($env) && strlen($env) >= 16) {
        $k = $env;

        return $k;
    }
    if (!defined('DB_NAME') || !defined('DB_USER')) {
        $k = 'nawras-fallback-resume-key';

        return $k;
    }
    $k = hash('sha256', (string) DB_NAME . '|' . (string) DB_USER . '|nawras-session-resume', true);

    return $k;
}

/**
 * @param array{id:int|string,role:string,username?:string,fullname?:string} $row
 */
function nawras_build_session_resume_token(array $row, int $ttlSeconds = 1209600): string {
    $id = (int) ($row['id'] ?? 0);
    $role = strtolower(trim((string) ($row['role'] ?? '')));
    if ($id <= 0 || $role === '') {
        return '';
    }
    $exp = time() + max(3600, $ttlSeconds);
    $payload = $id . '|' . $exp . '|' . $role;
    $sig = hash_hmac('sha256', $payload, nawras_resume_hmac_key());

    return base64_encode($payload . '|' . $sig);
}

/**
 * يملأ $_SESSION['nawras_user'] إن وُجد ترويسة صالحة والجلسة فارغة.
 */
function nawras_apply_session_resume(PDO $pdo, string $headerValue): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        return;
    }
    $u = $_SESSION['nawras_user'] ?? null;
    if (is_array($u) && !empty($u['id'])) {
        return;
    }
    $h = trim($headerValue);
    if ($h === '') {
        return;
    }
    $raw = base64_decode($h, true);
    if ($raw === false || $raw === '') {
        return;
    }
    $parts = explode('|', $raw, 4);
    if (count($parts) !== 4) {
        return;
    }
    [$idS, $expS, $roleTok, $sig] = $parts;
    $id = (int) $idS;
    $exp = (int) $expS;
    if ($id <= 0 || $exp < time()) {
        return;
    }
    $payload = $id . '|' . $exp . '|' . $roleTok;
    $expected = hash_hmac('sha256', $payload, nawras_resume_hmac_key());
    if (!hash_equals($expected, $sig)) {
        return;
    }
    $st = $pdo->prepare('SELECT id, username, fullname, role FROM users WHERE id = ? LIMIT 1');
    $st->execute([$id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        return;
    }
    $dbRole = strtolower(trim((string) ($row['role'] ?? '')));
    if ($dbRole !== strtolower(trim($roleTok))) {
        return;
    }
    $_SESSION['nawras_user'] = [
        'id'       => (int) $row['id'],
        'username' => (string) ($row['username'] ?? ''),
        'fullname' => (string) ($row['fullname'] ?? ''),
        'role'     => (string) ($row['role'] ?? ''),
    ];
}

/**
 * قراءة توكن الاستئناف من الترويسات (بعض الاستضافات لا تمرّر X-Custom-* وتمرّر Authorization فقط).
 */
function nawras_read_resume_token_from_request(): string {
    $h = trim((string) ($_SERVER['HTTP_X_NAWRAS_RESUME'] ?? ''));
    if ($h !== '') {
        return $h;
    }
    $auth = '';
    if (function_exists('apache_request_headers')) {
        foreach (apache_request_headers() as $k => $v) {
            if (strcasecmp((string) $k, 'Authorization') === 0) {
                $auth = trim((string) $v);
                break;
            }
        }
    }
    if ($auth === '' && isset($_SERVER['HTTP_AUTHORIZATION'])) {
        $auth = trim((string) $_SERVER['HTTP_AUTHORIZATION']);
    }
    if ($auth === '' && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
        $auth = trim((string) $_SERVER['REDIRECT_HTTP_AUTHORIZATION']);
    }
    if ($auth !== '' && preg_match('/Bearer\s+(\S+)/i', $auth, $m)) {
        return trim($m[1]);
    }

    return '';
}
