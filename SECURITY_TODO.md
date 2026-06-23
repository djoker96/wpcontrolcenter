# Security — Remaining Work

Status as of 2026-06-23. Branch `fix/ci-and-production-blockers` (PR #1).
Done so far: 7 CRITICAL + 13 HIGH + several MEDIUM/LOW — commits `55dea04`, `4a5d8e3`, `54f43e4`, `bd5c8be` (all pushed & adversarially verified),
**plus security fixes (PR #2): commits `cfa973a`, `6b43861` covering 10 items (A1–A8, B1–B2) from sections 1, 3, and 4 below.**

---

## 1. Manual ops — DO BEFORE / DURING DEPLOY (highest priority)

- [ ] **Purge `.env` from git history.** Untracked now, but old secrets still live in commits `586f99d`, `1ac4a43`. Run `git filter-repo --invert-paths --path .env` (or BFG), then `git push --force --all`. Coordinate with team.
- [ ] **Rotate ALL exposed secrets** (they were in git history, treat as compromised):
  - `JWT_SECRET` (dev already rotated; rotate prod)
  - `AGENT_ENCRYPTION_KEY` — run `packages/database/scripts/rotate-encryption-key.ts` during cutover (re-encrypts secretKey/connectionToken/integration tokens + recomputes `connectionTokenHash`). Then drop `OLD_AGENT_ENCRYPTION_KEY` from env.
  - Prod DB password (`SecretPassword123!` was committed in docker-compose)
  - Re-issue `secret_key` to every connected WordPress agent
- [ ] **Run new DB migration** before deploy: `prisma migrate deploy` — adds `SiteCredential.connection_token_hash` (migration `20260623120000_add_connection_token_hash`), `IntegrationAccount.owner_id` (`20260623130000_add_integration_owner`), `User.token_version` (`20260623140000_add_user_token_version`).
- [ ] **Set `WPCC_BACKUPS_DIR`** env to a shared absolute path for BOTH api + worker (else backup download/delete can 404 — paths diverge by default).
- [ ] **Enable TLS on nginx** — template + 80→443 redirect block is commented in `nginx/nginx.conf`; mount certs, uncomment. HSTS is meaningless until TLS is on.
- [x] **Redis password in prod** — `REDIS_PASSWORD` env read in BullMQ connections (`worker/src/index.ts`, `jobs.module.ts`); `--requirepass` uncommented in `docker-compose.yml`/`docker-compose.prod.yml`. Warns in `env.ts` if missing in production.
- [ ] Verify `CORS_ORIGIN` set correctly per env (cookie auth needs explicit origins + `credentials:true`; dev web↔api is cross-origin).

## 2. Dependency CVEs (HIGH) — own task, needs regression testing

7 high advisories; real fixes require a **NestJS v10 → v11 major upgrade** (done in **bun**, the repo's package manager — npm `overrides` did not apply cleanly):
- [ ] `multer` DoS (reachable via upload endpoints) — fixed via `@nestjs/platform-express@11`
- [ ] `lodash` `_.template` code injection — via `@nestjs/swagger@11`
- [ ] `picomatch` — via `@nestjs/schematics@11` (build)
- [ ] `glob`, `tmp`, `@nestjs/cli` — non-major, `bun update` should clear
- [ ] After upgrade: full build + e2e regression (NestJS v11 has breaking changes)

## 3. MEDIUM — design-level (not quick fixes)

- [x] **OAuth `state` param** missing (`integrations.service.ts` getGoogleAuthUrl / handleGoogleCallback) → authorization-code injection / CSRF. Fixed: self-contained signed HMAC token (AGENT_ENCRYPTION_KEY), 10 min TTL, verified before code exchange.
- [x] **Integration account binding** — `handleGoogleCallback` now accepts `userId`, upserts keyed by `{ provider, ownerId }`. Schema: `IntegrationAccount.ownerId` (nullable, FK → User). Migration `20260623130000_add_integration_owner`.
- [x] **WP `secret_key` stored plaintext** in `wp_options` (`admin/class-admin-page.php`). Fixed: `wpcc_agent_get_secret_key()` checks `WPCC_SECRET_KEY` constant first, falls back to DB. DB write skipped when constant defined. Autoload disabled.
- [x] **Notification `destination` not validated at creation** (`notifications.service.ts create`). Fixed: custom `@IsValidDestination()` decorator — WEBHOOK/SLACK/DISCORD require `https://`; TELEGRAM requires `token:chatId` format.
- [x] JWT has no revocation / no active-user re-check on each request — Fixed: `User.tokenVersion` (default 0) in JWT payload; AuthGuard DB lookups to verify `isActive` + `tokenVersion` match; `resetPassword` bumps `tokenVersion`. Migration `20260623140000_add_user_token_version`.
- [ ] CSP still uses `'unsafe-inline'` for script/style (api `main.ts` + web `next.config.ts`). Move to nonces/hashes when feasible.

## 4. LOW / hardening

- [x] `seed.ts` demo admin (`admin@example.com` SUPER_ADMIN) + demo integration tokens — gated behind `NODE_ENV !== 'production'`. Admin upsert runs unconditionally (idempotent); demo data (site, integration, jobs, incidents, etc.) skipped in production.
- [ ] Agent HMAC replay window (5 min) has no nonce/seen-signature cache — add one.
- [x] WP backup dir protected only by `.htaccess` "Deny from all" (ignored by nginx) — fixed: Apache 2.4 `Require all denied` + 2.2 compat `Deny from all`, `index.html` (blocks nginx directory listing), `web.config` hiddenSegments (IIS).
- [x] `attachIntegration` stub (`sites.controller.ts`) echoes arbitrary body — replaced with typed `AttachIntegrationDto` + `ParseEnumPipe(IntegrationProvider)` + real `SitesService.attachIntegration()` that persists siteIntegration.
- [x] Job `payloadJson` returned by `jobs.service.findOne` leaks absolute file paths — `redactPayload()` helper strips `filePath` from UPLOAD_PLUGIN/UPLOAD_THEME jobs in both `findOne` and `findAll`; only `fileName` (basename) exposed.

## 5. Notes

- `SECURITY_AUDIT.md` (local, untracked) = full finding map — intentionally NOT committed (vuln map).
- Git author identity for this repo set locally to `djoker96 <datjoker96@gmail.com>`.
- A stray background process committed `eff863f` (deploy) and regenerated `bun.lock`/`Makefile` mid-session — verify those are intentional.
