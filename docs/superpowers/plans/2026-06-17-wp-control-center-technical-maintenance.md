# WP Control Center - Phase F: Technical Maintenance Actions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement technical maintenance capabilities in both WordPress Agent PHP plugin and Backend/Frontend, including remote plugin installation from wp.org slugs, cache flushing, database optimization, and local file editors (robots.txt, .htaccess with backups, php config via .user.ini).

**Architecture:**
1. **WordPress Agent Plugin Support (`wordpress-agent/plugin`)**: Implement real PHP logic inside `class-plugin-manager.php`, `class-cache-manager.php`, `class-db-manager.php`, and `class-file-editor.php` to run actions safely on WordPress Core. Route new actions under `/execute/[action]` in `class-api.php`.
2. **Backend Services & Worker Integration (`apps/api` & `apps/worker`)**: Extend `sites.service.ts` to map actions to DB Job records. Update Worker `index.ts` to parse JobTypes, sign HMAC payloads, dispatch requests to agent, and capture resulting snapshots in `MaintenanceSnapshot` table.
3. **Frontend Maintenance Portal (`apps/web`)**: Create a "Maintenance & Tools" tab in the site details view, providing controls for cache clear, DB optimization, plugin installation by slug, and raw file editing.

**Tech Stack:** NestJS, TypeScript, React, Next.js, WordPress Core PHP APIs (Plugin_Upgrader, wp_cache_flush, $wpdb).

## Global Constraints
- Always create a backup `.htaccess.bak` before editing `.htaccess`.
- Capture robots.txt/htaccess/php config changes inside the `MaintenanceSnapshot` table.
- Maintain HMAC signature verification for all new REST actions.

---

### Task 1: WordPress Agent Plugin Action Implementations

**Files:**
- Modify: `wordpress-agent/plugin/includes/class-plugin-manager.php`
- Modify: `wordpress-agent/plugin/includes/class-cache-manager.php`
- Modify: `wordpress-agent/plugin/includes/class-db-manager.php`
- Modify: `wordpress-agent/plugin/includes/class-file-editor.php`
- Modify: `wordpress-agent/plugin/includes/class-api.php`

**Interfaces:**
- Consumes: Action REST requests via authenticated route.
- Produces: Execution status and array/string results.

- [ ] **Step 1: Implement install_plugin in class-plugin-manager.php**
  Modify [class-plugin-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-plugin-manager.php) to support downloading and installing plugins from WordPress.org.
  Add at the end of the class:
  ```php
      public function install_plugin(string $slug): array {
          if (empty($slug)) {
              return ['success' => false, 'error' => 'Plugin slug is required.'];
          }

          if (!function_exists('plugins_api')) {
              require_once ABSPATH . 'wp-admin/includes/plugin-install.php';
          }
          if (!class_exists('Plugin_Upgrader')) {
              require_once ABSPATH . 'wp-admin/includes/class-wp-upgrader.php';
          }

          $api = plugins_api('plugin_information', [
              'slug' => $slug,
              'fields' => ['sections' => false],
          ]);

          if (is_wp_error($api)) {
              return ['success' => false, 'error' => $api->get_error_message()];
          }

          $upgrader = new Plugin_Upgrader(new Automatic_Upgrader_Skin());
          $result = $upgrader->install($api->download_link);

          if (is_wp_error($result)) {
              return ['success' => false, 'error' => $result->get_error_message()];
          }
          if ($result === false) {
              return ['success' => false, 'error' => 'Plugin installation failed.'];
          }

          // Locate the installed plugin file name
          $plugin_file = $this->find_plugin_file_by_slug($slug);
          
          return [
              'success' => true, 
              'message' => 'Plugin installed successfully.', 
              'pluginFile' => $plugin_file
          ];
      }

      private function find_plugin_file_by_slug(string $slug): string {
          if (!function_exists('get_plugins')) {
              require_once ABSPATH . 'wp-admin/includes/plugin.php';
          }
          $plugins = get_plugins();
          foreach (array_keys($plugins) as $file) {
              if (dirname($file) === $slug) {
                  return $file;
              }
          }
          return $slug . '/' . $slug . '.php';
      }
  ```

