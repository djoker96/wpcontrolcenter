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
}
