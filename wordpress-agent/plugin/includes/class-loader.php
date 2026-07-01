<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Loader {
    public function boot() {
        (new WPCC_Agent_API())->register_hooks();
        (new WPCC_Agent_Admin_Page())->register_hooks();
        (new WPCC_Agent_Heartbeat())->register_hooks();
    }
}
