<?php
require_once __DIR__ . '/db.php';
$pdo = getDB();

/** عمود outcome لسجل المكالمات (إضافة تلقائية للقواعد القديمة) */
function ensure_call_logs_outcome_column(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec("ALTER TABLE call_logs ADD COLUMN outcome VARCHAR(32) NULL DEFAULT NULL AFTER note");
    } catch (Throwable $e) {
        // العمود موجود مسبقاً
    }
    $done = true;
}

/** أعمدة تواريخ مكالمات مسار الاحتضان (ثلاث مكالمات + 3 أيام) */
function ensure_incubation_call_columns(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    foreach ([
        'inc_call1_at' => "ALTER TABLE store_states ADD COLUMN inc_call1_at DATETIME NULL DEFAULT NULL",
        'inc_call2_at' => "ALTER TABLE store_states ADD COLUMN inc_call2_at DATETIME NULL DEFAULT NULL",
        'inc_call3_at' => "ALTER TABLE store_states ADD COLUMN inc_call3_at DATETIME NULL DEFAULT NULL",
    ] as $_col => $sql) {
        try {
            $pdo->exec($sql);
        } catch (Throwable $e) {
            // العمود موجود
        }
    }
    $done = true;
}

/** اتجاه الرضا للوحة المدير (🔼/🔽) + وسوم الفجوة [إدخال]/[تتبع]/[مهام] */
function ensure_surveys_satisfaction_columns(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec('ALTER TABLE surveys ADD COLUMN satisfaction_score VARCHAR(16) NULL DEFAULT NULL');
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE surveys ADD COLUMN satisfaction_gap_tags JSON NULL DEFAULT NULL');
    } catch (Throwable $e) {
    }
    $done = true;
}

/**
 * @param array $q ستة أعداد 1–5
 * @return array{score:string,tags:array}
 */
function nawras_compute_satisfaction(array $q, $surveyKind) {
    $tags = [];
    if ($surveyKind === 'new_merchant_onboarding') {
        $labelsOnb = ['[إدخال]', '[تتبع]', '[مهام]'];
        for ($i = 0; $i < 3; $i++) {
            $v = (int) ($q[$i] ?? 0);
            if ($v <= 3) {
                $tags[] = $labelsOnb[$i];
            }
        }
        $tags = array_values(array_unique($tags));
        $anyBad = false;
        for ($i = 0; $i < 3; $i++) {
            if ((int) ($q[$i] ?? 0) <= 3) {
                $anyBad = true;
                break;
            }
        }
        $allGood = (int) ($q[0] ?? 0) >= 4 && (int) ($q[1] ?? 0) >= 4 && (int) ($q[2] ?? 0) >= 4;
        if ($anyBad) {
            return ['score' => 'down', 'tags' => $tags];
        }
        if ($allGood) {
            return ['score' => 'up', 'tags' => []];
        }

        return ['score' => 'down', 'tags' => $tags];
    }

    /** active_csat — متوسط 6 تقييمات (معايير عالمية مبسّطة):
     *  أخضر 🔼: متوسط ≥ 4.0 | أصفر ↔️: 3.0–3.9 | أحمر 🔽: < 3.0
     */
    $labelsCsat = [
        '[سرعة التوصيل]',       // q1_delivery
        '[التجميع والمندوب]',   // q2_collection
        '[الدعم الفني]',       // q3_support
        '[سهولة التطبيق]',      // q4_app
        '[التسويات المالية]',  // q5_payments
        '[المرجوعات]',         // q6_returns
    ];
    $vals = [];
    for ($i = 0; $i < 6; $i++) {
        $vals[$i] = (int) ($q[$i] ?? 0);
    }
    $sum = array_sum($vals);
    $avg = $sum / 6.0;
    $tags = [];
    for ($i = 0; $i < 6; $i++) {
        if ($vals[$i] <= 3) {
            $tags[] = $labelsCsat[$i];
        }
    }
    $tags = array_values(array_unique($tags));
    if ($avg >= 4.0) {
        return ['score' => 'up', 'tags' => []];
    }
    if ($avg >= 3.0) {
        return ['score' => 'mid', 'tags' => $tags];
    }

    return ['score' => 'down', 'tags' => $tags];
}

/** نوع السجل في الاستبيان: نشط (CSAT) مقابل ملاحظة نصية لمتجر غير نشط */
function ensure_surveys_survey_kind(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec("ALTER TABLE surveys ADD COLUMN survey_kind VARCHAR(32) NULL DEFAULT 'active_csat'");
    } catch (Throwable $e) {
    }
    $done = true;
}

/** أعمدة سير العمل في التعيينات — يجب أن يشمل completed مثل active-workflow.php */
function ensure_store_assignments_workflow(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    require_once __DIR__ . '/workflow-queue-lib.php';
    ensure_workflow_schema($pdo);
    $done = true;
}

