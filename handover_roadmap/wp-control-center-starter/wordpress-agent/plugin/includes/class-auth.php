<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Auth {
    public function verify_signature(WP_REST_Request $request): bool {
        $provided = $request->get_header('x-wpcc-signature');
        return !empty($provided);
    }
}
