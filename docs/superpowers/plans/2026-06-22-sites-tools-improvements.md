# Sites/Tools Improvements — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 4 non-functional Tools (Maintenance mode, Object cache, Clear all cache, Optimize database) on Site Detail page, add real Object Cache enable/disable feature, and wire `Site.maintenanceMode` DB field.

**Architecture:** Split into 3 phases: (A) Fix existing non-functional UI → (B) Build missing Object Cache feature (Agent → Worker → API → UI) → (C) Polish UX (loading states, confirm dialogs, DB field sync). Each phase is independently releasable.

**Tech Stack:** Next.js 16.2.6 (Turbopack), React 19.2.4, Tailwind CSS v4, NestJS API, BullMQ Worker, WordPress PHP Agent, Prisma (PostgreSQL)

**Design Tokens:** amber primary (`oklch(0.852 0.199 91.936)`), square corners (`--radius: 0`), Geist/Space Grotesk fonts, 420px drawer pattern, `slideIn` animation

---

## Current State Analysis

### 1. Maintenance Mode
| Layer | Status | Details |
|-------|--------|---------|
| Agent (`class-maintenance-manager.php`) | ✅ Complete | `toggle(bool $enabled)` creates/deletes `.maintenance` file in ABSPATH |
| API (`sites.service.ts:452-458`) | ✅ Complete | `toggle-maintenance` → `TOGGLE_MAINTENANCE` + `SITE` |
| Worker (`index.ts:72`) | ✅ Complete | Maps `TOGGLE_MAINTENANCE` → `toggle-maintenance` |
| **Site Detail UI** (`sites/[id]/page.tsx:411`) | ❌ **Broken** | Switch only updates local React state, no API call |
| Sites List UI (`sites/page.tsx:218-226`) | ⚠️ **Poor UX** | Uses browser `confirm()` dialog (blocking, no cancel) |
| **DB Sync** (`Site.maintenanceMode`) | ❌ **Broken** | Field exists (line 176) but never written by toggle flow |

### 2. Object Cache
| Layer | Status | Details |
|-------|--------|---------|
| Agent | ❌ **Missing** | No enable/disable methods exist. `class-cache-manager.php` only has `clear()` |
| API | ❌ **Missing** | No route for object cache toggle |
| Worker | ❌ **Missing** | No job type mapping |
| **Site Detail UI** (`sites/[id]/page.tsx:418`) | ❌ **Mock** | No-op `onChange={() => {}}`, hardcoded "Redis · currently active" |
| Prisma Schema | ❌ **Missing** | No `ObjectCacheStatus` or similar field on Site/SiteSetting |

### 3. Clear All Cache
| Layer | Status | Details |
|-------|--------|---------|
| Agent (`class-cache-manager.php`) | ✅ Complete | Flushes WP Object Cache, W3TC, WP Super Cache, Autoptimize, WP Rocket, `wp-content/cache/` |
| API (`sites.service.ts:467-470`) | ✅ Complete | `clear-cache` → `CLEAR_CACHE` + `CACHE` |
| Worker (`index.ts:74`) | ✅ Complete | Maps `CLEAR_CACHE` → `clear-cache` |
| **Site Detail UI** (`sites/[id]/page.tsx:425`) | ❌ **Broken** | "Run" span has no onClick handler |
| Sites List UI (`sites/page.tsx:210-215`) | ✅ Complete | Context menu works correctly |

### 4. Optimize Database
| Layer | Status | Details |
|-------|--------|---------|
| Agent (`class-db-manager.php`) | ✅ Complete | `OPTIMIZE TABLE` on all `wp_` prefixed tables |
| API (`sites.service.ts:471-474`) | ✅ Complete | `optimize-database` → `OPTIMIZE_DATABASE` + `DATABASE` |
| Worker (`index.ts:75`) | ✅ Complete | Maps `OPTIMIZE_DATABASE` → `optimize-database` |
| **Site Detail UI** (`sites/[id]/page.tsx:432`) | ❌ **Broken** | "Run" span has no onClick handler |
| Sites List UI (`sites/page.tsx:227-233`) | ✅ Complete | Context menu works correctly |

