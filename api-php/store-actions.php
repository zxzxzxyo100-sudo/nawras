<?php
require_once __DIR__ . '/db.php';
$pdo = getDB();

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

// ========== GET STORE STATES ==========
if ($action === 'get_states') {
    $stmt = $pdo->query("SELECT store_id, store_name, category, state_reason, freeze_reason, restore_date, graduated_at FROM store_states");
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
    $hasShipped = !empty($input['has_shipped']);
    $registrationDate = $input['registration_date'] ?? null;

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

    // ===== منطق الاحتضان الذكي: جدولة المكالمات التلقائية =====
    $nextStage = null;
    $nextCallDate = null;
    $auditExtra = '';

    if (in_array($callType, ['day0', 'day3', 'day10']) && $registrationDate) {
        $regDate = new DateTime($registrationDate);

        if ($callType === 'day0' && $hasShipped) {
            // بعد المكالمة الترحيبية + المتجر شحن → جدولة المكالمة الثانية (يوم 3)
            $nextStage = 'day3';
            $nextDate = clone $regDate;
            $nextDate->modify('+3 days');
            $nextCallDate = $nextDate->format('Y-m-d');
            $auditExtra = 'جدولة تلقائية: المكالمة الثانية في ' . $nextCallDate;
        } elseif ($callType === 'day0' && !$hasShipped) {
            // المكالمة الترحيبية تمت لكن المتجر لم يشحن بعد - نسجل المرحلة فقط
            // سيتم الجدولة تلقائياً عبر check_pending_schedules عند الشحن
            $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, incubation_stage, registration_date) VALUES (?, ?, 'incubating', 'day0', ?) ON DUPLICATE KEY UPDATE incubation_stage='day0', registration_date=COALESCE(registration_date, VALUES(registration_date))")
                ->execute([$storeId, $storeName, $registrationDate]);
        } elseif ($callType === 'day3') {
            // بعد المكالمة الثانية → جدولة المكالمة الثالثة (يوم 10)
            $nextStage = 'day10';
            $nextDate = clone $regDate;
            $nextDate->modify('+10 days');
            $nextCallDate = $nextDate->format('Y-m-d');
            $auditExtra = 'جدولة تلقائية: المكالمة الثالثة في ' . $nextCallDate;
        } elseif ($callType === 'day10') {
            // بعد المكالمة الثالثة → انتظار التخريج (يوم 14)
            $nextStage = 'graduation_ready';
            $nextDate = clone $regDate;
            $nextDate->modify('+14 days');
            $nextCallDate = $nextDate->format('Y-m-d');
            $auditExtra = 'انتقال تلقائي: بانتظار التخريج بعد يوم ' . $nextCallDate;
        }

        // تحديث مرحلة الاحتضان وموعد المكالمة القادمة
        if ($nextStage) {
            $stmt = $pdo->prepare("UPDATE store_states SET incubation_stage = ?, next_call_date = ?, registration_date = COALESCE(registration_date, ?) WHERE store_id = ?");
            $stmt->execute([$nextStage, $nextCallDate, $registrationDate, $storeId]);

            // إذا لم يكن هناك سجل، أنشئ واحداً
            if ($stmt->rowCount() === 0) {
                $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, incubation_stage, next_call_date, registration_date) VALUES (?, ?, 'incubating', ?, ?, ?) ON DUPLICATE KEY UPDATE incubation_stage=VALUES(incubation_stage), next_call_date=VALUES(next_call_date), registration_date=COALESCE(registration_date, VALUES(registration_date))")
                    ->execute([$storeId, $storeName, $nextStage, $nextCallDate, $registrationDate]);
            }

            // تسجيل الانتقال التلقائي في سجل العمليات
            $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute([$storeId, $storeName, 'انتقال تلقائي للمرحلة: ' . $nextStage, $auditExtra, 'النظام', 'system']);
        }
    }

    // تحديث first_shipped_date عند أول شحنة
    if ($hasShipped) {
        $pdo->prepare("UPDATE store_states SET first_shipped_date = COALESCE(first_shipped_date, NOW()) WHERE store_id = ?")
            ->execute([$storeId]);
    }

    // Audit log
    $labels = ['day0'=>'مكالمة ترحيبية','day3'=>'متابعة يوم 3','day10'=>'تقييم يوم 10',
        'rcall1'=>'استعادة - مكالمة 1','rcall2'=>'استعادة - مكالمة 2','rcall3'=>'استعادة - مكالمة 3','general'=>'اتصال'];
    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $labels[$callType] ?? 'اتصال', $note, $user, $userRole]);

    jsonResponse(['success' => true, 'next_stage' => $nextStage, 'next_call_date' => $nextCallDate]);
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

