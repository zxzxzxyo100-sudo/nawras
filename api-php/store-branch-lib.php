<?php
/**
 * مزامنة "الفرع المسؤول" / "سجّله" لكل متجر إلى جدول store_branch_map،
 * بأفضل جهد فقط — لا تؤثر أبداً على استجابة الجهة المستدعية (قائمة المتاجر) عند فشلها.
 * الغرض: تمكين تقارير قاعدة البيانات (رضا، استعادة، مكالمات احتضان...) من التصفية حسب الفرع
 * رغم أنها لا تملك سوى store_id بدون بيانات المتجر الكاملة.
 */

function nawras_branch_sync_pdo() {
    try {
        return new PDO(
            'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_TIMEOUT => 3]
        );
    } catch (Throwable $e) {
        return null;
    }
}

/**
 * @param array<int|string, array> $allStores مصفوفة المتاجر الخام من fetchAll() — id => row
 */
function nawras_sync_branch_map(array $allStores): void {
    $throttleFile = __DIR__ . '/cache/.branch_sync_at';
    $now = time();
    if (is_file($throttleFile)) {
        $last = (int) @file_get_contents($throttleFile);
        if ($now - $last < 300) return; // كحد أقصى كل 5 دقائق
    }
    // نسجّل وقت المحاولة فوراً لمنع طلبات متزامنة من تكرار نفس العمل الثقيل
    @file_put_contents($throttleFile, (string) $now);

    $rows = [];
    foreach ($allStores as $id => $s) {
        $sid = (int) $id;
        if ($sid <= 0) continue;
        $branch = isset($s['responsible_branch']) ? trim((string) $s['responsible_branch']) : '';
        $regBy  = isset($s['registered_by'])      ? trim((string) $s['registered_by'])      : '';
        if ($branch === '' && $regBy === '') continue;
        $rows[] = [$sid, $branch !== '' ? $branch : null, $regBy !== '' ? $regBy : null];
    }
    if (!$rows) return;

    try {
        $pdo = nawras_branch_sync_pdo();
        if (!$pdo) return;
        foreach (array_chunk($rows, 500) as $chunk) {
            $placeholders = implode(',', array_fill(0, count($chunk), '(?, ?, ?)'));
            $sql = "INSERT INTO store_branch_map (store_id, responsible_branch, registered_by) VALUES $placeholders
                    ON DUPLICATE KEY UPDATE
                        responsible_branch = COALESCE(VALUES(responsible_branch), responsible_branch),
                        registered_by = COALESCE(VALUES(registered_by), registered_by)";
            $params = [];
            foreach ($chunk as $r) {
                array_push($params, ...$r);
            }
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
    } catch (Throwable $e) {
        // أفضل جهد فقط — لا نكسر استجابة قائمة المتاجر بسبب فشل مزامنة الفروع
    }
}
