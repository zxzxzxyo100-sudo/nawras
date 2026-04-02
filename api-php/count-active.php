<?php
// =========================================================
// count-active.php — عدد سريع للمتاجر النشطة (أول 5 صفحات)
// الوصول: /api-php/count-active.php
// =========================================================
require_once __DIR__ . '/config.php';

ini_set('memory_limit',       MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$now   = time();
$today = date('Y-m-d');

function fetchPages($url, $maxPages = 5) {
    $all    = [];
    $cursor = null;
    $pages  = 0;
    do {
        $u = $cursor
            ? $url . (strpos($url, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor)
            : $url;
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $u,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 20,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $raw = curl_exec($ch);
        $err = curl_errno($ch);
        curl_close($ch);

        if ($err) break;
        $d = json_decode($raw, true);
        if (!$d || empty($d['data'])) break;

        foreach ($d['data'] as $s) {
            $all[] = $s;
        }
        $cursor = $d['meta']['next_cursor'] ?? null;
        $pages++;
    } while ($cursor && $pages < $maxPages);

    return ['records' => $all, 'pages' => $pages, 'has_more' => !empty($cursor)];
}

// ─── جلب أول 5 صفحات من orders-summary ───────────────────
$from60 = date('Y-m-d', $now - 60 * 86400);
$res = fetchPages(
    NAWRIS_BASE . '/customers/orders-summary?from=' . $from60 . '&to=' . $today,
    5
);

$stores = $res['records'];
$active_shipping = 0;
$hot_inactive    = 0;
$cold_inactive   = 0;
$no_date         = 0;
$samples         = [];

foreach ($stores as $s) {
    $raw = $s['last_shipment_date'] ?? null;

    if (!$raw || $raw === 'لا يوجد' || $raw === null) {
        $no_date++;
        continue;
    }

    $ts   = strtotime($raw);
    $days = $ts ? ($now - $ts) / 86400 : null;

    if ($days === null) {
        $no_date++;
        continue;
    }

    if ($days <= 14) {
        $active_shipping++;
        if (count($samples) < 3) {
            $samples[] = [
                'id'   => $s['id'],
                'name' => $s['name'] ?? '?',
                'last_shipment_date' => $raw,
                'days_ago' => round($days, 1),
                'total_shipments' => $s['total_shipments'] ?? '?',
            ];
        }
    } elseif ($days <= 60) {
        $hot_inactive++;
    } else {
        $cold_inactive++;
    }
}

// ─── أول سجل كامل لفحص الحقول ────────────────────────────
$firstRecord      = $stores[0] ?? null;
$firstRecordFields = $firstRecord ? array_keys($firstRecord) : [];

echo json_encode([
    'pages_fetched'    => $res['pages'],
    'has_more_pages'   => $res['has_more'],
    'records_in_sample'=> count($stores),
    'classification' => [
        'active_shipping' => $active_shipping,
        'hot_inactive'    => $hot_inactive,
        'cold_inactive'   => $cold_inactive,
        'no_date_field'   => $no_date,
    ],
    'active_samples'   => $samples,
    'first_record_fields' => $firstRecordFields,
    'first_record'     => $firstRecord,
    'today'            => $today,
    'server_time'      => date('Y-m-d H:i:s'),
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
