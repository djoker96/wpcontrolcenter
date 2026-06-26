<?php
/**
 * Plugin Name: WP Control Center Agent
 * Description: WordPress agent plugin for remote management via WP Control Center.
 * Version: 0.1.0
 * Author: Internal
 */

if (!defined('ABSPATH')) {
    exit;
}

define('WPCC_AGENT_VERSION', '0.1.0');
define('WPCC_AGENT_PATH', plugin_dir_path(__FILE__));
define('WPCC_AGENT_URL', plugin_dir_url(__FILE__));

require_once WPCC_AGENT_PATH . 'includes/helpers.php';
require_once WPCC_AGENT_PATH . 'includes/class-loader.php';
require_once WPCC_AGENT_PATH . 'includes/class-auth.php';
require_once WPCC_AGENT_PATH . 'includes/class-api.php';
require_once WPCC_AGENT_PATH . 'includes/class-heartbeat.php';
require_once WPCC_AGENT_PATH . 'includes/class-system-info.php';
require_once WPCC_AGENT_PATH . 'includes/class-plugin-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-theme-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-core-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-maintenance-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-cache-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-db-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-object-cache-manager.php';
require_once WPCC_AGENT_PATH . 'includes/class-file-editor.php';
require_once WPCC_AGENT_PATH . 'includes/class-logger.php';
require_once WPCC_AGENT_PATH . 'includes/class-backup-manager.php';
require_once WPCC_AGENT_PATH . 'admin/class-admin-page.php';

function wpcc_agent_boot() {
    $loader = new WPCC_Agent_Loader();
    $loader->boot();
}
add_action('plugins_loaded', 'wpcc_agent_boot');
