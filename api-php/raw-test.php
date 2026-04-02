<?php
// =========================================================
// raw-test.php — اختبار نقي لـ orders-summary بدون أي منطق
// الوصول: /api-php/raw-test.php
// =========================================================
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

function call($url) {
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
    $errno = curl_errno($ch);
    $info  = curl_getinfo($ch);
    curl_close($ch);

    if ($errno) {
        return ['status' => 'CURL_ERROR', 'error' => curl_strerror($errno)];
    }

    $d = json_decode($raw, true);

    return [
        'status'        => $info['http_code'] === 200 ? 'OK' : 'HTTP_' . $info['http_code'],
        'http_code'     => $info['http_code'],
        'records'       => count($d['data'] ?? []),
        'has_next'      => !empty($d['meta']['next_cursor']),
        'fields'        => isset($d['data'][0]) ? array_keys($d['data'][0]) : [],
        'sample_ids'    => array_slice(array_column($d['data'] ?? [], 'id'), 0, 5),
        'sample_dates'  => array_slice(array_column($d['data'] ?? [], 'last_shipment_date'), 0, 5),
        'first'         => $d['data'][0] ?? null,
        'raw_preview'   => $d === null ? substr($raw, 0, 300) : null,
    ];
}

$now = time();
$results = [

    // ─── نفس المثال الذي أرسله المستخدم بالضبط ───
    'user_example'    => call(NAWRIS_BASE . '/customers/orders-summary?from=2026-01-01&to=2026-01-30'),

    // ─── نطاق يشمل الأمس ───
    'to_yesterday'    => call(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 30 * 86400) . '&to=' . date('Y-m-d', $now - 86400)),

    // ─── نطاق يشمل اليوم ───
    'to_today'        => call(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 30 * 86400) . '&to=' . date('Y-m-d')),

    // ─── آخر 14 يوم ───
    'last_14d'        => call(NAWRIS_BASE . '/customers/orders-summary?from=' . date('Y-m-d', $now - 14 * 86400) . '&to=' . date('Y-m-d')),

    // ─── inactive?days=15 ───
    'inactive_15d'    => call(NAWRIS_BASE . '/customers/inactive?days=15'),

    // ─── inactive?days=61 (يعمل بالتأكيد) ───
    'inactive_61d'    => call(NAWRIS_BASE . '/customers/inactive?days=61'),
];

echo json_encode(['token_prefix' => substr(NAWRIS_TOKEN, 0, 12) . '...', 'results' => $results],
    JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