// ========== GET ALL CALL LOGS (for state machine) - optimized ==========
elseif ($action === 'get_all_calllogs') {
    // فقط آخر مكالمة من كل نوع لكل متجر (بدل تحميل الكل)
    $stmt = $pdo->query("SELECT store_id, call_type, MAX(created_at) as created_at FROM call_logs GROUP BY store_id, call_type");
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

// ========== GET SURVEYS (optimized) ==========
elseif ($action === 'get_surveys') {
    // فقط آخر استبيان لكل متجر
    $stmt = $pdo->query("SELECT s.* FROM surveys s INNER JOIN (SELECT store_id, MAX(id) as max_id FROM surveys GROUP BY store_id) latest ON s.id = latest.max_id");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
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

// ========== مهام اليوم المجدولة (TODAYS SCHEDULED CALLS) ==========
elseif ($action === 'todays_tasks') {
    $today = date('Y-m-d');
    $stmt = $pdo->prepare("SELECT ss.*,
        (SELECT COUNT(*) FROM call_logs cl WHERE cl.store_id = ss.store_id AND cl.call_type = ss.incubation_stage) as already_called
        FROM store_states ss
        WHERE ss.category = 'incubating'
        AND ss.next_call_date <= ?
        AND ss.incubation_stage IN ('day3', 'day10', 'graduation_ready')
        ORDER BY ss.next_call_date ASC");
    $stmt->execute([$today]);
    $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);
    // استبعاد المهام التي تم الاتصال بها فعلاً
    $tasks = array_filter($tasks, function($t) { return $t['already_called'] == 0; });
    jsonResponse(['success' => true, 'data' => array_values($tasks)]);
}

// ========== تخريج المتجر (GRADUATE STORE) ==========
elseif ($action === 'graduate_store') {
    $storeId = $input['store_id'];
    $storeName = $input['store_name'] ?? '';
    $user = $input['user'] ?? '';
    $userRole = $input['user_role'] ?? '';

    // تحديث الحالة إلى نشط + تسجيل التخريج
    $pdo->prepare("UPDATE store_states SET category = 'active', incubation_stage = 'graduated', graduated_at = NOW() WHERE store_id = ?")
        ->execute([$storeId]);

    // إذا لم يوجد سجل
    $stmt = $pdo->prepare("SELECT store_id FROM store_states WHERE store_id = ?");
    $stmt->execute([$storeId]);
    if (!$stmt->fetch()) {
        $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, incubation_stage, graduated_at) VALUES (?, ?, 'active', 'graduated', NOW())")
            ->execute([$storeId, $storeName]);
    }

    // سجل العمليات
    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, 'تخريج المتجر', 'تم تخريج المتجر من مسار الاحتضان إلى المتاجر النشطة', 'incubating', 'active', $user, $userRole]);

    // تسجيل مكالمة التخريج
    $pdo->prepare("INSERT INTO call_logs (store_id, store_name, call_type, note, performed_by, performed_role) VALUES (?, ?, 'graduation', ?, ?, ?)")
        ->execute([$storeId, $storeName, 'تم التخريج إلى المتاجر النشطة', $user, $userRole]);

    jsonResponse(['success' => true]);
}