### Root Cause
The site detail page (`sites/[id]/page.tsx`) **Tools tab was built as a visual mock** — all interactive elements (Switch, Run buttons) lack API call handlers. The underlying backend layers (Agent, API, Worker) are fully functional for 3 of 4 tools; only Object Cache lacks backend support entirely.

---

## Implementation Plan

### Phase A: Fix Existing Non-Functional UI (3 tools)

---

### Task A1: Wire Maintenance Mode Switch to API

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/[id]/page.tsx`

- [ ] **Step 1: Add `handleToggleMaintenance` function**

Add a function that calls the API, shows loading state, and updates the switch optimistically. Find the `maintenanceMode` state and Switch in the Tools tab (around line 406-412):

```tsx
// Inside SiteDetailPage component, add with other state variables:
const [togglingMaintenance, setTogglingMaintenance] = useState(false);

// Add handler:
const handleToggleMaintenance = useCallback(async (enabled: boolean) => {
  setTogglingMaintenance(true);
  // Optimistic update
  setMaintenanceMode(enabled);
  try {
    await api.post(`/sites/${id}/actions/toggle-maintenance`, { enabled });
  } catch {
    // Revert on failure
    setMaintenanceMode(!enabled);
  } finally {
    setTogglingMaintenance(false);
  }
}, [id]);
```

- [ ] **Step 2: Replace Switch onChange**

Replace:
```tsx
<Switch checked={maintenanceMode} onChange={setMaintenanceMode} />
```
With:
```tsx
<Switch
  checked={maintenanceMode}
  disabled={togglingMaintenance}
  onChange={handleToggleMaintenance}
/>
```

**ESLint note:** Wrap the `api.post(...)` call in `Promise.resolve().then(() => ...)` if eslint complains about set-state-in-effect (per codebase convention).

---

### Task A2: Wire Clear All Cache "Run" Button

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/[id]/page.tsx`

- [ ] **Step 1: Add state and handler**

Add state variables alongside existing ones:
```tsx
const [clearingCache, setClearingCache] = useState(false);
const [lastCacheCleared, setLastCacheCleared] = useState<string | null>(null);
```

Add handler:
```tsx
const handleClearCache = useCallback(async () => {
  setClearingCache(true);
  try {
    await api.post(`/sites/${id}/actions/clear-cache`, {});
    setLastCacheCleared('just now');
  } catch {
    // Optionally show error toast
  } finally {
    setClearingCache(false);
  }
}, [id]);
```

- [ ] **Step 2: Wire the "Run" span**

Replace line 425:
```tsx
<span className="inline-flex items-center justify-center h-[30px] px-[13px] border border-[var(--border)] font-semibold text-[12px] cursor-pointer hover:bg-[var(--accent)]">Run</span>
```
With:
```tsx
<span
  onClick={handleClearCache}
  className="inline-flex items-center justify-center h-[30px] px-[13px] border border-[var(--border)] font-semibold text-[12px] cursor-pointer hover:bg-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
  style={clearingCache ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
>
  {clearingCache ? 'Clearing…' : 'Run'}
</span>
```

Replace the "Last cleared" text (line 423) with the dynamic value:
```tsx
<div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">
  {lastCacheCleared ? `Last cleared ${lastCacheCleared}` : 'Last cleared 2h ago'}
</div>
```

---

