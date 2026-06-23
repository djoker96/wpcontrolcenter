<?php
/**
 * Object Cache Manager for WP Control Center Agent.
 *
 * Handles enabling/disabling object cache and reporting status.
 *
 * @package WPCC_Agent
 */

if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Object_Cache_Manager {

    /**
     * Check current object cache status.
     */
    public function status(): array {
        $active = defined('WP_CACHE') && WP_CACHE;
        $dropin_exists = file_exists(WP_CONTENT_DIR . '/object-cache.php');
        $backend = $this->detect_backend();

        // Check Redis Object Cache plugin specifically
        $redis_plugin_active = $this->is_redis_cache_plugin_active();
        $redis_status = null;
        if ($redis_plugin_active && function_exists('redis_object_cache_get_status')) {
            $redis_status = redis_object_cache_get_status();
        }

        return [
            'success' => true,
            'enabled' => $active || $dropin_exists,
            'hasDropin' => $dropin_exists,
            'backend' => $backend,
            'redisPluginActive' => $redis_plugin_active,
            'redisStatus' => $redis_status,
        ];
    }

    /**
     * Enable object cache.
     */
    public function enable(): array {
        // 1. If Redis Object Cache plugin is active, use its API
        if ($this->is_redis_cache_plugin_active() && function_exists('redis_object_cache_enable')) {
            $result = redis_object_cache_enable();
            if ($result) {
                return ['success' => true, 'message' => 'Object cache enabled via Redis Object Cache plugin.', 'method' => 'redis_plugin'];
            }
        }

        // 2. Fallback: toggle WP_CACHE in wp-config.php
        $result = $this->toggle_wp_cache(true);
        if ($result['success']) {
            return ['success' => true, 'message' => 'Object cache enabled via WP_CACHE constant.', 'method' => 'wp_config'];
        }

        return ['success' => false, 'error' => 'Could not enable object cache: ' . $result['error']];
    }

    /**
     * Disable object cache.
     */
    public function disable(): array {
        // 1. If Redis Object Cache plugin is active, use its API
        if ($this->is_redis_cache_plugin_active() && function_exists('redis_object_cache_disable')) {
            $result = redis_object_cache_disable();
            if ($result) {
                return ['success' => true, 'message' => 'Object cache disabled via Redis Object Cache plugin.', 'method' => 'redis_plugin'];
            }
        }

        // 2. Remove drop-in if it exists
        $dropin = WP_CONTENT_DIR . '/object-cache.php';
        if (file_exists($dropin)) {
            if (!unlink($dropin)) {
                return ['success' => false, 'error' => 'Failed to remove object-cache.php drop-in.'];
            }
        }

        // 3. Fallback: toggle WP_CACHE in wp-config.php
        $result = $this->toggle_wp_cache(false);
        if ($result['success']) {
            return ['success' => true, 'message' => 'Object cache disabled.', 'method' => 'wp_config'];
        }

        return ['success' => false, 'error' => 'Could not disable object cache: ' . $result['error']];
    }

    private function is_redis_cache_plugin_active(): bool {
        if (!function_exists('is_plugin_active')) {
            include_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        return function_exists('is_plugin_active') && is_plugin_active('redis-cache/redis-cache.php');
    }

    private function detect_backend(): string {
        // Detect common object cache backends
        if (defined('WP_REDIS_HOST') || defined('WP_REDIS_SERVERS')) {
            return 'Redis';
        }
        if (defined('MEMCACHED_SERVERS') || class_exists('Memcached')) {
            return 'Memcached';
        }
        if (file_exists(WP_CONTENT_DIR . '/object-cache.php')) {
            return 'Unknown (drop-in present)';
        }
        return 'None';
    }

    /**
     * Toggle WP_CACHE constant in wp-config.php.
     * Reads the file, replaces or adds the define, writes back.
     */
    private function toggle_wp_cache(bool $enabled): array {
        $config_file = ABSPATH . 'wp-config.php';
        if (!file_exists($config_file)) {
            // Try parent directory (common for Bedrock/some setups)
            $config_file = dirname(ABSPATH) . '/wp-config.php';
        }
        if (!file_exists($config_file)) {
            return ['success' => false, 'error' => 'wp-config.php not found.'];
        }
        if (!is_writable($config_file)) {
            return ['success' => false, 'error' => 'wp-config.php is not writable.'];
        }

        $content = file_get_contents($config_file);
        $define_line = "define('WP_CACHE', " . ($enabled ? 'true' : 'false') . ");";

        if (preg_match("/define\s*\(\s*'WP_CACHE'\s*,\s*(true|false)\s*\)\s*;/i", $content)) {
            // Replace existing WP_CACHE define
            $content = preg_replace(
                "/define\s*\(\s*'WP_CACHE'\s*,\s*(true|false)\s*\)\s*;/i",
                $define_line,
                $content
            );
        } else {
            // Insert after opening <?php
            $insert_pos = strpos($content, '<?php');
            if ($insert_pos !== false) {
                $insert_pos += 5; // after '<?php'
                $content = substr($content, 0, $insert_pos) . "\n" . $define_line . "\n" . substr($content, $insert_pos);
            } else {
                $content = "<?php\n" . $define_line . "\n" . $content;
            }
        }

        $result = file_put_contents($config_file, $content);
        if ($result === false) {
            return ['success' => false, 'error' => 'Failed to write wp-config.php.'];
        }

        return ['success' => true];
    }
}
