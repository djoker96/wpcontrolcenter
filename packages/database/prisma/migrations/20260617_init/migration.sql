-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'OPERATOR', 'VIEWER');
CREATE TYPE "EnvironmentType" AS ENUM ('PRODUCTION', 'STAGING', 'DEVELOPMENT');
CREATE TYPE "SiteStatus" AS ENUM ('ACTIVE', 'DISABLED', 'ARCHIVED');
CREATE TYPE "ConnectionStatus" AS ENUM ('PENDING', 'CONNECTED', 'DISCONNECTED', 'ERROR');
CREATE TYPE "JobType" AS ENUM (
  'REGISTER_SITE', 'RESYNC_SITE', 'SYNC_SYSTEM_INFO', 'SYNC_PLUGINS', 'SYNC_THEMES', 'SYNC_CORE',
  'UPDATE_CORE', 'UPDATE_PLUGIN', 'UPDATE_THEME', 'ACTIVATE_PLUGIN', 'DEACTIVATE_PLUGIN', 'INSTALL_PLUGIN',
  'DELETE_PLUGIN', 'DELETE_THEME', 'TOGGLE_MAINTENANCE', 'CLEAR_CACHE', 'OPTIMIZE_DATABASE',
  'UPDATE_ROBOTS_TXT', 'UPDATE_HTACCESS', 'UPDATE_PHP_CONFIG'
);
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELED', 'TIMED_OUT');
CREATE TYPE "JobTargetType" AS ENUM ('SITE', 'CORE', 'PLUGIN', 'THEME', 'CONFIG', 'CACHE', 'DATABASE');
CREATE TYPE "IncidentType" AS ENUM ('UPTIME', 'RESPONSE_TIME', 'CONNECTION');
CREATE TYPE "IncidentSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "IncidentStatus" AS ENUM ('OPEN', 'RESOLVED', 'MUTED');
CREATE TYPE "NotificationChannelType" AS ENUM ('EMAIL', 'TELEGRAM', 'SLACK', 'DISCORD', 'WEBHOOK');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');
CREATE TYPE "IntegrationProvider" AS ENUM ('GOOGLE');
CREATE TYPE "IntegrationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED', 'ERROR');
CREATE TYPE "AnalyticsSource" AS ENUM ('GA4', 'GSC');
CREATE TYPE "AuditResult" AS ENUM ('SUCCESS', 'FAILURE', 'PARTIAL');
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateTable
CREATE TABLE "users" (
  "id" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "password_hash" TEXT NOT NULL,
  "full_name" TEXT,
  "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sites" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "site_url" TEXT NOT NULL,
  "environment" "EnvironmentType" NOT NULL DEFAULT 'PRODUCTION',
  "wp_version" TEXT,
  "php_version" TEXT,
  "wp_agent_version" TEXT,
  "timezone" TEXT,
  "status" "SiteStatus" NOT NULL DEFAULT 'ACTIVE',
  "connection_status" "ConnectionStatus" NOT NULL DEFAULT 'PENDING',
  "maintenance_mode" BOOLEAN NOT NULL DEFAULT false,
  "ga4_property_id" TEXT,
  "gsc_site_url" TEXT,
  "notes" TEXT,
  "last_seen_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "sites_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_credentials" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "public_key" TEXT NOT NULL,
  "secret_key_encrypted" TEXT NOT NULL,
  "connection_token_encrypted" TEXT,
  "last_rotated_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_credentials_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_settings" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "heartbeat_interval_minutes" INTEGER NOT NULL DEFAULT 5,
  "uptime_check_enabled" BOOLEAN NOT NULL DEFAULT true,
  "analytics_sync_enabled" BOOLEAN NOT NULL DEFAULT true,
  "update_window_start" TEXT,
  "update_window_end" TEXT,
  "allow_plugin_install" BOOLEAN NOT NULL DEFAULT true,
  "allow_plugin_delete" BOOLEAN NOT NULL DEFAULT true,
  "allow_theme_delete" BOOLEAN NOT NULL DEFAULT true,
  "allow_file_edit" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "plugins" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version_installed" TEXT NOT NULL,
  "version_latest" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "is_premium" BOOLEAN NOT NULL DEFAULT false,
  "auto_update_enabled" BOOLEAN NOT NULL DEFAULT false,
  "update_available" BOOLEAN NOT NULL DEFAULT false,
  "source_type" TEXT,
  "installed_at" TIMESTAMP(3),
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "plugins_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "themes" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version_installed" TEXT NOT NULL,
  "version_latest" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "update_available" BOOLEAN NOT NULL DEFAULT false,
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "core_versions" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "version_installed" TEXT NOT NULL,
  "version_latest" TEXT,
  "update_available" BOOLEAN NOT NULL DEFAULT false,
  "last_synced_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "core_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "jobs" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "job_type" "JobType" NOT NULL,
  "target_type" "JobTargetType" NOT NULL,
  "target_slug" TEXT,
  "payload_json" JSONB,
  "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
  "initiated_by_user_id" TEXT,
  "queued_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "ended_at" TIMESTAMP(3),
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "error_message" TEXT,
  "result_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "job_logs" (
  "id" TEXT NOT NULL,
  "job_id" TEXT NOT NULL,
  "level" "LogLevel" NOT NULL DEFAULT 'INFO',
  "message" TEXT NOT NULL,
  "context_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "job_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "uptime_checks" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status_code" INTEGER,
  "response_time_ms" INTEGER,
  "is_up" BOOLEAN NOT NULL,
  "error_message" TEXT,
  CONSTRAINT "uptime_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "incidents" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "incident_type" "IncidentType" NOT NULL,
  "severity" "IncidentSeverity" NOT NULL DEFAULT 'WARNING',
  "started_at" TIMESTAMP(3) NOT NULL,
  "ended_at" TIMESTAMP(3),
  "status" "IncidentStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT,
  "metadata_json" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "analytics_daily" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "metric_date" DATE NOT NULL,
  "source" "AnalyticsSource" NOT NULL,
  "sessions" INTEGER,
  "users" INTEGER,
  "pageviews" INTEGER,
  "impressions" INTEGER,
  "clicks" INTEGER,
  "ctr" DOUBLE PRECISION,
  "avg_position" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "analytics_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "top_pages_daily" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "metric_date" DATE NOT NULL,
  "source" "AnalyticsSource" NOT NULL,
  "page_path" TEXT NOT NULL,
  "page_title" TEXT,
  "sessions" INTEGER,
  "pageviews" INTEGER,
  "impressions" INTEGER,
  "clicks" INTEGER,
  "ctr" DOUBLE PRECISION,
  "avg_position" DOUBLE PRECISION,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "top_pages_daily_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "user_id" TEXT,
  "site_id" TEXT,
  "action" TEXT NOT NULL,
  "entity_type" TEXT,
  "entity_id" TEXT,
  "payload_json" JSONB,
  "result" "AuditResult" NOT NULL DEFAULT 'SUCCESS',
  "ip_address" TEXT,
  "user_agent" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notifications" (
  "id" TEXT NOT NULL,
  "channel_type" "NotificationChannelType" NOT NULL,
  "destination" TEXT NOT NULL,
  "is_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "notification_events" (
  "id" TEXT NOT NULL,
  "site_id" TEXT,
  "incident_id" TEXT,
  "notification_id" TEXT,
  "event_type" TEXT NOT NULL,
  "channel_type" "NotificationChannelType" NOT NULL,
  "destination" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "payload_json" JSONB,
  "sent_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notification_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "maintenance_snapshots" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "robots_txt_content" TEXT,
  "htaccess_content" TEXT,
  "php_ini_content" TEXT,
  "captured_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_by_user_id" TEXT,
  CONSTRAINT "maintenance_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "integration_accounts" (
  "id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "account_email" TEXT,
  "access_token_encrypted" TEXT NOT NULL,
  "refresh_token_encrypted" TEXT,
  "expires_at" TIMESTAMP(3),
  "metadata_json" JSONB,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "integration_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "site_integrations" (
  "id" TEXT NOT NULL,
  "site_id" TEXT NOT NULL,
  "integration_account_id" TEXT NOT NULL,
  "provider" "IntegrationProvider" NOT NULL,
  "external_property_id" TEXT,
  "external_site_identifier" TEXT,
  "status" "IntegrationStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "site_integrations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "sites_domain_key" ON "sites"("domain");
CREATE INDEX "sites_status_idx" ON "sites"("status");
CREATE INDEX "sites_connection_status_idx" ON "sites"("connection_status");
CREATE UNIQUE INDEX "site_credentials_site_id_key" ON "site_credentials"("site_id");
CREATE UNIQUE INDEX "site_settings_site_id_key" ON "site_settings"("site_id");
CREATE UNIQUE INDEX "plugins_site_id_slug_key" ON "plugins"("site_id", "slug");
CREATE INDEX "plugins_site_id_update_available_idx" ON "plugins"("site_id", "update_available");
CREATE UNIQUE INDEX "themes_site_id_slug_key" ON "themes"("site_id", "slug");
CREATE INDEX "themes_site_id_update_available_idx" ON "themes"("site_id", "update_available");
CREATE UNIQUE INDEX "core_versions_site_id_key" ON "core_versions"("site_id");
CREATE INDEX "jobs_site_id_status_idx" ON "jobs"("site_id", "status");
CREATE INDEX "jobs_job_type_status_idx" ON "jobs"("job_type", "status");
CREATE INDEX "job_logs_job_id_created_at_idx" ON "job_logs"("job_id", "created_at");
CREATE INDEX "uptime_checks_site_id_checked_at_idx" ON "uptime_checks"("site_id", "checked_at");
CREATE INDEX "incidents_site_id_status_idx" ON "incidents"("site_id", "status");
CREATE INDEX "incidents_started_at_idx" ON "incidents"("started_at");
CREATE UNIQUE INDEX "analytics_daily_site_id_metric_date_source_key" ON "analytics_daily"("site_id", "metric_date", "source");
CREATE INDEX "analytics_daily_site_id_metric_date_idx" ON "analytics_daily"("site_id", "metric_date");
CREATE INDEX "top_pages_daily_site_id_metric_date_idx" ON "top_pages_daily"("site_id", "metric_date");
CREATE INDEX "top_pages_daily_site_id_source_idx" ON "top_pages_daily"("site_id", "source");
CREATE INDEX "audit_logs_site_id_created_at_idx" ON "audit_logs"("site_id", "created_at");
CREATE INDEX "audit_logs_user_id_created_at_idx" ON "audit_logs"("user_id", "created_at");
CREATE INDEX "notification_events_site_id_created_at_idx" ON "notification_events"("site_id", "created_at");
CREATE INDEX "notification_events_incident_id_idx" ON "notification_events"("incident_id");
CREATE INDEX "maintenance_snapshots_site_id_captured_at_idx" ON "maintenance_snapshots"("site_id", "captured_at");
CREATE UNIQUE INDEX "site_integrations_site_id_provider_key" ON "site_integrations"("site_id", "provider");
CREATE INDEX "site_integrations_integration_account_id_idx" ON "site_integrations"("integration_account_id");

-- AddForeignKey
ALTER TABLE "site_credentials" ADD CONSTRAINT "site_credentials_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_settings" ADD CONSTRAINT "site_settings_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "themes" ADD CONSTRAINT "themes_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "core_versions" ADD CONSTRAINT "core_versions_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_initiated_by_user_id_fkey"
  FOREIGN KEY ("initiated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_job_id_fkey"
  FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "uptime_checks" ADD CONSTRAINT "uptime_checks_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "analytics_daily" ADD CONSTRAINT "analytics_daily_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "top_pages_daily" ADD CONSTRAINT "top_pages_daily_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_incident_id_fkey"
  FOREIGN KEY ("incident_id") REFERENCES "incidents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_notification_id_fkey"
  FOREIGN KEY ("notification_id") REFERENCES "notifications"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "maintenance_snapshots" ADD CONSTRAINT "maintenance_snapshots_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "maintenance_snapshots" ADD CONSTRAINT "maintenance_snapshots_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "site_integrations" ADD CONSTRAINT "site_integrations_site_id_fkey"
  FOREIGN KEY ("site_id") REFERENCES "sites"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "site_integrations" ADD CONSTRAINT "site_integrations_integration_account_id_fkey"
  FOREIGN KEY ("integration_account_id") REFERENCES "integration_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
