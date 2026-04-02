<?php
// =========================================================
// debug-api.php — تشخيص كامل لنقاط الـ API
// الوصول: /api-php/debug-api.php
// =========================================================
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_HEAVY);
ini_set('max_execution_time', TIME_LONG);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function singlePage($url) {
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
    $r = curl_exec($ch);
    $e = curl_errno($ch);
    $i = curl_getinfo($ch);
    curl_close($ch);

    if ($e) return ['error' => curl_strerror($e), 'code' => $e];
    $d = json_decode($r, true);
    if (!$d)  return ['error' => 'JSON parse failed', 'raw' => substr($r, 0, 200)];

    return [
        'http_code'    => $i['http_code'],
        'records_page' => count($d['data'] ?? []),
        'has_more'     => !empty($d['meta']['next_cursor']),
        'next_cursor'  => isset($d['meta']['next_cursor']) ? '…' : null,
        'meta'         => $d['meta'] ?? null,
        'sample'       => isset($d['data'][0]) ? array_keys($d['data'][0]) : [],
    ];
}

function countAll($url, $max = 300) {
    $total  = 0;
    $cursor = null;
    $pages  = 0;
    $start  = microtime(true);

    do {
        $u  = $cursor ? $url . (strpos($url, '?') !== false ? '&' : '?') . 'cursor=' . urlencode($cursor) : $url;
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
        $r = curl_exec($ch);
        curl_close($ch);
        $d = json_decode($r, true);

        $total  += count($d['data'] ?? []);
        $cursor  = $d['meta']['next_cursor'] ?? null;
        $pages++;
    } while ($cursor && $pages < $max);

    return [
        'total_records' => $total,
        'pages_fetched' => $pages,
        'truncated'     => ($cursor !== null),
        'elapsed_sec'   => round(microtime(true) - $start, 2),
    ];
}

$now   = time();
$today = date('Y-m-d');
$d60   = date('Y-m-d', $now - 60  * 86400);
$d90   = date('Y-m-d', $now - 90  * 86400);

$report = [];

// ── 1. صفحة أولى من كل endpoint ─────────────────────────────
$report['sample_pages'] = [
    'new'              => singlePage(NAWRIS_BASE . "/customers/new?since=$d90"),
    'inactive_14'      => singlePage(NAWRIS_BASE . '/customers/inactive?days=14'),
    'inactive_61'      => singlePage(NAWRIS_BASE . '/customers/inactive?days=61'),
    'orders_60d'       => singlePage(NAWRIS_BASE . "/customers/orders-summary?from=$d60&to=$today"),
    'orders_all_time'  => singlePage(NAWRIS_BASE . "/customers/orders-summary?from=2023-01-01&to=$today"),
];

// ── 2. عدد كامل لكل endpoint (يستغرق وقتاً) ─────────────────
$report['full_counts'] = [
    'new'              => countAll(NAWRIS_BASE . "/customers/new?since=$d90"),
    'inactive_61'      => countAll(NAWRIS_BASE . '/customers/inactive?days=61'),
    'orders_60d'       => countAll(NAWRIS_BASE . "/customers/orders-summary?from=$d60&to=$today"),
    'orders_all_time'  => countAll(NAWRIS_BASE . "/customers/orders-summary?from=2023-01-01&to=$today"),
];

$report['config'] = [
    'MAX_PAGES_ALL'      => MAX_PAGES_ALL,
    'MAX_PAGES_INACTIVE' => MAX_PAGES_INACTIVE,
    'MAX_PAGES_ORDERS'   => MAX_PAGES_ORDERS,
    'MAX_PAGES_NEW'      => MAX_PAGES_NEW,
    'today'              => $today,
];

echo json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
