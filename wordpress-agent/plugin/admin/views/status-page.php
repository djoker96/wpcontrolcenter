<?php if (!defined('ABSPATH')) { exit; } ?>
<div class="wrap">
  <h1>WP Control Center Agent Settings</h1>
  <?php settings_errors('wpcc_messages'); ?>

  <?php if (wpcc_agent_get_option('connected', false)): ?>
    <div class="card" style="max-width: 600px; padding: 20px; margin-top: 20px;">
      <h2 style="color: #46b450; display: flex; align-items: center;">
        <span class="dashicons dashicons-yes-alt" style="margin-right: 8px;"></span> Connected
      </h2>
      <p>This WordPress site is successfully connected and managed by WP Control Center.</p>
      <table class="form-table">
        <tr>
          <th>Site ID</th>
          <td><code><?php echo esc_html(wpcc_agent_get_option('site_id')); ?></code></td>
        </tr>
        <tr>
          <th>API URL</th>
          <td><code><?php echo esc_url(wpcc_agent_get_option('api_url')); ?></code></td>
        </tr>
        <tr>
          <th>Agent Version</th>
          <td><?php echo esc_html(WPCC_AGENT_VERSION); ?></td>
        </tr>
      </table>
      <form method="post" action="" style="margin-top: 20px;">
        <?php wp_nonce_field('wpcc_agent_action', 'wpcc_nonce'); ?>
        <input type="submit" name="wpcc_disconnect" class="button button-secondary" value="Disconnect Site">
      </form>
    </div>
  <?php else: ?>
    <div class="card" style="max-width: 600px; padding: 20px; margin-top: 20px;">
      <h2>Connect to Control Center</h2>
      <p>Enter the details provided on the WP Control Center dashboard to connect this site.</p>
      <form method="post" action="">
        <?php wp_nonce_field('wpcc_agent_action', 'wpcc_nonce'); ?>
        <table class="form-table">
          <tr>
            <th><label for="api_url">API URL</label></th>
            <td>
              <input type="url" name="api_url" id="api_url" class="regular-text" placeholder="http://localhost:3003/api" required>
              <p class="description">The NestJS API URL (e.g. http://localhost:3003/api)</p>
            </td>
          </tr>
          <tr>
            <th><label for="connection_token">Connection Token</label></th>
            <td>
              <input type="text" name="connection_token" id="connection_token" class="regular-text" placeholder="wpcc_tok_..." required>
              <p class="description">Copy this from the WP Control Center dashboard</p>
            </td>
          </tr>
        </table>
        <p class="submit">
          <input type="submit" name="wpcc_connect" class="button button-primary" value="Connect Site">
        </p>
      </form>
    </div>
  <?php endif; ?>
</div>
