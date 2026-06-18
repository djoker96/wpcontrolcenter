# Database Schema - WP Control Center

## 1. users
- id
- email
- password_hash
- full_name
- role
- is_active
- created_at
- updated_at

## 2. sites
- id
- name
- domain
- site_url
- environment
- wp_version
- php_version
- wp_agent_version
- timezone
- status
- connection_status
- maintenance_mode
- ga4_property_id
- gsc_site_url
- notes
- last_seen_at
- created_at
- updated_at

## 3. site_credentials
- id
- site_id
- public_key
- secret_key_encrypted
- connection_token_encrypted
- last_rotated_at
- created_at
- updated_at

## 4. site_settings
- id
- site_id
- heartbeat_interval_minutes
- uptime_check_enabled
- analytics_sync_enabled
- update_window_start
- update_window_end
- allow_plugin_install
- allow_plugin_delete
- allow_theme_delete
- allow_file_edit
- created_at
- updated_at

## 5. plugins
- id
- site_id
- slug
- name
- version_installed
- version_latest
- is_active
- is_premium
- auto_update_enabled
- update_available
- source_type
- installed_at
- last_synced_at
- created_at
- updated_at

## 6. themes
- id
- site_id
- slug
- name
- version_installed
- version_latest
- is_active
- update_available
- last_synced_at
- created_at
- updated_at

## 7. core_versions
- id
- site_id
- version_installed
- version_latest
- update_available
- last_synced_at
- created_at
- updated_at

## 8. jobs
- id
- site_id
- job_type
- target_type
- target_slug
- payload_json
- status
- initiated_by_user_id
- queued_at
- started_at
- ended_at
- retry_count
- error_message
- result_json
- created_at
- updated_at

## 9. job_logs
- id
- job_id
- level
- message
- context_json
- created_at

## 10. uptime_checks
- id
- site_id
- checked_at
- status_code
- response_time_ms
- is_up
- error_message

## 11. incidents
- id
- site_id
- incident_type
- severity
- started_at
- ended_at
- status
- summary
- metadata_json
- created_at
- updated_at

## 12. analytics_daily
- id
- site_id
- metric_date
- source
- sessions
- users
- pageviews
- impressions
- clicks
- ctr
- avg_position
- created_at
- updated_at

## 13. top_pages_daily
- id
- site_id
- metric_date
- source
- page_path
- page_title
- sessions
- pageviews
- impressions
- clicks
- ctr
- avg_position
- created_at
- updated_at

## 14. audit_logs
- id
- user_id
- site_id
- action
- entity_type
- entity_id
- payload_json
- result
- ip_address
- user_agent
- created_at

## 15. notifications
- id
- channel_type
- destination
- is_enabled
- created_at
- updated_at

## 16. notification_events
- id
- site_id
- incident_id
- event_type
- channel_type
- destination
- status
- payload_json
- sent_at
- created_at
- updated_at

## 17. maintenance_snapshots
- id
- site_id
- robots_txt_content
- htaccess_content
- php_ini_content
- captured_at
- created_by_user_id

## 18. integration_accounts
- id
- provider
- account_email
- access_token_encrypted
- refresh_token_encrypted
- expires_at
- metadata_json
- created_at
- updated_at

## 19. site_integrations
- id
- site_id
- integration_account_id
- provider
- external_property_id
- external_site_identifier
- status
- created_at
- updated_at
