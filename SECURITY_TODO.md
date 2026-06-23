# Security — Remaining Work

Status as of 2026-06-23. Branch `fix/ci-and-production-blockers` (PR #1).
Done so far: 7 CRITICAL + 13 HIGH + several MEDIUM/LOW — commits `55dea04`, `4a5d8e3`, `54f43e4`, `bd5c8be` (all pushed & adversarially verified).

---

## 1. Manual ops — DO BEFORE / DURING DEPLOY (highest priority)

- [ ] **Purge `.env` from git history.** Untracked now, but old secrets still live in commits `586f99d`, `1ac4a43`. Run `git filter-repo --invert-paths --path .env` (or BFG), then `git push --force --all`. Coordinate with team.
- [ ] **Rotate ALL exposed secrets** (they were in git history, treat as compromised):
  - `JWT_SECRET` (dev already rotated; rotate prod)
  - `AGENT_ENCRYPTION_KEY` — run `packages/database/scripts/rotate-encryption-key.ts` during cutover (re-encrypts secretKey/connectionToken/integration tokens + recomputes `connectionTokenHash`). Then drop `OLD_AGENT_ENCRYPTION_KEY` from env.
  - Prod DB password (`SecretPassword123!` was committed in docker-compose)
  - Re-issue `secret_key` to every connected WordPress agent
- [ ] **Run new DB migration** before deploy: `prisma migrate deploy` — adds `SiteCredential.connection_token_hash` (migration `20260623120000_add_connection_token_hash`).
- [ ] **Set `WPCC_BACKUPS_DIR`** env to a shared absolute path for BOTH api + worker (else backup download/delete can 404 — paths diverge by default).
- [ ] **Enable TLS on nginx** — template + 80→443 redirect block is commented in `nginx/nginx.conf`; mount certs, uncomment. HSTS is meaningless until TLS is on.
- [ ] **Redis password in prod** — `docker-compose.yml` has commented `--requirepass`; enable it AND wire `REDIS_PASSWORD` into api/worker BullMQ connection config (app currently connects without auth).
- [ ] Verify `CORS_ORIGIN` set correctly per env (cookie auth needs explicit origins + `credentials:true`; dev web↔api is cross-origin).

## 2. Dependency CVEs (HIGH) — own task, needs regression testing

7 high advisories; real fixes require a **NestJS v10 → v11 major upgrade** (done in **bun**, the repo's package manager — npm `overrides` did not apply cleanly):
- [ ] `multer` DoS (reachable via upload endpoints) — fixed via `@nestjs/platform-express@11`
- [ ] `lodash` `_.template` code injection — via `@nestjs/swagger@11`
- [ ] `picomatch` — via `@nestjs/schematics@11` (build)
- [ ] `glob`, `tmp`, `@nestjs/cli` — non-major, `bun update` should clear
- [ ] After upgrade: full build + e2e regression (NestJS v11 has breaking changes)

## 3. MEDIUM — design-level (not quick fixes)

- [ ] **OAuth `state` param** missing (`integrations.service.ts` getGoogleAuthUrl / handleGoogleCallback) → authorization-code injection / CSRF. Add signed `state`, store server-side, verify on callback.
- [ ] **Integration account binding** — `handleGoogleCallback` upserts by `provider+accountEmail` only, not bound to the initiating user; any admin can overwrite another's tokens. Bind to user + authorize updates.
- [ ] **WP `secret_key` stored plaintext** in `wp_options` (`admin/class-admin-page.php`). Store in a `wp-config.php` constant or encrypt at rest; set `autoload=no`.
- [ ] **Notification `destination` not validated at creation** (`notifications.service.ts create`). SSRF is already blocked at fetch time in the worker, but validate URL/format + scheme on create as defense-in-depth.
- [ ] JWT has no revocation / no active-user re-check on each request (token valid full TTL after deactivation). Consider token version or short TTL + refresh.
- [ ] CSP still uses `'unsafe-inline'` for script/style (api `main.ts` + web `next.config.ts`). Move to nonces/hashes when feasible.

## 4. LOW / hardening

- [ ] `seed.ts` demo admin (`admin@example.com` SUPER_ADMIN) + demo integration tokens — gate behind a non-prod guard so they never run against prod DB.
- [ ] Agent HMAC replay window (5 min) has no nonce/seen-signature cache — add one.
- [ ] WP backup dir protected only by `.htaccess` "Deny from all" (ignored by nginx) — store outside web root or enforce server-agnostic.
- [ ] `attachIntegration` stub (`sites.controller.ts`) echoes arbitrary body — remove or implement with typed DTO.
- [ ] Job `payloadJson` returned by `jobs.service.findOne` leaks absolute file paths — strip before returning.

## 5. Notes

- `SECURITY_AUDIT.md` (local, untracked) = full finding map — intentionally NOT committed (vuln map).
- Git author identity for this repo set locally to `djoker96 <datjoker96@gmail.com>`.
- A stray background process committed `eff863f` (deploy) and regenerated `bun.lock`/`Makefile` mid-session — verify those are intentional.