// ========== فحص التخريج التلقائي (CHECK GRADUATION) ==========
elseif ($action === 'check_graduation') {
    $graduated = 0;
    // المتاجر التي مر عليها 14 يوم وهي نشطة في الشحن
    $stmt = $pdo->query("SELECT ss.store_id, ss.store_name, ss.registration_date
        FROM store_states ss
        WHERE ss.category = 'incubating'
        AND ss.incubation_stage IN ('day10', 'graduation_ready')
        AND ss.registration_date IS NOT NULL
        AND DATEDIFF(NOW(), ss.registration_date) >= 14");
    $stores = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($stores as $store) {
        // نقل إلى قائمة التخريج (graduation_ready) بدلاً من التخريج المباشر
        $upd = $pdo->prepare("UPDATE store_states SET incubation_stage = 'graduation_ready', next_call_date = CURDATE() WHERE store_id = ? AND incubation_stage != 'graduation_ready'");
        $upd->execute([$store['store_id']]);

        if ($upd->rowCount() > 0) {
            $graduated++;
            $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?)")
                ->execute([$store['store_id'], $store['store_name'], 'انتقال تلقائي لقائمة التخريج', 'مر 14 يوماً على المتجر - جاهز للتخريج', 'النظام', 'system']);
        }
    }
    jsonResponse(['success' => true, 'moved_to_graduation' => $graduated]);
}

// ========== فحص الجدولة المعلقة (CHECK PENDING SCHEDULES) ==========
// يفحص المتاجر التي تم الاتصال بها day0 لكن لم تكن قد شحنت وقتها، والآن شحنت
elseif ($action === 'check_pending_schedules') {
    $scheduled = 0;
    // المتاجر في مرحلة day0 التي تم الاتصال بها ولديها شحنة الآن
    // نعتمد على first_shipped_date الذي يتم تحديثه من الـ frontend عند كل تحميل
    $stmt = $pdo->query("SELECT ss.store_id, ss.store_name, ss.registration_date
        FROM store_states ss
        INNER JOIN call_logs cl ON cl.store_id = ss.store_id AND cl.call_type = 'day0'
        WHERE ss.category = 'incubating'
        AND ss.incubation_stage = 'day0'
        AND ss.registration_date IS NOT NULL
        AND ss.first_shipped_date IS NOT NULL
        GROUP BY ss.store_id");
    $stores = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($stores as $store) {
        // جدولة المكالمة الثانية
        $regDate = new DateTime($store['registration_date']);
        $nextDate = clone $regDate;
        $nextDate->modify('+3 days');
        $nextCallDate = $nextDate->format('Y-m-d');

        $pdo->prepare("UPDATE store_states SET incubation_stage = 'day3', next_call_date = ? WHERE store_id = ?")
            ->execute([$nextCallDate, $store['store_id']]);

        $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([$store['store_id'], $store['store_name'], 'جدولة تلقائية بعد شحنة', 'المتجر شحن بعد المكالمة الترحيبية - تم جدولة متابعة يوم 3 في ' . $nextCallDate, 'النظام', 'system']);

        $scheduled++;
    }
    jsonResponse(['success' => true, 'scheduled' => $scheduled]);
}

// ========== تحديث بيانات الاحتضان (UPDATE INCUBATION DATA) ==========
elseif ($action === 'update_incubation') {
    $storeId = $input['store_id'];
    $storeName = $input['store_name'] ?? '';
    $regDate = $input['registration_date'] ?? null;
    $firstShipped = $input['first_shipped_date'] ?? null;
    $stage = $input['incubation_stage'] ?? 'day0';

    $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, registration_date, first_shipped_date, incubation_stage)
        VALUES (?, ?, 'incubating', ?, ?, ?)
        ON DUPLICATE KEY UPDATE registration_date = COALESCE(VALUES(registration_date), registration_date),
        first_shipped_date = COALESCE(VALUES(first_shipped_date), first_shipped_date),
        incubation_stage = VALUES(incubation_stage),
        store_name = VALUES(store_name)")
        ->execute([$storeId, $storeName, $regDate, $firstShipped, $stage]);

    jsonResponse(['success' => true]);
}

// ========== الحصول على بيانات الاحتضان (GET INCUBATION DATA) ==========
elseif ($action === 'get_incubation_data') {
    try {
        $stmt = $pdo->query("SELECT store_id, registration_date, first_shipped_date, incubation_stage, next_call_date, graduated_at FROM store_states WHERE category = 'incubating' OR incubation_stage IS NOT NULL");
        $result = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $result[$row['store_id']] = $row;
        }
        jsonResponse(['success' => true, 'data' => $result]);
    } catch (Exception $e) {
        // الأعمدة الجديدة لم تُضاف بعد - يرجى فتح setup-db.php أولاً
        jsonResponse(['success' => true, 'data' => []]);
    }
}

else { jsonResponse(['error' => 'Unknown action'], 400); }
