<?php
/**
 * تصحيح: استبيان active_csat + مكالمة outcome=answered قبل وقت حفظ الاستبيان
 * والتعيين/الحالة ما زالا في مسار المتابعة → منجز (دفعات محدودة لكل طلب).
 */
require_once __DIR__ . '/workflow-queue-lib.php';

function workflow_retroactive_complete_from_csat_and_answered(PDO $pdo, $batchLimit = 80) {
    ensure_workflow_schema($pdo);
    try {
        $pdo->exec('ALTER TABLE call_logs ADD COLUMN outcome VARCHAR(32) NULL DEFAULT NULL AFTER note');
    } catch (Throwable $e) {
    }
    $limit = max(1, min(200, (int) $batchLimit));

    $sql = "
        SELECT DISTINCT s.store_id
        FROM surveys s
        WHERE COALESCE(s.survey_kind, '') = 'active_csat'
        AND EXISTS (
            SELECT 1 FROM call_logs cl
            WHERE CAST(cl.store_id AS CHAR) = CAST(s.store_id AS CHAR)
            AND cl.outcome = 'answered'
            AND cl.created_at <= s.created_at
        )
        LIMIT " . (int) $limit . "
    ";
    $stmt = $pdo->query($sql);
    $ids = $stmt ? $stmt->fetchAll(PDO::FETCH_COLUMN) : [];
    if (!$ids) {
        return ['fixed_states' => 0, 'fixed_assignments' => 0];
    }
    $fixedStates = 0;
    $fixedAsg = 0;
    foreach ($ids as $rawSid) {
        $sid = (int) $rawSid;
        if ($sid <= 0) {
            continue;
        }
        $st = $pdo->prepare("
            UPDATE store_states
            SET category = 'completed', last_call_date = NOW(), updated_by = 'retro_csat'
            WHERE store_id = ?
            AND category IN ('active_pending_calls','active','active_shipping','unreachable')
        ");
        $st->execute([$sid]);
        if ($st->rowCount() > 0) {
            $fixedStates++;
        }
        $sidStr = (string) $sid;
        $u = $pdo->prepare("
            UPDATE store_assignments
            SET workflow_status = 'completed', workflow_updated_at = NOW(),
                assigned_by = IF(assigned_by = '' OR assigned_by IS NULL, 'retro_csat', assigned_by)
            WHERE store_id = ? AND assignment_queue = 'active' AND workflow_status IN ('active','no_answer')
        ");
        $u->execute([$sidStr]);
        $fixedAsg += $u->rowCount();
    }
    return ['fixed_states' => $fixedStates, 'fixed_assignments' => $fixedAsg];
}
