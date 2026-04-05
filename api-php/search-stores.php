<?php
/**
 * بحث متاجر للـ Autocomplete: يبدأ الاسم بالحروف أو يحتويها؛ الهاتف بأي جزء من الأرقام.
 * المصدر: cache/stores_search_lite.json (يُحدَّث عند كل تشغيل لـ all-stores.php)
 */
require_once __DIR__ . '/config.php';

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Cache-Control: no-cache');

$q = isset($_GET['q']) ? trim((string) $_GET['q']) : '';
if (mb_strlen($q, 'UTF-8') < 1) {
    echo json_encode(['success' => true, 'data' => []], JSON_UNESCAPED_UNICODE);
    exit;
}

$path = __DIR__ . '/cache/stores_search_lite.json';
if (!is_readable($path)) {
    echo json_encode([
        'success' => true,
        'data'    => [],
        'meta'    => ['cache' => 'missing', 'hint' => 'شغّل all-stores.php مرة لبناء الذاكرة'],
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw = file_get_contents($path);
$list = json_decode($raw, true);
if (!is_array($list)) {
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => 'cache_invalid'], JSON_UNESCAPED_UNICODE);
    exit;
}

$qLower = mb_strtolower($q, 'UTF-8');
$qDigits = preg_replace('/\D/u', '', $q);

$starts = [];
$rest   = [];

foreach ($list as $row) {
    if (!is_array($row) || !isset($row['id'])) {
        continue;
    }
    $name      = isset($row['name']) ? (string) $row['name'] : '';
    $nameLower = mb_strtolower($name, 'UTF-8');
    $phone     = isset($row['phone']) ? (string) $row['phone'] : '';
    $phoneDigits = preg_replace('/\D/u', '', $phone);

    $nameStarts = (mb_strpos($nameLower, $qLower, 0, 'UTF-8') === 0);
    $nameContains = !$nameStarts && (mb_strpos($nameLower, $qLower, 0, 'UTF-8') !== false);
    $phoneOk = ($qDigits !== '' && $phoneDigits !== '' && strpos($phoneDigits, $qDigits) !== false);

    if ($nameStarts) {
        $starts[] = $row;
    } elseif ($nameContains || $phoneOk) {
        $rest[] = $row;
    }
}

$max = 40;
$out = array_merge($starts, $rest);
if (count($out) > $max) {
    $out = array_slice($out, 0, $max);
}

echo json_encode(['success' => true, 'data' => $out], JSON_UNESCAPED_UNICODE);
