<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_File_Editor {
    public function snapshot(): array {
        $robots_file = ABSPATH . 'robots.txt';
        $htaccess_file = ABSPATH . '.htaccess';
        
        $robots = file_exists($robots_file) ? file_get_contents($robots_file) : null;
        $htaccess = file_exists($htaccess_file) ? file_get_contents($htaccess_file) : null;
        
        return [
            'robots' => $robots,
            'htaccess' => $htaccess,
            'phpIni' => null
        ];
    }

    public function update_robots(string $content): array {
        $robots_file = ABSPATH . 'robots.txt';
        if ((file_exists($robots_file) && !is_writable($robots_file)) || (!file_exists($robots_file) && !is_writable(ABSPATH))) {
            return ['success' => false, 'error' => 'robots.txt is not writeable.'];
        }

        $result = file_put_contents($robots_file, $content);
        if ($result === false) {
            return ['success' => false, 'error' => 'Failed to write robots.txt content.'];
        }

        return ['success' => true, 'message' => 'robots.txt updated successfully.'];
    }

    public function update_htaccess(string $content): array {
        $htaccess_file = ABSPATH . '.htaccess';
        $backup_file = ABSPATH . '.htaccess.bak';

        if (file_exists($htaccess_file)) {
            if (!copy($htaccess_file, $backup_file)) {
                return ['success' => false, 'error' => 'Failed to create backup copy of .htaccess.'];
            }
        }

        if ((file_exists($htaccess_file) && !is_writable($htaccess_file)) || (!file_exists($htaccess_file) && !is_writable(ABSPATH))) {
            return ['success' => false, 'error' => '.htaccess is not writeable.'];
        }

        $result = file_put_contents($htaccess_file, $content);
        if ($result === false) {
            if (file_exists($backup_file)) {
                copy($backup_file, $htaccess_file);
            }
            return ['success' => false, 'error' => 'Failed to write .htaccess content.'];
        }

        return ['success' => true, 'message' => '.htaccess updated successfully. Backup saved.'];
    }

    public function update_php_config(array $settings): array {
        $user_ini_file = ABSPATH . '.user.ini';
        
        $existing = [];
        if (file_exists($user_ini_file)) {
            $ini_content = file_get_contents($user_ini_file);
            $lines = explode("\n", $ini_content);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || $line[0] === ';') continue;
                $parts = explode('=', $line, 2);
                if (count($parts) === 2) {
                    $existing[trim($parts[0])] = trim($parts[1]);
                }
            }
        }

        foreach ($settings as $key => $value) {
            $existing[$key] = $value;
        }

        $content = "; WP Control Center Local PHP Configuration\n";
        foreach ($existing as $key => $value) {
            $content .= "{$key} = {$value}\n";
        }

        $result = file_put_contents($user_ini_file, $content);
        if ($result === false) {
            $applied = [];
            foreach ($settings as $key => $value) {
                if (@ini_set($key, $value) !== false) {
                    $applied[] = $key;
                }
            }
            return [
                'success' => false, 
                'error' => 'Failed to write .user.ini. Applied dynamically: ' . implode(', ', $applied)
            ];
        }

        return ['success' => true, 'message' => 'PHP local configuration (.user.ini) updated successfully.'];
    }
}
