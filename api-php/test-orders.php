<?php
// =========================================================
// test-orders.php — اختبار مباشر لـ orders-summary
// الوصول: /api-php/test-orders.php
// =========================================================
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$now   = time();
$today = date('Y-m-d');
$d14   = date('Y-m-d', $now - 14  * 86400);
$d60   = date('Y-m-d', $now - 60  * 86400);
$d90   = date('Y-m-d', $now - 90  * 86400);

function rawFetch($url) {
    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-API-TOKEN: ' . NAWRIS_TOKEN,
        ],
    ]);
    $raw  = curl_exec($ch);
    $err  = curl_errno($ch);
    $info = curl_getinfo($ch);
    curl_close($ch);

    $result = [
        'http_code'    => $info['http_code'],
        'curl_error'   => $err ? curl_strerror($err) : null,
        'url'          => $url,
    ];

    if ($raw === false || $err) {
        $result['error'] = 'cURL failed';
        return $result;
    }

    $d = json_decode($raw, true);
    if (!$d) {
        $result['error'] = 'JSON parse failed';
        $result['raw_preview'] = substr($raw, 0, 500);
        return $result;
    }

    $result['records_count'] = count($d['data'] ?? []);
    $result['has_next']      = !empty($d['meta']['next_cursor']);
    $result['first_record']  = $d['data'][0] ?? null;
    $result['api_keys']      = isset($d['data'][0]) ? array_keys($d['data'][0]) : [];
    $result['meta']          = $d['meta'] ?? null;

    return $result;
}

$tests = [
    // تجربة نفس النطاق الذي أرسله المستخدم
    'orders_jan2026'      => rawFetch(NAWRIS_BASE . '/customers/orders-summary?from=2026-01-01&to=2026-01-30'),
    // نطاق 14 يوم
    'orders_14d'          => rawFetch(NAWRIS_BASE . '/customers/orders-summary?from=' . $d14 . '&to=' . $today),
    // نطاق 60 يوم
    'orders_60d'          => rawFetch(NAWRIS_BASE . '/customers/orders-summary?from=' . $d60 . '&to=' . $today),
    // نطاق 90 يوم
    'orders_90d'          => rawFetch(NAWRIS_BASE . '/customers/orders-summary?from=' . $d90 . '&to=' . $today),
    // المتاجر الجديدة (يعمل عندنا)
    'new_90d'             => rawFetch(NAWRIS_BASE . '/customers/new?since=' . $d90),
    // المتاجر غير النشطة (يعمل عندنا)
    'inactive_61d'        => rawFetch(NAWRIS_BASE . '/customers/inactive?days=61'),
];

echo json_encode([
    'today'  => $today,
    'token'  => substr(NAWRIS_TOKEN, 0, 10) . '...',
    'base'   => NAWRIS_BASE,
    'tests'  => $tests,
], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
