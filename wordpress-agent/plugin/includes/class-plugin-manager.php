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

    public function update_plugin(string $plugin_file): array {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        if (!class_exists('Plugin_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        // Clear transient to force WordPress to check updates
        delete_site_transient('update_plugins');
        wp_update_plugins();

        $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
        $result = $upgrader->upgrade($plugin_file);

        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        if ($result === false) {
            return ['success' => false, 'error' => 'Plugin upgrade failed or is already up to date.'];
        }
        return ['success' => true, 'message' => 'Plugin updated successfully.'];
    }

    public function activate_plugin(string $plugin_file): array {
        $result = activate_plugin($plugin_file);
        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        return ['success' => true, 'message' => 'Plugin activated successfully.'];
    }

    public function deactivate_plugin(string $plugin_file): array {
        deactivate_plugins($plugin_file);
        return ['success' => true, 'message' => 'Plugin deactivated successfully.'];
    }

    public function delete_plugin(string $plugin_file): array {
        if (!function_exists('delete_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        // Plugin must be deactivated before deleting
        deactivate_plugins($plugin_file);
        $result = delete_plugins([$plugin_file]);
        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        if ($result === false) {
            return ['success' => false, 'error' => 'Failed to delete plugin files.'];
        }
        return ['success' => true, 'message' => 'Plugin deleted successfully.'];
    }

    public function install_plugin(string $slug): array {
        if (empty($slug)) {
            return ['success' => false, 'error' => 'Plugin slug is required.'];
        }

        if (!function_exists('plugins_api')) {
            require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
        }
        if (!class_exists('Plugin_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        $api = plugins_api('plugin_information', [
            'slug' => $slug,
            'fields' => ['sections' => false],
        ]);

        if (is_wp_error($api)) {
            return ['success' => false, 'error' => $api->get_error_message()];
        }

        $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
        $result = $upgrader->install($api->download_link);

        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        if ($result === false) {
            return ['success' => false, 'error' => 'Plugin installation failed.'];
        }

        // Locate the installed plugin file name
        $plugin_file = $this->find_plugin_file_by_slug($slug);
        
        return [
            'success' => true, 
            'message' => 'Plugin installed successfully.', 
            'pluginFile' => $plugin_file
        ];
    }

    private function find_plugin_file_by_slug(string $slug): string {
        if (!function_exists('get_plugins')) {
            require_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        $plugins = get_plugins();
        foreach (array_keys($plugins) as $file) {
            if (dirname($file) === $slug) {
                return $file;
            }
        }
        return $slug . '/' . $slug . '.php';
    }
}