- [ ] **Step 2: Implement clear in class-cache-manager.php**
  Modify [class-cache-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-cache-manager.php) to clean core and popular cache plugin files.
  Replace the entire class content:
  ```php
  class WPCC_Agent_Cache_Manager {
      public function clear(): array {
          $cleared_methods = [];
          
          if (function_exists('wp_cache_flush')) {
              wp_cache_flush();
              $cleared_methods[] = 'WordPress Object Cache';
          }
          
          if (function_exists('w3tc_pgcache_flush')) {
              w3tc_pgcache_flush();
              $cleared_methods[] = 'W3 Total Cache (Page Cache)';
          }
          if (function_exists('w3tc_dbcache_flush')) {
              w3tc_dbcache_flush();
              $cleared_methods[] = 'W3 Total Cache (DB Cache)';
          }
          
          if (function_exists('wp_cache_clear_cache')) {
              wp_cache_clear_cache();
              $cleared_methods[] = 'WP Super Cache';
          }
          
          if (class_exists('autoptimizeCache')) {
              if (method_exists('autoptimizeCache', 'clearall')) {
                  autoptimizeCache::clearall();
                  $cleared_methods[] = 'Autoptimize Cache';
              }
          }
          
          if (function_exists('rocket_clean_domain')) {
              rocket_clean_domain();
              $cleared_methods[] = 'WP Rocket Cache';
          }

          $cache_dir = WP_CONTENT_DIR . '/cache';
          if (is_dir($cache_dir)) {
              $this->delete_directory_contents($cache_dir);
              $cleared_methods[] = 'wp-content/cache directory files';
          }
          
          return [
              'success' => true, 
              'message' => 'Cache cleared successfully.',
              'clearedMethods' => $cleared_methods
          ];
      }

      private function delete_directory_contents(string $dir): void {
          $files = array_diff(scandir($dir), ['.', '..']);
          foreach ($files as $file) {
              $path = "$dir/$file";
              if (is_dir($path)) {
                  $this->delete_directory_contents($path);
                  @rmdir($path);
              } else {
                  @unlink($path);
              }
          }
      }
  }
  ```

- [ ] **Step 3: Implement optimize in class-db-manager.php**
  Modify [class-db-manager.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-db-manager.php) to optimize SQL tables.
  Replace the class:
  ```php
  class WPCC_Agent_DB_Manager {
      public function optimize(): array {
          global $wpdb;
          
          $tables = $wpdb->get_col("SHOW TABLES LIKE '{$wpdb->prefix}%'");
          $optimized = [];
          $errors = [];
          
          foreach ($tables as $table) {
              $result = $wpdb->query("OPTIMIZE TABLE `{$table}`");
              if ($result === false) {
                  $errors[] = "Failed to optimize table: {$table}";
              } else {
                  $optimized[] = $table;
              }
          }
          
          if (count($errors) > 0 && count($optimized) === 0) {
              return ['success' => false, 'error' => implode('; ', $errors)];
          }
          
          return [
              'success' => true, 
              'message' => 'Database optimization completed.',
              'optimizedTables' => $optimized,
              'errors' => $errors
          ];
      }
  }
  ```

