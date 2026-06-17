# WP Control Center - Phase D: Jobs & Remote Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish a secure, robust background job queue system (BullMQ + Redis) to trigger and monitor remote WordPress actions (plugins/themes/core updates and de/activation) via the WP Agent.

**Architecture:** 
1. **NestJS API (Producer)**: Install `bullmq` and `ioredis`. Create a global `Queue` provider. Trigger action endpoints that write a `Job` record with `QUEUED` status and push a job event containing `jobId` to BullMQ.
2. **BullMQ Worker (Consumer)**: Transform `apps/worker` into a real BullMQ worker listening to the Redis queue. For each job, fetch the target site and credentials, sign requests with the decrypted secret key, call the WordPress REST API action executor, handle responses/errors, and update status (`SUCCESS` / `FAILED`) in PostgreSQL.
3. **WordPress Agent (PHP Executor)**: Implement action handlers in managers (Core, Plugin, Theme, Maintenance) calling WordPress built-in upgrader/manager functions, and map them under the HMAC-protected REST `/execute/[action]` route.

**Tech Stack:** NestJS (TypeScript), BullMQ, Redis, Prisma, WordPress REST API (PHP).

## Global Constraints

- Enforce symmetric HMAC signature verification on all actions received by the WP Agent.
- Set job status properly (`QUEUED` -> `RUNNING` -> `SUCCESS` or `FAILED`).
- All actions must be logged in `AuditLog` and `JobLog` database tables.

---

### Task 1: WordPress Agent Plugin Remote Action Executors

**Files:**
- Modify: [class-plugin-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-plugin-manager.php)
- Modify: [class-theme-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-theme-manager.php)
- Modify: [class-core-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-core-manager.php)
- Modify: [class-maintenance-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-maintenance-manager.php)
- Modify: [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php)

**Interfaces:**
- Consumes: `POST /wp-json/wpcc/v1/execute/[action]`
- Produces: JSON response `{ success: true, message: "..." }` or `{ success: false, error: "..." }`

- [ ] **Step 1: Implement plugin action methods in class-plugin-manager.php**
  Add methods for `update_plugin`, `activate_plugin`, `deactivate_plugin`, and `delete_plugin` to [class-plugin-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-plugin-manager.php):
  ```php
  class WPCC_Agent_Plugin_Manager {
      // ... existing list_plugins code ...

      public function update_plugin(string $plugin_file): array {
          if (!function_exists('get_plugins')) {
              require_once ABSPATH . 'wp-admin/includes/plugin.php';
          }
          if (!class_exists('Plugin_Upgrader')) {
              require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
          }

          // Clear transient to force WordPress to check updates
          delete_site_transient('update_plugins');
          wp_update_plugins();

          $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
          $result = $upgrader->upgrade($plugin_file);

          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          if ($result === false) {
              return ['success' => false, 'error' => 'Plugin upgrade failed or is already up to date.'];
          }
          return ['success' => true, 'message' => 'Plugin updated successfully.'];
      }

      public function activate_plugin(string $plugin_file): array {
          $result = activate_plugin($plugin_file);
          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          return ['success' => true, 'message' => 'Plugin activated successfully.'];
      }

      public function deactivate_plugin(string $plugin_file): array {
          deactivate_plugins($plugin_file);
          return ['success' => true, 'message' => 'Plugin deactivated successfully.'];
      }

      public function delete_plugin(string $plugin_file): array {
          if (!function_exists('delete_plugins')) {
              require_once ABSPATH . 'wp-admin/includes/plugin.php';
          }
          // Plugin must be deactivated before deleting
          deactivate_plugins($plugin_file);
          $result = delete_plugins([$plugin_file]);
          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          if ($result === false) {
              return ['success' => false, 'error' => 'Failed to delete plugin files.'];
          }
          return ['success' => true, 'message' => 'Plugin deleted successfully.'];
      }
  }
  ```

