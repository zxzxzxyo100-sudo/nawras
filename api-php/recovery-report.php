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
    /**
     * تمت الاستعادة خلال الفترة — مصدران مدمجان:
     *  1) audit_logs: أي انتقال إلى 'restored'/'recovered' (بغض النظر عن old_status).
     *  2) store_states: المتاجر الموجودة حالياً بحالة 'restored'/'recovered' وتاريخ restore_date ضمن الفترة
     *     (يلتقط الاستعادات الآلية بالاكتمال الشحني التي قد لا تكتب في audit_logs).
     */
    $stRestored = $pdo->prepare("
        SELECT
            store_id,
            MAX(store_name) AS store_name,
            MIN(created_at) AS restored_at,
            MAX(performed_by) AS restored_by
        FROM audit_logs
        WHERE new_status IN ('recovered', 'restored')
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

try {
    /**
     * كل المتاجر بالحالة الحالية 'restored'/'recovered' — بدون قيد تاريخي.
     * «تمت الاستعادة» في الواجهة هو عدّاد الحالة الحالية (مطابق لصفحة «تمت الاستعادة»)
     * بينما «بدأت الاستعادة» يبقى مقيَّداً بالفترة لقياس نشاط الموظفين فيها.
     */
    $stState = $pdo->prepare("
        SELECT store_id, store_name, restore_date, updated_at, updated_by, category
        FROM store_states
        WHERE category IN ('restored', 'recovered', 'restoring')
    ");
    $stState->execute();
    $stateRows = $stState->fetchAll(PDO::FETCH_ASSOC) ?: [];

    /** قراءة كاش الشحنات للتقاط «restoring» بشحنة بعد restore_date (يطابق منطق الواجهة) */
    $liteShipments = [];
    $lite = __DIR__ . '/cache/stores_search_lite.json';
    if (is_readable($lite)) {
        $raw = file_get_contents($lite);
        $list = $raw !== false ? json_decode($raw, true) : null;
        if (is_array($list)) {
            foreach ($list as $row) {
                if (!is_array($row) || !isset($row['id'])) {
                    continue;
                }
                $sid = (int) $row['id'];
                if ($sid <= 0) {
                    continue;
                }
                $liteShipments[$sid] = (string) ($row['last_shipment_date'] ?? '');
            }
        }
    }

    foreach ($stateRows as $r) {
        $sid = (int) ($r['store_id'] ?? 0);
        if ($sid <= 0 || isset($restoredById[$sid])) {
            continue;
        }
        $cat = (string) ($r['category'] ?? '');
        $restoreDate = (string) ($r['restore_date'] ?? '');

        if ($cat === 'restoring') {
            /** restoring لا يُحتسب إلا عندما تكون آخر شحنة بعد تاريخ بدء الاستعادة (اكتمال شحني) */
            $ship = $liteShipments[$sid] ?? '';
            if ($ship === '' || $ship === 'لا يوجد' || $restoreDate === '') {
                continue;
            }
            if (strcmp($ship, $restoreDate) < 0) {
                continue;
            }
        }

        $restoredById[$sid] = [
            'store_id' => $sid,
            'store_name' => (string) ($r['store_name'] ?? ''),
            'restored_at' => $restoreDate !== '' ? $restoreDate : (string) ($r['updated_at'] ?? ''),
            'restored_by' => (string) ($r['updated_by'] ?? ''),
        ];
    }
} catch (Throwable $e) {
    /* store_states قد لا يحوي بعض الأعمدة في النسخ القديمة — تجاهل بهدوء */
}

/** يضاف للسجل كل متجر تمت استعادته في الفترة — حتى لو لم تبدأ استعادته في نفس الفترة */
$startedById = [];
foreach ($startedRows as $s) {
    $sid = (int) ($s['store_id'] ?? 0);
    if ($sid <= 0) {
        continue;
    }
    $startedById[$sid] = $s;
}
$allSids = array_unique(array_merge(array_keys($startedById), array_keys($restoredById)));

$rows = [];
$startedCount = count($startedById);
$restoredCount = count($restoredById);
foreach ($allSids as $sid) {
    $sid = (int) $sid;
    if ($sid <= 0) {
        continue;
    }
    $start = $startedById[$sid] ?? null;
    $rest = $restoredById[$sid] ?? null;
    $name = '';
    if (is_array($start) && !empty($start['store_name'])) {
        $name = (string) $start['store_name'];
    } elseif (is_array($rest) && !empty($rest['store_name'])) {
        $name = (string) $rest['store_name'];
    }
    if ($name === '') {
        $name = '#' . $sid;
    }
    $rows[] = [
        'store_id' => $sid,
        'store_name' => $name,
        'started_at' => is_array($start) ? (string) ($start['started_at'] ?? '') : '',
        'started_by' => is_array($start) ? (string) ($start['started_by'] ?? '') : '',
        'restored' => is_array($rest),
        'restored_at' => is_array($rest) ? (string) ($rest['restored_at'] ?? '') : '',
        'restored_by' => is_array($rest) ? (string) ($rest['restored_by'] ?? '') : '',
    ];
}

usort($rows, function ($a, $b) {
    $ar = (string) ($a['restored_at'] ?: $a['started_at']);
    $br = (string) ($b['restored_at'] ?: $b['started_at']);
    return strcmp($br, $ar);
});

/** النسبة = تمت / بدأت (إذا كانت بدأت > 0) — كما السابق */
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
