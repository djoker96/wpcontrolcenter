<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Theme_Manager {
    public function list_themes(): array {
        $themes = wp_get_themes();
        $current_theme = get_stylesheet();
        $update_themes = get_site_transient('update_themes');

        $data = [];
        foreach ($themes as $slug => $theme_obj) {
            $is_active = ($slug === $current_theme);
            $version_installed = $theme_obj->get('Version');

            $update_available = false;
            $version_latest = $version_installed;
            if (isset($update_themes->response[$slug])) {
                $update_available = true;
                $version_latest = $update_themes->response[$slug]['new_version'];
            }

            $data[] = [
                'slug' => $slug,
                'name' => $theme_obj->get('Name'),
                'versionInstalled' => $version_installed,
                'versionLatest' => $version_latest,
                'isActive' => $is_active,
                'updateAvailable' => $update_available,
            ];
        }
        return $data;
    }

    public function update_theme(string $theme_slug): array {
        if (!class_exists('Theme_Upgrader')) {
            require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
        }

        delete_site_transient('update_themes');
        wp_update_themes();

        $upgrader = new Theme_Upgrader(new Automatic_Upgrader_Skin());
        $result = $upgrader->upgrade($theme_slug);

        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        if ($result === false) {
            return ['success' => false, 'error' => 'Theme upgrade failed or is already up to date.'];
        }
        return ['success' => true, 'message' => 'Theme updated successfully.'];
    }

    public function delete_theme(string $theme_slug): array {
        if (!function_exists('delete_theme')) {
            require_once ABSPATH . 'wp-admin/includes/theme.php';
        }
        $result = delete_theme($theme_slug);
        if (is_wp_error($result)) {
            return ['success' => false, 'error' => $result->get_error_message()];
        }
        if ($result === false) {
            return ['success' => false, 'error' => 'Failed to delete theme files.'];
        }
        return ['success' => true, 'message' => 'Theme deleted successfully.'];
    }
}
