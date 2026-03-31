<?php
require_once __DIR__ . '/db.php';
$pdo = getDB();

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

// ========== GET STORE STATES ==========
if ($action === 'get_states') {
    $stmt = $pdo->query("SELECT * FROM store_states");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== SET STORE STATUS ==========
elseif ($action === 'set_status') {
    $storeId = $input['store_id'];
    $category = $input['category'];
    $storeName = $input['store_name'] ?? '';
    $reason = $input['state_reason'] ?? '';
    $freezeReason = $input['freeze_reason'] ?? '';
    $user = $input['user'] ?? '';
    $userRole = $input['user_role'] ?? '';
    $oldStatus = $input['old_status'] ?? '';

    // Upsert store state
    $stmt = $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, state_reason, freeze_reason, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE category=VALUES(category), state_reason=VALUES(state_reason),
        freeze_reason=VALUES(freeze_reason), updated_by=VALUES(updated_by), store_name=VALUES(store_name)");
    $stmt->execute([$storeId, $storeName, $category, $reason, $freezeReason, $user]);

    // Set restore date if restoring
    if ($category === 'restoring') {
        $pdo->prepare("UPDATE store_states SET restore_date = NOW() WHERE store_id = ?")->execute([$storeId]);
    }
    // Set graduated date
    if ($category === 'active' && $oldStatus === 'incubating') {
        $pdo->prepare("UPDATE store_states SET graduated_at = NOW() WHERE store_id = ?")->execute([$storeId]);
    }

    // Audit log
    $actionName = [
        'active' => 'تحويل إلى نشط',
        'inactive' => 'تحويل إلى غير نشط',
        'frozen' => 'تجميد المتجر',
        'restoring' => 'بدء استعادة',
        'recovered' => 'تمت الاستعادة',
        'incubating' => 'إعادة للاحتضان',
        'cold' => 'نقل للباردة'
    ][$category] ?? 'تغيير حالة';

    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $actionName, $freezeReason ?: $reason, $oldStatus, $category, $user, $userRole]);

    jsonResponse(['success' => true]);
}

// ========== LOG CALL ==========
elseif ($action === 'log_call') {
    $storeId = $input['store_id'];
    $storeName = $input['store_name'] ?? '';
    $callType = $input['call_type'];
    $note = $input['note'];
    $user = $input['user'] ?? '';
    $userRole = $input['user_role'] ?? '';

    // Save call log
    $pdo->prepare("INSERT INTO call_logs (store_id, store_name, call_type, note, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $callType, $note, $user, $userRole]);

    // Save recovery call if applicable
    if (strpos($callType, 'rcall') === 0) {
        $callNum = intval(str_replace('rcall', '', $callType));
        $pdo->prepare("INSERT IGNORE INTO recovery_calls (store_id, call_number, note, performed_by)
            VALUES (?, ?, ?, ?)")
            ->execute([$storeId, $callNum, $note, $user]);
    }

    // Audit log
    $labels = ['day0'=>'مكالمة ترحيبية','day3'=>'متابعة يوم 3','day10'=>'تقييم يوم 10',
        'rcall1'=>'استعادة - مكالمة 1','rcall2'=>'استعادة - مكالمة 2','rcall3'=>'استعادة - مكالمة 3','general'=>'اتصال'];
    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $labels[$callType] ?? 'اتصال', $note, $user, $userRole]);

    jsonResponse(['success' => true]);
}

// ========== GET CALL LOGS FOR STORE ==========
elseif ($action === 'get_calls') {
    $storeId = $_GET['store_id'] ?? 0;
    $stmt = $pdo->prepare("SELECT * FROM call_logs WHERE store_id = ? ORDER BY created_at DESC");
    $stmt->execute([$storeId]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== GET RECOVERY CALLS ==========
elseif ($action === 'get_recovery_calls') {
    $storeId = $_GET['store_id'] ?? 0;
    $stmt = $pdo->prepare("SELECT * FROM recovery_calls WHERE store_id = ? ORDER BY call_number");
    $stmt->execute([$storeId]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== GET ALL RECOVERY CALLS (bulk) ==========
elseif ($action === 'get_all_recovery_calls') {
    $stmt = $pdo->query("SELECT store_id, call_number, created_at FROM recovery_calls");
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['store_id']][$row['call_number']] = $row['created_at'];
    }
    jsonResponse(['success' => true, 'data' => $result]);
}

// ========== GET ALL CALL LOGS (for state machine) ==========
elseif ($action === 'get_all_calllogs') {
    $stmt = $pdo->query("SELECT store_id, call_type, created_at FROM call_logs ORDER BY created_at");
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['store_id']][$row['call_type']] = $row['created_at'];
    }
    jsonResponse(['success' => true, 'data' => $result]);
}

// ========== SAVE SURVEY ==========
elseif ($action === 'save_survey') {
    $pdo->prepare("INSERT INTO surveys (store_id, q1_delivery, q2_collection, q3_support, q4_app, q5_payments, q6_returns, suggestions, performed_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$input['store_id'], $input['answers'][0], $input['answers'][1], $input['answers'][2],
            $input['answers'][3], $input['answers'][4], $input['answers'][5], $input['suggestions'] ?? '', $input['user'] ?? '']);

    // Audit log
    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, 'استبيان رضا العميل', ?, ?, ?)")
        ->execute([$input['store_id'], $input['store_name'] ?? '', $input['suggestions'] ?? '', $input['user'] ?? '', $input['user_role'] ?? '']);

    jsonResponse(['success' => true]);
}

// ========== GET SURVEYS ==========
elseif ($action === 'get_surveys') {
    $stmt = $pdo->query("SELECT s.*, (SELECT s2.id FROM surveys s2 WHERE s2.store_id = s.store_id ORDER BY s2.created_at DESC LIMIT 1) as latest
        FROM surveys s ORDER BY created_at DESC");
    $all = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // Group by store, keep latest
    $byStore = [];
    foreach ($all as $row) {
        if (!isset($byStore[$row['store_id']]) || $row['id'] == $row['latest']) {
            $byStore[$row['store_id']] = $row;
        }
    }
    jsonResponse(['success' => true, 'data' => array_values($byStore)]);
}

// ========== GET AUDIT LOGS ==========
elseif ($action === 'get_audit_logs') {
    $storeId = $_GET['store_id'] ?? null;
    if ($storeId) {
        $stmt = $pdo->prepare("SELECT * FROM audit_logs WHERE store_id = ? ORDER BY created_at DESC LIMIT 50");
        $stmt->execute([$storeId]);
    } else {
        $stmt = $pdo->query("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 200");
    }
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== DAILY REPORT ==========
elseif ($action === 'daily_report') {
    $date = $_GET['date'] ?? date('Y-m-d');
    $stmt = $pdo->prepare("SELECT performed_by, performed_role, COUNT(*) as total FROM call_logs WHERE DATE(created_at) = ? GROUP BY performed_by, performed_role");
    $stmt->execute([$date]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== MONTHLY REPORT ==========
elseif ($action === 'monthly_report') {
    $stmt = $pdo->prepare("SELECT performed_by, COUNT(*) as total FROM call_logs WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY performed_by ORDER BY total DESC");
    $stmt->execute();
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

else { jsonResponse(['error' => 'Unknown action'], 400); }