- [ ] **Step 4: Implement file writing logic in class-file-editor.php**
  Modify [class-file-editor.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-file-editor.php) to read/write robots.txt, .htaccess, and php local configuration.
  Replace the class:
  ```php
  class WPCC_Agent_File_Editor {
      public function snapshot(): array {
          $robots_file = ABSPATH . 'robots.txt';
          $htaccess_file = ABSPATH . '.htaccess';
          
          $robots = file_exists($robots_file) ? file_get_contents($robots_file) : null;
          $htaccess = file_exists($htaccess_file) ? file_get_contents($htaccess_file) : null;
          
          return [
              'robots' => $robots,
              'htaccess' => $htaccess,
              'phpIni' => null
          ];
      }

      public function update_robots(string $content): array {
          $robots_file = ABSPATH . 'robots.txt';
          if ((file_exists($robots_file) && !is_writable($robots_file)) || (!file_exists($robots_file) && !is_writable(ABSPATH))) {
              return ['success' => false, 'error' => 'robots.txt is not writeable.'];
          }

          $result = file_put_contents($robots_file, $content);
          if ($result === false) {
              return ['success' => false, 'error' => 'Failed to write robots.txt content.'];
          }

          return ['success' => true, 'message' => 'robots.txt updated successfully.'];
      }

      public function update_htaccess(string $content): array {
          $htaccess_file = ABSPATH . '.htaccess';
          $backup_file = ABSPATH . '.htaccess.bak';

          if (file_exists($htaccess_file)) {
              if (!copy($htaccess_file, $backup_file)) {
                  return ['success' => false, 'error' => 'Failed to create backup copy of .htaccess.'];
              }
          }

          if ((file_exists($htaccess_file) && !is_writable($htaccess_file)) || (!file_exists($htaccess_file) && !is_writable(ABSPATH))) {
              return ['success' => false, 'error' => '.htaccess is not writeable.'];
          }

          $result = file_put_contents($htaccess_file, $content);
          if ($result === false) {
              if (file_exists($backup_file)) {
                  copy($backup_file, $htaccess_file);
              }
              return ['success' => false, 'error' => 'Failed to write .htaccess content.'];
          }

          return ['success' => true, 'message' => '.htaccess updated successfully. Backup saved.'];
      }

      public function update_php_config(array $settings): array {
          $user_ini_file = ABSPATH . '.user.ini';
          
          $existing = [];
          if (file_exists($user_ini_file)) {
              $ini_content = file_get_contents($user_ini_file);
              $lines = explode("\n", $ini_content);
              foreach ($lines as $line) {
                  $line = trim($line);
                  if (empty($line) || $line[0] === ';') continue;
                  $parts = explode('=', $line, 2);
                  if (count($parts) === 2) {
                      $existing[trim($parts[0])] = trim($parts[1]);
                  }
              }
          }

          foreach ($settings as $key => $value) {
              $existing[$key] = $value;
          }

          $content = "; WP Control Center Local PHP Configuration\n";
          foreach ($existing as $key => $value) {
              $content .= "{$key} = {$value}\n";
          }

          $result = file_put_contents($user_ini_file, $content);
          if ($result === false) {
              $applied = [];
              foreach ($settings as $key => $value) {
                  if (@ini_set($key, $value) !== false) {
                      $applied[] = $key;
                  }
              }
              return [
                  'success' => false, 
                  'error' => 'Failed to write .user.ini. Applied dynamically: ' . implode(', ', $applied)
              ];
          }

          return ['success' => true, 'message' => 'PHP local configuration (.user.ini) updated successfully.'];
      }
  }
  ```

