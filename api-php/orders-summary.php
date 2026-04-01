<?php
ini_set('memory_limit', '128M');
ini_set('max_execution_time', '30');

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';
$from = isset($_GET['from']) ? $_GET['from'] : date('Y-m-d', strtotime('-30 days'));
$to = isset($_GET['to']) ? $_GET['to'] : date('Y-m-d');

// ضمان عدم تجاوز 31 يوم (حد API الخارجي)
$diff = (strtotime($to) - strtotime($from)) / 86400;
if ($diff > 31) $from = date('Y-m-d', strtotime('-30 days'));

$allData = [];
$cursor = null;
$maxPages = 20;
$page = 0;

do {
    $url = $BASE . '/customers/orders-summary?from=' . $from . '&to=' . $to;
    if ($cursor) $url .= '&cursor=' . $cursor;

    $ch = curl_init();
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_HTTPHEADER, ['Accept: application/json', 'X-API-TOKEN: ' . $TOKEN]);
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
