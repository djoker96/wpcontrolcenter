<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Core_Manager { public function version(): string { return get_bloginfo('version'); } }
