<?php
/**
 * معدل الاحتفاظ بالعملاء (Customer Retention Rate) — من المتاجر النشطة.
 *
 * الفترة: الشهر الحالي (حتى اليوم) مقابل الشهر الماضي (كاملاً)، بتوقيت الرياض.
 * عميل "نشط" في فترة ما = متجر له طرد واحد على الأقل ضمن نطاق تلك الفترة (عبر orders-summary
 * الخاص بمنصة Nawris، بنفس منطق orders-summary.php).
 *
 * المعادلة: عدد المتاجر النشطة في كلا الفترتين (مستمرة) ÷ عدد المتاجر النشطة في بداية الفترة × 100.
 */
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

/** يجلب معرّفات المتاجر التي لديها طرد واحد على الأقل ضمن from..to (نفس منطق orders-summary.php) */
function retention_fetch_active_store_ids(string $from, string $to): array
{
    $storeMap  = [];
    $cursor    = null;
    $page      = 0;

    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . $from . '&to=' . $to;
        if ($cursor) {
            $url .= '&cursor=' . urlencode($cursor);
        }

        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $response = curl_exec($ch);
        $curlErr  = curl_errno($ch);
        curl_close($ch);

        if ($curlErr || !$response) {
            break;
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            break;
        }

        if (isset($data['data']) && is_array($data['data'])) {
            foreach ($data['data'] as $store) {
                $sid = $store['id'] ?? null;
                if ($sid === null) {
                    continue;
                }
                /* total_shipments هو إجمالي تاريخي غير مرتبط بـ from/to — لا يصلح لتحديد النشاط ضمن الفترة.
                   shipments_in_range هو المرتبط فعلياً بنطاق التاريخ الممرَّر. */
                if ((int) ($store['shipments_in_range'] ?? 0) > 0) {
                    $storeMap[(int) $sid] = true;
                }
            }
        }

        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;
    } while ($cursor && $page < MAX_PAGES_ALL);

    return array_keys($storeMap);
}

$tz  = new DateTimeZone('Asia/Riyadh');
$now = new DateTimeImmutable('now', $tz);

$currentMonthStart = $now->modify('first day of this month');
$previousMonthEnd   = $currentMonthStart->modify('-1 day');
$previousMonthStart = $previousMonthEnd->modify('first day of this month');

$periodEndFrom = $currentMonthStart->format('Y-m-d');
$periodEndTo   = $now->format('Y-m-d');
$periodStartFrom = $previousMonthStart->format('Y-m-d');
$periodStartTo   = $previousMonthEnd->format('Y-m-d');

$startIds = retention_fetch_active_store_ids($periodStartFrom, $periodStartTo);
$endIds   = retention_fetch_active_store_ids($periodEndFrom, $periodEndTo);

$startCount    = count($startIds);
$retainedCount = count(array_intersect($startIds, $endIds));

$retentionPercent = $startCount > 0
    ? round(100 * $retainedCount / $startCount, 1)
    : null;

echo json_encode([
    'success'              => true,
    'retention_percent'    => $retentionPercent,
    'retained_count'       => $retainedCount,
    'start_count'          => $startCount,
    'end_active_count'     => count($endIds),
    'period_start_label'   => $previousMonthStart->format('Y/m'),
    'period_end_label'     => $currentMonthStart->format('Y/m'),
    'period_start_from'    => $periodStartFrom,
    'period_start_to'      => $periodStartTo,
    'period_end_from'      => $periodEndFrom,
    'period_end_to'        => $periodEndTo,
    'rule'                 => 'نشط = طرد واحد على الأقل ضمن الفترة؛ الاحتفاظ = نشط في الفترتين ÷ نشط في بداية الفترة × 100',
    'generated_at'         => date('c'),
], JSON_UNESCAPED_UNICODE);
