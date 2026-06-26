<?php
/**
 * Cache Manager for WP Control Center Agent.
 *
 * Clears all known WordPress cache plugins. The approach is "fire & forget":
 * call every known cache-clearing API — if the plugin exists the function/class
 * exists and runs; if not, the check skips it silently.
 *
 * This list should be updated whenever a new cache plugin gains significant
 * market share (> 1% of WP sites).
 *
 * @package WPCC_Agent
 */

if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Cache_Manager {

    /**
     * Clear all known caches.
     *
     * @return array{success: bool, message: string, clearedMethods: string[]}
     */
    public function clear(): array {
        $cleared = [];

        /* ────────────────────────────────────────────────
         * 1. WordPress Object Cache (built-in)
         * ──────────────────────────────────────────────── */
        if (function_exists('wp_cache_flush')) {
            wp_cache_flush();
            $cleared[] = 'WordPress Object Cache (wp_cache_flush)';
        }

        /* ────────────────────────────────────────────────
         * 2. W3 Total Cache
         *    https://wordpress.org/plugins/w3-total-cache/
         * ──────────────────────────────────────────────── */
        if (function_exists('w3tc_pgcache_flush')) {
            w3tc_pgcache_flush();
            $cleared[] = 'W3 Total Cache (Page Cache)';
        }
        if (function_exists('w3tc_dbcache_flush')) {
            w3tc_dbcache_flush();
            $cleared[] = 'W3 Total Cache (DB Cache)';
        }
        if (function_exists('w3tc_minify_flush')) {
            w3tc_minify_flush();
            $cleared[] = 'W3 Total Cache (Minify)';
        }
        if (function_exists('w3tc_objectcache_flush')) {
            w3tc_objectcache_flush();
            $cleared[] = 'W3 Total Cache (Object Cache)';
        }
        if (function_exists('w3tc_flush_all')) {
            w3tc_flush_all();
            $cleared[] = 'W3 Total Cache (Flush All)';
        }

        /* ────────────────────────────────────────────────
         * 3. WP Super Cache
         *    https://wordpress.org/plugins/wp-super-cache/
         * ──────────────────────────────────────────────── */
        if (function_exists('wp_cache_clear_cache')) {
            wp_cache_clear_cache();
            $cleared[] = 'WP Super Cache (wp_cache_clear_cache)';
        }
        if (function_exists('prune_super_cache')) {
            // Clear everything including the cache directory root
            prune_super_cache(WP_CONTENT_DIR . '/cache/', true);
            $cleared[] = 'WP Super Cache (prune_super_cache)';
        }

        /* ────────────────────────────────────────────────
         * 4. WP Rocket
         *    https://wp-rocket.me/
         * ──────────────────────────────────────────────── */
        if (function_exists('rocket_clean_domain')) {
            rocket_clean_domain();
            $cleared[] = 'WP Rocket (rocket_clean_domain)';
        }
        if (function_exists('rocket_clean_minify')) {
            rocket_clean_minify();
            $cleared[] = 'WP Rocket (rocket_clean_minify)';
        }
        if (function_exists('rocket_clean_cache_busting')) {
            rocket_clean_cache_busting();
            $cleared[] = 'WP Rocket (cache busting)';
        }

        /* ────────────────────────────────────────────────
         * 5. Autoptimize
         *    https://wordpress.org/plugins/autoptimize/
         * ──────────────────────────────────────────────── */
        if (class_exists('autoptimizeCache') && method_exists('autoptimizeCache', 'clearall')) {
            autoptimizeCache::clearall();
            $cleared[] = 'Autoptimize (clearall)';
        }

        /* ────────────────────────────────────────────────
         * 6. WP Fastest Cache
         *    https://wordpress.org/plugins/wp-fastest-cache/
         * ──────────────────────────────────────────────── */
        if (function_exists('wpfc_clear_all_cache')) {
            wpfc_clear_all_cache(true);
            $cleared[] = 'WP Fastest Cache (wpfc_clear_all_cache)';
        }
        do_action('wpfc_clear_all_cache', true);
        $cleared[] = 'WP Fastest Cache (action)';

        /* ────────────────────────────────────────────────
         * 7. LiteSpeed Cache
         *    https://wordpress.org/plugins/litespeed-cache/
         * ──────────────────────────────────────────────── */
        if (function_exists('LiteSpeed_Cache_API') && method_exists('LiteSpeed_Cache_API', 'purge_all')) {
            LiteSpeed_Cache_API::purge_all();
            $cleared[] = 'LiteSpeed Cache (API::purge_all)';
        }
        // Newer versions use action-based approach
        if (defined('LSCWP_V')) {
            do_action('litespeed_purge_all');
            $cleared[] = 'LiteSpeed Cache (action)';
        }

        /* ────────────────────────────────────────────────
         * 8. Hummingbird (by WPMU DEV)
         *    https://wordpress.org/plugins/hummingbird-performance/
         * ──────────────────────────────────────────────── */
        if (class_exists('WP_Hummingbird_Module_Page_Cache') && method_exists('WP_Hummingbird_Module_Page_Cache', 'clear_cache')) {
            WP_Hummingbird_Module_Page_Cache::clear_cache();
            $cleared[] = 'Hummingbird (Page Cache)';
        }
        // Action-based fallback
        do_action('wphb_clear_cache');
        $cleared[] = 'Hummingbird (action)';

        /* ────────────────────────────────────────────────
         * 9. Cache Enabler
         *    https://wordpress.org/plugins/cache-enabler/
         * ──────────────────────────────────────────────── */
        if (class_exists('Cache_Enabler') && method_exists('Cache_Enabler', 'clear_total_cache')) {
            Cache_Enabler::clear_total_cache();
            $cleared[] = 'Cache Enabler (clear_total_cache)';
        }
        do_action('cache_enabler_clear_complete_cache');
        if (!in_array('Cache Enabler (action)', $cleared, true)) {
            $cleared[] = 'Cache Enabler (action)';
        }

        /* ────────────────────────────────────────────────
         * 10. Comet Cache
         *     https://wordpress.org/plugins/comet-cache/
         * ──────────────────────────────────────────────── */
        if (class_exists('comet_cache') && method_exists('comet_cache', 'clear')) {
            comet_cache::clear();
            $cleared[] = 'Comet Cache (comet_cache::clear)';
        }

        /* ────────────────────────────────────────────────
         * 11. Breeze (by Cloudways)
         *     https://wordpress.org/plugins/breeze/
         * ──────────────────────────────────────────────── */
        do_action('breeze_clear_all_cache');
        $cleared[] = 'Breeze (action)';
        if (function_exists('breeze_cache_invalidate')) {
            breeze_cache_invalidate();
            $cleared[] = 'Breeze (cache_invalidate)';
        }

        /* ────────────────────────────────────────────────
         * 12. SG Optimizer (SiteGround)
         *     https://wordpress.org/plugins/sg-cachepress/
         * ──────────────────────────────────────────────── */
        if (function_exists('sg_cachepress_purge_cache')) {
            sg_cachepress_purge_cache();
            $cleared[] = 'SG Optimizer (sg_cachepress_purge_cache)';
        }
        do_action('sg_cachepress_purge_cache');
        if (!in_array('SG Optimizer (action)', $cleared, true)) {
            $cleared[] = 'SG Optimizer (action)';
        }

        /* ────────────────────────────────────────────────
         * 13. WP-Optimize
         *     https://wordpress.org/plugins/wp-optimize/
         * ──────────────────────────────────────────────── */
        if (class_exists('WP_Optimize') && method_exists(WP_Optimize(), 'get_page_cache')) {
            $wp_optimize_cache = WP_Optimize()->get_page_cache();
            if ($wp_optimize_cache && method_exists($wp_optimize_cache, 'purge')) {
                $wp_optimize_cache->purge();
                $cleared[] = 'WP-Optimize (page cache purge)';
            }
        }

        /* ────────────────────────────────────────────────
         * 14. Swift Performance
         *     https://wordpress.org/plugins/swift-performance-lite/
         * ──────────────────────────────────────────────── */
        if (defined('SWIFT_PERFORMANCE_VERSION')) {
            do_action('swift_performance_clear_all_cache');
            $cleared[] = 'Swift Performance (action)';
        }
        if (class_exists('Swift_Performance_Cache') && method_exists('Swift_Performance_Cache', 'clear_all_cache')) {
            Swift_Performance_Cache::clear_all_cache();
            $cleared[] = 'Swift Performance (class)';
        }

        /* ────────────────────────────────────────────────
         * 15. Flying Press
         *     https://wordpress.org/plugins/flying-press/
         * ──────────────────────────────────────────────── */
        do_action('flying_press_purge_all');
        $cleared[] = 'Flying Press (action)';

        /* ────────────────────────────────────────────────
         * 16. Hyper Cache
         *     https://wordpress.org/plugins/hyper-cache/
         * ──────────────────────────────────────────────── */
        if (function_exists('hyper_clear')) {
            hyper_clear();
            $cleared[] = 'Hyper Cache (hyper_clear)';
        }

        /* ────────────────────────────────────────────────
         * 17. Nginx Helper
         *     https://wordpress.org/plugins/nginx-helper/
         * ──────────────────────────────────────────────── */
        do_action('rt_nginx_helper_purge_all');
        $cleared[] = 'Nginx Helper (action)';

        /* ────────────────────────────────────────────────
         * 18. Varnish / HTTP Purge
         *     https://wordpress.org/plugins/varnish-http-purge/
         * ──────────────────────────────────────────────── */
        do_action('varnish_http_purge_all');
        $cleared[] = 'Varnish (action)';

        /* ────────────────────────────────────────────────
         * 19. Pantheon Cache
         * ──────────────────────────────────────────────── */
        if (function_exists('pantheon_wp_clear_edge_cache')) {
            pantheon_wp_clear_edge_cache();
            $cleared[] = 'Pantheon (pantheon_wp_clear_edge_cache)';
        }
        // Also try the action (newer versions)
        if (defined('PANTHEON_CACHE_ENABLED')) {
            do_action('pantheon_clear_edge_cache');
            $cleared[] = 'Pantheon (action)';
        }

        /* ────────────────────────────────────────────────
         * 20. WP Engine
         * ──────────────────────────────────────────────── */
        if (defined('WPE_CLUSTER') || defined('WPE_APIKEY')) {
            if (function_exists('WpeCommon::purge_varnish_cache')) {
                call_user_func(array('WpeCommon', 'purge_varnish_cache'));
                $cleared[] = 'WP Engine (WpeCommon::purge_varnish_cache)';
            }
            if (function_exists('WpeCommon::purge_memcached')) {
                call_user_func(array('WpeCommon', 'purge_memcached'));
                $cleared[] = 'WP Engine (WpeCommon::purge_memcached)';
            }
            if (function_exists('WpeCommon::clear_maxcdn_cache')) {
                call_user_func(array('WpeCommon', 'clear_maxcdn_cache'));
                $cleared[] = 'WP Engine (WpeCommon::clear_maxcdn_cache)';
            }
            do_action('wpe_purge_all_caches');
            $cleared[] = 'WP Engine (action)';
        }

        /* ────────────────────────────────────────────────
         * 21. Kinsta Cache
         * ──────────────────────────────────────────────── */
        if (defined('KINSTAMU_VERSION') || defined('KINSTA_CACHE')) {
            do_action('kinsta_clear_cache_home');
            $cleared[] = 'Kinsta (action)';
            // Kinsta's full-site purge action
            do_action('kinsta_clear_full_site_cache');
            $cleared[] = 'Kinsta (full site purge)';
        }
        if (class_exists('Kinsta\Cache_Purge') && method_exists('Kinsta\Cache_Purge', 'purge_complete_caches')) {
            Kinsta\Cache_Purge::purge_complete_caches();
            $cleared[] = 'Kinsta (Cache_Purge::purge_complete_caches)';
        }

        /* ────────────────────────────────────────────────
         * 22. Pressable / GoDaddy / Pagely
         * ──────────────────────────────────────────────── */
        do_action('pressable_cache_purge');
        $cleared[] = 'Pressable (action)';
        do_action('pagely_cache_purge');
        $cleared[] = 'Pagely (action)';
        do_action('gd_system_purge_cache');
        $cleared[] = 'GoDaddy (action)';
        do_action('endurance_cache_purge_settings');
        $cleared[] = 'Endurance (action)';

        /* ────────────────────────────────────────────────
         * 23. Servebolt
         * ──────────────────────────────────────────────── */
        do_action('servebolt_purge_all');
        $cleared[] = 'Servebolt (action)';

        /* ────────────────────────────────────────────────
         * 24. Cloudflare
         *     APO (Automatic Platform Optimization)
         * ──────────────────────────────────────────────── */
        if (function_exists('cloudflare_purge_cache')) {
            cloudflare_purge_cache();
            $cleared[] = 'Cloudflare (cloudflare_purge_cache)';
        }
        do_action('cloudflare_purge_cache');
        $cleared[] = 'Cloudflare (action)';

        /* ────────────────────────────────────────────────
         * 25. Dọn sạch thư mục /wp-content/cache/ (fallback cuối)
         *     Bắt tất cả cache plugin không nằm trong danh sách trên
         * ──────────────────────────────────────────────── */
        $cache_dir = WP_CONTENT_DIR . '/cache';
        if (is_dir($cache_dir)) {
            $this->delete_directory_contents($cache_dir);
            $cleared[] = 'wp-content/cache directory (physical cleanup)';
        }

        // Deduplicate
        $cleared = array_unique($cleared);

        return [
            'success' => true,
            'message' => sprintf('Cleared %d cache layer(s).', count($cleared)),
            'clearedMethods' => $cleared,
        ];
    }

    /**
     * Recursively delete all files and subdirectories inside a directory
     * without removing the directory itself.
     */
    private function delete_directory_contents(string $dir): void {
        if (!is_dir($dir)) return;

        $items = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($dir, RecursiveDirectoryIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($items as $item) {
            if ($item->isDir()) {
                @rmdir($item->getRealPath());
            } else {
                @unlink($item->getRealPath());
            }
        }
    }
}
