<?php
/**
 * معدل الاحتفاظ بالعملاء (Customer Retention Rate) — من المتاجر النشطة.
 *
 * "نشط" هنا يطابق تعريف «نشط يشحن» في store-lifecycle-lib.php: متجر شحن خلال آخر 14 يوماً
 * من تاريخ مرجعي معيّن (active_days = 14 — بعد يوم 15 يتحول إلى hot_inactive). نتحقق من ذلك عبر
 * shipments_in_range ضمن نافذة متحركة من 14 يوماً تنتهي عند التاريخ المرجعي (بدل شهر تقويمي كامل).
 *
 * التاريخ المرجعي لبداية الفترة = نهاية الشهر الماضي (بداية الشهر الحالي). لنهاية الفترة = اليوم —
 * لذلك «نشطون في نهاية الفترة» يطابق تقريباً عدّاد «نشط يشحن» الحي في الداشبورد.
 *
 * المعادلة: عدد المتاجر النشطة في كلا التاريخين المرجعيين (مستمرة) ÷ عدد المتاجر النشطة في بداية الفترة × 100.
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

const ACTIVE_WINDOW_DAYS = 14;

$tz  = new DateTimeZone('Asia/Riyadh');
$now = new DateTimeImmutable('now', $tz);

$currentMonthStart = $now->modify('first day of this month');
$previousMonthEnd  = $currentMonthStart->modify('-1 day');

/** تاريخان مرجعيان: بداية الفترة (نهاية الشهر الماضي) ونهاية الفترة (اليوم) */
$refStart = $previousMonthEnd;
$refEnd   = $now;

/** نافذة 14 يوماً تنتهي عند تاريخ مرجعي — تطابق تعريف daysSinceLast <= 14 */
function retention_window(DateTimeImmutable $ref, int $days): array
{
    return [
        $ref->modify('-' . ($days - 1) . ' days')->format('Y-m-d'),
        $ref->format('Y-m-d'),
    ];
}

[$periodStartFrom, $periodStartTo] = retention_window($refStart, ACTIVE_WINDOW_DAYS);
[$periodEndFrom, $periodEndTo]     = retention_window($refEnd, ACTIVE_WINDOW_DAYS);

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
    'period_start_label'   => $refStart->format('Y-m-d'),
    'period_end_label'     => $refEnd->format('Y-m-d'),
    'period_start_from'    => $periodStartFrom,
    'period_start_to'      => $periodStartTo,
    'period_end_from'      => $periodEndFrom,
    'period_end_to'        => $periodEndTo,
    'active_window_days'   => ACTIVE_WINDOW_DAYS,
    'rule'                 => 'نشط = شحن ضمن آخر 14 يوماً من التاريخ المرجعي (نفس تعريف «نشط يشحن»)؛ الاحتفاظ = نشط عند التاريخين ÷ نشط في بداية الفترة × 100',
    'generated_at'         => date('c'),
], JSON_UNESCAPED_UNICODE);
