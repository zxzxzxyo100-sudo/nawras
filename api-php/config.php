<?php
// Central settings for Nawras CRM API

// External Nawris API
define('NAWRIS_TOKEN', 'f651a69a2df9596088c524208de21d91d09457b9fc3e75bade2903390713f703');
define('NAWRIS_BASE',  'https://backoffice.nawris.algoriza.com/external-api');

/// Runtime limits
@set_time_limit(0);
@ini_set('max_execution_time', '0');
@ini_set('max_input_time', '300');
@ini_set('memory_limit', '1024M');

if (!headers_sent()) {
    header('X-LiteSpeed-NoAbort: 1');
}

define('MEMORY_LIGHT',  '256M');
define('MEMORY_MEDIUM', '512M');
define('MEMORY_HEAVY',  '1024M');
define('TIME_SHORT',    '300');
define('TIME_MEDIUM',   '600');
define('TIME_LONG',     '1200');

// Runtime limits
define('MEMORY_LIGHT',  '96M');
define('MEMORY_MEDIUM', '128M');
define('MEMORY_HEAVY',  '256M');
define('TIME_SHORT',    '30');
define('TIME_MEDIUM',   '60');
define('TIME_LONG',     '120');

// Auto-select DB by host/path
$_host = $_SERVER['HTTP_HOST']   ?? '';
$_uri  = $_SERVER['REQUEST_URI'] ?? '';

$_isStaging = (
    stripos($_host, 'staging') !== false ||
    strpos($_uri, '/staging/') !== false
);

if ($_isStaging) {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u495355717_nawras_stg');
    define('DB_USER', 'u495355717_nawras_stg');
    define('DB_PASS', 'Zidona11@');
    define('IS_STAGING_ENV', true);
} else {
    define('DB_HOST', 'localhost');
    define('DB_NAME', 'u495355717_nawras_crm');
    define('DB_USER', 'u495355717_nawras_admin');
    define('DB_PASS', 'Zidona11!');
    define('IS_STAGING_ENV', false);
}

if (!defined('CRON_QUEUE_FILL_SECRET')) {
    $cronFromEnv = getenv('NAWRAS_CRON_SECRET');
    define('CRON_QUEUE_FILL_SECRET', is_string($cronFromEnv) && $cronFromEnv !== '' ? $cronFromEnv : '');
}

if (!defined('SYNC_DB_SECRET')) {
    $syncEnv = getenv('NAWRAS_SYNC_DB_SECRET');
    define('SYNC_DB_SECRET', is_string($syncEnv) && $syncEnv !== '' ? $syncEnv : '');
}
