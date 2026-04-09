<?php
/**
 * تصحيح تراكمي: متجر له استبيان رضا (active_csat) ومكالمة نجاح في السجل
 * وما زال في مسار «نشط يشحن» → منجز + إكمال تعيين المتابعة الدورية إن وُجد.
 */
require_once __DIR__ . '/workflow-queue-lib.php';

function workflow_retroactive_complete_from_csat_and_answered(PDO $pdo, $batchLimit = 35) {
    ensure_workflow_schema($pdo);
    $limit = max(1, min(150, (int) $batchLimit));

    $sql = "
        SELECT DISTINCT s.store_id
        FROM surveys s
        INNER JOIN call_logs cl ON CAST(cl.store_id AS CHAR) = CAST(s.store_id AS CHAR)
        INNER JOIN store_states ss ON ss.store_id = s.store_id
        WHERE COALESCE(s.survey_kind, '') = 'active_csat'
        AND ss.category IN ('active_pending_calls', 'active', 'active_shipping', 'unreachable')
        AND (
            cl.outcome IN ('answered', 'callback')
            OR cl.outcome IS NULL
            OR TRIM(COALESCE(cl.outcome, '')) = ''
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
