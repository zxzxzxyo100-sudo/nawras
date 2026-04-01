<?php
// حماية من Out of Memory
ini_set('memory_limit', '48M');
ini_set('max_execution_time', '15');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';
$since = isset($_GET['since']) ? $_GET['since'] : date('Y-m-d', strtotime('-90 days'));

$allData = [];
$cursor = null;
$maxPages = 5; // حد أقصى 5 صفحات لمنع استهلاك الذاكرة
$page = 0;

do {
    $url = $BASE . '/customers/new?since=' . $since;
    if ($cursor) $url .= '&cursor=' . $cursor;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, [
        'Accept: application/json',
        'X-API-TOKEN: ' . $TOKEN
    ]);
    curl_setopt($ch, CURLOPT_TIMEOUT, 10);
    curl_setopt($ch, CURLOPT_CONNECTTIMEOUT, 5);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    if (isset($data['data']) && is_array($data['data'])) {
        $allData = array_merge($allData, $data['data']);
    }

    $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;
    $page++;
} while ($cursor && $page < $maxPages);

echo json_encode(['success' => true, 'data' => $allData, 'total' => count($allData)], JSON_UNESCAPED_UNICODE);
