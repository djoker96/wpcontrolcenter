<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Theme_Manager { public function list_themes(): array { return wp_get_themes(); } }
