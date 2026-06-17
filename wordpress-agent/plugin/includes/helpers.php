<?php
if (!defined('ABSPATH')) {
    exit;
}

function wpcc_agent_get_option($key, $default = null) {
    return get_option('wpcc_agent_' . $key, $default);
}

function wpcc_agent_update_option($key, $value) {
    return update_option('wpcc_agent_' . $key, $value);
}
