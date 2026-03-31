<?php
// Auto-recovery checker: called periodically or on-demand
// Checks if any "restoring" stores have shipped since restore date
// If yes → auto-moves to "active" + audit log
require_once __DIR__ . '/db.php';

$pdo = getDB();

// Get all stores in "restoring" status
$stmt = $pdo->query("SELECT store_id, store_name, restore_date FROM store_states WHERE category = 'restoring'");
$restoringStores = $stmt->fetchAll(PDO::FETCH_ASSOC);

if (empty($restoringStores)) {
    jsonResponse(['success' => true, 'message' => 'No restoring stores', 'recovered' => 0]);
}

// Fetch latest shipment data from Nawras API
$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';
$from = '2024-01-01';
$to = date('Y-m-d');

// Build store IDs lookup
$storeMap = [];
foreach ($restoringStores as $s) {
    $storeMap[$s['store_id']] = $s;
}

// Fetch orders-summary with pagination
$recoveredCount = 0;
$cursor = null;

do {
    $url = $BASE . '/customers/orders-summary?from=' . $from . '&to=' . $to;
    if ($cursor) $url .= '&cursor=' . $cursor;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $TOKEN]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);

    if (isset($data['data']) && is_array($data['data'])) {
        foreach ($data['data'] as $store) {
            $sid = $store['id'];

            // Only check stores that are in "restoring"
            if (!isset($storeMap[$sid])) continue;

            $restoreDate = $storeMap[$sid]['restore_date'];
            $lastShipDate = $store['last_shipment_date'] ?? null;

            // Check if store shipped AFTER restore date
            if ($lastShipDate && $lastShipDate !== 'لا يوجد' && $restoreDate) {
                if (strtotime($lastShipDate) > strtotime($restoreDate)) {
                    // AUTO-RECOVER: Update status to active
                    $pdo->prepare("UPDATE store_states SET category = 'recovered', updated_by = 'System / API' WHERE store_id = ?")
                        ->execute([$sid]);

                    // Audit log
                    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
                        ->execute([
                            $sid,
                            $storeMap[$sid]['store_name'],
                            'تغيير حالة تلقائي (استعادة نشاط)',
                            'تم تنشيط المتجر تلقائياً بعد إضافة طلبية جديدة - آخر شحنة: ' . $lastShipDate,
                            'restoring',
                            'recovered',
                            'System / API',
                            'system'
                        ]);

                    $recoveredCount++;
                    // Remove from map so we don't process again
                    unset($storeMap[$sid]);
                }
            }
        }
    }

    $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;

    // Stop early if all restoring stores are processed
    if (empty($storeMap)) break;

} while ($cursor);

jsonResponse([
    'success' => true,
    'message' => $recoveredCount > 0 ? "تم استعادة $recoveredCount متجر تلقائياً" : 'لا توجد متاجر جديدة للاستعادة',
    'recovered' => $recoveredCount
]);