- [ ] **Step 2: Implement theme action methods in class-theme-manager.php**
  Add methods for `update_theme` and `delete_theme` to [class-theme-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-theme-manager.php):
  ```php
  class WPCC_Agent_Theme_Manager {
      // ... existing list_themes code ...

      public function update_theme(string $theme_slug): array {
          if (!class_exists('Theme_Upgrader')) {
              require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
          }

          delete_site_transient('update_themes');
          wp_update_themes();

          $upgrader = new Theme_Upgrader(new Automatic_Upgrader_Skin());
          $result = $upgrader->upgrade($theme_slug);

          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          if ($result === false) {
              return ['success' => false, 'error' => 'Theme upgrade failed or is already up to date.'];
          }
          return ['success' => true, 'message' => 'Theme updated successfully.'];
      }

      public function delete_theme(string $theme_slug): array {
          if (!function_exists('delete_theme')) {
              require_once ABSPATH . 'wp-admin/includes/theme.php';
          }
          $result = delete_theme($theme_slug);
          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          if ($result === false) {
              return ['success' => false, 'error' => 'Failed to delete theme files.'];
          }
          return ['success' => true, 'message' => 'Theme deleted successfully.'];
      }
  }
  ```

- [ ] **Step 3: Implement core upgrade method in class-core-manager.php**
  Add `update_core` method to [class-core-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-core-manager.php):
  ```php
  class WPCC_Agent_Core_Manager {
      // ... existing version code ...

      public function update_core(): array {
          if (!class_exists('Core_Upgrader')) {
              require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
          }

          wp_version_check();
          $updates = get_core_updates();
          if (empty($updates)) {
              return ['success' => false, 'error' => 'No core updates available.'];
          }

          $upgrader = new Core_Upgrader(new Automatic_Upgrader_Skin());
          $result = $upgrader->upgrade($updates[0]);

          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          return ['success' => true, 'message' => 'WordPress core updated successfully.'];
      }
  }
  ```

