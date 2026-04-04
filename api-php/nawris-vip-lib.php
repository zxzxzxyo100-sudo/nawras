<?php
/**
 * دوال مشتركة لكبار التجار — جلب كامل لـ orders-summary (تجاوز حد 200 صفحة في all-stores).
 */
if (!defined('NAWRIS_BASE')) {
    require_once __DIR__ . '/config.php';
}

/** أقصى صفحات لـ orders-summary في مسار VIP فقط */
if (!defined('VIP_ORDERS_SUMMARY_MAX_PAGES')) {
    define('VIP_ORDERS_SUMMARY_MAX_PAGES', 2000);
}

function nawris_total_shipments(array $s): int {
    $keys = ['total_shipments', 'totalShipments', 'Total_Shipments'];
    foreach ($keys as $k) {
        if (!array_key_exists($k, $s)) {
            continue;
        }
        $v = $s[$k];
        if ($v === null || $v === '') {
            continue;
        }
        if (is_numeric($v)) {
            return (int) $v;
        }
        if (is_string($v)) {
            $clean = preg_replace('/[^\d]/u', '', $v);
            if ($clean !== '') {
                return (int) $clean;
            }
        }
    }
    if (!empty($s['stats']) && is_array($s['stats'])) {
        $st = $s['stats'];
        $v = $st['total_shipments'] ?? $st['totalShipments'] ?? null;
        if ($v !== null && $v !== '') {
            return is_numeric($v) ? (int) $v : (int) preg_replace('/[^\d]/u', '', (string) $v);
        }
    }

    return 0;
}

function nawris_is_active_status(array $s): bool {
    $st = $s['status'] ?? null;
    if ($st === null || $st === '') {
        return true;
    }
    if (is_bool($st)) {
        return $st;
    }
    if (is_int($st) || is_float($st)) {
        return ((int) $st) === 1;
    }
    $t = strtolower(trim((string) $st));

    return in_array($t, ['active', '1', 'true', 'yes'], true);
}

function nawris_best_shipment_total_from_summary_row(array $store): int {
    $parts = [nawris_total_shipments($store)];
    foreach (['shipments_in_range', 'total_in_range', 'orders_in_range'] as $k) {
        if (isset($store[$k]) && is_numeric($store[$k])) {
            $parts[] = (int) $store[$k];
        }
    }

    return max($parts ?: [0]);
}

/**
 * جلب orders-summary لنطاق تاريخ واحد — حتى نفاد cursor.
 *
 * @return array{totals: array<int,int>, rows: array<int,array>, meta: array}
 */
function nawris_fetch_orders_summary_single_range(string $from, string $to): array {
    $totals = [];
    $rows = [];
    $cursor = null;
    $page = 0;
    $lastHttp = 0;
    $curlErr = 0;
    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . urlencode($from) . '&to=' . urlencode($to);
        if ($cursor) {
            $url .= '&cursor=' . urlencode($cursor);
        }
        $ch = curl_init();
        curl_setopt_array($ch, [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_SSL_VERIFYPEER => false,
            CURLOPT_SSL_VERIFYHOST => false,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ]);
        $response = curl_exec($ch);
        $curlErr = curl_errno($ch);
        $lastHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($curlErr || !$response) {
            return [
                'totals' => $totals,
                'rows'   => $rows,
                'meta'   => [
                    'ok' => false,
                    'curl_errno' => $curlErr,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                    'range'      => ['from' => $from, 'to' => $to],
                ],
            ];
        }
        if ($lastHttp < 200 || $lastHttp >= 400) {
            return [
                'totals' => $totals,
                'rows'   => $rows,
                'meta'   => [
                    'ok' => false,
                    'http_code' => $lastHttp,
                    'pages'     => $page,
                    'range'     => ['from' => $from, 'to' => $to],
                ],
            ];
        }
        $data = json_decode($response, true);
        if (!is_array($data)) {
            return [
                'totals' => $totals,
                'rows'   => $rows,
                'meta'   => [
                    'ok' => false,
                    'json_error' => true,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                    'range'      => ['from' => $from, 'to' => $to],
                ],
            ];
        }
        if (empty($data['data']) || !is_array($data['data'])) {
            break;
        }
        foreach ($data['data'] as $store) {
            if (!is_array($store)) {
                continue;
            }
            $sid = isset($store['id']) ? (int) $store['id'] : 0;
            if ($sid <= 0) {
                continue;
            }
            $t = nawris_best_shipment_total_from_summary_row($store);
            if (!isset($totals[$sid]) || $t > $totals[$sid]) {
                $totals[$sid] = $t;
                $rows[$sid] = $store;
            }
        }
        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;
    } while ($cursor && $page < VIP_ORDERS_SUMMARY_MAX_PAGES);

    return [
        'totals' => $totals,
        'rows'   => $rows,
        'meta'   => [
            'ok'                     => true,
            'http_code'              => $lastHttp,
            'pages'                  => $page,
            'curl_errno'             => $curlErr,
            'range'                  => ['from' => $from, 'to' => $to],
            'truncated_by_page_cap'  => $cursor !== null && $page >= VIP_ORDERS_SUMMARY_MAX_PAGES,
        ],
    ];
}

