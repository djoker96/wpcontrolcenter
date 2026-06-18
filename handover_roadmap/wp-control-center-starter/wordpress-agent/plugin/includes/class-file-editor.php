<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_File_Editor { public function snapshot(): array { return ['robots' => null, 'htaccess' => null, 'phpIni' => null]; } }