/** تاريخ آخر مكالمة أنشأت حالة «منجز» (للعودة التلقائية بعد 30 يوماً) */
function ensure_last_call_date_column(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    try {
        $pdo->exec('ALTER TABLE store_states ADD COLUMN last_call_date DATETIME NULL DEFAULT NULL AFTER inc_call3_at');
    } catch (Throwable $e) {
        // موجود
    }
    $done = true;
}

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?: $_POST;

// ========== GET STORE STATES ==========
if ($action === 'get_states') {
    ensure_incubation_call_columns($pdo);
    ensure_last_call_date_column($pdo);
    try {
        $pdo->exec('ALTER TABLE store_states ADD COLUMN officer_performance_error TINYINT(1) NOT NULL DEFAULT 0');
    } catch (Throwable $e) {
    }
    $stmt = $pdo->query("SELECT store_id, store_name, category, state_reason, freeze_reason, restore_date, graduated_at, updated_by, inc_call1_at, inc_call2_at, inc_call3_at, last_call_date, officer_performance_error FROM store_states");
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== SET STORE STATUS ==========
elseif ($action === 'set_status') {
    $storeId = (int) ($input['store_id'] ?? 0);
    $category = $input['category'] ?? '';
    $storeName = $input['store_name'] ?? '';
    $reason = $input['state_reason'] ?? '';
    $freezeReason = trim((string) ($input['freeze_reason'] ?? ''));
    $user = $input['user'] ?? '';
    $userRole = $input['user_role'] ?? '';
    $oldStatus = $input['old_status'] ?? '';
    /** من all-stores: hot_inactive | cold_inactive — مطلوب لبدء الاستعادة */
    $merchantBucket = $input['merchant_bucket'] ?? '';

    if ($storeId <= 0) {
        jsonResponse(['success' => false, 'error' => 'معرّف المتجر غير صالح.'], 400);
    }

    $allowedTargets = ['frozen', 'active_pending_calls', 'restoring'];
    if (!in_array($category, $allowedTargets, true)) {
        jsonResponse(['success' => false, 'error' => 'التحويل اليدوي مقتصر على التجميد أو رفع التجميد أو بدء الاستعادة فقط.'], 400);
    }

    $stmtCur = $pdo->prepare('SELECT category FROM store_states WHERE store_id = ?');
    $stmtCur->execute([$storeId]);
    $rowCur = $stmtCur->fetch(PDO::FETCH_ASSOC);
    $currentCat = $rowCur['category'] ?? '';

    $err = '';
    if ($category === 'frozen') {
        if ($currentCat === 'frozen') {
            $err = 'المتجر مجمّد مسبقاً.';
        } elseif ($freezeReason === '') {
            $err = 'سبب التجميد مطلوب.';
        }
    } elseif ($category === 'active_pending_calls') {
        if ($currentCat !== 'frozen') {
            $err = 'رفع التجميد مسموح فقط عندما تكون الحالة «مجمد». باقي الانتقالات تتم آلياً (مكالمات، شحن، قواعد النظام).';
        }
    } elseif ($category === 'restoring') {
        if (in_array($currentCat, ['restoring', 'restored', 'recovered'], true)) {
            $err = 'حالة الاستعادة محددة مسبقاً أو اكتملت.';
        } elseif (!in_array($merchantBucket, ['hot_inactive', 'cold_inactive'], true)) {
            $err = 'بدء الاستعادة يُسمح فقط لمتجر مُصنَّف غير نشط ساخن أو غير نشط بارد.';
        }
    }

    if ($err !== '') {
        jsonResponse(['success' => false, 'error' => $err], 400);
    }

    // موظف نشط: لا يجمّد متجراً في حالة «عدم رد» ضمن سير العمل
    if ($category === 'frozen' && ($userRole ?? '') === 'active_manager') {
        try {
            $pdo->exec("ALTER TABLE store_assignments ADD COLUMN workflow_status ENUM('active','no_answer') NOT NULL DEFAULT 'active'");
        } catch (Throwable $e) {
        }
        $un = trim((string) ($input['username'] ?? ''));
        if ($un !== '') {
            $stAsg = $pdo->prepare('SELECT workflow_status FROM store_assignments WHERE store_id = ? AND assigned_to = ?');
            $stAsg->execute([(string) $storeId, $un]);
            $asgRow = $stAsg->fetch(PDO::FETCH_ASSOC);
            if ($asgRow && ($asgRow['workflow_status'] ?? '') === 'no_answer') {
                jsonResponse(['success' => false, 'error' => 'لا يمكن تجميد متجر مُعلَّم «عدم رد» من حسابك. المتابعة من المدير التنفيذي.'], 403);
            }
        }
    }

    // رفع التجميد: إفراغ سبب التجميد في السجل — العودة إلى «نشط قيد المكالمة»
    if ($category === 'active_pending_calls' && $currentCat === 'frozen') {
        $freezeReason = '';
    }

    $stmt = $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, state_reason, freeze_reason, updated_by)
        VALUES (?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE category=VALUES(category), state_reason=VALUES(state_reason),
        freeze_reason=VALUES(freeze_reason), updated_by=VALUES(updated_by), store_name=VALUES(store_name)");
    $stmt->execute([$storeId, $storeName, $category, $reason, $freezeReason, $user]);

    if ($category === 'restoring') {
        $pdo->prepare('UPDATE store_states SET restore_date = NOW() WHERE store_id = ?')->execute([$storeId]);
    }

    if ($category === 'active_pending_calls' && $currentCat === 'frozen') {
        $actionName = 'رفع التجميد';
    } elseif ($category === 'frozen') {
        $actionName = 'تجميد المتجر';
    } elseif ($category === 'restoring') {
        $actionName = 'بدء استعادة';
    } else {
        $actionName = 'تغيير حالة';
    }

    $detail = $freezeReason !== '' ? $freezeReason : $reason;

    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $actionName, $detail, $oldStatus, $category, $user, $userRole]);

    /** تنبيه للمدير التنفيذي — التحقيق السريع (سبب التجميد) */
    if ($category === 'frozen' && $freezeReason !== '') {
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
            $insQv = $pdo->prepare('INSERT INTO qv_freeze_alerts (store_id, store_name, freeze_reason, frozen_by, frozen_by_username) VALUES (?,?,?,?,?)');
            $insQv->execute([
                $storeId,
                (string) $storeName,
                $freezeReason,
                (string) $user,
                trim((string) ($input['username'] ?? '')),
            ]);
        } catch (Throwable $e) {
            // لا نمنع التجميد إن فشل إدراج التنبيه
        }
    }

    jsonResponse(['success' => true]);
}

