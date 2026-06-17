<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_DB_Manager {
    public function optimize(): array {
        global $wpdb;
        
        $tables = $wpdb->get_col("SHOW TABLES LIKE '{$wpdb->prefix}%'");
        $optimized = [];
        $errors = [];
        
        foreach ($tables as $table) {
            $result = $wpdb->query("OPTIMIZE TABLE `{$table}`");
            if ($result === false) {
                $errors[] = "Failed to optimize table: {$table}";
            } else {
                $optimized[] = $table;
            }
        }
        
        if (count($errors) > 0 && count($optimized) === 0) {
            return ['success' => false, 'error' => implode('; ', $errors)];
        }
        
        return [
            'success' => true, 
            'message' => 'Database optimization completed.',
            'optimizedTables' => $optimized,
            'errors' => $errors
        ];
    }
}
