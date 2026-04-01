<?php
// Auto-recovery checker - optimized to prevent Out of Memory
ini_set('memory_limit', '48M');
ini_set('max_execution_time', '15');

require_once __DIR__ . '/db.php';

$pdo = getDB();
$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';

// Get all stores in "restoring" status
$stmt = $pdo->query("SELECT store_id, store_name, restore_date FROM store_states WHERE category = 'restoring'");
$restoringStores = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($restoringStores)) {
    jsonResponse(['success' => true, 'message' => 'No restoring stores', 'recovered' => 0]);
}

$storeMap = [];
foreach ($restoringStores as $s) {
    $storeMap[intval($s['store_id'])] = $s;
}

// جلب صفحة واحدة فقط (بدل كل الصفحات) لتوفير الذاكرة
function fetchOnePage($url, $token) {
    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $token]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response = curl_exec($ch);
    curl_close($ch);
    $data = json_decode($response, true);
    return (isset($data['data']) && is_array($data['data'])) ? $data['data'] : [];
}

// Fetch from BOTH APIs (صفحة واحدة فقط - أحدث البيانات)
$since = date('Y-m-d', strtotime('-30 days'));
$newCustomers = fetchOnePage($BASE . '/customers/new?since=' . $since, $TOKEN);
$ordersSummary = fetchOnePage($BASE . '/customers/orders-summary?from=' . $since . '&to=' . date('Y-m-d'), $TOKEN);

// Merge: build shipment map by store ID
$shipmentMap = [];
foreach ($newCustomers as $s) {
    $sid = intval($s['id']);
    $ship = $s['last_shipment_date'] ?? null;
    if ($ship && $ship !== 'لا يوجد') {
        $shipmentMap[$sid] = $ship;
    }
}
foreach ($ordersSummary as $s) {
    $sid = intval($s['id']);
    $ship = $s['last_shipment_date'] ?? null;
    if ($ship && $ship !== 'لا يوجد') {
        // Keep the most recent shipment date
        if (!isset($shipmentMap[$sid]) || strtotime($ship) > strtotime($shipmentMap[$sid])) {
            $shipmentMap[$sid] = $ship;
        }
    }
}

// Check each restoring store
$recoveredCount = 0;
$recoveredNames = [];

foreach ($storeMap as $sid => $storeInfo) {
    $restoreDate = $storeInfo['restore_date'];
    if (!$restoreDate) continue;

    $lastShipDate = $shipmentMap[$sid] ?? null;
    if (!$lastShipDate) continue;

    // Shipped AFTER restore date?
    if (strtotime($lastShipDate) > strtotime($restoreDate)) {
        // AUTO-RECOVER
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
                'system'
            ]);

        $recoveredCount++;
        $recoveredNames[] = $storeInfo['store_name'] . ' (#' . $sid . ')';
    }
}

jsonResponse([
    'success' => true,
    'recovered' => $recoveredCount,
    'stores' => $recoveredNames,
    'message' => $recoveredCount > 0
        ? "تم استعادة $recoveredCount متجر تلقائياً: " . implode(', ', $recoveredNames)
        : 'لا توجد متاجر جديدة للاستعادة',
    'checked' => count($storeMap),
    'shipments_found' => count($shipmentMap)
]);
