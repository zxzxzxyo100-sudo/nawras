<?php
/**
 * بناء قائمة «بورصة الرضا اليوم» من جدول surveys — للداشبورد فقط.
 */
function nawras_build_daily_staff_missions(PDO $pdo) {
    $dailyStaffMissions = [];
    try {
        try {
            $pdo->exec('ALTER TABLE surveys ADD COLUMN satisfaction_score VARCHAR(16) NULL DEFAULT NULL');
        } catch (Throwable $e) {
        }
        try {
            $pdo->exec('ALTER TABLE surveys ADD COLUMN satisfaction_gap_tags JSON NULL DEFAULT NULL');
        } catch (Throwable $e) {
        }
        $st = $pdo->query("
            SELECT id, submitted_username, satisfaction_score, satisfaction_gap_tags, survey_kind
            FROM surveys
            WHERE DATE(created_at) = CURDATE()
            AND submitted_username IS NOT NULL AND TRIM(submitted_username) <> ''
            AND COALESCE(survey_kind, '') IN ('active_csat', 'new_merchant_onboarding')
            AND satisfaction_score IS NOT NULL AND TRIM(satisfaction_score) <> ''
        ");
        $byUser = [];
        while ($r = $st->fetch(PDO::FETCH_ASSOC)) {
            $u = trim((string) ($r['submitted_username'] ?? ''));
            if ($u === '') {
                continue;
            }
            if (!isset($byUser[$u])) {
                $byUser[$u] = [];
            }
            $byUser[$u][] = $r;
        }
        foreach ($byUser as $uname => $rows) {
            $anyDown = false;
            $anyMid = false;
            $tags = [];
            foreach ($rows as $row) {
                $sc = (string) ($row['satisfaction_score'] ?? '');
                if ($sc === 'down' || $sc === 'mid') {
                    if ($sc === 'down') {
                        $anyDown = true;
                    }
                    if ($sc === 'mid') {
                        $anyMid = true;
                    }
                    $j = $row['satisfaction_gap_tags'] ?? '';
                    if ($j !== '' && $j !== null) {
                        $dec = json_decode((string) $j, true);
                        if (is_array($dec)) {
                            foreach ($dec as $t) {
                                if ($t !== '' && $t !== null) {
                                    $tags[] = (string) $t;
                                }
                            }
                        }
                    }
                }
            }
            $tags = array_values(array_unique($tags));
            $fullname = $uname;
            $role = '';
            $st2 = $pdo->prepare('SELECT fullname, role FROM users WHERE username = ? LIMIT 1');
            $st2->execute([$uname]);
            $ur = $st2->fetch(PDO::FETCH_ASSOC);
            if ($ur) {
                $fullname = trim((string) ($ur['fullname'] ?? '')) !== '' ? $ur['fullname'] : $uname;
                $role = (string) ($ur['role'] ?? '');
            }
            if ($anyDown) {
                $dailyStaffMissions[] = [
                    'username' => $uname,
                    'fullname' => $fullname,
                    'role' => $role,
                    'satisfaction_arrow' => 'down',
                    'gap_tags' => $tags,
                    'answered_surveys_today' => count($rows),
                ];
            } elseif ($anyMid) {
                $dailyStaffMissions[] = [
                    'username' => $uname,
                    'fullname' => $fullname,
                    'role' => $role,
                    'satisfaction_arrow' => 'mid',
                    'gap_tags' => $tags,
                    'answered_surveys_today' => count($rows),
                ];
            } else {
                $allUp = true;
                foreach ($rows as $row) {
                    if (($row['satisfaction_score'] ?? '') !== 'up') {
                        $allUp = false;
                        break;
                    }
                }
                if ($allUp && count($rows) > 0) {
                    $dailyStaffMissions[] = [
                        'username' => $uname,
                        'fullname' => $fullname,
                        'role' => $role,
                        'satisfaction_arrow' => 'up',
                        'gap_tags' => [],
                        'answered_surveys_today' => count($rows),
                    ];
                }
            }
        }
    } catch (Throwable $e) {
        return [];
    }

    return $dailyStaffMissions;
}
