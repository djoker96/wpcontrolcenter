# WP Control Center - Phase C: Inventory Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Retrieve, update, and persist WordPress system info, plugins, themes, and core version updates in PostgreSQL database using real data fetched from WP Agent REST API.

**Architecture:** Extend WP Agent REST API to fetch real installations. Implement a backend trigger `resync` inside NestJS that makes an authenticated and HMAC-signed request to the WP agent. Persist these records in PostgreSQL using Prisma, keeping them in sync by removing uninstalled components.

**Tech Stack:** NestJS (TypeScript), WordPress REST API (PHP), Prisma, Next.js (TypeScript) with Tailwind CSS.

## Global Constraints

- Enforce signature verification on WP Agent side using the decrypted secret key.
- Signed request from backend to agent must match PHP hash_hmac signature verification.
- Sites must run on PORT 3003 (Backend API) and PORT 3004 (Next.js Dashboard).
- Decrypt secrets in database using process.env.AGENT_ENCRYPTION_KEY or the default key.

---

### Task 1: WordPress Agent Plugin Inventory Collector

**Files:**
- Modify: [class-plugin-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-plugin-manager.php)
- Modify: [class-theme-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-theme-manager.php)
- Modify: [class-core-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-core-manager.php)
- Modify: [class-system-info.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-system-info.php)
- Modify: [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php)

**Interfaces:**
- Consumes: None
- Produces: `POST /wp-json/wpcc/v1/execute/sync-inventory` returning structured JSON data containing systemInfo, plugins, themes, and core.

