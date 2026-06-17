<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Auth {
    public function verify_signature(WP_REST_Request $request): bool {
        $signature = $request->get_header('x-wpcc-signature');
        $timestamp = $request->get_header('x-wpcc-timestamp');

        if (empty($signature) || empty($timestamp)) {
            return false;
        }

        // Prevent replay attacks (allow 5-minute window)
        $current_time = time();
        if (abs($current_time - (int)$timestamp) > 300) {
            return false;
        }

        $secret_key = wpcc_agent_get_option('secret_key');
        if (empty($secret_key)) {
            return false;
        }

        // Reconstruct signed message: Method|Path|Timestamp|Body
        $method = $request->get_method();
        $path = $request->get_route();
        $body = $request->get_body();
        
        $message = $method . '|' . $path . '|' . $timestamp . '|' . $body;
        $expected_signature = hash_hmac('sha256', $message, $secret_key);

        return hash_equals($expected_signature, $signature);
    }
}
