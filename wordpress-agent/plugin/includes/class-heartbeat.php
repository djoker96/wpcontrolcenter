<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Heartbeat {
    private const HOOK = 'wpcc_agent_heartbeat';
    private const RECURRENCE = 'wpcc_agent_interval';

    public function register_hooks() {
        if (function_exists('add_filter')) {
            add_filter('cron_schedules', [$this, 'add_schedule']);
        }

        add_action(self::HOOK, [$this, 'send_heartbeat']);

        if (!wp_next_scheduled(self::HOOK)) {
            wp_schedule_event(time() + 60, self::RECURRENCE, self::HOOK);
        }
    }

    public function add_schedule(array $schedules): array {
        $minutes = (int) wpcc_agent_get_option('heartbeat_interval_minutes', 5);
        $interval = max(60, $minutes * 60);

        $schedules[self::RECURRENCE] = [
            'interval' => $interval,
            'display' => 'WP Control Center heartbeat',
        ];

        return $schedules;
    }

    public function send_heartbeat(): void {
        if (!wpcc_agent_get_option('connected', false)) {
            return;
        }

        $api_url = rtrim((string) wpcc_agent_get_option('api_url', ''), '/');
        $site_id = (string) wpcc_agent_get_option('site_id', '');
        $secret_key = (string) wpcc_agent_get_option('secret_key', '');

        if ($api_url === '' || $site_id === '' || $secret_key === '') {
            return;
        }

        $body = wp_json_encode([
            'siteUrl' => site_url(),
            'wpVersion' => get_bloginfo('version'),
            'phpVersion' => PHP_VERSION,
            'wpAgentVersion' => WPCC_AGENT_VERSION,
        ]);

        if ($body === false) {
            return;
        }

        $timestamp = (string) time();
        $signed_path = $this->build_signed_path($api_url, '/agent/heartbeat');
        $signature = hash_hmac('sha256', 'POST|' . $signed_path . '|' . $timestamp . '|' . $body, $secret_key);

        $response = wp_remote_post($api_url . '/agent/heartbeat', [
            'headers' => [
                'Content-Type' => 'application/json',
                'x-wpcc-site-id' => $site_id,
                'x-wpcc-signature' => $signature,
                'x-wpcc-timestamp' => $timestamp,
            ],
            'body' => $body,
            'timeout' => 15,
        ]);

        if (function_exists('wpcc_agent_update_option')) {
            $ok = !is_wp_error($response);
            wpcc_agent_update_option('last_heartbeat_at', time());
            wpcc_agent_update_option('last_heartbeat_status', $ok ? 'ok' : 'failed');
        }
    }

    private function build_signed_path(string $api_url, string $endpoint): string {
        $base_path = (string) parse_url($api_url, PHP_URL_PATH);
        $base_path = '/' . trim($base_path, '/');
        if ($base_path === '/') {
            $base_path = '';
        }

        return $base_path . $endpoint;
    }
}
