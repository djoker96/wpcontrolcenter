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
}
