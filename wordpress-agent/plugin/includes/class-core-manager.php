<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Core_Manager {
    public function version(): array {
        $version_installed = get_bloginfo('version');
        $update_core = get_site_transient('update_core');

        $update_available = false;
        $version_latest = $version_installed;

        if (isset($update_core->updates) && is_array($update_core->updates)) {
            foreach ($update_core->updates as $update) {
                if ($update->response === 'upgrade') {
                    $update_available = true;
                    $version_latest = $update->current;
                    break;
                }
            }
        }

        return [
            'versionInstalled' => $version_installed,
            'versionLatest' => $version_latest,
            'updateAvailable' => $update_available,
        ];
    }

    public function update_core(): array {
        if (!class_exists('Core_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        wp_version_check();
        $updates = get_core_updates();
        if (empty($updates)) {
            return ['success' => false, 'error' => 'No core updates available.'];
        }

        $upgrader = new Core_Upgrader(new Automatic_Upgrader_Skin());
        $result = $upgrader->upgrade($updates[0]);

        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        return ['success' => true, 'message' => 'WordPress core updated successfully.'];
    }
}
