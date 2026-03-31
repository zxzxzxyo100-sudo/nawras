<?php
// Auto-recovery checker
// Checks ALL "restoring" stores against BOTH APIs for shipment after restore date
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

function fetchAllPages($url, $token) {
    $allData = [];
    $cursor = null;
    do {
        $fetchUrl = $cursor ? $url . '&cursor=' . $cursor : $url;
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $fetchUrl);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $token]);
        curl_setopt($ch, CURLOPT_TIMEOUT, 30);
        $response = curl_exec($ch);
        curl_close($ch);
        $data = json_decode($response, true);
        if (isset($data['data']) && is_array($data['data'])) {
            $allData = array_merge($allData, $data['data']);
        }
        $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;
    } while ($cursor);
    return $allData;
}

// Fetch from BOTH APIs
$newCustomers = fetchAllPages($BASE . '/customers/new?since=2024-01-01', $TOKEN);
$ordersSummary = fetchAllPages($BASE . '/customers/orders-summary?from=2024-01-01&to=' . date('Y-m-d'), $TOKEN);

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
