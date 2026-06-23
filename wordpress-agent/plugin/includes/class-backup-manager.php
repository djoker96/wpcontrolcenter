<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Backup_Manager {
    private $backup_dir;

    public function __construct() {
        $this->backup_dir = WP_CONTENT_DIR . '/wpcc-backups';
        if (!file_exists($this->backup_dir)) {
            wp_mkdir_p($this->backup_dir);
            // Defense-in-depth: prevent public web access across server stacks.
            // Apache 2.4 + 2.2 compat .htaccess
            file_put_contents($this->backup_dir . '/.htaccess', "# Apache 2.4\nRequire all denied\n# Apache 2.2 compat\nDeny from all\n");
            // nginx ignores .htaccess; silent index.html blocks directory listing
            file_put_contents($this->backup_dir . '/index.html', '');
            // IIS hiddenSegments (web.config)
            file_put_contents($this->backup_dir . '/web.config', '<?xml version="1.0"?><configuration><system.webServer><security><requestFiltering><hiddenSegments><add segment="wpcc-backups"/></hiddenSegments></requestFiltering></security></system.webServer></configuration>');
            file_put_contents($this->backup_dir . '/index.php', "<?php\n// Silence\n");
        }
    }

    public function create($type): array {
        $timestamp = time();
        $db_file = '';
        $zip_file = '';
        $final_file = '';

        try {
            if ($type === 'DATABASE' || $type === 'FULL') {
                $db_file = $this->dump_db($timestamp);
            }
            if ($type === 'FILES' || $type === 'FULL') {
                $zip_file = $this->zip_files($timestamp, $db_file);
            }

            if ($type === 'FULL') {
                // Merge both into full zip and remove temporary database sql
                $full_zip = $this->backup_dir . "/full-backup-{$timestamp}.zip";
                $zip = new ZipArchive();
                if ($zip->open($full_zip, ZipArchive::CREATE) === true) {
                    if ($db_file && file_exists($db_file)) {
                        $zip->addFile($db_file, basename($db_file));
                    }
                    if ($zip_file && file_exists($zip_file)) {
                        $zip->addFile($zip_file, basename($zip_file));
                    }
                    $zip->close();
                } else {
                    throw new Exception('Failed to create full ZIP backup.');
                }
                if ($db_file && file_exists($db_file)) {
                    @unlink($db_file);
                }
                if ($zip_file && file_exists($zip_file)) {
                    @unlink($zip_file);
                }
                $final_file = $full_zip;
            } elseif ($type === 'DATABASE') {
                $final_file = $db_file;
            } else {
                $final_file = $zip_file;
            }

            if (!$final_file || !file_exists($final_file)) {
                throw new Exception('Backup file creation failed or file does not exist.');
            }

            return [
                'success' => true,
                'filename' => basename($final_file),
                'size' => filesize($final_file),
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function restore($filename): array {
        $filepath = $this->backup_dir . '/' . basename($filename);
        if (!file_exists($filepath)) {
            return ['success' => false, 'message' => 'Backup file not found.'];
        }

        try {
            if (strpos($filename, 'db-backup') !== false) {
                $this->restore_db($filepath);
            } elseif (strpos($filename, 'files-backup') !== false) {
                $this->restore_files($filepath);
            } elseif (strpos($filename, 'full-backup') !== false) {
                // Extract into a unique temp subdir (Zip-Slip safe) so the restore
                // loop only touches THIS archive's contents, not stale backups.
                $tmp_dir = $this->backup_dir . '/.restore-' . uniqid('', true);
                wp_mkdir_p($tmp_dir);
                try {
                    wpcc_agent_safe_extract_zip($filepath, $tmp_dir);
                    foreach (glob($tmp_dir . '/*') as $file) {
                        if (strpos($file, 'db-backup') !== false) {
                            $this->restore_db($file);
                        } elseif (strpos($file, 'files-backup') !== false) {
                            $this->restore_files($file);
                        }
                    }
                } finally {
                    // Clean up extracted artifacts regardless of outcome.
                    foreach (glob($tmp_dir . '/*') as $file) { @unlink($file); }
                    @rmdir($tmp_dir);
                }
            }
            return ['success' => true, 'message' => 'Restore completed successfully.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    private function dump_db($timestamp): string {
        global $wpdb;
        $filepath = $this->backup_dir . "/db-backup-{$timestamp}.sql";
        $handle = fopen($filepath, 'w');
        if (!$handle) {
            throw new Exception('Cannot write to SQL backup file');
        }

        $tables = $wpdb->get_col("SHOW TABLES");
        foreach ($tables as $table) {
            $create = $wpdb->get_row("SHOW CREATE TABLE `{$table}`", ARRAY_N);
            if (!$create || !isset($create[1])) {
                continue;
            }
            fwrite($handle, "\n\nDROP TABLE IF EXISTS `{$table}`;\n");
            fwrite($handle, "\n\n" . $create[1] . ";\n\n");

            $rows = $wpdb->get_results("SELECT * FROM `{$table}`", ARRAY_A);
            foreach ($rows as $row) {
                $fields = array_map(function($val) use ($wpdb) {
                    if ($val === null) return 'NULL';
                    return "'" . esc_sql($val) . "'";
                }, $row);
                fwrite($handle, "INSERT INTO `{$table}` VALUES (" . implode(',', $fields) . ");\n");
            }
        }
        fclose($handle);
        return $filepath;
    }

    private function restore_db($filepath) {
        global $wpdb;
        $queries = file_get_contents($filepath);
        if ($queries === false) {
            throw new Exception('Cannot read database backup SQL file');
        }
        // Reject dumps carrying executable/web-shell payloads — a .sql restore
        // should never contain PHP tags or NUL bytes.
        if (strpos($queries, '<?php') !== false || strpos($queries, '<?=') !== false || strpos($queries, "\0") !== false) {
            throw new Exception('Backup SQL file failed content validation.');
        }
        // Quote-aware split so semicolons/newlines inside values cannot break or
        // inject statements (see wpcc_agent_split_sql).
        foreach (wpcc_agent_split_sql($queries) as $query) {
            $wpdb->query($query);
        }
    }

    private function zip_files($timestamp, $exclude_db_file): string {
        $filepath = $this->backup_dir . "/files-backup-{$timestamp}.zip";
        $zip = new ZipArchive();
        if ($zip->open($filepath, ZipArchive::CREATE) !== true) {
            throw new Exception('Cannot create zip file');
        }

        $root_path = realpath(WP_CONTENT_DIR);
        $files = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($root_path),
            RecursiveIteratorIterator::LEAVES_ONLY
        );

        foreach ($files as $name => $file) {
            if (!$file->isDir()) {
                $file_real = $file->getRealPath();
                // Exclude the backup directory itself
                if (strpos($file_real, $this->backup_dir) !== false) {
                    continue;
                }
                // Exclude temporary db dump if it exists
                if ($exclude_db_file && $file_real === realpath($exclude_db_file)) {
                    continue;
                }
                $relative_path = substr($file_real, strlen($root_path) + 1);
                $zip->addFile($file_real, $relative_path);
            }
        }
        $zip->close();
        return $filepath;
    }

    private function restore_files($filepath) {
        // Zip-Slip safe extraction: rejects entries that escape WP_CONTENT_DIR.
        wpcc_agent_safe_extract_zip($filepath, WP_CONTENT_DIR);
    }
}
