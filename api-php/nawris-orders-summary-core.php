<?php
/**
 * منطق جلب orders-summary — مطابق لـ orders-summary.php (نفس خيارات cURL الافتراضية).
 * يدعم تعطيل التحقق من SSL كمحاولة ثانية عند أخطاء الشبكة/SSL.
 */
if (!defined('NAWRIS_BASE')) {
    require_once __DIR__ . '/config.php';
}

/**
 * @return array{stores: array<int,array>, meta: array}
 */
function nawris_orders_summary_fetch_all(string $from, string $to, int $maxPages, bool $verifySsl): array {
    $storeMap = [];
    $cursor = null;
    $page = 0;
    $truncated = false;
    $lastHttp = 0;
    $curlErr = 0;

    do {
        $url = NAWRIS_BASE . '/customers/orders-summary?from=' . urlencode($from) . '&to=' . urlencode($to);
        if ($cursor) {
            $url .= '&cursor=' . urlencode($cursor);
        }

        $ch = curl_init();
        $opts = [
            CURLOPT_URL            => $url,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 60,
            CURLOPT_CONNECTTIMEOUT => 10,
            CURLOPT_HTTPHEADER     => [
                'Accept: application/json',
                'X-API-TOKEN: ' . NAWRIS_TOKEN,
            ],
        ];
        if (!$verifySsl) {
            $opts[CURLOPT_SSL_VERIFYPEER] = false;
            $opts[CURLOPT_SSL_VERIFYHOST] = false;
            $opts[CURLOPT_FOLLOWLOCATION] = true;
        }
        curl_setopt_array($ch, $opts);

        $response = curl_exec($ch);
        $curlErr = curl_errno($ch);
        $lastHttp = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($curlErr || !$response) {
            return [
                'stores' => $storeMap,
                'meta'   => [
                    'ok' => false,
                    'curl_errno' => $curlErr,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                    'range'      => ['from' => $from, 'to' => $to],
                    'ssl_verify' => $verifySsl,
                ],
            ];
        }

        if ($lastHttp >= 400) {
            return [
                'stores' => $storeMap,
                'meta'   => [
                    'ok' => false,
                    'http_code' => $lastHttp,
                    'pages'     => $page,
                    'range'     => ['from' => $from, 'to' => $to],
                    'ssl_verify'=> $verifySsl,
                ],
            ];
        }

        $data = json_decode($response, true);
        if (!is_array($data)) {
            return [
                'stores' => $storeMap,
                'meta'   => [
                    'ok' => false,
                    'json_error' => true,
                    'http_code'  => $lastHttp,
                    'pages'      => $page,
                    'range'      => ['from' => $from, 'to' => $to],
                    'ssl_verify' => $verifySsl,
                ],
            ];
        }

        if (isset($data['data']) && is_array($data['data'])) {
            foreach ($data['data'] as $store) {
                $sid = $store['id'];
                if (!isset($storeMap[$sid])) {
                    $storeMap[$sid] = $store;
                } else {
                    if (($store['total_shipments'] ?? 0) > ($storeMap[$sid]['total_shipments'] ?? 0)) {
                        $storeMap[$sid]['total_shipments'] = $store['total_shipments'];
                    }
                    $newDate = $store['last_shipment_date'] ?? null;
                    $oldDate = $storeMap[$sid]['last_shipment_date'] ?? null;
                    if ($newDate && $newDate !== 'لا يوجد' &&
                        (!$oldDate || $oldDate === 'لا يوجد' || strtotime($newDate) > strtotime($oldDate))) {
                        $storeMap[$sid]['last_shipment_date'] = $newDate;
                    }
                }
            }
        }

        $cursor = $data['meta']['next_cursor'] ?? null;
        $page++;

        if ($page >= $maxPages) {
            $truncated = true;
            break;
        }
    } while ($cursor);

    return [
        'stores' => $storeMap,
        'meta'   => [
            'ok'         => true,
            'http_code'  => $lastHttp,
            'pages'      => $page,
            'truncated'  => $truncated,
            'range'      => ['from' => $from, 'to' => $to],
            'ssl_verify' => $verifySsl,
            'curl_errno' => $curlErr,
        ],
    ];
}

/**
 * جلب عبر نفس سكربت orders-summary.php على هذا الخادم (تجاوز قيود cURL → Nawras على بعض الاستضافات).
 */
function nawris_orders_summary_fetch_via_local_script(string $from, string $to): ?array {
    $https = !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off';
    $scheme = $https ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'] ?? '127.0.0.1';
    $dir = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/api-php')), '/');
    $url = $scheme . '://' . $host . $dir . '/orders-summary.php?from=' . urlencode($from) . '&to=' . urlencode($to);

    $ctx = stream_context_create([
        'http' => [
            'timeout' => 300,
            'header'  => "Accept: application/json\r\n",
        ],
        'ssl' => [
            'verify_peer'      => false,
            'verify_peer_name' => false,
        ],
    ]);

    $raw = @file_get_contents($url, false, $ctx);
    if ($raw === false || $raw === '') {
        return null;
    }
    $data = json_decode($raw, true);
    if (!is_array($data) || empty($data['success']) || !isset($data['data']) || !is_array($data['data'])) {
        return null;
    }

    $storeMap = [];
    foreach ($data['data'] as $store) {
        if (!is_array($store) || !isset($store['id'])) {
            continue;
        }
        $storeMap[(int) $store['id']] = $store;
    }

    return [
        'stores' => $storeMap,
        'meta'   => [
            'ok'            => true,
            'via_local'     => true,
            'local_url'     => $url,
            'pages_reported'=> $data['pages_fetched'] ?? null,
            'range'         => ['from' => $from, 'to' => $to],
        ],
    ];
}
