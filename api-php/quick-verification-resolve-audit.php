<?php
/**
 * تسجيل حل مشكلة تدقيق — استبيان اليوم في التحقق السريع، أو أرشفة تنبيه تجميد (للمدير التنفيذي).
 */
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'طريقة غير مسموحة.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents('php://input');
$input = json_decode($raw, true);
if (!is_array($input)) {
    $input = [];
}

$userRole = trim((string) ($input['user_role'] ?? ''));
$allowedRoles = ['executive', 'incubation_manager', 'active_manager', 'inactive_manager'];
if (!in_array($userRole, $allowedRoles, true)) {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح.'], JSON_UNESCAPED_UNICODE);
    exit;
}

$freezeAlertId = (int) ($input['freeze_alert_id'] ?? 0);
$surveyId = (int) ($input['survey_id'] ?? 0);
$needsFreezeId = (int) ($input['needs_freeze_id'] ?? 0);

$idCount = ($freezeAlertId > 0 ? 1 : 0) + ($surveyId > 0 ? 1 : 0) + ($needsFreezeId > 0 ? 1 : 0);
if ($idCount !== 1) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'أرسل نوعاً واحداً فقط (استبيان، تنبيه تجميد، أو طلب يحتاج تجميد).'], JSON_UNESCAPED_UNICODE);
    exit;
}

$resolvedBy = trim((string) ($input['resolved_by'] ?? ''));
$executiveNotes = trim((string) ($input['executive_notes'] ?? ''));

$pdo = getDB();

