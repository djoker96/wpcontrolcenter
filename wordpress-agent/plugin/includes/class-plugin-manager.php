<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Plugin_Manager {
    public function list_plugins(): array {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $plugins = get_plugins();
        $active_plugins = (array) get_option('active_plugins', []);
        $update_plugins = get_site_transient('update_plugins');

        $data = [];
        foreach ($plugins as $file => $details) {
            $slug = dirname($file);
            if ($slug === '.' || empty($slug)) {
                $slug = sanitize_title(pathinfo($file, PATHINFO_FILENAME));
            }

            // Also check for network active plugins
            $is_active = in_array($file, $active_plugins) || (function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($file));

            $update_available = false;
            $version_latest = $details['Version'];
            if (isset($update_plugins->response[$file])) {
                $update_available = true;
                $version_latest = $update_plugins->response[$file]->new_version;
            }

            $auto_update_plugins = (array) get_option('auto_update_plugins', []);
            $auto_update_enabled = in_array($file, $auto_update_plugins);

            $data[] = [
                'slug' => $file,
                'name' => $details['Name'],
                'versionInstalled' => $details['Version'],
                'versionLatest' => $version_latest,
                'isActive' => $is_active,
                'updateAvailable' => $update_available,
                'autoUpdateEnabled' => $auto_update_enabled,
            ];
        }
        return $data;
    }
}
