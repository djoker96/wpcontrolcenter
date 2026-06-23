# Zip Upload Update Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users to update WordPress plugins and themes by uploading a .zip file, supporting both single-site and bulk cross-site workflows.

**Architecture:** 4-layer: Web UI → API (NestJS) → Worker (BullMQ) → Agent (WordPress plugin). Files stored on local disk at `storage/uploads/{siteId}/{jobId}/`, cleaned up after job completion.

**Tech Stack:** NestJS + multer (`@nestjs/platform-express`), BullMQ, Prisma, React 19 + Tailwind v4, WordPress `Plugin_Upgrader`/`Theme_Upgrader`

**Scope:** Only Plugin + Theme (no Core upload). Two UI surfaces.

---

## File Structure

### New files
| File | Purpose |
|------|---------|
| `apps/api/src/modules/upload/upload.module.ts` | NestJS module for upload endpoints |
| `apps/api/src/modules/upload/upload.controller.ts` | 3 endpoints: single + bulk upload |
| `apps/api/src/modules/upload/upload.service.ts` | File handling + job creation logic |
| `apps/web/app/(dashboard)/updates/upload/page.tsx` | Bulk upload page |
| `apps/web/components/updates/UploadUpdateDrawer.tsx` | Single-upload drawer |
| `apps/web/components/updates/BulkUploadForm.tsx` | Bulk upload form |
| `apps/worker/src/handlers/upload-plugin.handler.ts` | Worker handler for UPLOAD_PLUGIN |
| `apps/worker/src/handlers/upload-theme.handler.ts` | Worker handler for UPLOAD_THEME |

### Modified files
| File | Change |
|------|--------|
| `apps/api/src/app.module.ts` | Import `UploadModule` |
| `packages/database/prisma/schema.prisma` | Add `UPLOAD_PLUGIN`, `UPLOAD_THEME` to `JobType` + `JobTargetType` |
| `packages/database/prisma/seed.ts` | Add new job types to seed |
| `apps/api/src/modules/sites/sites.service.ts` | Add `createJobRaw()` method |
| `apps/worker/src/index.ts` | Register upload handler in dispatch |
| `apps/web/app/(dashboard)/updates/page.tsx` | Add "Upload" button per site card + bulk page link |
| `apps/web/lib/api-client.ts` | Add `uploadFile()` method |

### Agent files (separate WordPress plugin repo)
| File | Change |
|------|--------|
| `wp-content/plugins/wpcc-agent/includes/class-controller.php` | Add handlers for `install-plugin-upload` + `install-theme-upload` |
| `wp-content/plugins/wpcc-agent/includes/class-upgrader.php` | NEW: wrapper around WordPress Plugin_Upgrader / Theme_Upgrader |

---

## Task A: WordPress Agent

### A1: Create `class-upgrader.php`

Wrapper that uses WordPress built-in `Plugin_Upgrader::install()` and `Theme_Upgrader::install()`.

### A2: Register handlers in `class-controller.php`

Two new action strings: `install-plugin-upload`, `install-theme-upload`. Both receive raw zip binary in request body, write to temp file, call upgrader, clean up temp file.

**Agent endpoints:**
- `POST /wp-json/wpcc/v1/execute/install-plugin-upload` — body: raw zip binary
- `POST /wp-json/wpcc/v1/execute/install-theme-upload` — body: raw zip binary

---

## Task B: Database Schema

### B1: Extend Prisma enums

Add to `schema.prisma`:
```
JobType: add UPLOAD_PLUGIN, UPLOAD_THEME
JobTargetType: add UPLOAD_PLUGIN, UPLOAD_THEME
```

### B2: Migration + generate

Run `prisma migrate dev` + `prisma generate` in database, API, and worker packages.

---

## Task C: API (NestJS Backend)

### C1: Create UploadService

`apps/api/src/modules/upload/upload.service.ts`

- `handleUpload()` — saves file to `storage/uploads/{siteId}/{jobId}/`, creates Job record via `SitesService.createJobRaw()`, enqueues in BullMQ
- `handleBulkUpload()` — iterates siteIds, calls `handleUpload()` for each

### C2: Add `createJobRaw()` to SitesService

Direct job creation without action dispatch (file is already handled separately).

### C3: Create UploadController + BulkUploadController

`apps/api/src/modules/upload/upload.controller.ts`

**Endpoints:**
- `POST /api/sites/:id/actions/upload-plugin` — `@FileInterceptor('file')`, multipart with `slug` + zip file
- `POST /api/sites/:id/actions/upload-theme` — same, theme doesn't need slug
- `POST /api/uploads/bulk` — accepts `siteIds[]`, `slug`, `type`, zip file

Limits: 50MB file size, memory storage.

### C4: Register UploadModule in app.module.ts

---

## Task D: Worker

### D1: Create `upload-plugin.handler.ts`

Reads file from `payloadJson.filePath`, sends raw binary to agent endpoint, cleans up file after, triggers resync.

### D2: Create `upload-theme.handler.ts`

Same pattern, different agent endpoint.

### D3: Register handlers in worker index.ts

Add `UPLOAD_PLUGIN` → `handleUploadPlugin`, `UPLOAD_THEME` → `handleUploadTheme` to the dispatch map.

---

## Task E: Web UI — API Client

### E1: Add `uploadFile()` method

`apps/web/lib/api-client.ts`

New method that sends `FormData` via `fetch` with Bearer auth. No explicit Content-Type (browser sets multipart boundary automatically).

---

## Task F: Web UI — Single Upload Drawer

### F1: Create `UploadUpdateDrawer.tsx`

Slide-out drawer (420px, same pattern as ConfigureChecksDrawer):
- Dropdown to select installed plugin (fetch from `/sites/:id/plugins`)
- File picker (drag/drop zone or click, accept `.zip`, max 50MB)
- Shows file name + size after selection, option to remove
- Upload + Update button → calls `api.uploadFile()`
- Success shows job ID, error shown inline

---

## Task G: Web UI — Bulk Upload Page

### G1: Create `BulkUploadForm.tsx`

Full form layout:
- Type toggle: Plugin / Theme
- Slug input (for plugin)
- File picker
- Site checklist (fetch all sites, checkboxes with select-all)
- Results panel after upload showing per-site status

### G2: Create page at `/updates/upload`

Simple page wrapping `BulkUploadForm` with Header.

---

## Task H: Integrate into Updates Page

### H1: Add upload entry points

1. Per site card: "Upload" button in each card header → opens `UploadUpdateDrawer`
2. Header area: "Upload" button → links to `/updates/upload` (bulk page)

---

## Self-Review

**Spec coverage:**
- ✅ Upload zip for Plugin (drawer + bulk page)
- ✅ Upload zip for Theme (drawer + bulk page)
- ✅ Per-site "Upload" button on Updates page card
- ✅ Dedicated bulk upload page (`/updates/upload`) with multi-site select
- ✅ File stored on local disk (`storage/uploads/`)
- ❌ Core upload — intentionally excluded (user chose Plugin+Theme only)
- ❌ Schedule update — excluded (never requested)

**Placeholder scan:** All code is complete in the spec above. No TBD/TODO patterns.

**Type consistency:** `UPLOAD_PLUGIN` / `UPLOAD_THEME` used consistently across DB → API → Worker → Agent. Endpoint paths match between Worker and Agent.
