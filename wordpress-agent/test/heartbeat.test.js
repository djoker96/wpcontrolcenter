const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');

test('WordPress agent schedules and sends signed heartbeats', () => {
  const result = runPhp(`
define('ABSPATH', sys_get_temp_dir() . '/wpcc-wp/');
define('WP_CONTENT_DIR', sys_get_temp_dir() . '/wpcc-content');
define('WPCC_AGENT_VERSION', '1.2.3');

$actions = [];
$scheduled = [];
$remote_posts = [];
$options = [
    'connected' => true,
    'api_url' => 'https://control.test/api',
    'site_id' => 'site_123',
    'secret_key' => 'agent-secret',
];

function add_action($hook, $callback) {
    global $actions;
    $actions[$hook] = $callback;
}

function wp_next_scheduled($hook) {
    global $scheduled;
    return isset($scheduled[$hook]) ? $scheduled[$hook][0] : false;
}

function wp_schedule_event($timestamp, $recurrence, $hook) {
    global $scheduled;
    $scheduled[$hook] = [$timestamp, $recurrence];
    return true;
}

function wpcc_agent_get_option($key, $default = null) {
    global $options;
    return $options[$key] ?? $default;
}

function site_url() {
    return 'https://wp.example.test';
}

function get_bloginfo($key) {
    return $key === 'version' ? '6.6.1' : '';
}

function wp_json_encode($value) {
    return json_encode($value);
}

function wp_remote_post($url, $args) {
    global $remote_posts;
    $remote_posts[] = [$url, $args];
    return ['response' => ['code' => 200], 'body' => '{}'];
}

function is_wp_error($value) {
    return false;
}

require 'wordpress-agent/plugin/includes/class-heartbeat.php';

$heartbeat = new WPCC_Agent_Heartbeat();
$heartbeat->register_hooks();

if (!isset($actions['wpcc_agent_heartbeat'])) {
    throw new Exception('Heartbeat action was not registered.');
}

if (!isset($scheduled['wpcc_agent_heartbeat'])) {
    throw new Exception('Heartbeat event was not scheduled.');
}

if ($scheduled['wpcc_agent_heartbeat'][1] !== 'wpcc_agent_interval') {
    throw new Exception('Heartbeat recurrence should use wpcc_agent_interval.');
}

$heartbeat->send_heartbeat();

if (count($remote_posts) !== 1) {
    throw new Exception('Expected exactly one heartbeat request.');
}

[$url, $args] = $remote_posts[0];
if ($url !== 'https://control.test/api/agent/heartbeat') {
    throw new Exception('Unexpected heartbeat URL: ' . $url);
}

$body = $args['body'] ?? '';
$timestamp = $args['headers']['x-wpcc-timestamp'] ?? '';
$signature = $args['headers']['x-wpcc-signature'] ?? '';
$site_id = $args['headers']['x-wpcc-site-id'] ?? '';
$expected_signature = hash_hmac('sha256', 'POST|/api/agent/heartbeat|' . $timestamp . '|' . $body, 'agent-secret');

if ($site_id !== 'site_123') {
    throw new Exception('Missing site id header.');
}

if (!hash_equals($expected_signature, $signature)) {
    throw new Exception('Heartbeat signature mismatch.');
}

$payload = json_decode($body, true);
foreach (['siteUrl', 'wpVersion', 'phpVersion', 'wpAgentVersion'] as $key) {
    if (empty($payload[$key])) {
        throw new Exception('Missing heartbeat payload key: ' . $key);
    }
}
`);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('WordPress agent loader boots the heartbeat hooks', () => {
  const result = runPhp(`
define('ABSPATH', sys_get_temp_dir() . '/wpcc-wp/');
define('WP_CONTENT_DIR', sys_get_temp_dir() . '/wpcc-content');
define('WPCC_AGENT_VERSION', '1.2.3');

$booted = [];

function add_action($hook, $callback) {
    global $booted;
    $booted[] = $hook;
}

function wp_next_scheduled($hook) {
    return false;
}

function wp_schedule_event($timestamp, $recurrence, $hook) {
    global $booted;
    $booted[] = 'scheduled:' . $hook . ':' . $recurrence;
    return true;
}

class WPCC_Agent_API {
    public function register_hooks() {
        global $booted;
        $booted[] = 'api';
    }
}

class WPCC_Agent_Admin_Page {
    public function register_hooks() {
        global $booted;
        $booted[] = 'admin';
    }
}

require 'wordpress-agent/plugin/includes/class-heartbeat.php';
require 'wordpress-agent/plugin/includes/class-loader.php';

(new WPCC_Agent_Loader())->boot();

foreach (['api', 'admin', 'wpcc_agent_heartbeat', 'scheduled:wpcc_agent_heartbeat:wpcc_agent_interval'] as $expected) {
    if (!in_array($expected, $booted, true)) {
        throw new Exception('Loader did not boot: ' . $expected);
    }
}
`);

  assert.equal(result.status, 0, result.stderr || result.stdout);
});

function runPhp(script) {
  return spawnSync('php', ['-d', 'display_errors=1'], {
    cwd: process.cwd(),
    input: `<?php\n${script}`,
    encoding: 'utf8',
  });
}