- [ ] **Step 1: Implement plugin listing logic in class-plugin-manager.php**
  Replace contents of [class-plugin-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-plugin-manager.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_Plugin_Manager {
      public function list_plugins(): array {
          if (!function_exists('get_plugins')) {
              require_once ABSPATH . 'wp-admin/includes/plugin.php';
          }
          $plugins = get_plugins();
          $active_plugins = (array) get_option('active_plugins', []);
          $update_plugins = get_site_transient('update_plugins');

          $data = [];
          foreach ($plugins as $file => $details) {
              $slug = dirname($file);
              if ($slug === '.' || empty($slug)) {
                  $slug = sanitize_title(pathinfo($file, PATHINFO_FILENAME));
              }

              // Also check for network active plugins
              $is_active = in_array($file, $active_plugins) || (function_exists('is_plugin_active_for_network') && is_plugin_active_for_network($file));

              $update_available = false;
              $version_latest = $details['Version'];
              if (isset($update_plugins->response[$file])) {
                  $update_available = true;
                  $version_latest = $update_plugins->response[$file]->new_version;
              }

              $auto_update_plugins = (array) get_option('auto_update_plugins', []);
              $auto_update_enabled = in_array($file, $auto_update_plugins);

              $data[] = [
                  'slug' => $file,
                  'name' => $details['Name'],
                  'versionInstalled' => $details['Version'],
                  'versionLatest' => $version_latest,
                  'isActive' => $is_active,
                  'updateAvailable' => $update_available,
                  'autoUpdateEnabled' => $auto_update_enabled,
              ];
          }
          return $data;
      }
  }
  ```

- [ ] **Step 2: Implement theme listing logic in class-theme-manager.php**
  Replace contents of [class-theme-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-theme-manager.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_Theme_Manager {
      public function list_themes(): array {
          $themes = wp_get_themes();
          $current_theme = get_stylesheet();
          $update_themes = get_site_transient('update_themes');

          $data = [];
          foreach ($themes as $slug => $theme_obj) {
              $is_active = ($slug === $current_theme);
              $version_installed = $theme_obj->get('Version');

              $update_available = false;
              $version_latest = $version_installed;
              if (isset($update_themes->response[$slug])) {
                  $update_available = true;
                  $version_latest = $update_themes->response[$slug]['new_version'];
              }

              $data[] = [
                  'slug' => $slug,
                  'name' => $theme_obj->get('Name'),
                  'versionInstalled' => $version_installed,
                  'versionLatest' => $version_latest,
                  'isActive' => $is_active,
                  'updateAvailable' => $update_available,
              ];
          }
          return $data;
      }
  }
  ```

- [ ] **Step 3: Implement core version logic in class-core-manager.php**
  Replace contents of [class-core-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-core-manager.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_Core_Manager {
      public function version(): array {
          $version_installed = get_bloginfo('version');
          $update_core = get_site_transient('update_core');

          $update_available = false;
          $version_latest = $version_installed;

          if (isset($update_core->updates) && is_array($update_core->updates)) {
              foreach ($update_core->updates as $update) {
                  if ($update->response === 'upgrade') {
                      $update_available = true;
                      $version_latest = $update->current;
                      break;
                  }
              }
          }

          return [
              'versionInstalled' => $version_installed,
              'versionLatest' => $version_latest,
              'updateAvailable' => $update_available,
          ];
      }
  }
  ```

- [ ] **Step 4: Implement system info collection in class-system-info.php**
  Replace contents of [class-system-info.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-system-info.php):
  ```php
  <?php
  if (!defined('ABSPATH')) { exit; }

  class WPCC_Agent_System_Info {
      public function collect(): array {
          return [
              'phpVersion' => PHP_VERSION,
              'wpVersion' => get_bloginfo('version'),
              'wpAgentVersion' => WPCC_AGENT_VERSION,
              'timezone' => get_option('timezone_string') ?: 'UTC',
          ];
      }
  }
  ```

- [ ] **Step 5: Bind the sync-inventory action handler in class-api.php**
  Modify [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php) to return the payload when `sync-inventory` action is received:
  ```php
      public function execute_action(WP_REST_Request $request): WP_REST_Response {
          $action = $request->get_param('action');
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

          return new WP_REST_Response([
              'success' => true,
              'action' => $action,
              'message' => 'Stub executor completed',
          ], 200);
      }
  ```

---

### Task 2: Backend API Inventory Sync Implementations

**Files:**
- Modify: [sites.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.service.ts)
- Modify: [sites.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.controller.ts)

**Interfaces:**
- Consumes: `POST /wp-json/wpcc/v1/execute/sync-inventory` from the WordPress Agent.
- Produces: `POST /api/sites/:id/resync` and queries `plugins`, `themes`, `core` and `overview` endpoints.

- [ ] **Step 1: Write the logic for resync in sites.service.ts**
  Add `createHmac` import from `node:crypto` and implement the `resync` method in [sites.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.service.ts):
  ```typescript
  import { createHmac } from 'node:crypto';
  import { BadRequestException } from '@nestjs/common';

  // Inside class SitesService
  async resync(id: string) {
    const site = await this.prisma.site.findUnique({
      where: { id },
      include: { credential: true },
    });

    if (!site) {
      throw new NotFoundException(`Site with ID ${id} not found`);
    }

    if (site.connectionStatus !== 'CONNECTED') {
      throw new BadRequestException('Site is not connected');
    }

    const secretKey = decrypt(site.credential.secretKeyEncrypted, this.getEncryptionKey());
    const method = 'POST';
    const path = '/wpcc/v1/execute/sync-inventory';
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const bodyObj = {};
    const bodyStr = JSON.stringify(bodyObj);

    // Create signature
    const message = `${method}|${path}|${timestamp}|${bodyStr}`;
    const signature = createHmac('sha256', secretKey).update(message).digest('hex');

    // Call WordPress Agent
    const targetUrl = `${site.siteUrl.replace(/\/$/, '')}/wp-json/wpcc/v1/execute/sync-inventory`;
    
    try {
      const response = await fetch(targetUrl, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'x-wpcc-signature': signature,
          'x-wpcc-timestamp': timestamp,
        },
        body: bodyStr,
      });

      if (!response.ok) {
        throw new Error(`Agent returned status ${response.status}`);
      }

      const responseBody = await response.json() as any;
      if (!responseBody.success || !responseBody.data) {
        throw new Error(responseBody.message || 'Agent sync failed');
      }

      const { systemInfo, plugins, themes, core } = responseBody.data;

      // Update Site Table
      await this.prisma.site.update({
        where: { id },
        data: {
          wpVersion: systemInfo.wpVersion,
          phpVersion: systemInfo.phpVersion,
          wpAgentVersion: systemInfo.wpAgentVersion,
          timezone: systemInfo.timezone,
          lastSeenAt: new Date(),
        },
      });

      // Upsert plugins
      const activeSlugs = plugins.map(p => p.slug);
      for (const plugin of plugins) {
        await this.prisma.plugin.upsert({
          where: {
            siteId_slug: {
              siteId: id,
              slug: plugin.slug,
            },
          },
          update: {
            name: plugin.name,
            versionInstalled: plugin.versionInstalled,
            versionLatest: plugin.versionLatest,
            isActive: plugin.isActive,
            updateAvailable: plugin.updateAvailable,
            autoUpdateEnabled: plugin.autoUpdateEnabled,
            lastSyncedAt: new Date(),
          },
          create: {
            siteId: id,
            slug: plugin.slug,
            name: plugin.name,
            versionInstalled: plugin.versionInstalled,
            versionLatest: plugin.versionLatest,
            isActive: plugin.isActive,
            updateAvailable: plugin.updateAvailable,
            autoUpdateEnabled: plugin.autoUpdateEnabled,
            lastSyncedAt: new Date(),
          },
        });
      }
      // Delete uninstalled plugins
      await this.prisma.plugin.deleteMany({
        where: {
          siteId: id,
          slug: { notIn: activeSlugs },
        },
      });

      // Upsert themes
      const activeThemeSlugs = themes.map(t => t.slug);
      for (const theme of themes) {
        await this.prisma.theme.upsert({
          where: {
            siteId_slug: {
              siteId: id,
              slug: theme.slug,
            },
          },
          update: {
            name: theme.name,
            versionInstalled: theme.versionInstalled,
            versionLatest: theme.versionLatest,
            isActive: theme.isActive,
            updateAvailable: theme.updateAvailable,
            lastSyncedAt: new Date(),
          },
          create: {
            siteId: id,
            slug: theme.slug,
            name: theme.name,
            versionInstalled: theme.versionInstalled,
            versionLatest: theme.versionLatest,
            isActive: theme.isActive,
            updateAvailable: theme.updateAvailable,
            lastSyncedAt: new Date(),
          },
        });
      }
      // Delete uninstalled themes
      await this.prisma.theme.deleteMany({
        where: {
          siteId: id,
          slug: { notIn: activeThemeSlugs },
        },
      });

      // Upsert core version
      await this.prisma.coreVersion.upsert({
        where: { siteId: id },
        update: {
          versionInstalled: core.versionInstalled,
          versionLatest: core.versionLatest,
          updateAvailable: core.updateAvailable,
          lastSyncedAt: new Date(),
        },
        create: {
          siteId: id,
          versionInstalled: core.versionInstalled,
          versionLatest: core.versionLatest,
          updateAvailable: core.updateAvailable,
          lastSyncedAt: new Date(),
        },
      });

      // Log success audit event
      await this.prisma.auditLog.create({
        data: {
          siteId: id,
          action: 'site.resync',
          entityType: 'site',
          entityId: id,
          result: 'SUCCESS',
        },
      });

      return { success: true };
    } catch (error) {
      await this.prisma.auditLog.create({
        data: {
          siteId: id,
          action: 'site.resync',
          entityType: 'site',
          entityId: id,
          result: 'FAILURE',
          payloadJson: { error: error.message },
        },
      });
      throw error;
    }
  }
  ```

- [ ] **Step 2: Bind the resync and query endpoints in sites.controller.ts**
  Replace the stub methods in [sites.controller.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.controller.ts):
  ```typescript
  // Replace resync
  @Post(':id/resync')
  @Roles(UserRole.ADMIN)
  async resync(@Param('id') id: string) {
    return this.sitesService.resync(id);
  }

  // Replace overview
  @Get(':id/overview')
  @Roles(UserRole.ADMIN)
  async overview(@Param('id') id: string) {
    const site = await this.sitesService.findOne(id);
    const [pluginsCount, activePluginsCount, pluginUpdatesAvailable] = await Promise.all([
      this.sitesService.prisma.plugin.count({ where: { siteId: id } }),
      this.sitesService.prisma.plugin.count({ where: { siteId: id, isActive: true } }),
      this.sitesService.prisma.plugin.count({ where: { siteId: id, updateAvailable: true } }),
    ]);

    const [themesCount, activeThemeName, themeUpdatesAvailable] = await Promise.all([
      this.sitesService.prisma.theme.count({ where: { siteId: id } }),
      this.sitesService.prisma.theme.findFirst({ where: { siteId: id, isActive: true } }).then(t => t?.name || 'None'),
      this.sitesService.prisma.theme.count({ where: { siteId: id, updateAvailable: true } }),
    ]);

    return {
      siteId: id,
      summary: {
        name: site.name,
        domain: site.domain,
        siteUrl: site.siteUrl,
        connectionStatus: site.connectionStatus,
        lastSeenAt: site.lastSeenAt,
        wpVersion: site.wpVersion,
        phpVersion: site.phpVersion,
        wpAgentVersion: site.wpAgentVersion,
        timezone: site.timezone,
        pluginsCount,
        activePluginsCount,
        pluginUpdatesAvailable,
        themesCount,
        activeThemeName,
        themeUpdatesAvailable,
        coreUpdateAvailable: site.coreVersion?.updateAvailable || false,
        coreVersionLatest: site.coreVersion?.versionLatest || null,
      },
    };
  }

  // Replace plugins
  @Get(':id/plugins')
  @Roles(UserRole.ADMIN)
  async plugins(@Param('id') id: string) {
    const data = await this.sitesService.prisma.plugin.findMany({
      where: { siteId: id },
      orderBy: { name: 'asc' },
    });
    return { siteId: id, data };
  }

  // Replace themes
  @Get(':id/themes')
  @Roles(UserRole.ADMIN)
  async themes(@Param('id') id: string) {
    const data = await this.sitesService.prisma.theme.findMany({
      where: { siteId: id },
      orderBy: { name: 'asc' },
    });
    return { siteId: id, data };
  }

  // Replace core
  @Get(':id/core')
  @Roles(UserRole.ADMIN)
  async core(@Param('id') id: string) {
    const data = await this.sitesService.prisma.coreVersion.findUnique({
      where: { siteId: id },
    });
    return data || { versionInstalled: 'Unknown', updateAvailable: false };
  }
  ```

---

### Task 3: Admin Dashboard (Next.js) UI Views

**Files:**
- [NEW] [apps/web/app/sites/[id]/page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/%5Bid%5D/page.tsx)
- [NEW] [apps/web/app/sites/page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/page.tsx)
- [MODIFY] [apps/web/app/page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/page.tsx)

- [ ] **Step 1: Create the Sites List Page in apps/web/app/sites/page.tsx**
  Add a gorgeous, premium, dark-mode styling page to view all sites and connection statuses.
  Includes an "Add New Site" modal.

- [ ] **Step 2: Create the Site Detail tabs Page in apps/web/app/sites/[id]/page.tsx**
  Implement responsive tabs (Overview, Plugins, Themes, Core Version, Uptime, Audit Logs).
  Add a "Sync Now" button that triggers backend `resync` API and displays a loading spinner.

- [ ] **Step 3: Redirect main page to /sites in page.tsx**
  Simplify [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/page.tsx) to act as landing page or directly link to `/sites`.

---

## Verification Plan

### Automated Tests
- Run `npm run test` in backend apps if tests exist.
- Run `npm run typecheck` in next.js web application.

### Manual Verification
1. **WP Agent REST Call Verification**:
   - Manually call `POST /wp-json/wpcc/v1/execute/sync-inventory` using Postman or curl with valid HMAC signature headers.
   - Confirm it returns real WordPress installation inventory.
2. **Backend Resync Trigger Verification**:
   - Execute `POST /api/sites/:id/resync` with a valid Admin token.
   - Verify PostgreSQL database tables (`plugins`, `themes`, `core_versions`) have updated records.
3. **Frontend Dashboard UI Inspection**:
   - Launch Next.js dev server.
   - Access the sites detail dashboard, click "Sync Now".
   - Confirm it updates visual lists of plugins, themes, and WP version.