/**
 * تقسيم سنوي إذا فشل الطلب الواسع (يقلل احتمال 500 من خادم Nawris).
 */
function nawris_fetch_orders_summary_by_years(string $to): array {
    $endY = (int) substr($to, 0, 4);
    $totals = [];
    $rows = [];
    $chunks = [];
    $anyOk = false;
    for ($y = 2020; $y <= $endY; $y++) {
        $from = sprintf('%04d-01-01', $y);
        $chunkTo = ($y === $endY) ? $to : sprintf('%04d-12-31', $y);
        $part = nawris_fetch_orders_summary_single_range($from, $chunkTo);
        $chunks[] = [
            'from' => $from,
            'to'   => $chunkTo,
            'ok'   => !empty($part['meta']['ok']),
            'http' => $part['meta']['http_code'] ?? null,
            'pages'=> $part['meta']['pages'] ?? 0,
        ];
        if (empty($part['meta']['ok'])) {
            continue;
        }
        $anyOk = true;
        foreach ($part['totals'] as $id => $t) {
            $id = (int) $id;
            if (!isset($totals[$id]) || $t > $totals[$id]) {
                $totals[$id] = $t;
                $rows[$id] = $part['rows'][$id] ?? [];
            }
        }
    }

    return [
        'totals' => $totals,
        'rows'   => $rows,
        'meta'   => [
            'ok'        => $anyOk,
            'strategy'  => 'year_chunks',
            'chunks'    => $chunks,
            'http_code' => 200,
            'range'     => ['from' => '2020-01-01', 'to' => $to],
        ],
    ];
}

/**
 * جلب لـ VIP: محاولات بنطاق أضيق إذا أعاد Nawris 500 على النطاق الواسع، ثم تقسيم سنوي.
 */
function nawris_fetch_orders_summary_for_vip(string $to): array {
    $to = $to ?: date('Y-m-d');
    $attempts = [
        ['2023-01-01', $to],
        [date('Y-m-d', strtotime('-730 days')), $to],
        [date('Y-m-d', strtotime('-365 days')), $to],
        ['2020-01-01', $to],
    ];
    $seen = [];
    $last = null;
    foreach ($attempts as $pair) {
        $k = $pair[0] . '|' . $pair[1];
        if (isset($seen[$k])) {
            continue;
        }
        $seen[$k] = true;
        $last = nawris_fetch_orders_summary_single_range($pair[0], $pair[1]);
        $last['meta']['attempt'] = ['from' => $pair[0], 'to' => $pair[1]];
        $code = (int) ($last['meta']['http_code'] ?? 0);
        if (!empty($last['meta']['ok'])) {
            return $last;
        }
        if ($code !== 500 && $code !== 502 && $code !== 503 && $code !== 504) {
            return $last;
        }
    }

    $yearly = nawris_fetch_orders_summary_by_years($to);
    $yearly['meta']['attempt'] = ['strategy' => 'year_chunks_fallback', 'to' => $to];
    if (!empty($yearly['totals']) || !empty($yearly['meta']['ok'])) {
        return $yearly;
    }

    return $last ?? ['totals' => [], 'rows' => [], 'meta' => ['ok' => false, 'note' => 'all_attempts_failed']];
}
