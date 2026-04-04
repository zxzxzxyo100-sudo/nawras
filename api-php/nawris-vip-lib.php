<?php
/**
 * دوال مشتركة لكبار التجار — جلب كامل لـ orders-summary (تجاوز حد 200 صفحة في all-stores).
 */
if (!defined('NAWRIS_BASE')) {
    require_once __DIR__ . '/config.php';
}
require_once __DIR__ . '/nawris-orders-summary-core.php';

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
 * تحويل خريطة المتاجر (مثل orders-summary.php) إلى totals/rows للـ VIP.
 */
function nawris_store_map_to_vip_totals_rows(array $storeMap): array {
    $totals = [];
    $rows = [];
    foreach ($storeMap as $sid => $store) {
        if (!is_array($store)) {
            continue;
        }
        $sid = (int) $sid;
        if ($sid <= 0) {
            continue;
        }
        $t = nawris_best_shipment_total_from_summary_row($store);
        $totals[$sid] = $t;
        $rows[$sid] = $store;
    }

    return ['totals' => $totals, 'rows' => $rows];
}

/**
 * جلب orders-summary لنطاق واحد — نفس منطق orders-summary.php ثم بدون SSL ثم عبر استدعاء محلي.
 *
 * @return array{totals: array<int,int>, rows: array<int,array>, meta: array}
 */
function nawris_fetch_orders_summary_single_range(string $from, string $to): array {
    foreach ([true, false] as $verifySsl) {
        $r = nawris_orders_summary_fetch_all($from, $to, VIP_ORDERS_SUMMARY_MAX_PAGES, $verifySsl);
        if (!empty($r['meta']['ok'])) {
            $out = nawris_store_map_to_vip_totals_rows($r['stores']);
            $out['meta'] = $r['meta'];

            return $out;
        }
        $code = (int) ($r['meta']['http_code'] ?? 0);
        if ($code !== 500 && $code !== 502 && $code !== 503 && $code !== 504) {
            $out = nawris_store_map_to_vip_totals_rows($r['stores']);
            $out['meta'] = $r['meta'];

            return $out;
        }
    }

    $local = nawris_orders_summary_fetch_via_local_script($from, $to);
    if ($local !== null && !empty($local['meta']['ok'])) {
        $out = nawris_store_map_to_vip_totals_rows($local['stores']);
        $out['meta'] = $local['meta'];

        return $out;
    }

    return [
        'totals' => [],
        'rows'   => [],
        'meta'   => [
            'ok'        => false,
            'http_code' => 500,
            'pages'     => 0,
            'range'     => ['from' => $from, 'to' => $to],
            'note'      => 'direct_curl_and_local_orders_summary_failed',
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
