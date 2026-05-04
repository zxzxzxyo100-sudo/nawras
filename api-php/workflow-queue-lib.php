<?php
/**
 * مكتبة مشتركة: طوابير المسؤول النشط (50) ومسؤول الاستعادة (50)
 * يُستدعى من active-workflow.php و cron-daily-queue-fill.php
 */
if (!defined('ACTIVE_QUEUE_TARGET')) {
    define('ACTIVE_QUEUE_TARGET', 100);
}
/** الحد الأقصى لعدد الشحنات الإجمالية قبل ترقية المتجر إلى VIP وخروجه من قائمة المتاجر النشطة */
if (!defined('ACTIVE_VIP_SHIPMENTS_THRESHOLD')) {
    define('ACTIVE_VIP_SHIPMENTS_THRESHOLD', 301);
}
/** عدّاد يومي تقريري فقط لمسؤول المتاجر النشطة — لا يوقف الإحلال أو التعبئة */
if (!defined('ACTIVE_DAILY_SUCCESS_TARGET')) {
    define('ACTIVE_DAILY_SUCCESS_TARGET', 50);
}
if (!defined('INACTIVE_QUEUE_TARGET')) {
    define('INACTIVE_QUEUE_TARGET', 50);
}
/** هدف اتصالات ناجحة (تم) يومياً لمسؤول الاستعادة — بعدها لا تُعبَّأ قوائم جديدة */
if (!defined('INACTIVE_DAILY_SUCCESS_TARGET')) {
    define('INACTIVE_DAILY_SUCCESS_TARGET', 50);
}
/** أولوية طابور الاستعادة: متاجر بعدد طرود معتمد أعلى من هذا الرقم تُرتَّب أولاً؛ ولا يُعيَّن في الطابور من عدده المعتمد ≤ هذا (أي يُشترط > 5 طلبيات) */
if (!defined('INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS')) {
    define('INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS', 5);
}
/** أقصى صفوف في طابور «نشط» لكل موظف (نشط + لم يرد) — أعلى من 50 لأن جزءاً يكون بانتظار الاستبيان بعد المكالمة */
if (!defined('MAX_ACTIVE_ASSIGNMENTS_TOTAL_PER_USER')) {
    define('MAX_ACTIVE_ASSIGNMENTS_TOTAL_PER_USER', 120);
}
/** أقصى عدد صفوف تعيين (نشط + لم يرد) لمسؤول واحد — أعلى من 50 حتى يمكن وجود متاجر «بانتظار استبيان بعد مكالمة» مع 50 «بلا مكالمة اليوم» */
if (!defined('ACTIVE_ASSIGNMENTS_MAX_TOTAL')) {
    define('ACTIVE_ASSIGNMENTS_MAX_TOTAL', 120);
}
if (!defined('SURVEY_COOLDOWN_DAYS')) {
    define('SURVEY_COOLDOWN_DAYS', 30);
}

function ensure_workflow_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    ensure_active_pool_rotation_schema($pdo);
    try {
        $pdo->exec("ALTER TABLE store_assignments ADD COLUMN workflow_status ENUM('active','no_answer','completed') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec("ALTER TABLE store_assignments MODIFY workflow_status ENUM('active','no_answer','completed') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE store_assignments ADD COLUMN workflow_updated_at DATETIME NULL DEFAULT NULL ON UPDATE CURRENT_TIMESTAMP');
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec('ALTER TABLE surveys ADD COLUMN submitted_username VARCHAR(100) NULL DEFAULT NULL AFTER performed_by');
    } catch (Throwable $e) {
    }
    try {
        $pdo->exec("ALTER TABLE store_assignments ADD COLUMN assignment_queue ENUM('active','inactive') NOT NULL DEFAULT 'active'");
    } catch (Throwable $e) {
    }
    ensure_inactive_daily_stats_schema($pdo);
    ensure_active_daily_stats_schema($pdo);
    $done = true;
}