- [ ] **Step 4: Implement maintenance toggle in class-maintenance-manager.php**
  Replace contents of [class-maintenance-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-maintenance-manager.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_Maintenance_Manager {
      public function toggle(bool $enabled): bool {
          $file = ABSPATH . '.maintenance';
          if ($enabled) {
              $content = "<?php \$upgrading = " . time() . ";";
              return file_put_contents($file, $content) !== false;
          } else {
              if (file_exists($file)) {
                  return unlink($file);
              }
              return true;
          }
      }
  }
  ```

- [ ] **Step 5: Route actions to managers in class-api.php**
  Modify the `execute_action()` method in [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php) to call correct managers:
  ```php
      public function execute_action(WP_REST_Request $request): WP_REST_Response {
          $action = $request->get_param('action');
          $body = json_decode($request->get_body(), true) ?: [];

          if ($action === 'sync-inventory') {
              $system_info = (new WPCC_Agent_System_Info())->collect();
              $plugins = (new WPCC_Agent_Plugin_Manager())->list_plugins();
              $themes = (new WPCC_Agent_Theme_Manager())->list_themes();
              $core = (new WPCC_Agent_Core_Manager())->version();

              return new WP_REST_Response([
                  'success' => true,
                  'data' => [
                      'systemInfo' => $system_info,
                      'plugins' => $plugins,
                      'themes' => $themes,
                      'core' => $core,
                  ],
              ], 200);
          }

          // Remote actions dispatch
          switch ($action) {
              case 'update-plugin':
                  $res = (new WPCC_Agent_Plugin_Manager())->update_plugin($body['slug'] ?? '');
                  break;
              case 'activate-plugin':
                  $res = (new WPCC_Agent_Plugin_Manager())->activate_plugin($body['slug'] ?? '');
                  break;
              case 'deactivate-plugin':
                  $res = (new WPCC_Agent_Plugin_Manager())->deactivate_plugin($body['slug'] ?? '');
                  break;
              case 'delete-plugin':
                  $res = (new WPCC_Agent_Plugin_Manager())->delete_plugin($body['slug'] ?? '');
                  break;
              case 'update-theme':
                  $res = (new WPCC_Agent_Theme_Manager())->update_theme($body['slug'] ?? '');
                  break;
              case 'delete-theme':
                  $res = (new WPCC_Agent_Theme_Manager())->delete_theme($body['slug'] ?? '');
                  break;
              case 'update-core':
                  $res = (new WPCC_Agent_Core_Manager())->update_core();
                  break;
              case 'toggle-maintenance':
                  $enabled = filter_var($body['enabled'] ?? false, FILTER_VALIDATE_BOOLEAN);
                  $success = (new WPCC_Agent_Maintenance_Manager())->toggle($enabled);
                  $res = ['success' => $success, 'message' => $success ? 'Maintenance toggled successfully.' : 'Failed to toggle maintenance mode.'];
                  break;
              default:
                  return new WP_REST_Response(['success' => false, 'error' => 'Unknown action: ' . $action], 400);
          }

          return new WP_REST_Response($res, $res['success'] ? 200 : 500);
      }
  ```

---

### Task 2: Backend Jobs Queue Setup (BullMQ)

**Files:**
- Modify: [package.json](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/package.json)
- Modify: [app.module.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/app.module.ts)
- Modify: [sites.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.controller.ts)
- Modify: [sites.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.service.ts)

**Interfaces:**
- Consumes: Action trigger endpoints in `SitesController`.
- Produces: Adds job items containing database `{ jobId }` to Redis `jobs` queue.

- [ ] **Step 1: Install dependencies in apps/api/package.json**
  Add `bullmq` and `ioredis` to [package.json](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/package.json):
  ```json
    "dependencies": {
      // ... existing dependencies ...
      "bullmq": "^5.8.0",
      "ioredis": "^5.4.1"
    }
  ```
  Run `npm install` to update package-lock.json.

- [ ] **Step 2: Initialize BullMQ Queue provider in NestJS app.module.ts**
  Import `Queue` from `bullmq` and export a global `JOBS_QUEUE` provider connected to Redis.
  Redis host: `process.env.REDIS_HOST || 'localhost'`
  Redis port: `process.env.REDIS_PORT || 6380` (since we mapped host to 6380).

- [ ] **Step 3: Modify executeAction in sites.controller.ts to write job & enqueue**
  Replace stub `executeAction` in [sites.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.controller.ts) to delegate to `SitesService.createJob()`.

- [ ] **Step 4: Implement createJob method in sites.service.ts**
  Create database `Job` records with `QUEUED` status, parse the action name to map to correct `JobType` and `JobTargetType` enums, and add the job to the BullMQ queue.

---

### Task 3: BullMQ Worker Processing (apps/worker)

**Files:**
- Modify: [index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts)

**Interfaces:**
- Consumes: Redis `jobs` queue.
- Produces: Authenticated signed requests to WordPress Agent. Updates DB job states.

- [ ] **Step 1: Implement BullMQ Worker class in index.ts**
  Replace `setInterval` tick stubs in [index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts):
  - Read Redis connection settings.
  - Instantiate a BullMQ `Worker` consuming from the `jobs` queue.
  - On each job processor event:
    1. Retrieve the `Job` and `Site` (with credentials) from database using Prisma Client.
    2. Set job status to `RUNNING` and `startedAt` to current date-time.
    3. Construct HMAC headers (`x-wpcc-signature` and `x-wpcc-timestamp`) using the decrypted site secret key.
    4. Fetch the agent's action execution URL using native `fetch`.
    5. On success: update job status to `SUCCESS`, save result payload, set `endedAt`, log in `JobLog`, and trigger a background site inventory resync.
    6. On failure: log exception message, set job status to `FAILED`, set `endedAt`.

---

## Verification Plan

### Automated Tests
- Run `npm run build:all` to ensure no typescript errors exist.

### Manual Verification
1. **Queue Triggering**:
   - Call NestJS API `POST /api/sites/:id/actions/toggle-maintenance` sending `{ "enabled": true }`.
   - Verify that a job record is written to database with `QUEUED` status and enqueued.
2. **Worker Processing**:
   - Launch `npm run dev:worker`.
   - Confirm the worker consumes the job, updates database state to `RUNNING`, sends the HMAC signed request, receives the agent's response, and updates database state to `SUCCESS`.
3. **Agent Action Validation**:
   - Verify that a `.maintenance` file is actually created in the WordPress site's root directory.
   - Run deactivation action and confirm the target plugin is deactivated in WordPress admin.
