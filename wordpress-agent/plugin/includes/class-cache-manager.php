<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Cache_Manager {
    public function clear(): array {
        $cleared_methods = [];
        
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
            $cleared_methods[] = 'WordPress Object Cache';
        }
        
        if (function_exists('w3tc_pgcache_flush')) {
            w3tc_pgcache_flush();
            $cleared_methods[] = 'W3 Total Cache (Page Cache)';
        }
        if (function_exists('w3tc_dbcache_flush')) {
            w3tc_dbcache_flush();
            $cleared_methods[] = 'W3 Total Cache (DB Cache)';
        }
        
        if (function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
            $cleared_methods[] = 'WP Super Cache';
        }
        
        if (class_exists('autoptimizeCache')) {
            if (method_exists('autoptimizeCache', 'clearall')) {
                autoptimizeCache::clearall();
                $cleared_methods[] = 'Autoptimize Cache';
            }
        }
        
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
            $cleared_methods[] = 'WP Rocket Cache';
        }

        $cache_dir = WP_CONTENT_DIR . '/cache';
        if (is_dir($cache_dir)) {
            $this->delete_directory_contents($cache_dir);
            $cleared_methods[] = 'wp-content/cache directory files';
        }
        
        return [
            'success' => true, 
            'message' => 'Cache cleared successfully.',
            'clearedMethods' => $cleared_methods
        ];
    }

    private function delete_directory_contents(string $dir): void {
        if (!is_dir($dir)) return;
        $files = array_diff(scandir($dir), ['.', '..']);
        foreach ($files as $file) {
            $path = "$dir/$file";
            if (is_dir($path)) {
                $this->delete_directory_contents($path);
                @rmdir($path);
            } else {
                @unlink($path);
            }
        }
    }
}
