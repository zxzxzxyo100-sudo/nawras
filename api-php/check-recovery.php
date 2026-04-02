<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_MEDIUM);
ini_set('max_execution_time', TIME_MEDIUM);

require_once __DIR__ . '/db.php';

$pdo = getDB();

// جلب كل المتاجر في وضع "restoring"
$stmt = $pdo->query("SELECT store_id, store_name, restore_date FROM store_states WHERE category = 'restoring'");
$restoringStores = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($restoringStores)) {
    jsonResponse(['success' => true, 'message' => 'No restoring stores', 'recovered' => 0]);
}

$storeMap = [];
foreach ($restoringStores as $s) {
    $storeMap[intval($s['store_id'])] = $s;
}

// -------------------------------------------------------
// جلب بيانات الشحن مع Pagination كامل (بدل صفحة واحدة)
// نتوقف مبكراً إذا وجدنا كل المتاجر المطلوبة لتوفير الوقت
// -------------------------------------------------------
function fetchShipmentMap(string $url, int $maxPages, array $targetIds): array {
    $shipMap = [];
    $cursor  = null;
    $page    = 0;

    do {
        $fullUrl = $cursor ? $url . '&cursor=' . urlencode($cursor) : $url;

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $fullUrl,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 15,
            CURLOPT_CONNECTTIMEOUT => 5,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $response = curl_exec($ch);
        $curlErr  = curl_errno($ch);
        curl_close($ch);

        if ($curlErr || !$response) break;

        $data = json_decode($response, true);
        if (!is_array($data)) break;

        foreach ($data['data'] ?? [] as $s) {
            $sid  = intval($s['id']);
            $ship = $s['last_shipment_date'] ?? null;
            if ($ship && $ship !== 'لا يوجد') {
                if (!isset($shipMap[$sid]) || strtotime($ship) > strtotime($shipMap[$sid])) {
                    $shipMap[$sid] = $ship;
                }
            }
        }

        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;

        // توقف مبكر: وجدنا بيانات شحن لكل المتاجر المطلوبة
        $foundAll = !array_diff($targetIds, array_keys($shipMap));
        if ($foundAll) break;

    } while ($cursor && $page < $maxPages);

    return $shipMap;
}

$since      = date('Y-m-d', strtotime('-30 days'));
$targetIds  = array_keys($storeMap);

$shipNew    = fetchShipmentMap(
    NAWRIS_BASE . '/customers/new?since=' . $since,
    MAX_PAGES_RECOVERY,
    $targetIds
);
$shipOrders = fetchShipmentMap(
    NAWRIS_BASE . '/customers/orders-summary?from=' . $since . '&to=' . date('Y-m-d'),
    MAX_PAGES_RECOVERY,
    $targetIds
);

// دمج: الاحتفاظ بأحدث تاريخ شحنة لكل متجر
$shipmentMap = $shipNew;
foreach ($shipOrders as $sid => $date) {
    if (!isset($shipmentMap[$sid]) || strtotime($date) > strtotime($shipmentMap[$sid])) {
        $shipmentMap[$sid] = $date;
    }
}

// فحص كل متجر في "restoring"
$recoveredCount = 0;
$recoveredNames = [];

foreach ($storeMap as $sid => $storeInfo) {
    $restoreDate = $storeInfo['restore_date'];
    if (!$restoreDate) continue;

    $lastShipDate = $shipmentMap[$sid] ?? null;
    if (!$lastShipDate) continue;

    if (strtotime($lastShipDate) > strtotime($restoreDate)) {
        $pdo->prepare("UPDATE store_states SET category = 'recovered', updated_by = 'System / API' WHERE store_id = ?")
            ->execute([$sid]);

        $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
            ->execute([
                $sid,
                $storeInfo['store_name'],
                'تغيير حالة تلقائي (استعادة نشاط)',
                'تم تنشيط المتجر تلقائياً بعد إضافة طلبية جديدة - آخر شحنة: ' . $lastShipDate,
                'restoring',
                'recovered',
                'System / API',
                'system',
            ]);

        $recoveredCount++;
        $recoveredNames[] = $storeInfo['store_name'] . ' (#' . $sid . ')';
    }
}

jsonResponse([
    'success'         => true,
    'recovered'       => $recoveredCount,
    'stores'          => $recoveredNames,
    'message'         => $recoveredCount > 0
        ? "تم استعادة $recoveredCount متجر تلقائياً: " . implode(', ', $recoveredNames)
        : 'لا توجد متاجر جديدة للاستعادة',
    'checked'         => count($storeMap),
    'shipments_found' => count($shipmentMap),
]);
