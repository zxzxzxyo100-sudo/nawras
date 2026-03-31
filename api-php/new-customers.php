<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$TOKEN = 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703';
$BASE = 'https://backoffice.nawris.algoriza.com/external-api';
$since = isset($_GET['since']) ? $_GET['since'] : '2024-01-01';

$allData = [];
$cursor = null;

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
    curl_setopt($ch, CURLOPT_TIMEOUT, 30);
    $response = curl_exec($ch);
    curl_close($ch);

    $data = json_decode($response, true);
    if (isset($data['data']) && is_array($data['data'])) {
        $allData = array_merge($allData, $data['data']);
    }

    $cursor = isset($data['meta']['next_cursor']) ? $data['meta']['next_cursor'] : null;
} while ($cursor);

echo json_encode(['success' => true, 'data' => $allData, 'total' => count($allData)]);
