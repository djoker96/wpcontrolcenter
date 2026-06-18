<div class="wrap">
  <h1>WP Control Center Agent</h1>
  <p>Connection status: <?php echo wpcc_agent_get_option('connected', false) ? 'Connected' : 'Disconnected'; ?></p>
  <p>Agent version: <?php echo esc_html(WPCC_AGENT_VERSION); ?></p>
</div>