// ── أرشفة تنبيه تجميد (التنفيذي فقط) ─────────────────────────────
if ($freezeAlertId > 0) {
    if ($userRole !== 'executive') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'أرشفة تنبيهات التجميد للمدير التنفيذي فقط.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS qv_freeze_alerts (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            store_id INT NOT NULL,
            store_name VARCHAR(512) NULL,
            freeze_reason TEXT NOT NULL,
            frozen_by VARCHAR(255) NULL,
            frozen_by_username VARCHAR(100) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created (created_at),
            INDEX idx_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_freeze_resolutions (
            freeze_alert_id INT NOT NULL PRIMARY KEY,
            resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_by VARCHAR(100) NULL DEFAULT NULL,
            executive_notes TEXT NULL DEFAULT NULL,
            INDEX idx_resolved_at (resolved_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        try {
            $pdo->exec('ALTER TABLE quick_verification_freeze_resolutions ADD COLUMN executive_notes TEXT NULL DEFAULT NULL');
        } catch (Throwable $e) {
        }
        $st = $pdo->prepare('SELECT id FROM qv_freeze_alerts WHERE id = ? AND DATE(created_at) = CURDATE() LIMIT 1');
        $st->execute([$freezeAlertId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'تنبيه التجميد غير موجود أو ليس من اليوم.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $ins = $pdo->prepare('
            INSERT INTO quick_verification_freeze_resolutions (freeze_alert_id, resolved_at, resolved_by, executive_notes)
            VALUES (?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE
                resolved_at = VALUES(resolved_at),
                resolved_by = VALUES(resolved_by),
                executive_notes = VALUES(executive_notes)
        ');
        $ins->execute([
            $freezeAlertId,
            $resolvedBy !== '' ? $resolvedBy : null,
            $executiveNotes !== '' ? $executiveNotes : null,
        ]);
        echo json_encode([
            'success' => true,
            'freeze_alert_id' => $freezeAlertId,
            'resolved' => true,
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'تعذّر حفظ الأرشفة.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ── أرشفة طلب «يحتاج تجميد» (التنفيذي فقط) ───────────────────────
if ($needsFreezeId > 0) {
    if ($userRole !== 'executive') {
        http_response_code(403);
        echo json_encode(['success' => false, 'error' => 'أرشفة طلبات «يحتاج تجميد» للمدير التنفيذي فقط.'], JSON_UNESCAPED_UNICODE);
        exit;
    }
    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS qv_needs_freeze_requests (
            id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
            store_id INT NOT NULL,
            store_name VARCHAR(512) NULL,
            reason TEXT NOT NULL,
            source VARCHAR(32) NOT NULL,
            requested_by_username VARCHAR(100) NULL,
            requested_by_fullname VARCHAR(255) NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_created (created_at),
            INDEX idx_store (store_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_needs_freeze_resolutions (
            needs_freeze_id INT NOT NULL PRIMARY KEY,
            resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            resolved_by VARCHAR(100) NULL DEFAULT NULL,
            executive_notes TEXT NULL DEFAULT NULL,
            INDEX idx_resolved_at (resolved_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        try {
            $pdo->exec('ALTER TABLE quick_verification_needs_freeze_resolutions ADD COLUMN executive_notes TEXT NULL DEFAULT NULL');
        } catch (Throwable $e) {
        }
        $st = $pdo->prepare('SELECT id FROM qv_needs_freeze_requests WHERE id = ? AND DATE(created_at) = CURDATE() LIMIT 1');
        $st->execute([$needsFreezeId]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            http_response_code(404);
            echo json_encode(['success' => false, 'error' => 'الطلب غير موجود أو ليس من اليوم.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
        $ins = $pdo->prepare('
            INSERT INTO quick_verification_needs_freeze_resolutions (needs_freeze_id, resolved_at, resolved_by, executive_notes)
            VALUES (?, NOW(), ?, ?)
            ON DUPLICATE KEY UPDATE
                resolved_at = VALUES(resolved_at),
                resolved_by = VALUES(resolved_by),
                executive_notes = VALUES(executive_notes)
        ');
        $ins->execute([
            $needsFreezeId,
            $resolvedBy !== '' ? $resolvedBy : null,
            $executiveNotes !== '' ? $executiveNotes : null,
        ]);
        echo json_encode([
            'success' => true,
            'needs_freeze_id' => $needsFreezeId,
            'resolved' => true,
        ], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'تعذّر حفظ الأرشفة.'], JSON_UNESCAPED_UNICODE);
    }
    exit;
}

// ── استبيان (السلوك السابق) ─────────────────────────────────────
try {
    $pdo->exec("CREATE TABLE IF NOT EXISTS quick_verification_resolutions (
        survey_id INT NOT NULL PRIMARY KEY,
        resolved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        resolved_by VARCHAR(100) NULL DEFAULT NULL,
        executive_notes TEXT NULL DEFAULT NULL,
        INDEX idx_resolved_at (resolved_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر تهيئة التخزين.'], JSON_UNESCAPED_UNICODE);
    exit;
}

try {
    $pdo->exec('ALTER TABLE quick_verification_resolutions ADD COLUMN executive_notes TEXT NULL DEFAULT NULL');
} catch (Throwable $e) {
}

try {
    $st = $pdo->prepare('
        SELECT id, submitted_username, performed_by FROM surveys
        WHERE id = ? AND DATE(created_at) = CURDATE()
        LIMIT 1
    ');
    $st->execute([$surveyId]);
    $surveyRow = $st->fetch(PDO::FETCH_ASSOC);
    if (!$surveyRow) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'الاستبيان غير موجود أو ليس من اليوم.'], JSON_UNESCAPED_UNICODE);
        exit;
    }

    if ($userRole !== 'executive') {
        $uname = trim((string) ($surveyRow['submitted_username'] ?? ''));
        $staffKey = $uname !== '' ? $uname : trim((string) ($surveyRow['performed_by'] ?? ''));
        $rb = trim((string) $resolvedBy);
        if ($staffKey === '' || $rb === '' || strcasecmp($staffKey, $rb) !== 0) {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'لا يمكن حلّ استبيان غير مسند إليك.'], JSON_UNESCAPED_UNICODE);
            exit;
        }
    }

    $ins = $pdo->prepare('
        INSERT INTO quick_verification_resolutions (survey_id, resolved_at, resolved_by, executive_notes)
        VALUES (?, NOW(), ?, ?)
        ON DUPLICATE KEY UPDATE
            resolved_at = VALUES(resolved_at),
            resolved_by = VALUES(resolved_by),
            executive_notes = VALUES(executive_notes)
    ');
    $ins->execute([
        $surveyId,
        $resolvedBy !== '' ? $resolvedBy : null,
        $executiveNotes !== '' ? $executiveNotes : null,
    ]);

    /** دمج وسوم «لم يتصل موظف الاحتضان» مع satisfaction_gap_tags ليُقرأ من get_surveys ومسار المهام */
    $qvMissed = $input['qv_missed_inc_calls'] ?? null;
    if (is_array($qvMissed) && count($qvMissed) > 0) {
        $allowed = [
            'qv_missed_inc_call_1' => true,
            'qv_missed_inc_call_2' => true,
            'qv_missed_inc_call_3' => true,
        ];
        $toAdd = [];
        foreach ($qvMissed as $tag) {
            $t = trim((string) $tag);
            if ($t !== '' && isset($allowed[$t])) {
                $toAdd[] = $t;
            }
        }
        $toAdd = array_values(array_unique($toAdd));
        if (count($toAdd) > 0) {
            try {
                $pdo->exec('ALTER TABLE surveys ADD COLUMN satisfaction_gap_tags JSON NULL DEFAULT NULL');
            } catch (Throwable $e) {
            }
            $stTags = $pdo->prepare('SELECT satisfaction_gap_tags FROM surveys WHERE id = ? LIMIT 1');
            $stTags->execute([$surveyId]);
            $rowT = $stTags->fetch(PDO::FETCH_ASSOC);
            $existing = [];
            if ($rowT && !empty($rowT['satisfaction_gap_tags'])) {
                $dec = json_decode((string) $rowT['satisfaction_gap_tags'], true);
                if (is_array($dec)) {
                    foreach ($dec as $x) {
                        if ($x !== '' && $x !== null) {
                            $existing[] = (string) $x;
                        }
                    }
                }
            }
            $merged = array_values(array_unique(array_merge($existing, $toAdd)));
            $up = $pdo->prepare('UPDATE surveys SET satisfaction_gap_tags = ? WHERE id = ?');
            $up->execute([json_encode($merged, JSON_UNESCAPED_UNICODE), $surveyId]);
        }
    }

    echo json_encode([
        'success' => true,
        'survey_id' => $surveyId,
        'resolved' => true,
    ], JSON_UNESCAPED_UNICODE);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'تعذّر حفظ الحل.'], JSON_UNESCAPED_UNICODE);
}