function ensure_active_daily_stats_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS active_manager_daily_stats (
            username VARCHAR(191) NOT NULL,
            work_date DATE NOT NULL,
            successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (username, work_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

/**
 * إنتاجية اليوم — عدد التعيينات المكتملة اليوم فقط (تم الرد + استبيان عبر save_survey).
 * المصدر: store_assignments وليس عدّاداً منفصلاً.
 */
function get_active_daily_success_count(PDO $pdo, $username) {
    ensure_workflow_schema($pdo);
    $u = trim((string) $username);
    if ($u === '') {
        return 0;
    }
    $st = $pdo->prepare("
        SELECT COUNT(*) FROM store_assignments
        WHERE assigned_to = ?
        AND assignment_queue = 'active'
        AND workflow_status = 'completed'
        AND DATE(COALESCE(workflow_updated_at, assigned_at)) = CURDATE()
    ");
    $st->execute([$u]);
    return (int) $st->fetchColumn();
}

/** @deprecated لا يُستخدم — الإنتاجية تُحسب من store_assignments */
function increment_active_daily_success(PDO $pdo, $username) {
}

function ensure_inactive_daily_stats_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS inactive_manager_daily_stats (
            username VARCHAR(191) NOT NULL,
            work_date DATE NOT NULL,
            successful_contacts INT UNSIGNED NOT NULL DEFAULT 0,
            updated_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (username, work_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

function get_inactive_daily_success_count(PDO $pdo, $username) {
    ensure_inactive_daily_stats_schema($pdo);
    $st = $pdo->prepare('SELECT COALESCE(successful_contacts, 0) FROM inactive_manager_daily_stats WHERE username = ? AND work_date = CURDATE()');
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

function increment_inactive_daily_success(PDO $pdo, $username) {
    ensure_inactive_daily_stats_schema($pdo);
    $pdo->prepare("
        INSERT INTO inactive_manager_daily_stats (username, work_date, successful_contacts)
        VALUES (?, CURDATE(), 1)
        ON DUPLICATE KEY UPDATE successful_contacts = successful_contacts + 1
    ")->execute([$username]);
}

function active_pipeline_where_sql() {
    return "ss.category IN ('active','active_shipping','active_pending_calls')";
}

/**
 * معرّفات متاجر ما زالت ضمن واجهة «قيد المتابعة» (نشط يشحن / جديد / احتضان) — لا تُحذف تعيينها الميداني عند التنظيف.
 *
 * @param array<string, mixed> $result
 * @param array<string, mixed> $incubation_path
 * @return array<int, true>
 */
function nawras_protected_store_ids_for_assignment_purge(array $result, array $incubation_path = []): array {
    $protected = [];
    foreach (['active_shipping', 'incubating', 'new_registered'] as $key) {
        foreach ($result[$key] ?? [] as $s) {
            $id = (int) ($s['id'] ?? 0);
            if ($id > 0) {
                $protected[$id] = true;
            }
        }
    }
    foreach ($incubation_path as $rows) {
        if (!is_array($rows)) {
            continue;
        }
        foreach ($rows as $s) {
            $id = (int) ($s['id'] ?? 0);
            if ($id > 0) {
                $protected[$id] = true;
            }
        }
    }

    return $protected;
}

/**
 * إزالة تعيينات طابور «متابعة دورية» (assignment_queue = active) عندما لم يعد المتجر ضمن احتضان المسؤول النشط.
 * يُستدعى من all-stores.php بعد التصنيف حتى لا يبقى متجر «ساخن/بارد/منجز…» مُسنداً بعد تغيّر حالته.
 *
 * لا يُمسّ التعيين اليدوي للمتاجر الظاهرة في active_shipping / الاحتضان — كان يُحذَف خطأً إن وُجد نفس store_id
 * في completed_merchants أو غيره بسبب طبقة overlay أو ازدواج التصنيف.
 */
function purge_active_manager_assignments_for_exited_incubation(PDO $pdo, array $result, array $incubation_path = []) {
    ensure_workflow_schema($pdo);
    $protected = nawras_protected_store_ids_for_assignment_purge($result, $incubation_path);
    $protectedIds = array_keys($protected);

    try {
        if ($protectedIds === []) {
            $pdo->exec("
                DELETE sa FROM store_assignments sa
                INNER JOIN store_states ss ON CAST(sa.store_id AS CHAR) = CAST(ss.store_id AS CHAR)
                WHERE sa.assignment_queue = 'active'
                AND ss.category IN (
                    'hot_inactive', 'cold_inactive', 'completed', 'contacted', 'frozen', 'unreachable'
                )
            ");
        } else {
            foreach (array_chunk($protectedIds, 200) as $chunkP) {
                $phP = implode(',', array_fill(0, count($chunkP), '?'));
                $bindP = array_map(static function ($x) {
                    return (string) $x;
                }, $chunkP);
                $st = $pdo->prepare("
                    DELETE sa FROM store_assignments sa
                    INNER JOIN store_states ss ON CAST(sa.store_id AS CHAR) = CAST(ss.store_id AS CHAR)
                    WHERE sa.assignment_queue = 'active'
                    AND ss.category IN (
                        'hot_inactive', 'cold_inactive', 'completed', 'contacted', 'frozen', 'unreachable'
                    )
                    AND CAST(sa.store_id AS UNSIGNED) NOT IN ($phP)
                ");
                $st->execute($bindP);
            }
        }
    } catch (Throwable $e) {
    }
    $seen = [];
    foreach (['hot_inactive', 'cold_inactive', 'completed_merchants', 'frozen_merchants', 'unreachable_merchants'] as $key) {
        foreach ($result[$key] ?? [] as $s) {
            $id = isset($s['id']) ? (int) $s['id'] : 0;
            if ($id > 0) {
                $seen[$id] = true;
            }
        }
    }
    $ids = array_values(array_filter(array_keys($seen), static function ($id) use ($protected) {
        return !isset($protected[(int) $id]);
    }));
    if ($ids === []) {
        return;
    }
    foreach (array_chunk($ids, 200) as $chunk) {
        $ph = implode(',', array_fill(0, count($chunk), '?'));
        $bind = array_map(static function ($x) {
            return (string) $x;
        }, $chunk);
        try {
            $st = $pdo->prepare("
                DELETE FROM store_assignments
                WHERE assignment_queue = 'active'
                AND CAST(store_id AS CHAR) IN ($ph)
            ");
            $st->execute($bind);
        } catch (Throwable $e) {
        }
    }
}

/** سجل متاجر اختيرت من المجمع لمسؤول النشط — لعدم تكرار نفس المتجر في أمس والأمس السابق */
function ensure_active_pool_rotation_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS active_manager_pool_rotation (
            username VARCHAR(191) NOT NULL,
            store_id VARCHAR(64) NOT NULL,
            slot_date DATE NOT NULL,
            created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, store_id, slot_date),
            INDEX idx_user_recent (username, slot_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

function ensure_active_queue_reset_schema(PDO $pdo) {
    static $done = false;
    if ($done) {
        return;
    }
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS active_manager_queue_resets (
            username VARCHAR(191) NOT NULL,
            reset_key VARCHAR(64) NOT NULL,
            created_at DATETIME NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (username, reset_key)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    ");
    $done = true;
}

/**
 * إعادة تهيئة لمرة واحدة: كل التعيينات المفتوحة الحالية لهذا المستخدم تصبح كأنها مُعيّنة الآن.
 * يشمل ذلك active و no_answer حتى يبدأ كل شيء "من جديد" ولا يظهر مباشرةً في التأخيرات.
 */
function reset_active_assignments_as_fresh_once(PDO $pdo, $username, $resetKey = 'delays_from_tomorrow_v2') {
    ensure_active_queue_reset_schema($pdo);
    $u = trim((string) $username);
    if ($u === '') {
        return false;
    }
    $check = $pdo->prepare('SELECT 1 FROM active_manager_queue_resets WHERE username = ? AND reset_key = ? LIMIT 1');
    $check->execute([$u, $resetKey]);
    if ($check->fetchColumn()) {
        return false;
    }
    $pdo->prepare("
        UPDATE store_assignments
        SET assigned_at = NOW(), workflow_updated_at = NOW()
        WHERE assigned_to = ?
        AND assignment_queue = 'active'
        AND workflow_status IN ('active', 'no_answer')
    ")->execute([$u]);
    $pdo->prepare("
        INSERT INTO active_manager_queue_resets (username, reset_key)
        VALUES (?, ?)
    ")->execute([$u, $resetKey]);
    return true;
}

function log_active_manager_pool_pick(PDO $pdo, $username, $storeId) {
    ensure_active_pool_rotation_schema($pdo);
    $u = trim((string) $username);
    if ($u === '') {
        return;
    }
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT IGNORE INTO active_manager_pool_rotation (username, store_id, slot_date)
        VALUES (?, ?, CURDATE())
    ")->execute([$u, $sid]);
}

/**
 * متجر من مجمع «النشط» — بدون تبريد استبيان 30 يوماً ولا تدوير أمس؛ فقط غير معيّن حالياً في الطابور.
 */
function pick_next_pool_store_for_user(PDO $pdo, $_username = '') {
    /** أي صف في طابور «active» يمنع سحب المتجر مجدداً — بما فيه «منجز» حتى يُزال الصف (تنظيف شهري) ولا يُكرَّر في المهام. */
    $sql = "
        SELECT ss.store_id, ss.store_name
        FROM store_states ss
        WHERE " . active_pipeline_where_sql() . "
        AND CAST(ss.store_id AS CHAR) NOT IN (
            SELECT store_id FROM store_assignments
            WHERE assignment_queue = 'active'
        )
        ORDER BY ss.store_id ASC
        LIMIT 1
    ";
    return $pdo->query($sql)->fetch(PDO::FETCH_ASSOC) ?: null;
}

/** @deprecated استخدم pick_next_pool_store_for_user */
function pick_next_pool_store(PDO $pdo) {
    return pick_next_pool_store_for_user($pdo, '');
}

function count_active_queue(PDO $pdo, $username) {
    $st = $pdo->prepare("
        SELECT COUNT(*) FROM store_assignments
        WHERE assigned_to = ?
          AND assigned_to IS NOT NULL
          AND TRIM(assigned_to) <> ''
          AND TRIM(assigned_to) <> 'بدون تعيين'
          AND workflow_status = 'active'
          AND assignment_queue = 'active'
    ");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

/**
 * عدد خانات «المتابعة الدورية»: تعيينات active بلا أي مكالمة مسجّلة لذلك المتجر اليوم (أي نتيجة).
 */
function count_pending_active_queue(PDO $pdo, $username) {
    $st = $pdo->prepare("
        SELECT COUNT(*) FROM store_assignments sa
        WHERE sa.assigned_to = ?
          AND sa.assigned_to IS NOT NULL
          AND TRIM(sa.assigned_to) <> ''
          AND TRIM(sa.assigned_to) <> 'بدون تعيين'
          AND sa.workflow_status = 'active'
          AND sa.assignment_queue = 'active'
          AND NOT EXISTS (
              SELECT 1 FROM call_logs cl
              WHERE CAST(cl.store_id AS CHAR) = CAST(sa.store_id AS CHAR)
              AND DATE(cl.created_at) = CURDATE()
          )
    ");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

/** إجمالي صفوف طابور المتابعة الدورية (نشط + لم يرد) — لضبط سقف التعبئة */
function count_total_active_workflow_assignments(PDO $pdo, $username) {
    $st = $pdo->prepare("
        SELECT COUNT(*) FROM store_assignments
        WHERE assigned_to = ?
          AND assigned_to IS NOT NULL
          AND TRIM(assigned_to) <> ''
          AND TRIM(assigned_to) <> 'بدون تعيين'
          AND assignment_queue = 'active'
          AND workflow_status IN ('active', 'no_answer')
    ");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

/**
 * عدد تعيينات «نشط» فقط — عند «لم يرد» ينقص العدد فيُستدعى fill لإضافة متجر ساخن جديد (صف لم يرد يبقى في المتابعة وليس في جدول المهام).
 */
function count_inactive_queue(PDO $pdo, $username) {
    $st = $pdo->prepare("SELECT COUNT(*) FROM store_assignments WHERE assigned_to = ? AND workflow_status = 'active' AND assignment_queue = 'inactive'");
    $st->execute([$username]);
    return (int) $st->fetchColumn();
}

/** لم يعد يُستخدم — العرض يقتصر على 50 في الاستعلام والتعبئة تضبط العدد فقط. */
function trim_active_queue_excess(PDO $pdo, $username) {
    return 0;
}

function cleanup_completed_assignments(PDO $pdo, $username, $queue) {
    $u = trim((string) $username);
    $q = $queue === 'inactive' ? 'inactive' : 'active';
    if ($u === '') {
        return;
    }
    $pdo->prepare("
        DELETE FROM store_assignments
        WHERE assigned_to = ?
        AND workflow_status = 'completed'
        AND assignment_queue = ?
        AND workflow_updated_at < DATE_FORMAT(CURDATE(), '%Y-%m-01')
    ")->execute([$u, $q]);
}

function assign_store_to_user(PDO $pdo, $storeId, $storeName, $username, $assignedBy) {
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue)
        VALUES (?, ?, ?, ?, '', 'active', 'active')
        ON DUPLICATE KEY UPDATE
            assigned_to = VALUES(assigned_to),
            assigned_by = VALUES(assigned_by),
            store_name = VALUES(store_name),
            workflow_status = 'active',
            assignment_queue = 'active',
            assigned_at = CURRENT_TIMESTAMP
    ")->execute([$sid, $storeName, $username, $assignedBy]);
}

function inactive_pipeline_where_sql() {
    return "ss.category IN ('hot_inactive','cold_inactive')";
}

/** طابور مهام مسؤول الاستعادة اليومية: تعيين من «غير نشط ساخن» فقط (لا البارد). */
function inactive_hot_pipeline_where_sql() {
    return "ss.category = 'hot_inactive'";
}

/**
 * خريطة store_id => إجمالي الشحنات من stores_search_lite.json (يُحدَّث مع all-stores.php).
 *
 * @return array<string,int>
 */
function wf_lite_total_shipments_map(): array {
    static $map = null;
    if ($map !== null) {
        return $map;
    }
    $map = [];
    $path = __DIR__ . '/cache/stores_search_lite.json';
    if (is_readable($path)) {
        $list = json_decode((string) file_get_contents($path), true);
        if (is_array($list)) {
            foreach ($list as $row) {
                if (!is_array($row) || !isset($row['id'])) {
                    continue;
                }
                $id = (string) (int) $row['id'];
                if ($id === '0') {
                    continue;
                }
                $map[$id] = (int) ($row['total_shipments'] ?? 0);
            }
        }
    }

    return $map;
}

/**
 * خريطة store_id => عدد الطرود ضمن آخر نطاق جُلب بـ orders-summary.php (يُحدَّث عند فتح التطبيق / جلب النطاق).
 *
 * @return array<string,int>
 */
function wf_orders_range_shipments_map(): array {
    static $map = null;
    if ($map !== null) {
        return $map;
    }
    $map = [];
    $path = __DIR__ . '/cache/orders_range_shipments.json';
    if (!is_readable($path)) {
        return $map;
    }
    $j = json_decode((string) file_get_contents($path), true);
    if (!is_array($j) || !isset($j['counts']) || !is_array($j['counts'])) {
        return $map;
    }
    foreach ($j['counts'] as $k => $v) {
        $id = (string) (int) $k;
        if ($id === '0') {
            continue;
        }
        $map[$id] = (int) $v;
    }

    return $map;
}

/**
 * عدد الطرود/الطلبات المعتمد لطابور الاستعادة: max(طرود نطاق orders-summary، إجمالي الشحنات من الصف/lite)
 * حتى لا يُصنَّف متجر بإجمالي عالٍ كـ «صفر طرود» فقط لأن النطاق الأخير صفر.
 */
function wf_inactive_priority_parcel_count(array $row): int {
    $sidNorm = (string) (int) preg_replace('/\D+/', '', (string) ($row['store_id'] ?? ''));
    $total = (int) ($row['total_shipments'] ?? 0);
    if ($sidNorm === '0') {
        return $total;
    }
    $rangeMap = wf_orders_range_shipments_map();
    if (array_key_exists($sidNorm, $rangeMap)) {
        return max((int) $rangeMap[$sidNorm], $total);
    }

    return $total;
}

/** للسحب التلقائي من المجمع: يُفضّل متاجر طرودها المعتمدة أعلى من الحد */
function wf_inactive_pool_pick_meets_priority_floor(array $row): bool {
    return wf_inactive_priority_parcel_count($row) > (int) INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS;
}

/**
 * يُلغى تعيين inactive (نشط / لم يرد) إذا لم يبلغ المتجر حد الطرود — ليُستبدل من المجمع بمتاجر أقوى حتى يكتمل الـ50.
 *
 * @return int عدد الصفوف المُحذوفة
 */
function release_inactive_assignments_below_parcel_threshold(PDO $pdo, string $username): int {
    $u = trim($username);
    if ($u === '') {
        return 0;
    }
    /** يُستبدل فقط التعيين «نشط» ذو طرود معتمدة منخفضة — «لم يرد» يبقى حتى يُعاد الاتصال أو يُكمّل */
    $st = $pdo->prepare("
        SELECT store_id FROM store_assignments
        WHERE assigned_to = ? AND assignment_queue = 'inactive'
        AND workflow_status = 'active'
    ");
    $st->execute([$u]);
    $lite = wf_lite_total_shipments_map();
    $released = 0;
    $minShip = (int) INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS;
    while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
        $sid = (string) ($r['store_id'] ?? '');
        $norm = (string) (int) preg_replace('/\D+/', '', $sid);
        $row = [
            'store_id'        => $sid,
            'total_shipments' => (int) ($lite[$norm] ?? 0),
        ];
        if (wf_inactive_priority_parcel_count($row) > $minShip) {
            continue;
        }
        $del = $pdo->prepare("
            DELETE FROM store_assignments
            WHERE assigned_to = ? AND assignment_queue = 'inactive'
            AND workflow_status = 'active'
            AND CAST(store_id AS CHAR) = CAST(? AS CHAR)
        ");
        $del->execute([$u, $sid]);
        $released += $del->rowCount();
    }

    return $released;
}

/**
 * ترتيب مرشحي الاستعادة: أولاً عدد الطرود المعتمد > الحد (الأعلى أولاً)، ثم store_id.
 *
 * @param list<array{store_id:mixed,store_name?:string,total_shipments?:int,...}> $rows
 */
function wf_sort_inactive_recovery_candidates(array &$rows): void {
    $min = (int) INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS;
    usort($rows, static function (array $a, array $b) use ($min): int {
        $sa = wf_inactive_priority_parcel_count($a);
        $sb = wf_inactive_priority_parcel_count($b);
        $pa = $sa > $min ? 1 : 0;
        $pb = $sb > $min ? 1 : 0;
        if ($pb !== $pa) {
            return $pb <=> $pa;
        }
        if ($sb !== $sa) {
            return $sb <=> $sa;
        }
        $ida = (string) ($a['store_id'] ?? '');
        $idb = (string) ($b['store_id'] ?? '');

        return strcmp($ida, $idb);
    });
}

/**
 * ترتيب صفوف مهام مسؤول الاستعادة المعروضة: نفس أولوية الطرود، ثم assigned_at.
 *
 * @param list<array<string,mixed>> $rows
 * @return list<array<string,mixed>>
 */
function wf_sort_inactive_manager_task_rows(array $rows): array {
    $min = (int) INACTIVE_RECOVERY_PRIORITY_MIN_SHIPMENTS;
    usort($rows, static function (array $a, array $b) use ($min): int {
        $sa = wf_inactive_priority_parcel_count($a);
        $sb = wf_inactive_priority_parcel_count($b);
        $pa = $sa > $min ? 1 : 0;
        $pb = $sb > $min ? 1 : 0;
        if ($pb !== $pa) {
            return $pb <=> $pa;
        }
        if ($sb !== $sa) {
            return $sb <=> $sa;
        }
        $ta = strtotime((string) ($a['assigned_at'] ?? '')) ?: 0;
        $tb = strtotime((string) ($b['assigned_at'] ?? '')) ?: 0;
        if ($ta !== $tb) {
            return $ta <=> $tb;
        }

        return strcmp((string) ($a['store_id'] ?? ''), (string) ($b['store_id'] ?? ''));
    });

    return $rows;
}

/**
 * نفس مصدر الواجهة: ملف يُحدَّث عند كل تشغيل لـ all-stores.php
 * (تصنيف ساخن/بارد يُحسب من API وليس مخزّناً في store_states لكل متجر).
 */
function pick_next_inactive_pool_store(PDO $pdo) {
    $cacheFile = __DIR__ . '/cache/inactive_recovery_pool.json';
    if (is_readable($cacheFile)) {
        $raw = @file_get_contents($cacheFile);
        $j = is_string($raw) ? json_decode($raw, true) : null;
        $stores = is_array($j) && isset($j['stores']) && is_array($j['stores']) ? $j['stores'] : [];
        if ($stores !== []) {
            /** أي تعيين inactive (بما فيه completed) يمنع إعادة سحب المتجر — وإلا ON DUPLICATE يعيد الحالة إلى active ويُفقد «تم التواصل». */
            $stmt = $pdo->query("SELECT store_id FROM store_assignments WHERE assignment_queue = 'inactive'");
            $assigned = [];
            while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $assigned[(string) ($row['store_id'] ?? '')] = true;
            }
            $liteShip = wf_lite_total_shipments_map();
            $pickFloor = static function (bool $requirePriorityFloor) use ($stores, $assigned, $liteShip): ?array {
                $candidates = [];
                foreach ($stores as $row) {
                    $sid = isset($row['store_id']) ? (string) $row['store_id'] : '';
                    $bucket = (string) ($row['bucket'] ?? '');
                    if ($bucket === 'cold_inactive') {
                        continue;
                    }
                    if ($sid === '' || isset($assigned[$sid])) {
                        continue;
                    }
                    $sidNorm = (string) (int) preg_replace('/\D+/', '', $sid);
                    $ts = isset($row['total_shipments']) ? (int) $row['total_shipments'] : (int) ($liteShip[$sidNorm] ?? 0);
                    $cand = [
                        'store_id'        => $row['store_id'],
                        'store_name'      => $row['store_name'] ?? '',
                        'total_shipments' => $ts,
                    ];
                    if ($requirePriorityFloor && !wf_inactive_pool_pick_meets_priority_floor($cand)) {
                        continue;
                    }
                    $candidates[] = $cand;
                }
                if ($candidates === []) {
                    return null;
                }
                wf_sort_inactive_recovery_candidates($candidates);

                return $candidates[0];
            };
            $first = $pickFloor(true) ?? $pickFloor(false);
            if ($first !== null) {
                return [
                    'store_id'   => $first['store_id'],
                    'store_name' => $first['store_name'] ?? '',
                ];
            }

            return null;
        }
    }

    return pick_next_inactive_pool_store_from_store_states($pdo);
}

/** احتياطي: متاجر مسجّلة في store_states كساخن/بارد فقط */
function pick_next_inactive_pool_store_from_store_states(PDO $pdo) {
    $sql = "
        SELECT ss.store_id, ss.store_name
        FROM store_states ss
        WHERE " . inactive_hot_pipeline_where_sql() . "
        AND CAST(ss.store_id AS CHAR) NOT IN (
            SELECT store_id FROM store_assignments WHERE assignment_queue = 'inactive'
        )
        ORDER BY ss.store_id ASC
    ";
    $stmt = $pdo->query($sql);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
    if ($rows === []) {
        return null;
    }
    $liteShip = wf_lite_total_shipments_map();
    $candidates = [];
    foreach ($rows as $r) {
        $sidNorm = (string) (int) preg_replace('/\D+/', '', (string) ($r['store_id'] ?? ''));
        $cand = [
            'store_id'        => $r['store_id'],
            'store_name'      => $r['store_name'] ?? '',
            'total_shipments' => (int) ($liteShip[$sidNorm] ?? 0),
        ];
        $candidates[] = $cand;
    }
    $withFloor = array_values(array_filter($candidates, static function (array $c): bool {
        return wf_inactive_pool_pick_meets_priority_floor($c);
    }));
    $pool = $withFloor !== [] ? $withFloor : $candidates;
    wf_sort_inactive_recovery_candidates($pool);
    $first = $pool[0];

    return [
        'store_id'   => $first['store_id'],
        'store_name' => $first['store_name'] ?? '',
    ];
}

function assign_inactive_store_to_user(PDO $pdo, $storeId, $storeName, $username, $assignedBy) {
    $sid = (string) $storeId;
    $pdo->prepare("
        INSERT INTO store_assignments (store_id, store_name, assigned_to, assigned_by, notes, workflow_status, assignment_queue)
        VALUES (?, ?, ?, ?, '', 'active', 'inactive')
        ON DUPLICATE KEY UPDATE
            assigned_to = VALUES(assigned_to),
            assigned_by = VALUES(assigned_by),
            store_name = VALUES(store_name),
            workflow_status = 'active',
            assignment_queue = 'inactive',
            assigned_at = CURRENT_TIMESTAMP
    ")->execute([$sid, $storeName, $username, $assignedBy]);
}

function fill_inactive_slots_for_user(PDO $pdo, $username, $assignedBy, $maxToAdd = null) {
    ensure_workflow_schema($pdo);
    ensure_inactive_daily_stats_schema($pdo);
    cleanup_completed_assignments($pdo, $username, 'inactive');
    /** إيقاف التعبئة عند بلوغ 50 «تم التواصل» يومياً — لا يُمنع بـ employee_daily_processed_stores (50 معالجة عامة) وإلا لا يُستبدل متجر بعد «لم يرد». */
    if (get_inactive_daily_success_count($pdo, $username) >= INACTIVE_DAILY_SUCCESS_TARGET) {
        return 0;
    }
    release_inactive_assignments_below_parcel_threshold($pdo, (string) $username);
    $have = count_inactive_queue($pdo, $username);
    $need = INACTIVE_QUEUE_TARGET - $have;
    if ($need <= 0) {
        return 0;
    }
    if ($maxToAdd !== null) {
        $need = min($need, (int) $maxToAdd);
    }
    $added = 0;
    while ($need > 0) {
        $row = pick_next_inactive_pool_store($pdo);
        if (!$row) {
            break;
        }
        assign_inactive_store_to_user($pdo, $row['store_id'], $row['store_name'] ?? '', $username, $assignedBy);
        $added++;
        $need--;
    }
    return $added;
}

/**
 * تعبئة طابور مسؤول النشط حتى ACTIVE_QUEUE_TARGET — من متاجر «نشط يشحن» غير المُعيَّنة في الطابور.
 * يُستدعى بعد «لم يرد» (لا يُحتسب ضمن الـ50) أو بعد إكمال/إطلاق من الطابور لإحلال متجر آخر.
 */
function fill_slots_for_user(PDO $pdo, $username, $assignedBy, $maxToAdd = null) {
    ensure_workflow_schema($pdo);
    cleanup_completed_assignments($pdo, $username, 'active');
    require_once __DIR__ . '/daily-quota-lib.php';
    nawras_ensure_daily_quota_schema($pdo);
    if (getDailyProgress($pdo, $username)['quota_reached']) {
        return 0;
    }
    /**
     * كان العدّ يعتمد على كل التعيينات بحالة «active» فيُعتبر الطابور ممتلئاً (50)
     * بينما الواجهة تعرض فقط «بلا مكالمة اليوم» — فيبقى صف واحد ظاهراً.
     * نعبّئ حتى ACTIVE_QUEUE_TARGET صفاً تحتاج أول مكالمة اليوم، مع سقف إجمالي للصفوف.
     */
    $pending = count_pending_active_queue($pdo, $username);
    $totalRows = count_total_active_workflow_assignments($pdo, $username);
    $need = ACTIVE_QUEUE_TARGET - $pending;
    if ($need <= 0) {
        return 0;
    }
    $room = max(0, (int) MAX_ACTIVE_ASSIGNMENTS_TOTAL_PER_USER - $totalRows);
    $need = min($need, $room);
    if ($need <= 0) {
        return 0;
    }
    if ($maxToAdd !== null) {
        $need = min($need, (int) $maxToAdd);
    }
    $added = 0;
    while ($need > 0) {
        $row = pick_next_pool_store_for_user($pdo, $username);
        if (!$row || !isset($row['store_id'])) {
            break;
        }
        $sid = (int) $row['store_id'];
        if ($sid <= 0) {
            break;
        }
        assign_store_to_user($pdo, $sid, (string) ($row['store_name'] ?? ''), $username, $assignedBy);
        log_active_manager_pool_pick($pdo, $username, $sid);
        $added++;
        $need--;
    }
    return $added;
}

/**
 * مزامنة سعة طابور المتابعة الدورية لمسؤول المتاجر النشطة.
 * تُستدعى مباشرة بعد أي تغيير حالة يحرّر خانة من أصل 50.
 */
function sync_active_queue_capacity(PDO $pdo, $username, $assignedBy, $maxToAdd = null) {
    return fill_slots_for_user($pdo, $username, $assignedBy, $maxToAdd);
}

/**
 * إحلال فوري: عند خروج متجر من الحسبة النشطة نضيف بديلاً واحداً في آخر القائمة.
 */
function replace_one_active_queue_slot(PDO $pdo, $username, $assignedBy) {
    return sync_active_queue_capacity($pdo, $username, $assignedBy, 1);
}

/**
 * تعبئة جميع مسؤولي النشط ثم مسؤولي الاستعادة — للـ cron والمدير التنفيذي
 */
function fill_all_active_and_inactive_queues(PDO $pdo, $assignedByLabel) {
    ensure_workflow_schema($pdo);
    $filled_active = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'active_manager'");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $u) {
        $filled_active[$u] = fill_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    $filled_inactive = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
    foreach ($stmt->fetchAll(PDO::FETCH_COLUMN) as $u) {
        $filled_inactive[$u] = fill_inactive_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    return [
        'filled_active_per_user'   => $filled_active,
        'filled_inactive_per_user' => $filled_inactive,
        'active_queue_target'      => ACTIVE_QUEUE_TARGET,
        'inactive_queue_target'    => INACTIVE_QUEUE_TARGET,
    ];
}

/**
 * تعبئة طابور الاستعادة فقط — حتى INACTIVE_QUEUE_TARGET لكل inactive_manager
 */
function fill_all_inactive_managers_only(PDO $pdo, $assignedByLabel) {
    ensure_workflow_schema($pdo);
    $filled_inactive = [];
    $stmt = $pdo->query("SELECT username FROM users WHERE role = 'inactive_manager'");
    $users = $stmt->fetchAll(PDO::FETCH_COLUMN);
    foreach ($users as $u) {
        $filled_inactive[$u] = fill_inactive_slots_for_user($pdo, $u, $assignedByLabel, null);
    }
    return [
        'filled_inactive_per_user' => $filled_inactive,
        'inactive_queue_target'    => INACTIVE_QUEUE_TARGET,
        'inactive_managers_found'  => count($users),
    ];
}

/**
 * بعد «تم التواصل» من الطابور أو إكمال الاستبيان: يضمن ظهور المتجر في «المتاجر المنجزة»
 * (all-stores.php يفرز من active_shipping حسب store_states.category = completed).
 * إن لم يوجد صف في store_states يُنشَأ صف منجز؛ وإن كان التصنيف نشطاً/احتضاناً يُحدَّث إلى منجز.
 */
function workflow_mark_active_store_contacted_completed(PDO $pdo, $storeId, $storeName, $username) {
    $storeId = (int) $storeId;
    if ($storeId <= 0) {
        return;
    }
    $storeName = (string) $storeName;
    $username = trim((string) $username);

    $upd = $pdo->prepare("
        UPDATE store_states
        SET category = 'completed',
            last_call_date = NOW(),
            updated_by = ?
        WHERE store_id = ?
        AND category IN ('active_pending_calls','active','active_shipping','unreachable','incubating')
    ");
    $upd->execute([$username, $storeId]);
    if ($upd->rowCount() > 0) {
        return;
    }

    $chk = $pdo->prepare('SELECT category FROM store_states WHERE store_id = ? LIMIT 1');
    $chk->execute([$storeId]);
    $row = $chk->fetch(PDO::FETCH_ASSOC);
    if (!$row) {
        try {
            $pdo->prepare("
                INSERT INTO store_states (store_id, store_name, category, last_call_date, updated_by)
                VALUES (?, ?, 'completed', NOW(), ?)
            ")->execute([$storeId, $storeName, $username]);
        } catch (Throwable $e) {
            try {
                $pdo->prepare("
                    INSERT INTO store_states (store_id, store_name, category, updated_by)
                    VALUES (?, ?, 'completed', ?)
                ")->execute([$storeId, $storeName, $username]);
            } catch (Throwable $e2) {
            }
        }
        return;
    }

    $cat = (string) ($row['category'] ?? '');
    if (in_array($cat, ['frozen', 'restoring'], true)) {
        return;
    }
    if ($cat === 'completed' || $cat === 'contacted') {
        try {
            $pdo->prepare('UPDATE store_states SET last_call_date = NOW(), updated_by = ? WHERE store_id = ?')
                ->execute([$username, $storeId]);
        } catch (Throwable $e) {
        }
        return;
    }

    try {
        $pdo->prepare("
            UPDATE store_states
            SET category = 'completed', last_call_date = NOW(), updated_by = ?
            WHERE store_id = ?
        ")->execute([$username, $storeId]);
    } catch (Throwable $e) {
        $pdo->prepare("
            UPDATE store_states SET category = 'completed', updated_by = ?
            WHERE store_id = ?
        ")->execute([$username, $storeId]);
    }
}

/**
 * «لم يرد» من طابور المتابعة النشط = نفس خانة «لم يتم الوصول للمتجر» في نشط يشحن
 * (all-stores.php يفرز unreachable من active_shipping عند category = unreachable).
 */
function workflow_mark_active_store_no_answer_unreachable(PDO $pdo, $storeId, $storeName, $username) {
    $storeId = (int) $storeId;
    if ($storeId <= 0) {
        return;
    }
    $storeName = (string) $storeName;
    $username = trim((string) $username);

    $chk = $pdo->prepare('SELECT category FROM store_states WHERE store_id = ? LIMIT 1');
    $chk->execute([$storeId]);
    $row = $chk->fetch(PDO::FETCH_ASSOC);
    if ($row) {
        $cat = (string) ($row['category'] ?? '');
        if (in_array($cat, ['frozen', 'restoring', 'completed', 'contacted'], true)) {
            return;
        }
    }

    $upd = $pdo->prepare("
        UPDATE store_states
        SET category = 'unreachable',
            last_call_date = NOW(),
            updated_by = ?
        WHERE store_id = ?
        AND category IN ('active_pending_calls','active','active_shipping','unreachable','incubating')
    ");
    $upd->execute([$username, $storeId]);
    if ($upd->rowCount() > 0) {
        return;
    }

    if (!$row) {
        try {
            $pdo->prepare("
                INSERT INTO store_states (store_id, store_name, category, last_call_date, updated_by)
                VALUES (?, ?, 'unreachable', NOW(), ?)
            ")->execute([$storeId, $storeName, $username]);
        } catch (Throwable $e) {
            try {
                $pdo->prepare("
                    INSERT INTO store_states (store_id, store_name, category, updated_by)
                    VALUES (?, ?, 'unreachable', ?)
                ")->execute([$storeId, $storeName, $username]);
            } catch (Throwable $e2) {
            }
        }
        return;
    }

    // صف موجود لكن ليس ضمن مسار نشط يشحن — لا نغيّر الفئة (مثلاً inactive) لتجنّب أخطاء بيانات
}

/**
 * عند «تم الرد» في مكالمة عامة لمسؤول المتاجر: إكمال تعيين الطابور النشط.
 * يُصلح بقاء workflow_status = no_answer رغم تسجيل مكالمة ناجحة (قبل استدعاء release_after_survey أو عند فشله).
 */
function workflow_try_complete_active_assignment_on_answered(PDO $pdo, $storeId, $storeName, $username) {
    $storeId = (int) $storeId;
    $username = trim((string) $username);
    if ($storeId <= 0 || $username === '') {
        return false;
    }
    ensure_workflow_schema($pdo);
    $sid = (string) $storeId;
    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'completed', workflow_updated_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'active'
        AND workflow_status IN ('active','no_answer')
    ");
    $upd->execute([$sid, $username]);
    if ($upd->rowCount() === 0) {
        return false;
    }
    workflow_mark_active_store_contacted_completed($pdo, $storeId, (string) $storeName, $username);
    return true;
}

function active_manager_open_periodic_assignment(PDO $pdo, $storeId, $username) {
    ensure_workflow_schema($pdo);
    $sid = (string) (is_numeric($storeId) ? (int) $storeId : (int) preg_replace('/\D+/', '', (string) $storeId));
    $u = trim((string) $username);
    if ($sid === '0' || $u === '') {
        return false;
    }
    $st = $pdo->prepare("
        SELECT 1 FROM store_assignments
        WHERE store_id = ? AND assigned_to = ? AND assignment_queue = 'active'
        AND workflow_status IN ('active','no_answer')
        LIMIT 1
    ");
    $st->execute([$sid, $u]);
    return (bool) $st->fetchColumn();
}

/**
 * بعد تسجيل مكالمة busy/no_answer: نقل التعيين إلى «عدم الرد» وإحلال من المجمع (سجل المكالمة مُدخل مسبقاً من log_call).
 */
function workflow_sync_active_queue_after_no_success_call(PDO $pdo, $storeId, $storeName, $username) {
    ensure_workflow_schema($pdo);
    $sid = (string) (is_numeric($storeId) ? (int) $storeId : (int) preg_replace('/\D+/', '', (string) $storeId));
    $u = trim((string) $username);
    if ($sid === '0' || $u === '') {
        return false;
    }
    $upd = $pdo->prepare("
        UPDATE store_assignments
        SET workflow_status = 'no_answer', workflow_updated_at = NOW(), assigned_at = NOW()
        WHERE store_id = ? AND assigned_to = ? AND workflow_status = 'active' AND assignment_queue = 'active'
    ");
    $upd->execute([$sid, $u]);
    if ($upd->rowCount() === 0) {
        return false;
    }
    workflow_mark_active_store_no_answer_unreachable($pdo, (int) $storeId, (string) $storeName, $u);
    return true;
}
