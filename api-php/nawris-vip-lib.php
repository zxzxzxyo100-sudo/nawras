<?php
/**
 * دوال مشتركة لكبار التجار — جلب كامل لـ orders-summary (تجاوز حد 200 صفحة في all-stores).
 */
if (!defined('NAWRIS_BASE')) {
    require_once __DIR__ . '/config.php';
}

/** أقصى صفحات لـ orders-summary في مسار VIP فقط (التاجر الكبير قد يكون في آخر الصفحات) */
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
 * جلب كامل لـ orders-summary — حتى نفاد cursor أو VIP_ORDERS_SUMMARY_MAX_PAGES.
 *
 * @return array{totals: array<int,int>, rows: array<int,array>, meta: array}
 */
function nawris_fetch_orders_summary_for_vip(string $from, string $to): array {
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
            'ok'                => true,
            'http_code'         => $lastHttp,
            'pages'             => $page,
            'curl_errno'        => $curlErr,
            'truncated_by_page_cap' => $cursor !== null && $page >= VIP_ORDERS_SUMMARY_MAX_PAGES,
        ],
    ];
}
