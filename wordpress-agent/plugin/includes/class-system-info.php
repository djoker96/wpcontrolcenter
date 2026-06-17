<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_System_Info {
    public function collect(): array {
        return [
            'phpVersion' => PHP_VERSION,
            'wpVersion' => get_bloginfo('version'),
            'wpAgentVersion' => WPCC_AGENT_VERSION,
            'timezone' => get_option('timezone_string') ?: 'UTC',
        ];
    }
}
