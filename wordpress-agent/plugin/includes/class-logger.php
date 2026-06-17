<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Logger { public static function info(string $message, array $context = []): void { error_log('[WPCC] '.$message); } }