// ========== LOG CALL ==========
elseif ($action === 'log_call') {
    ensure_call_logs_outcome_column($pdo);
    ensure_last_call_date_column($pdo);
    $storeId = $input['store_id'];
    $storeName = $input['store_name'] ?? '';
    $callType = $input['call_type'];
    $note = $input['note'] ?? '';
    $outcome = isset($input['outcome']) ? substr((string) $input['outcome'], 0, 32) : '';
    // دعم كلا المفتاحين: performed_by (من CallModal) و user (القديم)
    $user = $input['performed_by'] ?? $input['user'] ?? '';
    $userRole = $input['performed_role'] ?? $input['user_role'] ?? '';
    $hasShipped = !empty($input['has_shipped']);
    $registrationDate = $input['registration_date'] ?? null;

    // Save call log (outcome: answered | no_answer | busy | callback من الواجهة)
    $pdo->prepare("INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role)
        VALUES (?, ?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, $callType, $note, $outcome !== '' ? $outcome : null, $user, $userRole]);

    // —— طابور المتابعة النشطة: «تم الرد» يُكمّل التعيين فوراً (لا يبقى تحت «لم يتم الرد») ——
    $usernameForWorkflow = trim((string) ($input['username'] ?? ''));
    if (
        $callType === 'general'
        && $outcome === 'answered'
        && $usernameForWorkflow !== ''
        && ($userRole ?? '') === 'active_manager'
    ) {
        require_once __DIR__ . '/workflow-queue-lib.php';
        $sidInt = is_numeric($storeId) ? (int) $storeId : (int) preg_replace('/\D+/', '', (string) $storeId);
        if ($sidInt > 0) {
            workflow_try_complete_active_assignment_on_answered($pdo, $sidInt, (string) $storeName, $usernameForWorkflow);
        }
    }

    // —— نشط يشحن: تم الرد → منجز | لم يرد / مشغول → لم يتم الوصول (باستثناء احتضان واستعادة) ——
    if (!in_array($callType, ['inc_call1', 'inc_call2', 'inc_call3'], true) && strpos($callType, 'rcall') !== 0) {
        $sid = (int) $storeId;
        $oc = $outcome !== '' ? $outcome : '';
        if ($oc === 'answered') {
            $pdo->prepare("UPDATE store_states SET category = 'completed', last_call_date = NOW() WHERE store_id = ? AND category IN ('active_pending_calls','active','active_shipping','unreachable')")
                ->execute([$sid]);
        } elseif ($oc === 'busy' || $oc === 'no_answer') {
            $pdo->prepare("UPDATE store_states SET category = 'unreachable', last_call_date = NOW() WHERE store_id = ? AND category IN ('active_pending_calls','active','active_shipping','unreachable')")
                ->execute([$sid]);
        }
    }

    // —— مسار الاحتضان: ثلاث مكالمات (بعد كل مكالمة 3 أيام للتالية؛ الثالثة تخرج نشط/غير نشط حسب الشحن) ——
    if (in_array($callType, ['inc_call1', 'inc_call2', 'inc_call3'], true)) {
        ensure_incubation_call_columns($pdo);
        $regDate = !empty($registrationDate) ? $registrationDate : null;

        if ($callType === 'inc_call1') {
            $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, inc_call1_at, registration_date)
                VALUES (?, ?, 'incubating', NOW(), ?)
                ON DUPLICATE KEY UPDATE
                  inc_call1_at = IF(inc_call1_at IS NULL, NOW(), inc_call1_at),
                  store_name = VALUES(store_name),
                  registration_date = COALESCE(registration_date, VALUES(registration_date))")
                ->execute([$storeId, $storeName, $regDate]);
        } elseif ($callType === 'inc_call2') {
            $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, inc_call2_at, registration_date)
                VALUES (?, ?, 'incubating', NOW(), ?)
                ON DUPLICATE KEY UPDATE
                  inc_call2_at = IF(inc_call2_at IS NULL, NOW(), inc_call2_at),
                  store_name = VALUES(store_name),
                  registration_date = COALESCE(registration_date, VALUES(registration_date))")
                ->execute([$storeId, $storeName, $regDate]);
        } elseif ($callType === 'inc_call3') {
            // التخريج إلى نشط/غير نشط فقط عند «تم الرد» على المكالمة الثالثة
            if ($outcome === 'answered') {
                $hasShipped = !empty($input['has_shipped']);
                $newCat = $hasShipped ? 'active_pending_calls' : 'inactive';
                $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, inc_call3_at, incubation_stage, graduated_at, registration_date)
                    VALUES (?, ?, ?, NOW(), 'graduated', NOW(), ?)
                    ON DUPLICATE KEY UPDATE
                      inc_call3_at = IF(inc_call3_at IS NULL, NOW(), inc_call3_at),
                      category = VALUES(category),
                      incubation_stage = 'graduated',
                      graduated_at = COALESCE(graduated_at, NOW()),
                      store_name = VALUES(store_name),
                      registration_date = COALESCE(registration_date, VALUES(registration_date))")
                    ->execute([$storeId, $storeName, $newCat, $regDate]);
            }
        }

        $labels = [
            'inc_call1' => 'مسار الاحتضان — المكالمة الأولى',
            'inc_call2' => 'مسار الاحتضان — المكالمة الثانية',
            'inc_call3' => 'مسار الاحتضان — المكالمة الثالثة (تخريج)',
        ];
        $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
            VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([$storeId, $storeName, $labels[$callType] ?? $callType, $note, $user, $userRole]);

        jsonResponse(['success' => true, 'points_awarded' => 0]);
    }

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

    // ========== منح النقاط (NRS Points) ==========
    $pointsAwarded = 0;
    if ($user && $outcome !== 'no_answer') {
        // إنشاء جدول النقاط إن لم يكن موجوداً
        $pdo->exec("CREATE TABLE IF NOT EXISTS points_log (
            id         INT AUTO_INCREMENT PRIMARY KEY,
            username   VARCHAR(100) NOT NULL,
            fullname   VARCHAR(200) DEFAULT '',
            points     INT          NOT NULL DEFAULT 10,
            reason     VARCHAR(200) DEFAULT 'مكالمة',
            store_id   INT,
            store_name VARCHAR(300) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (username),
            INDEX idx_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // قيمة النقاط بناءً على نوع المكالمة
        $pts = 10;
        if (in_array($callType, ['day0','day3','day10'])) $pts = 15;
        if (strpos($callType, 'rcall') === 0)             $pts = 20;

        $pdo->prepare("INSERT INTO points_log (username, fullname, points, reason, store_id, store_name)
            VALUES (?, ?, ?, ?, ?, ?)")
            ->execute([$user, $user, $pts, ($labels[$callType] ?? 'اتصال'), $storeId, $storeName]);
        $pointsAwarded = $pts;
    }

    jsonResponse([
        'success'        => true,
        'next_stage'     => $nextStage,
        'next_call_date' => $nextCallDate,
        'points_awarded' => $pointsAwarded,
    ]);
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
    ensure_call_logs_outcome_column($pdo);
    // آخر مكالمة من كل نوع لكل متجر مع الملاحظة والمنفذ
    $stmt = $pdo->query("
        SELECT cl.store_id, cl.call_type, cl.created_at, cl.note, cl.outcome, cl.performed_by
        FROM call_logs cl
        INNER JOIN (
            SELECT store_id, call_type, MAX(created_at) AS max_date
            FROM call_logs
            GROUP BY store_id, call_type
        ) latest
        ON  cl.store_id   = latest.store_id
        AND cl.call_type  = latest.call_type
        AND cl.created_at = latest.max_date
    ");
    $result = [];
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $result[$row['store_id']][$row['call_type']] = [
            'date'         => $row['created_at'],
            'note'         => $row['note']         ?? '',
            'outcome'      => $row['outcome']      ?? '',
            'performed_by' => $row['performed_by'] ?? '',
        ];
    }

    // آخر مكالمة «عامة» بنتيجة «تم الرد» لكل متجر — حتى لا يُستبدل بـ «لم يرد» في المفتاح general وحده
    $stmtAns = $pdo->query("
        SELECT cl.store_id, cl.created_at, cl.note, cl.outcome, cl.performed_by
        FROM call_logs cl
        INNER JOIN (
            SELECT store_id, MAX(created_at) AS max_date
            FROM call_logs
            WHERE call_type = 'general'
            AND (outcome = 'answered' OR outcome = 'callback' OR IFNULL(outcome, '') = '')
            GROUP BY store_id
        ) latest
        ON cl.store_id = latest.store_id
        AND cl.created_at = latest.max_date
        AND cl.call_type = 'general'
    ");
    while ($row = $stmtAns->fetch(PDO::FETCH_ASSOC)) {
        $sid = $row['store_id'];
        if (!isset($result[$sid])) {
            $result[$sid] = [];
        }
        $result[$sid]['general_answered'] = [
            'date'         => $row['created_at'],
            'note'         => $row['note']         ?? '',
            'outcome'      => ($row['outcome'] ?? '') !== '' ? $row['outcome'] : 'answered',
            'performed_by' => $row['performed_by'] ?? '',
        ];
    }

    jsonResponse(['success' => true, 'data' => $result]);
}

// ========== SAVE SURVEY ==========
elseif ($action === 'save_survey') {
    ensure_surveys_survey_kind($pdo);
    $surveyKind = trim((string) ($input['survey_kind'] ?? 'active_csat'));

    // ── متجر غير نشط: ملاحظة نصية إلزامية (لا أسئلة متعددة) — لا تُحتسب ضمن CSAT ──
    if ($surveyKind === 'inactive_feedback') {
        $text = trim((string) ($input['inactive_feedback'] ?? $input['suggestions'] ?? ''));
        if (function_exists('mb_strlen')) {
            if (mb_strlen($text) < 10) {
                jsonResponse(['success' => false, 'error' => 'يجب كتابة 10 أحرف على الأقل في «ماذا قال المتجر؟».'], 400);
            }
        } elseif (strlen($text) < 10) {
            jsonResponse(['success' => false, 'error' => 'يجب كتابة 10 أحرف على الأقل في «ماذا قال المتجر؟».'], 400);
        }
        $storeId = (int) ($input['store_id'] ?? 0);
        if ($storeId <= 0) {
            jsonResponse(['success' => false, 'error' => 'معرّف المتجر غير صالح.'], 400);
        }
        try {
            $pdo->exec('ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL AFTER performed_by');
        } catch (Throwable $e) {
        }
        $neutral = 3;
        $submittedUser = trim((string) ($input['username'] ?? ''));
        $pdo->prepare("INSERT INTO surveys (store_id, q1_delivery, q2_collection, q3_support, q4_app, q5_payments, q6_returns, suggestions, performed_by, submitted_username, survey_kind)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'inactive_feedback')")
            ->execute([
                $storeId, $neutral, $neutral, $neutral, $neutral, $neutral, $neutral,
                $text,
                $input['user'] ?? '',
                $submittedUser !== '' ? $submittedUser : null,
            ]);
        $detail = 'ملاحظة متجر غير نشط — ماذا قال المتجر: ' . $text;
        $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
            VALUES (?, ?, 'ملاحظة متجر غير نشط', ?, ?, ?)")
            ->execute([$storeId, $input['store_name'] ?? '', $detail, $input['user'] ?? '', $input['user_role'] ?? '']);
        jsonResponse(['success' => true]);
    }

    $answers = $input['answers'] ?? null;
    if (!is_array($answers) || count($answers) !== 6) {
        jsonResponse(['success' => false, 'error' => 'يجب إرسال ستة تقييمات (1–5) لكل سؤال.'], 400);
    }
    $q = [];
    foreach ($answers as $i => $v) {
        $n = (int) $v;
        if ($n < 1 || $n > 5) {
            jsonResponse(['success' => false, 'error' => 'كل تقييم يجب أن يكون بين 1 و 5.'], 400);
        }
        $q[$i] = $n;
    }
    $suggestions = trim((string) ($input['suggestions'] ?? ''));
    $storeId = (int) ($input['store_id'] ?? 0);
    if ($storeId <= 0) {
        jsonResponse(['success' => false, 'error' => 'معرّف المتجر غير صالح.'], 400);
    }

    try {
        $pdo->exec('ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL AFTER performed_by');
    } catch (Throwable $e) {
    }
    $submittedUser = trim((string) ($input['username'] ?? ''));

    ensure_surveys_satisfaction_columns($pdo);

    if ($surveyKind === 'new_merchant_onboarding') {
        $metaNm = nawras_compute_satisfaction($q, 'new_merchant_onboarding');
        $gapNm = json_encode($metaNm['tags'], JSON_UNESCAPED_UNICODE);
        $pdo->prepare("INSERT INTO surveys (store_id, q1_delivery, q2_collection, q3_support, q4_app, q5_payments, q6_returns, suggestions, performed_by, submitted_username, survey_kind, satisfaction_score, satisfaction_gap_tags)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new_merchant_onboarding', ?, ?)")
            ->execute([
                $storeId, $q[0], $q[1], $q[2], $q[3], $q[4], $q[5], $suggestions, $input['user'] ?? '',
                $submittedUser !== '' ? $submittedUser : null,
                $metaNm['score'], $gapNm,
            ]);

        $detail = sprintf(
            'استبيان تهيئة متجر جديد (1–5): إدخال الطلبات=%d، تتبع الشحنات=%d، أنواع المهام=%d.',
            $q[0], $q[1], $q[2]
        );
        if ($suggestions !== '') {
            $detail .= ' ملاحظات: ' . $suggestions;
        }
        $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
            VALUES (?, ?, 'استبيان تهيئة متجر جديد', ?, ?, ?)")
            ->execute([$storeId, $input['store_name'] ?? '', $detail, $input['user'] ?? '', $input['user_role'] ?? '']);

        jsonResponse(['success' => true]);
    }

    if ($surveyKind !== 'active_csat') {
        jsonResponse(['success' => false, 'error' => 'نوع الاستبيان غير مدعوم.'], 400);
    }

    $metaA = nawras_compute_satisfaction($q, 'active_csat');
    $gapA = json_encode($metaA['tags'], JSON_UNESCAPED_UNICODE);
    $pdo->prepare("INSERT INTO surveys (store_id, q1_delivery, q2_collection, q3_support, q4_app, q5_payments, q6_returns, suggestions, performed_by, submitted_username, survey_kind, satisfaction_score, satisfaction_gap_tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active_csat', ?, ?)")
        ->execute([
            $storeId, $q[0], $q[1], $q[2], $q[3], $q[4], $q[5], $suggestions, $input['user'] ?? '',
            $submittedUser !== '' ? $submittedUser : null,
            $metaA['score'], $gapA,
        ]);

    $detail = sprintf(
        'تقييمات (1–5): سرعة التوصيل=%d، التجميع=%d، الدعم=%d، المنظومة=%d، التسويات=%d، المرجوعات=%d.',
        $q[0], $q[1], $q[2], $q[3], $q[4], $q[5]
    );
    if ($suggestions !== '') {
        $detail .= ' مقترحات/ملاحظات: ' . $suggestions;
    }

    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, performed_by, performed_role)
        VALUES (?, ?, 'استبيان رضا العميل (نشط)', ?, ?, ?)")
        ->execute([$storeId, $input['store_name'] ?? '', $detail, $input['user'] ?? '', $input['user_role'] ?? '']);

    jsonResponse(['success' => true]);
}

// ========== GET SURVEYS (optimized) ==========
elseif ($action === 'get_surveys') {
    ensure_surveys_survey_kind($pdo);
    // فقط آخر استبيان لكل متجر
    $stmt = $pdo->query("SELECT s.* FROM surveys s INNER JOIN (SELECT store_id, MAX(id) as max_id FROM surveys GROUP BY store_id) latest ON s.id = latest.max_id");
    $doneOnboarding = $pdo->query("SELECT DISTINCT store_id FROM surveys WHERE COALESCE(survey_kind, '') = 'new_merchant_onboarding'")->fetchAll(PDO::FETCH_COLUMN);
    jsonResponse([
        'success' => true,
        'data' => $stmt->fetchAll(PDO::FETCH_ASSOC),
        'new_merchant_onboarding_done_ids' => array_map('intval', $doneOnboarding ?: []),
    ]);
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
    ensure_call_logs_outcome_column($pdo);
    $storeId = $input['store_id'];
    $storeName = $input['store_name'] ?? '';
    $user = $input['user'] ?? '';
    $userRole = $input['user_role'] ?? '';

    // تحديث الحالة إلى نشط قيد المكالمة + تسجيل التخريج
    $pdo->prepare("UPDATE store_states SET category = 'active_pending_calls', incubation_stage = 'graduated', graduated_at = NOW() WHERE store_id = ?")
        ->execute([$storeId]);

    // إذا لم يوجد سجل
    $stmt = $pdo->prepare("SELECT store_id FROM store_states WHERE store_id = ?");
    $stmt->execute([$storeId]);
    if (!$stmt->fetch()) {
        $pdo->prepare("INSERT INTO store_states (store_id, store_name, category, incubation_stage, graduated_at) VALUES (?, ?, 'active_pending_calls', 'graduated', NOW())")
            ->execute([$storeId, $storeName]);
    }

    // سجل العمليات
    $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$storeId, $storeName, 'تخريج المتجر', 'تم تخريج المتجر من مسار الاحتضان إلى المتاجر النشطة (قيد المكالمة)', 'incubating', 'active_pending_calls', $user, $userRole]);

    // تسجيل مكالمة التخريج
    $pdo->prepare("INSERT INTO call_logs (store_id, store_name, call_type, note, outcome, performed_by, performed_role) VALUES (?, ?, 'graduation', ?, NULL, ?, ?)")
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

