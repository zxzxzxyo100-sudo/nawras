<?php
require_once __DIR__ . '/config.php';

ini_set('memory_limit',      MEMORY_MEDIUM);
ini_set('max_execution_time', TIME_MEDIUM);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$since = isset($_GET['since']) ? $_GET['since'] : date('Y-m-d', strtotime('-90 days'));

$allData  = [];
$cursor   = null;
$page     = 0;
$truncated = false;

do {
    $url = NAWRIS_BASE . '/customers/new?since=' . urlencode($since);
    if ($cursor) $url .= '&cursor=' . urlencode($cursor);

    $ch = curl_init();
    curl_setopt_array($ch, [
        CURLOPT_URL            => $url,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 5,
        CURLOPT_HTTPHEADER     => [
            'Accept: application/json',
            'X-API-TOKEN: ' . NAWRIS_TOKEN,
        ],
    ]);
    $response = curl_exec($ch);
    $curlErr  = curl_errno($ch);
    curl_close($ch);

    if ($curlErr || !$response) break;

    $data = json_decode($response, true);
    if (!is_array($data)) break;

    if (isset($data['data']) && is_array($data['data'])) {
        foreach ($data['data'] as $item) {
            $allData[$item['id']] = $item;   // key = id يمنع التكرار
        }
    }

    $cursor = $data['meta']['next_cursor'] ?? null;
    $page++;

    if ($page >= MAX_PAGES_NEW) {
        $truncated = true;
        break;
    }
} while ($cursor);

echo json_encode([
    'success'   => true,
    'data'      => array_values($allData),
    'total'     => count($allData),
    'pages'     => $page,
    'truncated' => $truncated,   // true = وُجدت صفحات إضافية لم تُجلب
], JSON_UNESCAPED_UNICODE);
