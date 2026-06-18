<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Plugin_Manager { public function list_plugins(): array { return array_values(get_plugins()); } }