// ========== GET AUDIT LOG (single store) ==========
elseif ($action === 'get_audit_log') {
    $storeId = $_GET['store_id'] ?? null;
    if (!$storeId) { jsonResponse(['success' => true, 'data' => []]); }
    $stmt = $pdo->prepare("SELECT action_type, action_detail, old_status, new_status, performed_by, performed_role, created_at FROM audit_logs WHERE store_id = ? ORDER BY created_at DESC LIMIT 50");
    $stmt->execute([$storeId]);
    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== RESET CATEGORY (bulk) ==========
// يحذف حالة DB لمجموعة متاجر ويُعيدها لـ "غير نشطة" الافتراضية
elseif ($action === 'reset_category') {
    $storeIds = $input['store_ids'] ?? [];
    $user     = $input['user']      ?? 'النظام';
    $userRole = $input['user_role'] ?? '';
    $reason   = $input['reason']    ?? 'إعادة تعيين يدوية';

    if (empty($storeIds)) { jsonResponse(['success' => true, 'affected' => 0]); }

    $placeholders = implode(',', array_fill(0, count($storeIds), '?'));
    // جلب الأسماء والحالات الحالية قبل الحذف للتوثيق
    $stmt = $pdo->prepare("SELECT store_id, store_name, category FROM store_states WHERE store_id IN ($placeholders)");
    $stmt->execute($storeIds);
    $existing = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // حذف الحالات من DB
    $del = $pdo->prepare("DELETE FROM store_states WHERE store_id IN ($placeholders)");
    $del->execute($storeIds);
    $affected = $del->rowCount();

    // تسجيل في audit_logs لكل متجر كان له حالة
    $ins = $pdo->prepare("INSERT INTO audit_logs (store_id, store_name, action_type, action_detail, old_status, new_status, performed_by, performed_role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
    foreach ($existing as $row) {
        $ins->execute([
            $row['store_id'], $row['store_name'],
            'إعادة تعيين الحالة', $reason,
            $row['category'], 'inactive',
            $user, $userRole
        ]);
    }

    jsonResponse(['success' => true, 'affected' => $affected]);
}

// ========== GET ASSIGNMENTS ==========
elseif ($action === 'get_assignments') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS store_assignments (
        store_id     VARCHAR(50)  PRIMARY KEY,
        store_name   VARCHAR(255) DEFAULT '',
        assigned_to  VARCHAR(100) NOT NULL,
        assigned_by  VARCHAR(100) DEFAULT '',
        assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes        TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    ensure_store_assignments_workflow($pdo);

    $stmt = $pdo->query("SELECT * FROM store_assignments ORDER BY assigned_at DESC");
    $data = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $data[$row['store_id']] = $row;
    }
    jsonResponse(['success' => true, 'data' => $data]);
}

// ========== ASSIGN STORE ==========
elseif ($action === 'assign_store') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS store_assignments (
        store_id     VARCHAR(50)  PRIMARY KEY,
        store_name   VARCHAR(255) DEFAULT '',
        assigned_to  VARCHAR(100) NOT NULL,
        assigned_by  VARCHAR(100) DEFAULT '',
        assigned_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        notes        TEXT
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    ensure_store_assignments_workflow($pdo);

    $storeId   = $input['store_id']   ?? '';
    $storeName = $input['store_name'] ?? '';
    $assignTo  = $input['assigned_to'] ?? '';
    $assignBy  = $input['assigned_by'] ?? '';
    $notes     = $input['notes']       ?? '';

    if (!$storeId) { jsonResponse(['success' => false, 'error' => 'store_id مطلوب'], 400); }

    if ($assignTo === '') {
        // إلغاء التعيين
        $pdo->prepare("DELETE FROM store_assignments WHERE store_id = ?")->execute([$storeId]);
    } else {
        $pdo->prepare("INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue)
            VALUES (?, ?, ?, ?, ?, 'active', 'active')
            ON DUPLICATE KEY UPDATE
                assigned_to  = VALUES(assigned_to),
                assigned_by  = VALUES(assigned_by),
                notes        = VALUES(notes),
                store_name   = VALUES(store_name),
                workflow_status = 'active',
                assignment_queue = 'active',
                assigned_at  = CURRENT_TIMESTAMP")
            ->execute([$storeId, $storeName, $assignTo, $assignBy, $notes]);
    }

    jsonResponse(['success' => true]);
}

// ========== GET LEADERBOARD (أداء الموظفين + النقاط) ==========
elseif ($action === 'get_leaderboard') {
    $pdo->exec("CREATE TABLE IF NOT EXISTS points_log (
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL,
        fullname VARCHAR(200) DEFAULT '', points INT NOT NULL DEFAULT 10,
        reason VARCHAR(200) DEFAULT 'مكالمة', store_id INT, store_name VARCHAR(300) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (username), INDEX idx_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $today = date('Y-m-d');

    // إجمالي النقاط لكل موظف + مكالمات اليوم + مكالمات الأسبوع
    $stmt = $pdo->query("
        SELECT
            u.username,
            u.fullname,
            u.role,
            COALESCE(SUM(p.points), 0)                              AS total_points,
            COALESCE(SUM(CASE WHEN DATE(p.created_at) = CURDATE() THEN p.points ELSE 0 END), 0) AS today_points,
            COALESCE(SUM(CASE WHEN p.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN p.points ELSE 0 END), 0) AS week_points,
            COALESCE(COUNT(CASE WHEN DATE(p.created_at) = CURDATE() THEN 1 END), 0)             AS today_calls,
            COALESCE(COUNT(p.id), 0)                                AS total_calls
        FROM users u
        LEFT JOIN points_log p ON p.username = u.fullname
        WHERE u.role != 'executive'
        GROUP BY u.username, u.fullname, u.role
        ORDER BY total_points DESC
    ");

    jsonResponse(['success' => true, 'data' => $stmt->fetchAll(PDO::FETCH_ASSOC)]);
}

// ========== GET MY STATS (إحصائياتي الشخصية) ==========
elseif ($action === 'get_my_stats') {
    $username = $input['username'] ?? ($_GET['username'] ?? '');
    if (!$username) { jsonResponse(['success' => false, 'error' => 'username مطلوب']); }

    try {
        $pdo->exec("CREATE TABLE IF NOT EXISTS points_log (
            id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL,
            fullname VARCHAR(200) DEFAULT '', points INT NOT NULL DEFAULT 10,
            reason VARCHAR(200) DEFAULT 'مكالمة', store_id INT, store_name VARCHAR(300) DEFAULT '',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user (username), INDEX idx_date (created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        // إجمالي النقاط
        $totStmt = $pdo->prepare("SELECT COALESCE(SUM(points),0) AS total FROM points_log WHERE username = ?");
        $totStmt->execute([$username]);
        $totalPoints = (int)$totStmt->fetchColumn();
        $totStmt->closeCursor();

        // نقاط اليوم + مكالمات اليوم
        $todayStmt = $pdo->prepare("
            SELECT COALESCE(SUM(points),0) AS pts, COUNT(*) AS calls
            FROM points_log WHERE username = ? AND DATE(created_at) = CURDATE()
        ");
        $todayStmt->execute([$username]);
        $todayRow = $todayStmt->fetch(PDO::FETCH_ASSOC);
        $todayStmt->closeCursor();

        // مكالمات آخر 7 أيام (للرسم البياني)
        $weekStmt = $pdo->prepare("
            SELECT DATE(created_at) AS day, COUNT(*) AS calls, COALESCE(SUM(points),0) AS pts
            FROM points_log
            WHERE username = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
            GROUP BY DATE(created_at)
            ORDER BY day ASC
        ");
        $weekStmt->execute([$username]);
        $weekData = $weekStmt->fetchAll(PDO::FETCH_ASSOC);
        $weekStmt->closeCursor();

        // آخر 10 مكالمات
        $recentStmt = $pdo->prepare("
            SELECT reason, store_name, points, created_at
            FROM points_log WHERE username = ?
            ORDER BY created_at DESC LIMIT 10
        ");
        $recentStmt->execute([$username]);
        $recent = $recentStmt->fetchAll(PDO::FETCH_ASSOC);

        jsonResponse([
            'success'      => true,
            'total_points' => $totalPoints,
            'today_points' => (int)($todayRow['pts']   ?? 0),
            'today_calls'  => (int)($todayRow['calls'] ?? 0),
            'week_data'    => $weekData,
            'recent'       => $recent,
        ]);
    } catch (Throwable $e) {
        error_log('get_my_stats: ' . $e->getMessage());
        jsonResponse([
            'success' => false,
            'error'   => 'تعذّر قراءة إحصائيات النقاط — تحقق من جدول points_log أو إعدادات MySQL',
        ]);
    }
}

// ========== AWARD BONUS (إعلانات النورس الذكية) ==========
elseif ($action === 'award_bonus') {
    $username  = $input['username']  ?? '';
    $adId      = $input['ad_id']     ?? 'ad_unknown';
    $adTitle   = $input['ad_title']  ?? 'بونص إعلاني';
    $pts       = min((int)($input['points'] ?? 5), 100);

    if (!$username) { jsonResponse(['success' => false, 'error' => 'username مطلوب'], 400); }

    $pdo->exec("CREATE TABLE IF NOT EXISTS points_log (
        id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(100) NOT NULL,
        fullname VARCHAR(200) DEFAULT '', points INT NOT NULL DEFAULT 10,
        reason VARCHAR(200) DEFAULT 'مكالمة', store_id INT, store_name VARCHAR(300) DEFAULT '',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user (username), INDEX idx_date (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    // كل إعلان مرة واحدة فقط يومياً لنفس المستخدم
    $check = $pdo->prepare("SELECT id FROM points_log WHERE username = ? AND reason = ? AND DATE(created_at) = CURDATE()");
    $check->execute([$username, 'إعلان: ' . $adId]);
    if ($check->rowCount() > 0) {
        jsonResponse(['success' => false, 'error' => 'تم استخدام هذا البونص اليوم', 'already_claimed' => true]);
        exit;
    }

    $pdo->prepare("INSERT INTO points_log (username, fullname, points, reason)
        VALUES (?, ?, ?, ?)")
        ->execute([$username, $username, $pts, 'إعلان: ' . $adId]);

    jsonResponse(['success' => true, 'points_awarded' => $pts, 'ad_title' => $adTitle]);
}

else { jsonResponse(['error' => 'Unknown action'], 400); }