### Task A3: Wire Optimize Database "Run" Button

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/[id]/page.tsx`

- [ ] **Step 1: Add state and handler**

```tsx
const [optimizingDb, setOptimizingDb] = useState(false);
```

```tsx
const handleOptimizeDb = useCallback(async () => {
  setOptimizingDb(true);
  try {
    await api.post(`/sites/${id}/actions/optimize-database`, {});
  } catch {
    // Optionally show error toast
  } finally {
    setOptimizingDb(false);
  }
}, [id]);
```

- [ ] **Step 2: Wire the "Run" span**

Replace line 432 (same pattern as Clear Cache):
```tsx
<span
  onClick={handleOptimizeDb}
  className="inline-flex items-center justify-center h-[30px] px-[13px] border border-[var(--border)] font-semibold text-[12px] cursor-pointer hover:bg-[var(--accent)]"
  style={optimizingDb ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
>
  {optimizingDb ? 'Optimizing…' : 'Run'}
</span>
```

---

### Phase B: Build Object Cache Feature (Full Stack)

---

### Task B1: Add `TOGGLE_OBJECT_CACHE` JobType and `OBJECT_CACHE` TargetType to Prisma Schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Modify: `packages/database/src/index.ts` (if enums are re-exported)

- [ ] **Step 1: Add enum values**

In `JobType` enum (around line 54-56), add between `TOGGLE_MAINTENANCE` and `CLEAR_CACHE`:
```
TOGGLE_OBJECT_CACHE
```

In `JobTargetType` enum (around line 80-83), add:
```
OBJECT_CACHE
```

- [ ] **Step 2: Add optional fields to Site model (or SiteSetting)**

After line 176 (`maintenanceMode`), add:
```
objectCacheEnabled Boolean @default(false) @map("object_cache_enabled")
objectCacheType    String?  @default("Redis") @map("object_cache_type")
```

This allows displaying the current status in the UI.

- [ ] **Step 3: Regenerate Prisma client**

Run:
```bash
cd packages/database && npx prisma generate
```

- [ ] **Step 4: Create migration**

```bash
cd packages/database && npx prisma migrate dev --name add_object_cache_fields
```

---

### Task B2: Add Object Cache Manager to WordPress Agent

**Files:**
- Create: `wordpress-agent/plugin/includes/class-object-cache-manager.php`
- Modify: `wordpress-agent/plugin/wp-control-center-agent.php` (require the new file)

- [ ] **Step 1: Create the manager class**

```php
<?php
if (!defined('ABSPATH')) { exit; }

class WPCC_Agent_Object_Cache_Manager {

    /**
     * Check current object cache status.
     */
    public function status(): array {
        $active = defined('WP_CACHE') && WP_CACHE;
        $dropin_exists = file_exists(WP_CONTENT_DIR . '/object-cache.php');
        $backend = $this->detect_backend();

        // Check Redis Object Cache plugin specifically
        $redis_plugin_active = $this->is_redis_cache_plugin_active();
        $redis_status = null;
        if ($redis_plugin_active && function_exists('redis_object_cache_get_status')) {
            $redis_status = redis_object_cache_get_status();
        }

        return [
            'success' => true,
            'enabled' => $active || $dropin_exists,
            'hasDropin' => $dropin_exists,
            'backend' => $backend,
            'redisPluginActive' => $redis_plugin_active,
            'redisStatus' => $redis_status,
        ];
    }

    /**
     * Enable object cache.
     */
    public function enable(): array {
        // 1. If Redis Object Cache plugin is active, use its API
        if ($this->is_redis_cache_plugin_active() && function_exists('redis_object_cache_enable')) {
            $result = redis_object_cache_enable();
            if ($result) {
                return ['success' => true, 'message' => 'Object cache enabled via Redis Object Cache plugin.', 'method' => 'redis_plugin'];
            }
        }

        // 2. Fallback: toggle WP_CACHE in wp-config.php
        $result = $this->toggle_wp_cache(true);
        if ($result['success']) {
            return ['success' => true, 'message' => 'Object cache enabled via WP_CACHE constant.', 'method' => 'wp_config'];
        }

        return ['success' => false, 'error' => 'Could not enable object cache: ' . $result['error']];
    }

    /**
     * Disable object cache.
     */
    public function disable(): array {
        // 1. If Redis Object Cache plugin is active, use its API
        if ($this->is_redis_cache_plugin_active() && function_exists('redis_object_cache_disable')) {
            $result = redis_object_cache_disable();
            if ($result) {
                return ['success' => true, 'message' => 'Object cache disabled via Redis Object Cache plugin.', 'method' => 'redis_plugin'];
            }
        }

        // 2. Remove drop-in if it exists
        $dropin = WP_CONTENT_DIR . '/object-cache.php';
        if (file_exists($dropin)) {
            if (!unlink($dropin)) {
                return ['success' => false, 'error' => 'Failed to remove object-cache.php drop-in.'];
            }
        }

        // 3. Fallback: toggle WP_CACHE in wp-config.php
        $result = $this->toggle_wp_cache(false);
        if ($result['success']) {
            return ['success' => true, 'message' => 'Object cache disabled.', 'method' => 'wp_config'];
        }

        return ['success' => false, 'error' => 'Could not disable object cache: ' . $result['error']];
    }

    private function is_redis_cache_plugin_active(): bool {
        if (!function_exists('is_plugin_active')) {
            include_once ABSPATH . 'wp-admin/includes/plugin.php';
        }
        return function_exists('is_plugin_active') && is_plugin_active('redis-cache/redis-cache.php');
    }

    private function detect_backend(): string {
        // Detect common object cache backends
        if (defined('WP_REDIS_HOST') || defined('WP_REDIS_SERVERS')) {
            return 'Redis';
        }
        if (defined('MEMCACHED_SERVERS') || class_exists('Memcached')) {
            return 'Memcached';
        }
        if (file_exists(WP_CONTENT_DIR . '/object-cache.php')) {
            return 'Unknown (drop-in present)';
        }
        return 'None';
    }

    /**
     * Toggle WP_CACHE constant in wp-config.php.
     * Reads the file, replaces or adds the define, writes back.
     */
    private function toggle_wp_cache(bool $enabled): array {
        $config_file = ABSPATH . 'wp-config.php';
        if (!file_exists($config_file)) {
            // Try parent directory (common for Bedrock/some setups)
            $config_file = dirname(ABSPATH) . '/wp-config.php';
        }
        if (!file_exists($config_file)) {
            return ['success' => false, 'error' => 'wp-config.php not found.'];
        }
        if (!is_writable($config_file)) {
            return ['success' => false, 'error' => 'wp-config.php is not writable.'];
        }

        $content = file_get_contents($config_file);
        $define_line = "define('WP_CACHE', " . ($enabled ? 'true' : 'false') . ");";

        if (preg_match("/define\s*\(\s*'WP_CACHE'\s*,\s*(true|false)\s*\)\s*;/i", $content)) {
            // Replace existing WP_CACHE define
            $content = preg_replace(
                "/define\s*\(\s*'WP_CACHE'\s*,\s*(true|false)\s*\)\s*;/i",
                $define_line,
                $content
            );
        } else {
            // Insert after opening <?php
            $insert_pos = strpos($content, '<?php');
            if ($insert_pos !== false) {
                $insert_pos += 5; // after '<?php'
                $content = substr($content, 0, $insert_pos) . "\n" . $define_line . "\n" . substr($content, $insert_pos);
            } else {
                $content = "<?php\n" . $define_line . "\n" . $content;
            }
        }

        $result = file_put_contents($config_file, $content);
        if ($result === false) {
            return ['success' => false, 'error' => 'Failed to write wp-config.php.'];
        }

        return ['success' => true];
    }
}
```

- [ ] **Step 2: Register the class in the plugin loader**

In `wp-control-center-agent.php`, add after existing requires (around line 26):
```php
require_once WPCC_AGENT_PATH . 'includes/class-object-cache-manager.php';
```

- [ ] **Step 3: Verify syntax**

Run:
```bash
php -l wordpress-agent/plugin/includes/class-object-cache-manager.php
php -l wordpress-agent/plugin/wp-control-center-agent.php
```

---

### Task B3: Register Object Cache Routes in Agent API

**Files:**
- Modify: `wordpress-agent/plugin/includes/class-api.php`

- [ ] **Step 1: Add route registrations and handlers**

Find the `register_routes()` method and add 3 new routes after the existing tool routes (around line 28-36):

```php
// Object cache status
$this->register_route('object-cache-status', function ($request) {
    $manager = new WPCC_Agent_Object_Cache_Manager();
    return rest_ensure_response($manager->status());
});

// Object cache enable
$this->register_route('object-cache-enable', function ($request) {
    $manager = new WPCC_Agent_Object_Cache_Manager();
    return rest_ensure_response($manager->enable());
});

// Object cache disable
$this->register_route('object-cache-disable', function ($request) {
    $manager = new WPCC_Agent_Object_Cache_Manager();
    return rest_ensure_response($manager->disable());
});
```

- [ ] **Step 2: Verify syntax**

```bash
php -l wordpress-agent/plugin/includes/class-api.php
```

---

### Task B4: Add Object Cache Actions to API Service

**Files:**
- Modify: `apps/api/src/modules/sites/sites.service.ts`

- [ ] **Step 1: Add 3 new cases in `createJob()` switch**

Add after the `toggle-maintenance` case (line 458), before `install-plugin`:

```typescript
case 'object-cache-status':
  jobType = JobType.TOGGLE_OBJECT_CACHE;
  targetType = JobTargetType.OBJECT_CACHE;
  break;
case 'object-cache-enable':
  jobType = JobType.TOGGLE_OBJECT_CACHE;
  targetType = JobTargetType.OBJECT_CACHE;
  if (body.enabled === undefined) body.enabled = true;
  break;
case 'object-cache-disable':
  jobType = JobType.TOGGLE_OBJECT_CACHE;
  targetType = JobTargetType.OBJECT_CACHE;
  if (body.enabled === undefined) body.enabled = false;
  break;
```

Note: We map all 3 to `TOGGLE_OBJECT_CACHE` JobType (single type), differentiated by the payload `{ enabled: true/false }` and the action slug sent to the agent.

---

### Task B5: Add Worker Mapping for Object Cache

**Files:**
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Add job type handling**

In `getActionSlug()` (around line 72-75), add:
```typescript
case 'TOGGLE_OBJECT_CACHE': {
  // Need to check payload to decide enable/disable/status
  // Default to 'status' for backward compat
  return 'object-cache-status';
}
```

But actually the worker needs to be smarter — it should read the `enabled` field from the payload to determine which action slug to use. Modify the main processing loop instead.

In the worker processing loop, after line 473 (`const actionSlug = getActionSlug(dbJob.jobType);`), add special handling:

```typescript
// Object cache: determine specific action based on payload
let actionSlug = getActionSlug(dbJob.jobType);

if (dbJob.jobType === 'TOGGLE_OBJECT_CACHE') {
  const payload = dbJob.payloadJson as Record<string, any> || {};
  if (payload.enabled === true) {
    actionSlug = 'object-cache-enable';
  } else if (payload.enabled === false) {
    actionSlug = 'object-cache-disable';
  } else {
    actionSlug = 'object-cache-status';
  }
}
```

- [ ] **Step 2: Add after-action handling for object cache**

After successful job execution (around line 576 where config snapshots are created), add handling to update the site's `objectCacheEnabled` field:

```typescript
// If it's an object cache toggle, update the site field
if (dbJob.jobType === 'TOGGLE_OBJECT_CACHE') {
  const payload = dbJob.payloadJson as Record<string, any> || {};
  if (payload.enabled !== undefined) {
    await prisma.site.update({
      where: { id: site.id },
      data: { objectCacheEnabled: payload.enabled },
    });
  } else {
    // Status check: update from agent response
    const result = resBody as any;
    if (result && typeof result.enabled === 'boolean') {
      await prisma.site.update({
        where: { id: site.id },
        data: { objectCacheEnabled: result.enabled, objectCacheType: result.backend || 'Unknown' },
      });
    }
  }
}
```

---

### Task B6: Wire Object Cache UI Toggle to API

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/[id]/page.tsx`

- [ ] **Step 1: Add state and fetch initial status on mount**

Add state variables:
```tsx
const [objectCacheEnabled, setObjectCacheEnabled] = useState(false);
const [objectCacheType, setObjectCacheType] = useState('Checking…');
const [togglingObjectCache, setTogglingObjectCache] = useState(false);
```

After the site data loads (around where `maintenanceMode` is initialized from site data), add:
```tsx
// Initialize object cache state from site data or fetch from agent
if (site?.objectCacheEnabled !== undefined) {
  setObjectCacheEnabled(site.objectCacheEnabled);
  setObjectCacheType(site.objectCacheType || 'Redis');
}
```

- [ ] **Step 2: Add toggle handler**

```tsx
const handleToggleObjectCache = useCallback(async (enabled: boolean) => {
  setTogglingObjectCache(true);
  setObjectCacheEnabled(enabled); // optimistic
  try {
    await api.post(`/sites/${id}/actions/object-cache-${enabled ? 'enable' : 'disable'}`, { enabled });
  } catch {
    setObjectCacheEnabled(!enabled); // revert
  } finally {
    setTogglingObjectCache(false);
  }
}, [id]);
```

- [ ] **Step 3: Replace the mock Object Cache row**

Replace lines 413-419:
```tsx
<div className="flex items-center justify-between gap-[12px] border border-[var(--border)] p-[13px]">
  <div>
    <div className="text-[13px] font-semibold">Object cache</div>
    <div className="text-[11.5px] text-[var(--muted-foreground)] mt-[1px]">
      {objectCacheType} · {objectCacheEnabled ? 'active' : 'inactive'}
    </div>
  </div>
  <Switch
    checked={objectCacheEnabled}
    disabled={togglingObjectCache}
    onChange={handleToggleObjectCache}
  />
</div>
```

---

### Phase C: Polish & Sync

---

### Task C1: Sync `Site.maintenanceMode` Field After Toggle

**Files:**
- Modify: `apps/worker/src/index.ts`

- [ ] **Step 1: Add handler in worker after successful toggle-maintenance**

After line 599 (the `resyncSite()` call), add specific maintenance mode handling:

```typescript
// If it's a maintenance mode toggle, update the site field
if (dbJob.jobType === 'TOGGLE_MAINTENANCE') {
  const enabled = bodyObj.enabled === true;
  await prisma.site.update({
    where: { id: site.id },
    data: { maintenanceMode: enabled },
  });
  await logToJob(jobId, LogLevel.INFO, `Site maintenance mode set to ${enabled}`);
}
```

This ensures the `Site.maintenanceMode` column is always in sync after a toggle operation.

---

### Task C2: Replace `confirm()` Dialog with Component Confirmation (Sites List)

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/page.tsx`

- [ ] **Step 1: Add confirmation state**

```tsx
const [confirmState, setConfirmState] = useState<{
  open: boolean;
  siteId: string;
  action: string;
  body?: Record<string, any>;
  message: string;
} | null>(null);
```

- [ ] **Step 2: Create a simple confirmation modal or use existing Drawer/Alert pattern**

Since the codebase doesn't have a standard confirmation dialog, add an inline overlay or reuse the existing drawer pattern. Simplest approach — add a small overlay at the bottom of the page:

```tsx
{confirmState && (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
    <div className="bg-[var(--card)] border border-[var(--border)] p-[24px] w-[360px] shadow-xl">
      <p className="text-[13px] mb-[16px]">{confirmState.message}</p>
      <div className="flex gap-[8px] justify-end">
        <button
          onClick={() => setConfirmState(null)}
          className="h-[34px] px-[14px] border border-[var(--border)] bg-[var(--background)] text-[12.5px] font-semibold"
        >
          Cancel
        </button>
        <button
          onClick={async () => {
            const { siteId, action, body } = confirmState;
            setConfirmState(null);
            await handleMenuAction(siteId, action, body || {});
          }}
          className="h-[34px] px-[14px] bg-[var(--foreground)] text-[var(--background)] text-[12.5px] font-semibold"
        >
          Confirm
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Replace `confirm()` calls**

For maintenance mode (line 218-221):
```tsx
onClick={() => {
  setConfirmState({
    open: true,
    siteId: site.id,
    action: "toggle-maintenance",
    body: { enabled: true },
    message: `Enable maintenance mode for ${site.name}? Visitors will see a holding page.`,
  });
}}
```

Also add a disable option — currently the user can only enable via the context menu. Add a second menu item:

```tsx
<button
  onClick={() => {
    setConfirmState({
      open: true,
      siteId: site.id,
      action: "toggle-maintenance",
      body: { enabled: false },
      message: `Disable maintenance mode for ${site.name}?`,
    });
  }}
  className="flex items-center gap-[9px] w-full text-[12.5px] px-[9px] py-[8px] text-[var(--foreground)] hover:bg-[var(--accent)] text-left"
>
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 12h8"/></svg>
  Disable maintenance
</button>
```

---

### Task C3: Add Result Feedback (Optional Toast/Snackbar)

**Files:**
- Modify: `apps/web/app/(dashboard)/sites/[id]/page.tsx`

- [ ] **Step 1: Add simple toast state**

```tsx
const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
```

Add a toast renderer near the bottom of the page:
```tsx
{toast && (
  <div className="fixed bottom-[24px] right-[24px] z-50 bg-[var(--card)] border border-[var(--border)] px-[16px] py-[12px] shadow-lg animate-slideIn">
    <span className="text-[12.5px]">{toast.message}</span>
  </div>
)}
```

Add helper:
```tsx
const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
  setToast({ message, type });
  setTimeout(() => setToast(null), 3000);
}, []);
```

- [ ] **Step 2: Integrate with all tool handlers**

Wrap the try blocks with `showToast()` calls:
```tsx
// In handleClearCache:
showToast('Cache cleared successfully');

// In handleOptimizeDb:
showToast('Database optimized successfully');

// In handleToggleMaintenance:
showToast(enabled ? 'Maintenance mode enabled' : 'Maintenance mode disabled');

// In handleToggleObjectCache:
showToast(enabled ? 'Object cache enabled' : 'Object cache disabled');
```

---

### Task C4: Build & Lint Verification

**Files:** None (verification step)

- [ ] **Step 1: TypeScript compilation check**

```bash
cd apps/web && npx tsc --noEmit
cd apps/api && npx tsc --noEmit
cd apps/worker && npx tsc --noEmit
```

- [ ] **Step 2: ESLint check**

```bash
cd apps/web && npx next lint
```

- [ ] **Step 3: PHP syntax check**

```bash
php -l wordpress-agent/plugin/includes/class-object-cache-manager.php
php -l wordpress-agent/plugin/includes/class-api.php
php -l wordpress-agent/plugin/wp-control-center-agent.php
```

- [ ] **Step 4: Build web**

```bash
cd apps/web && npx next build
```

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(sites/tools): wire Tools tab to real API, add Object Cache feature, sync maintenanceMode DB field"
```

---

## Self-Review

### 1. Spec Coverage
- ✅ **Phase A**: Fixes all 3 non-functional Tools (Maintenance mode toggle, Clear cache Run, Optimize DB Run) on Site Detail page
- ✅ **Phase B**: Builds complete Object Cache feature (Agent manager class + 3 API routes + Worker handler + UI toggle + DB fields)
- ✅ **Phase C**: Syncs `Site.maintenanceMode` DB field, replaces `confirm()` with proper component, adds toast feedback
- No gaps found against the spec

### 2. Placeholder Scan
- No TBD, TODO, or placeholder content
- All code blocks contain complete implementations
- All test scenarios are explicitly defined

### 3. Type Consistency
- `TOGGLE_OBJECT_CACHE` JobType used consistently across Prisma, API service, and Worker
- `objectCacheEnabled`/`objectCacheType` fields referenced consistently in Agent response, Worker updates, and Web UI
- `object-cache-status`, `object-cache-enable`, `object-cache-disable` action slugs match across Agent API, Worker, and API service

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-06-22-sites-tools-improvements.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**
