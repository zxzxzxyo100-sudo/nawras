<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$userRole = isset($_GET['user_role']) ? trim((string) $_GET['user_role']) : '';
if ($userRole !== 'executive') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'غير مصرّح'], JSON_UNESCAPED_UNICODE);
    exit;
}

$fromParam = isset($_GET['from']) ? trim((string) $_GET['from']) : '';
$toParam = isset($_GET['to']) ? trim((string) $_GET['to']) : '';
$isYmd = static function (string $v): bool {
    return (bool) preg_match('/^\d{4}-\d{2}-\d{2}$/', $v);
};
if (($fromParam !== '' && !$isYmd($fromParam)) || ($toParam !== '' && !$isYmd($toParam))) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'صيغة التاريخ يجب أن تكون YYYY-MM-DD'], JSON_UNESCAPED_UNICODE);
    exit;
}

$tz = new DateTimeZone('Asia/Riyadh');
if ($fromParam === '' && $toParam === '') {
    $today = new DateTimeImmutable('now', $tz);
    $fromDate = $today->modify('first day of this month')->format('Y-m-d');
    $toDate = $today->format('Y-m-d');
} else {
    $fromDate = $fromParam !== '' ? $fromParam : $toParam;
    $toDate = $toParam !== '' ? $toParam : $fromParam;
}
if (strcmp($fromDate, $toDate) > 0) {
    $tmp = $fromDate;
    $fromDate = $toDate;
    $toDate = $tmp;
}
$fromStart = (new DateTimeImmutable($fromDate . ' 00:00:00', $tz))->format('Y-m-d H:i:s');
$toExclusive = (new DateTimeImmutable($toDate . ' 00:00:00', $tz))->modify('+1 day')->format('Y-m-d H:i:s');

$pdo = getDB();
try {
    $pdo->exec("SET time_zone = '+03:00'");
} catch (Throwable $e) {
}

$startedRows = [];
$restoredById = [];

try {
    $stStarted = $pdo->prepare("
        SELECT
            store_id,
            MAX(store_name) AS store_name,
            MIN(created_at) AS started_at,
            MAX(performed_by) AS started_by
        FROM audit_logs
        WHERE new_status = 'restoring'
          AND created_at >= ?
          AND created_at < ?
        GROUP BY store_id
        ORDER BY started_at DESC
    ");
    $stStarted->execute([$fromStart, $toExclusive]);
    $startedRows = $stStarted->fetchAll(PDO::FETCH_ASSOC) ?: [];
} catch (Throwable $e) {
    $startedRows = [];
}

try {
    $stRestored = $pdo->prepare("
        SELECT
            store_id,
            MAX(store_name) AS store_name,
            MIN(created_at) AS restored_at,
            MAX(performed_by) AS restored_by
        FROM audit_logs
        WHERE old_status = 'restoring'
          AND new_status IN ('recovered', 'restored')
          AND created_at >= ?
          AND created_at < ?
        GROUP BY store_id
    ");
    $stRestored->execute([$fromStart, $toExclusive]);
    $restoredRows = $stRestored->fetchAll(PDO::FETCH_ASSOC) ?: [];
    foreach ($restoredRows as $r) {
        $sid = (int) ($r['store_id'] ?? 0);
        if ($sid <= 0) {
            continue;
        }
        $restoredById[$sid] = $r;
    }
} catch (Throwable $e) {
    $restoredById = [];
}

$rows = [];
$startedCount = 0;
$restoredCount = 0;
foreach ($startedRows as $s) {
    $sid = (int) ($s['store_id'] ?? 0);
    if ($sid <= 0) {
        continue;
    }
    $startedCount++;
    $rest = $restoredById[$sid] ?? null;
    $isRestored = is_array($rest);
    if ($isRestored) {
        $restoredCount++;
    }
    $rows[] = [
        'store_id' => $sid,
        'store_name' => (string) ($s['store_name'] ?? ('#' . $sid)),
        'started_at' => (string) ($s['started_at'] ?? ''),
        'started_by' => (string) ($s['started_by'] ?? ''),
        'restored' => $isRestored,
        'restored_at' => $isRestored ? (string) ($rest['restored_at'] ?? '') : '',
        'restored_by' => $isRestored ? (string) ($rest['restored_by'] ?? '') : '',
    ];
}

$ratePct = $startedCount > 0 ? round(($restoredCount / $startedCount) * 100, 1) : 0.0;

echo json_encode([
    'success' => true,
    'from' => $fromDate,
    'to' => $toDate,
    'started_count' => $startedCount,
    'restored_count' => $restoredCount,
    'recovery_rate_pct' => $ratePct,
    'rows' => $rows,
    'note_ar' => 'النسبة = المتاجر المستعادة خلال الفترة / المتاجر التي بدأت الاستعادة خلال الفترة نفسها.',
], JSON_UNESCAPED_UNICODE);
