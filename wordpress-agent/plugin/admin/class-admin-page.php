<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Admin_Page {
    public function register_hooks() {
        add_action('admin_menu', [$this, 'register_menu']);
        add_action('admin_init', [$this, 'handle_actions']);
    }

    public function register_menu() {
        add_menu_page('WP Control Center Agent', 'WPCC Agent', 'manage_options', 'wpcc-agent', [$this, 'render']);
    }

    public function handle_actions() {
        if (!isset($_POST['wpcc_nonce']) || !wp_verify_nonce($_POST['wpcc_nonce'], 'wpcc_agent_action')) {
            return;
        }

        if (isset($_POST['wpcc_connect'])) {
            $api_url = esc_url_raw(trim($_POST['api_url']));
            $token = sanitize_text_field(trim($_POST['connection_token']));

            if (empty($api_url) || empty($token)) {
                add_settings_error('wpcc_messages', 'wpcc_error', 'API URL and Connection Token are required.', 'error');
                return;
            }

            // Perform handshake call to NestJS backend /agent/register
            $response = wp_remote_post(rtrim($api_url, '/') . '/agent/register', [
                'headers' => [
                    'Content-Type' => 'application/json',
                ],
                'body' => wp_json_encode([
                    'connectionToken' => $token,
                    'siteUrl' => site_url(),
                    'domain' => parse_url(site_url(), PHP_URL_HOST),
                ]),
                'timeout' => 15,
            ]);

            if (is_wp_error($response)) {
                add_settings_error('wpcc_messages', 'wpcc_error', 'Connection failed: ' . $response->get_error_message(), 'error');
                return;
            }

            $code = wp_remote_retrieve_response_code($response);
            $body = json_decode(wp_remote_retrieve_body($response), true);

            if ($code !== 200 && $code !== 201) {
                $msg = isset($body['message']) ? $body['message'] : 'Registration rejected by backend';
                add_settings_error('wpcc_messages', 'wpcc_error', 'Connection failed (' . $code . '): ' . $msg, 'error');
                return;
            }

            // Save credentials returned by NestJS
            wpcc_agent_update_option('connected', true);
            wpcc_agent_update_option('api_url', rtrim($api_url, '/'));
            wpcc_agent_update_option('site_id', $body['siteId']);
            wpcc_agent_update_option('secret_key', $body['secretKey']);

            add_settings_error('wpcc_messages', 'wpcc_success', 'Connected successfully to WP Control Center!', 'updated');
        }

        if (isset($_POST['wpcc_disconnect'])) {
            wpcc_agent_update_option('connected', false);
            wpcc_agent_update_option('api_url', '');
            wpcc_agent_update_option('site_id', '');
            wpcc_agent_update_option('secret_key', '');

            add_settings_error('wpcc_messages', 'wpcc_success', 'Disconnected successfully.', 'updated');
        }
    }

    public function render() {
        include WPCC_AGENT_PATH . 'admin/views/status-page.php';
    }
}
