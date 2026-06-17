<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Maintenance_Manager {
    public function toggle(bool $enabled): bool {
        $file = ABSPATH . '.maintenance';
        if ($enabled) {
            $content = "<?php \$upgrading = " . time() . ";";
            return file_put_contents($file, $content) !== false;
        } else {
            if (file_exists($file)) {
                return unlink($file);
            }
            return true;
        }
    }
}
