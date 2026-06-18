<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Admin_Page {
    public function register_hooks() {
        add_action('admin_menu', [$this, 'register_menu']);
    }

    public function register_menu() {
        add_menu_page('WP Control Center Agent', 'WPCC Agent', 'manage_options', 'wpcc-agent', [$this, 'render']);
    }

    public function render() {
        include WPCC_AGENT_PATH . 'admin/views/status-page.php';
    }
}
