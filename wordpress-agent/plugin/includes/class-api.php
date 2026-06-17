<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_API {
    public function register_hooks() {
        add_action('rest_api_init', [$this, 'register_routes']);
    }

    public function register_routes() {
        register_rest_route('wpcc/v1', '/register', [
            'methods' => 'POST',
            'callback' => [$this, 'register_site'],
            'permission_callback' => '__return_true',
        ]);

        register_rest_route('wpcc/v1', '/heartbeat', [
            'methods' => 'POST',
            'callback' => [$this, 'heartbeat'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/(?P<action>[a-z\-]+)', [
            'methods' => 'POST',
            'callback' => [$this, 'execute_action'],
            'permission_callback' => [$this, 'verify_request'],
        ]);
    }

    public function verify_request(WP_REST_Request $request): bool {
        return (new WPCC_Agent_Auth())->verify_signature($request);
    }

    public function register_site(WP_REST_Request $request): WP_REST_Response {
        wpcc_agent_update_option('connected', true);
        return new WP_REST_Response(['success' => true, 'siteUrl' => site_url()], 200);
    }

    public function heartbeat(WP_REST_Request $request): WP_REST_Response {
        return new WP_REST_Response([
            'success' => true,
            'timestamp' => current_time('mysql'),
            'versions' => [
                'wordpress' => get_bloginfo('version'),
                'agent' => WPCC_AGENT_VERSION,
            ],
        ], 200);
    }

    public function execute_action(WP_REST_Request $request): WP_REST_Response {
        $action = $request->get_param('action');
        $body = json_decode($request->get_body(), true) ?: [];

        if ($action === 'sync-inventory') {
            $system_info = (new WPCC_Agent_System_Info())->collect();
            $plugins = (new WPCC_Agent_Plugin_Manager())->list_plugins();
            $themes = (new WPCC_Agent_Theme_Manager())->list_themes();
            $core = (new WPCC_Agent_Core_Manager())->version();

            return new WP_REST_Response([
                'success' => true,
                'data' => [
                    'systemInfo' => $system_info,
                    'plugins' => $plugins,
                    'themes' => $themes,
                    'core' => $core,
                ],
            ], 200);
        }

        // Remote actions dispatch
        switch ($action) {
            case 'update-plugin':
                $res = (new WPCC_Agent_Plugin_Manager())->update_plugin($body['slug'] ?? '');
                break;
            case 'install-plugin':
                $res = (new WPCC_Agent_Plugin_Manager())->install_plugin($body['slug'] ?? '');
                break;
            case 'clear-cache':
                $res = (new WPCC_Agent_Cache_Manager())->clear();
                break;
            case 'optimize-database':
                $res = (new WPCC_Agent_DB_Manager())->optimize();
                break;
            case 'update-robots-txt':
                $res = (new WPCC_Agent_File_Editor())->update_robots($body['content'] ?? '');
                break;
            case 'update-htaccess':
                $res = (new WPCC_Agent_File_Editor())->update_htaccess($body['content'] ?? '');
                break;
            case 'update-php-config':
                $res = (new WPCC_Agent_File_Editor())->update_php_config($body['settings'] ?? []);
                break;
            case 'activate-plugin':
                $res = (new WPCC_Agent_Plugin_Manager())->activate_plugin($body['slug'] ?? '');
                break;
            case 'deactivate-plugin':
                $res = (new WPCC_Agent_Plugin_Manager())->deactivate_plugin($body['slug'] ?? '');
                break;
            case 'delete-plugin':
                $res = (new WPCC_Agent_Plugin_Manager())->delete_plugin($body['slug'] ?? '');
                break;
            case 'update-theme':
                $res = (new WPCC_Agent_Theme_Manager())->update_theme($body['slug'] ?? '');
                break;
            case 'delete-theme':
                $res = (new WPCC_Agent_Theme_Manager())->delete_theme($body['slug'] ?? '');
                break;
            case 'update-core':
                $res = (new WPCC_Agent_Core_Manager())->update_core();
                break;
            case 'toggle-maintenance':
                $enabled = filter_var($body['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $success = (new WPCC_Agent_Maintenance_Manager())->toggle($enabled);
                $res = ['success' => $success, 'message' => $success ? 'Maintenance toggled successfully.' : 'Failed to toggle maintenance mode.'];
                break;
            default:
                return new WP_REST_Response(['success' => false, 'error' => 'Unknown action: ' . $action], 400);
        }

        return new WP_REST_Response($res, $res['success'] ? 200 : 500);
    }
}
