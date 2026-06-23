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
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/heartbeat', [
            'methods' => 'POST',
            'callback' => [$this, 'heartbeat'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/download-backup', [
            'methods' => 'GET',
            'callback' => [$this, 'download_backup'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/upload-backup', [
            'methods' => 'POST',
            'callback' => [$this, 'upload_backup'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/install-plugin-upload', [
            'methods' => 'POST',
            'callback' => [$this, 'install_plugin_upload'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/install-theme-upload', [
            'methods' => 'POST',
            'callback' => [$this, 'install_theme_upload'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/object-cache-status', [
            'methods' => 'POST',
            'callback' => [$this, 'object_cache_status'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/object-cache-enable', [
            'methods' => 'POST',
            'callback' => [$this, 'object_cache_enable'],
            'permission_callback' => [$this, 'verify_request'],
        ]);

        register_rest_route('wpcc/v1', '/execute/object-cache-disable', [
            'methods' => 'POST',
            'callback' => [$this, 'object_cache_disable'],
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
            case 'create-backup':
                $res = (new WPCC_Agent_Backup_Manager())->create($body['type'] ?? 'FULL');
                break;
            case 'restore-backup':
                $res = (new WPCC_Agent_Backup_Manager())->restore($body['filename'] ?? '');
                break;
            case 'delete-backup':
                $backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
                $file = $backup_dir . '/' . basename($body['filename'] ?? '');
                if (file_exists($file)) {
                    @unlink($file);
                    $res = ['success' => true, 'message' => 'Backup deleted from agent.'];
                } else {
                    $res = ['success' => false, 'message' => 'Backup file not found on agent.'];
                }
                break;
            case 'toggle-maintenance':
                $enabled = filter_var($body['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
                $success = (new WPCC_Agent_Maintenance_Manager())->toggle($enabled);
                $res = ['success' => $success, 'message' => $success ? 'Maintenance toggled successfully.' : 'Failed to toggle maintenance mode.'];
                break;
            case 'diagnostics':
                $disk_total = @disk_total_space(ABSPATH) ?: 0;
                $disk_free = @disk_free_space(ABSPATH) ?: 0;
                $disk_used = max(0, $disk_total - $disk_free);

                // WP Cron check
                $crons = _get_cron_array();
                $late_jobs = [];
                $now = time();
                if (is_array($crons)) {
                    foreach ($crons as $timestamp => $cronhooks) {
                        if ($timestamp < $now - 300) { // late by 5+ mins
                            foreach ($cronhooks as $hook => $keys) {
                                foreach ($keys as $key => $data) {
                                    $late_jobs[] = [
                                        'hook' => $hook,
                                        'schedule' => $timestamp,
                                        'delay_seconds' => $now - $timestamp,
                                        'schedule_name' => $data['schedule'] ?? 'one-off'
                                    ];
                                }
                            }
                        }
                    }
                }
                
                $cron_health = count($late_jobs) > 0 ? 'LATE_JOBS' : 'OK';

                $res = [
                    'success' => true,
                    'data' => [
                        'disk' => [
                            'total' => $disk_total,
                            'free' => $disk_free,
                            'used' => $disk_used,
                        ],
                        'cron' => [
                            'health' => $cron_health,
                            'late_jobs' => array_slice($late_jobs, 0, 50),
                        ],
                    ],
                ];
                break;
            case 'php-logs':
                $log_file = '';
                if (defined('WP_DEBUG_LOG') && is_string(WP_DEBUG_LOG)) {
                    $log_file = WP_DEBUG_LOG;
                } elseif (defined('WP_DEBUG_LOG') && WP_DEBUG_LOG === true) {
                    $log_file = WP_CONTENT_DIR . '/debug.log';
                } else {
                    $log_file = ini_get('error_log');
                }

                if (empty($log_file) || !file_exists($log_file)) {
                    $log_file = WP_CONTENT_DIR . '/debug.log';
                }

                if (file_exists($log_file) && is_readable($log_file)) {
                    $lines = intval($body['lines'] ?? 100);
                    $file = new SplFileObject($log_file, 'r');
                    $file->seek(PHP_INT_MAX);
                    $total_lines = $file->key();
                    $start_line = max(0, $total_lines - $lines);
                    $file->seek($start_line);
                    
                    $log_content = '';
                    while (!$file->eof()) {
                        $log_content .= $file->current();
                        $file->next();
                    }
                    $res = [
                        'success' => true,
                        'log_file' => basename($log_file),
                        'content' => $log_content,
                    ];
                } else {
                    $res = [
                        'success' => false,
                        'message' => 'PHP error log file not found or not readable. Path: ' . basename($log_file),
                        'content' => '',
                    ];
                }
                break;
            default:
                return new WP_REST_Response(['success' => false, 'error' => 'Unknown action: ' . $action], 400);
        }

        return new WP_REST_Response($res, $res['success'] ? 200 : 500);
    }

    public function download_backup(WP_REST_Request $request) {
        $filename = basename($request->get_param('filename'));
        $filepath = WP_CONTENT_DIR . '/wpcc-backups/' . $filename;
        
        if (!file_exists($filepath)) {
            return new WP_Error('not_found', 'Backup file not found', ['status' => 404]);
        }

        header('Content-Description: File Transfer');
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Expires: 0');
        header('Cache-Control: must-revalidate');
        header('Pragma: public');
        header('Content-Length: ' . filesize($filepath));
        
        readfile($filepath);
        exit;
    }

    /**
     * Handle plugin installation from uploaded .zip.
     * Raw zip binary is sent in the request body.
     */
    public function install_plugin_upload(WP_REST_Request $request): WP_REST_Response {
        $body = $request->get_body();
        if (empty($body)) {
            return new WP_REST_Response(['success' => false, 'error' => 'Empty upload body.'], 400);
        }

        // Save to a temp file
        $tmp_dir = WP_CONTENT_DIR . '/wpcc-uploads';
        if (!file_exists($tmp_dir)) {
            wp_mkdir_p($tmp_dir);
        }
        $tmp_file = $tmp_dir . '/' . uniqid('plugin-', true) . '.zip';
        if (file_put_contents($tmp_file, $body) === false) {
            return new WP_REST_Response(['success' => false, 'error' => 'Failed to save uploaded file.'], 500);
        }

        // Reject anything that is not a real ZIP archive before handing to the installer.
        if (!wpcc_agent_is_zip_file($tmp_file)) {
            @unlink($tmp_file);
            return new WP_REST_Response(['success' => false, 'error' => 'Uploaded file is not a valid ZIP archive.'], 400);
        }

        $result = (new WPCC_Agent_Plugin_Manager())->install_plugin_from_upload($tmp_file);

        // Clean up the temp file
        @unlink($tmp_file);

        $status = $result['success'] ? 200 : 500;
        return new WP_REST_Response($result, $status);
    }

    /**
     * Handle theme installation from uploaded .zip.
     * Raw zip binary is sent in the request body.
     */
    public function install_theme_upload(WP_REST_Request $request): WP_REST_Response {
        $body = $request->get_body();
        if (empty($body)) {
            return new WP_REST_Response(['success' => false, 'error' => 'Empty upload body.'], 400);
        }

        // Save to a temp file
        $tmp_dir = WP_CONTENT_DIR . '/wpcc-uploads';
        if (!file_exists($tmp_dir)) {
            wp_mkdir_p($tmp_dir);
        }
        $tmp_file = $tmp_dir . '/' . uniqid('theme-', true) . '.zip';
        if (file_put_contents($tmp_file, $body) === false) {
            return new WP_REST_Response(['success' => false, 'error' => 'Failed to save uploaded file.'], 500);
        }

        // Reject anything that is not a real ZIP archive before handing to the installer.
        if (!wpcc_agent_is_zip_file($tmp_file)) {
            @unlink($tmp_file);
            return new WP_REST_Response(['success' => false, 'error' => 'Uploaded file is not a valid ZIP archive.'], 400);
        }

        $result = (new WPCC_Agent_Theme_Manager())->install_theme_from_upload($tmp_file);

        // Clean up the temp file
        @unlink($tmp_file);

        $status = $result['success'] ? 200 : 500;
        return new WP_REST_Response($result, $status);
    }

    /**
     * Get object cache status.
     */
    public function object_cache_status(WP_REST_Request $request): WP_REST_Response {
        $manager = new WPCC_Agent_Object_Cache_Manager();
        return new WP_REST_Response($manager->status(), 200);
    }

    /**
     * Enable object cache.
     */
    public function object_cache_enable(WP_REST_Request $request): WP_REST_Response {
        $manager = new WPCC_Agent_Object_Cache_Manager();
        $result = $manager->enable();
        return new WP_REST_Response($result, $result['success'] ? 200 : 500);
    }

    /**
     * Disable object cache.
     */
    public function object_cache_disable(WP_REST_Request $request): WP_REST_Response {
        $manager = new WPCC_Agent_Object_Cache_Manager();
        $result = $manager->disable();
        return new WP_REST_Response($result, $result['success'] ? 200 : 500);
    }

    public function upload_backup(WP_REST_Request $request) {
        $filename = basename($request->get_param('filename'));

        // Only allow backup artifacts produced by this agent: .zip or .sql.
        $ext = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
        if (!in_array($ext, ['zip', 'sql'], true)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Disallowed backup file type.'], 400);
        }

        $body = $request->get_body();
        if (empty($body)) {
            return new WP_REST_Response(['success' => false, 'message' => 'Empty upload body.'], 400);
        }

        // A .zip must start with the ZIP magic bytes (blocks polyglot/non-zip payloads).
        if ($ext === 'zip' && substr($body, 0, 4) !== "PK\x03\x04" && substr($body, 0, 4) !== "PK\x05\x06") {
            return new WP_REST_Response(['success' => false, 'message' => 'Uploaded file is not a valid ZIP archive.'], 400);
        }

        $backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
        if (!file_exists($backup_dir)) {
            wp_mkdir_p($backup_dir);
        }
        $filepath = $backup_dir . '/' . $filename;

        if (file_put_contents($filepath, $body) !== false) {
            return new WP_REST_Response(['success' => true, 'filename' => $filename], 200);
        }
        return new WP_REST_Response(['success' => false, 'message' => 'Failed to save uploaded backup file.'], 500);
    }
}