- [ ] **Step 5: Add cases to class-api.php execute_action**
  Modify [class-api.php](file:///Users/djoker/Documents/ANTIGRAVITY/wordpress-agent/plugin/includes/class-api.php) to support dispatching these new actions.
  In `execute_action` switch (lines 70-100), add the following cases:
  ```php
              case 'install-plugin':
                  $res = (new WPCC_Agent_Plugin_Manager())->install_plugin($body['slug'] ?? '');
                  break;
              case 'clear-cache':
                  $res = (new WPCC_Agent_Cache_Manager())->clear();
                  break;
              case 'optimize-database':
                  $res = (new WPCC_Agent_DB_Manager())->optimize();
                  break;
              case 'update-robots-txt':
                  $res = (new WPCC_Agent_File_Editor())->update_robots($body['content'] ?? '');
                  break;
              case 'update-htaccess':
                  $res = (new WPCC_Agent_File_Editor())->update_htaccess($body['content'] ?? '');
                  break;
              case 'update-php-config':
                  $res = (new WPCC_Agent_File_Editor())->update_php_config($body['settings'] ?? []);
                  break;
  ```

- [ ] **Step 6: Commit Plugin changes**
  Run:
  ```bash
  git add wordpress-agent/plugin/includes/class-plugin-manager.php wordpress-agent/plugin/includes/class-cache-manager.php wordpress-agent/plugin/includes/class-db-manager.php wordpress-agent/plugin/includes/class-file-editor.php wordpress-agent/plugin/includes/class-api.php
  git commit -m "feat: implement real PHP handlers for advanced maintenance and files in agent plugin"
  ```

---

### Task 2: Backend API and Worker Integrations

**Files:**
- Modify: `apps/api/src/modules/sites/sites.service.ts`
- Modify: `apps/worker/src/index.ts`

**Interfaces:**
- Consumes: Maintenance requests via API.
- Produces: BullMQ Jobs for `INSTALL_PLUGIN`, `CLEAR_CACHE`, `OPTIMIZE_DATABASE`, `UPDATE_ROBOTS_TXT`, `UPDATE_HTACCESS`, `UPDATE_PHP_CONFIG`. Writes database snapshot records.

- [ ] **Step 1: Update createJob switch inside sites.service.ts**
  Modify [sites.service.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/api/src/modules/sites/sites.service.ts) to support the new job types in `createJob()` switch:
  Add the following cases:
  ```typescript
        case 'install-plugin':
          jobType = JobType.INSTALL_PLUGIN;
          targetType = JobTargetType.PLUGIN;
          targetSlug = body.slug || null;
          if (!targetSlug) {
            throw new BadRequestException('Plugin slug is required');
          }
          break;
        case 'clear-cache':
          jobType = JobType.CLEAR_CACHE;
          targetType = JobTargetType.CACHE;
          break;
        case 'optimize-database':
          jobType = JobType.OPTIMIZE_DATABASE;
          targetType = JobTargetType.DATABASE;
          break;
        case 'update-robots-txt':
          jobType = JobType.UPDATE_ROBOTS_TXT;
          targetType = JobTargetType.CONFIG;
          if (body.content === undefined) {
            throw new BadRequestException('Robots.txt content is required');
          }
          break;
        case 'update-htaccess':
          jobType = JobType.UPDATE_HTACCESS;
          targetType = JobTargetType.CONFIG;
          if (body.content === undefined) {
            throw new BadRequestException('.htaccess content is required');
          }
          break;
        case 'update-php-config':
          jobType = JobType.UPDATE_PHP_CONFIG;
          targetType = JobTargetType.CONFIG;
          if (!body.settings || typeof body.settings !== 'object') {
            throw new BadRequestException('PHP settings object is required');
          }
          break;
  ```

- [ ] **Step 2: Update Worker getActionSlug and result logging**
  Modify [index.ts](file:///Users/djoker/Documents/ANTIGRAVITY/apps/worker/src/index.ts) to map these new job types to agent REST slugs.
  In `getActionSlug()` switch (lines 35-48):
  ```typescript
      case 'INSTALL_PLUGIN': return 'install-plugin';
      case 'CLEAR_CACHE': return 'clear-cache';
      case 'OPTIMIZE_DATABASE': return 'optimize-database';
      case 'UPDATE_ROBOTS_TXT': return 'update-robots-txt';
      case 'UPDATE_HTACCESS': return 'update-htaccess';
      case 'UPDATE_PHP_CONFIG': return 'update-php-config';
  ```
  Also, inside the Worker's `process` loop (around lines 530+), if the action is file modification (`UPDATE_ROBOTS_TXT`, `UPDATE_HTACCESS`, `UPDATE_PHP_CONFIG`), we should record a `MaintenanceSnapshot` entry in the database.
  Add after `await prisma.auditLog.create({...})` success handling:
  ```typescript
        // If it's a configuration edit, write a snapshot
        if (['UPDATE_ROBOTS_TXT', 'UPDATE_HTACCESS', 'UPDATE_PHP_CONFIG'].includes(dbJob.jobType)) {
          let robotsTxtContent: string | null = null;
          let htaccessContent: string | null = null;
          let phpIniContent: string | null = null;

          if (dbJob.jobType === 'UPDATE_ROBOTS_TXT') {
            robotsTxtContent = bodyObj.content || '';
          } else if (dbJob.jobType === 'UPDATE_HTACCESS') {
            htaccessContent = bodyObj.content || '';
          } else if (dbJob.jobType === 'UPDATE_PHP_CONFIG') {
            phpIniContent = JSON.stringify(bodyObj.settings || {});
          }

          await prisma.maintenanceSnapshot.create({
            data: {
              siteId: site.id,
              robotsTxtContent,
              htaccessContent,
              phpIniContent,
              createdByUserId: dbJob.initiatedByUserId,
            },
          });
        }
  ```

- [ ] **Step 3: Commit Backend changes**
  Run:
  ```bash
  git add apps/api/src/modules/sites/sites.service.ts apps/worker/src/index.ts
  git commit -m "feat: add backend job queueing and snapshot logging for advanced maintenance actions"
  ```

---

### Task 3: Frontend Dashboard Integration for Tools & File Editing

**Files:**
- Modify: `apps/web/app/sites/[id]/page.tsx`

**Interfaces:**
- Consumes: `POST /api/sites/:id/actions/[action]`
- Produces: UI options inside a new "Maintenance" tab.

- [ ] **Step 1: Define new Tab Navigation for Maintenance**
  Modify [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx) to add the "Maintenance" tab button:
  ```typescript
            { id: "core", label: "Core Version" },
            { id: "uptime", label: `Uptime & Incidents (${incidentsList.filter(i => i.status === "OPEN").length})` },
            { id: "maintenance", label: "Maintenance & Tools" },
          ].map((tab) => (
  ```

- [ ] **Step 2: Add Maintenance state elements**
  Add React states inside `SiteDetailPage` Component to support form inputs:
  ```typescript
    const [robotsContent, setRobotsContent] = useState("");
    const [htaccessContent, setHtaccessContent] = useState("");
    const [phpMemoryLimit, setPhpMemoryLimit] = useState("256M");
    const [pluginSlugToInstall, setPluginSlugToInstall] = useState("");
    const [actionRunning, setActionRunning] = useState(false);
  ```

- [ ] **Step 3: Implement remote action triggers**
  Add a helper function inside the component to execute post actions:
  ```typescript
    const triggerMaintenanceAction = async (action: string, payload: Record<string, any> = {}) => {
      const token = localStorage.getItem("wpcc_token");
      if (!token) return;

      setActionRunning(true);
      setError("");
      try {
        const res = await fetch(`http://localhost:3003/api/sites/${id}/actions/${action}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.message || `Action ${action} failed`);
        }

        const data = await res.json();
        alert(`Maintenance Job Queued! Job ID: ${data.jobId}. Check Audit Log or reload shortly.`);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Action failed.";
        setError(errorMsg);
      } finally {
        setActionRunning(false);
      }
    };
  ```

- [ ] **Step 4: Render Maintenance tab panel**
  Add the markup for `activeTab === "maintenance"` at the end of tab content list in [page.tsx](file:///Users/djoker/Documents/ANTIGRAVITY/apps/web/app/sites/[id]/page.tsx):
  ```typescript
            {activeTab === "maintenance" && (
              <div className="space-y-8">
                {/* Core Utilities */}
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <h4 className="text-md font-bold text-white font-heading">Cache Clean</h4>
                    <p className="text-xs text-zinc-500">Flush WordPress object cache, transient data, and static files.</p>
                    <Button
                      onClick={() => triggerMaintenanceAction("clear-cache")}
                      disabled={actionRunning}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Flush Site Cache
                    </Button>
                  </div>

                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <h4 className="text-md font-bold text-white font-heading">Optimize Database</h4>
                    <p className="text-xs text-zinc-500">Run OPTIMIZE TABLE on all active WordPress tables.</p>
                    <Button
                      onClick={() => triggerMaintenanceAction("optimize-database")}
                      disabled={actionRunning}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      Run DB Optimization
                    </Button>
                  </div>
                </div>

                {/* Plugin Installer */}
                <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                  <h4 className="text-md font-bold text-white font-heading">Remote Plugin Installer</h4>
                  <p className="text-xs text-zinc-500">Download and install plugins directly from WordPress.org repository.</p>
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={pluginSlugToInstall}
                      onChange={(e) => setPluginSlugToInstall(e.target.value)}
                      placeholder="e.g. contact-form-7"
                      className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 p-2.5 text-sm text-white placeholder-zinc-600 outline-none"
                    />
                    <Button
                      onClick={() => {
                        triggerMaintenanceAction("install-plugin", { slug: pluginSlugToInstall });
                        setPluginSlugToInstall("");
                      }}
                      disabled={actionRunning || !pluginSlugToInstall}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Install Plugin
                    </Button>
                  </div>
                </div>

                {/* Configurations Editor */}
                <div className="space-y-6">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">File Editors</h4>
                  
                  {/* Robots.txt */}
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <h5 className="font-semibold text-white">robots.txt</h5>
                    <textarea
                      value={robotsContent}
                      onChange={(e) => setRobotsContent(e.target.value)}
                      placeholder="User-agent: *&#10;Disallow: /wp-admin/"
                      rows={4}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-white font-mono outline-none"
                    />
                    <Button
                      onClick={() => triggerMaintenanceAction("update-robots-txt", { content: robotsContent })}
                      disabled={actionRunning}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Save robots.txt
                    </Button>
                  </div>

                  {/* .htaccess */}
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <h5 className="font-semibold text-white">.htaccess</h5>
                    <p className="text-xs text-zinc-500">Saves a backup copy as .htaccess.bak automatically before saving.</p>
                    <textarea
                      value={htaccessContent}
                      onChange={(e) => setHtaccessContent(e.target.value)}
                      placeholder="# Begin WordPress"
                      rows={6}
                      className="w-full rounded-lg border border-zinc-800 bg-zinc-900 p-3 text-sm text-white font-mono outline-none"
                    />
                    <Button
                      onClick={() => triggerMaintenanceAction("update-htaccess", { content: htaccessContent })}
                      disabled={actionRunning}
                      className="bg-violet-600 hover:bg-violet-500 text-white"
                    >
                      Save .htaccess
                    </Button>
                  </div>

                  {/* PHP config */}
                  <div className="rounded-lg border border-zinc-900 bg-zinc-950 p-6 space-y-4">
                    <h5 className="font-semibold text-white">PHP local config (.user.ini)</h5>
                    <div className="flex gap-4 items-center">
                      <span className="text-xs text-zinc-400">Memory Limit</span>
                      <select
                        value={phpMemoryLimit}
                        onChange={(e) => setPhpMemoryLimit(e.target.value)}
                        className="rounded-lg border border-zinc-800 bg-zinc-900 p-2 text-sm text-white outline-none"
                      >
                        <option value="128M">128M</option>
                        <option value="256M">256M</option>
                        <option value="512M">512M</option>
                      </select>
                      <Button
                        onClick={() => triggerMaintenanceAction("update-php-config", { settings: { memory_limit: phpMemoryLimit } })}
                        disabled={actionRunning}
                        className="bg-violet-600 hover:bg-violet-500 text-white"
                      >
                        Apply Config
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
  ```

- [ ] **Step 5: Commit Frontend changes**
  Run:
  ```bash
  git add "apps/web/app/sites/[id]/page.tsx"
  git commit -m "feat: build Maintenance tab inside site detail dashboard, integrating cache flush, DB optimization, and file editing"
  ```

---

## Verification Plan

### Automated Tests
- Run `npm run lint -w apps/web` to confirm no ESLint errors exist.
- Run `npm run build:all` to ensure TypeScript compilation passes.

### Manual Verification
1. **Cache Clean & DB Optimize**:
   - Navigate to the Maintenance tab on a connected site.
   - Click "Flush Site Cache" and "Run DB Optimization".
   - Verify that jobs are created successfully. Check logs in Worker console.
2. **File Editing**:
   - Write content in robots.txt and save. Confirm file is written correctly in local filesystem under WordPress mock directory.
   - Edit .htaccess and save. Verify that a `.htaccess.bak` backup is created in the same directory.
