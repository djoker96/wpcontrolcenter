# Security Audit — wp-control-center (full project)

Date: 2026-06-23 · Branch: `fix/ci-and-production-blockers` · Method: 5 parallel auditors over auth/crypto, API business modules, Next.js web, WordPress PHP agent plugin, infra/secrets/deps.

## Totals (deduped)

| Severity | Count |
|----------|-------|
| CRITICAL | 7 |
| HIGH     | 27 |
| MEDIUM   | 16 |
| LOW      | 15 |

Highest-risk surface: **WordPress PHP agent plugin** (remote RCE on every managed site) and **leaked secrets in git**.

---

## CRITICAL — fix before any deploy

1. **`.env` committed to git** (`.env:1-15`, commits `586f99d`, `1ac4a43`). `JWT_SECRET`, `AGENT_ENCRYPTION_KEY` (64-hex), DB password live in history + working tree.
   Fix: `git rm --cached .env` → purge history (git-filter-repo/BFG) → rotate ALL three secrets → invalidate exposed tokens.

2. **Compromised `AGENT_ENCRYPTION_KEY` reused in CI** (`.github/workflows/ci.yml:135`, same `6a66632c…f9bf3` as leaked `.env`). All `secretKeyEncrypted`/`accessTokenEncrypted` in any deployed DB is decryptable by anyone with repo access.
   Fix: random throwaway key for CI; run `rotate-encryption-key.ts` at cutover; treat all encrypted agent secrets as exposed.

3. **WP plugin `/register` unauthenticated** (`wordpress-agent/plugin/includes/class-api.php:13`). `permission_callback => '__return_true'`, `register_site()` sets `connected=true`. Any unauth request hijacks site connection.
   Fix: require signature / one-time provisioning token; gate behind `verify_request`.

4. **WP plugin Zip Slip → RCE** (`class-backup-manager.php:194`, restore path 88-101). `ZipArchive::extractTo(WP_CONTENT_DIR)` on attacker-uploaded zip, no entry-path validation → arbitrary PHP write under wp-content.
   Fix: validate each entry stays in target, reject absolute/`..`; only restore agent-generated backups.

5. **WP plugin raw SQL restore** (`class-backup-manager.php:154`). `restore_db()` splits dump on `";\n"` and runs each via `$wpdb->query()` unsanitized; chained with `upload_backup` = arbitrary SQL / full DB compromise.
   Fix: restrict restore to locally-created backups (manifest/checksum), disallow uploaded dumps.

6. **WP plugin arbitrary plugin/theme install → RCE** (`class-api.php:288` plugin, `:317` theme). Raw request body written to `.zip` and installed via `Plugin_Upgrader`/`Theme_Upgrader`, no checksum from control center.
   Fix: verify control-center SHA256 before install; rate-limit.

7. **WP plugin `.htaccess`/`.user.ini` arbitrary write → RCE** (`class-file-editor.php:33` htaccess, `:58` user.ini). Arbitrary directives (e.g. `auto_prepend_file`, `SetHandler`) = code execution / takeover.
   Fix: whitelist allowed directives/ini keys; reject `auto_prepend_file`/`auto_append_file`/`disable_functions`/handler lines.

---

## HIGH (27)

### WP agent plugin
- `class-auth.php:26` — HMAC covers Method|Path|Timestamp|Body but **not query string**; `?filename=` on download/upload is unauthenticated/malleable. (`class-api.php:264` download_backup, `:368` upload_backup overwrite). Fix: sign full URI incl. query.
- `class-auth.php:32` — `hash_equals` arg order reversed + `$signature` not validated as 64-char hex / scalar. Fix: validate format, ensure scalar.
- `class-object-cache-manager.php:148` — remote-triggered `wp-config.php` rewrite; insert-after-`<?php` can corrupt config.

### API auth/crypto
- `auth.guard.ts:28` — `jwt.verify` no algorithm pinning → alg-confusion. Fix: `{ algorithms: ['HS256'] }` + iss/aud.
- `roles.guard.ts:33` — authz purely weight-`>=`; forged/tampered `role` claim grants access (compounds with unpinned JWT). Fix: pin alg, set-membership for exact roles, reject unknown roles.
- `agent.guard.ts:63` — timing-unsafe HMAC compare (`!==`). Fix: `crypto.timingSafeEqual`.
- `agent.controller.ts:9` — `POST /agent/register` no guard, no throttle; decrypt-all-and-compare = unauth token-guessing oracle + CPU-DoS. Fix: lookup by token hash, rate-limit, constant-time.
- `crypto.utils.ts:13` — legacy unsalted SHA-256 password path, no forced upgrade. Fix: migrate to scrypt on login, remove SHA-256 branch.

### API business
- `diagnostics.service.ts:56,119` & `sites.service.ts:192` — **SSRF**: `siteUrl` fetched server-side, no private-IP/metadata block. Fix: deny-list private/loopback/link-local before fetch.
- `upload.service.ts:29,33` — **path traversal**: raw `siteId` param in `path.join`. Fix: validate CUID, assert resolved path under UPLOAD_DIR.
- `upload.service.ts:20-55` — **unrestricted upload**: no type/magic-byte/extension check, written `.zip` → remote install. Fix: verify `PK\x03\x04`, whitelist, validate structure.
- `backups.service.ts:101-110` — **IDOR + traversal** on download: lookup by `backupId` only, unvalidated `siteId` in path. Fix: `findFirst({id, siteId})`, validate path within root.

### Infra/deps/worker
- `worker/src/index.ts:824,1415,544` — **SSRF**: `site.siteUrl` + notification `destination` (webhook/slack/discord/telegram) fetched, no allow-list. Fix: block private/link-local IPs.
- `docker-compose.yml:11-12,20-21` — Postgres 5433 + **Redis 6380 published, no `requirepass`** (unauth Redis = RCE vector). Fix: bind `127.0.0.1`, set Redis password, no DB/Redis ports in prod.
- `.env:9` — `JWT_SECRET` is literal placeholder. Fix: high-entropy per-env secret.
- `docker-compose.yml:9` — weak hardcoded DB password `SecretPassword123!`.
- `nginx/nginx.conf:31,44` — **HTTP-only (no 443/redirect) but sends HSTS**; JWT travels cleartext. Fix: terminate TLS, redirect 80→443.
- `npm audit` HIGH: **multer** 5 DoS advisories (reachable via upload endpoints), **webpack** buildHttp SSRF, **tmp** path traversal. Fix: `npm audit fix` / upgrade `@nestjs/platform-express`.

### Web
- `lib/api-client.ts:25` & `app/page.tsx:43` — JWT in **localStorage** (XSS = token theft). Fix: httpOnly Secure SameSite cookie.
- `app/(dashboard)/layout.tsx:16` — auth guard **client-side only**. Fix: middleware/server-component check.
- `next.config.js:1` — **no security headers** (CSP/HSTS/X-Frame-Options/nosniff/Referrer-Policy). Fix: add `headers()`.

---

## MEDIUM (16)
JWT trusted wholesale, no revocation/active-check (`auth.guard.ts:28`) · agent HMAC re-serializes body, fragile (`agent.guard.ts:60`) · login enumeration via distinct errors (`auth.service.ts:71`) · `JWT_SECRET<32` only warns, not fail (`env.ts:54`) · CSP `unsafe-inline` (`main.ts:32`) · backup restore/delete IDOR (`backups.service.ts:59,82`) · OAuth no `state` param + account binding → CSRF/takeover (`integrations.controller.ts:26`) · resync raw error.message in audit log (`sites.service.ts:379`) · PageSpeed latent SSRF · upload missing site-existence check · WP php-logs disclosure (`class-api.php:217`) · WP catch-all `/execute/` no per-action authz (`:64`) · WP secret_key plaintext in `wp_options` (`admin/class-admin-page.php:59`) · nginx 25m vs app 50MB upload mismatch + no general rate-limit · containers run as root (dev) · no CSRF if moving to cookie auth.

## LOW (15)
agent replay window no nonce · scrypt default params + non-constant-time fallback · JWT no iss/aud · CORS credentials+allowlist (assert never `*`) · seeded `admin@example.com` SUPER_ADMIN not prod-gated · backup dir `.htaccess`-only protection (ignored by nginx) · integration token scoping · `attachIntegration` dead stub echoes input · job `payloadJson` leaks absolute paths · audit `take` NaN · two conflicting `next.config.js`/`.ts` (silent header drop) · API base URL plaintext localhost fallback · relative `/api/...` calls hit no route (functional bug).

## NOT vulnerable (verified)
No raw `$queryRaw`/`$executeRaw` (no SQLi in API) · no cross-tenant IDOR (single-tenant role-gated, no owner field) · `.dockerignore` excludes `.env` (not baked into images) · containers run as non-root `node` · `dangerouslySetInnerHTML` uses static CSS only · no `eval`/`new Function` · global ValidationPipe whitelist mitigates mass-assignment.

---

## Remediation order
1. Rotate + purge all leaked secrets (CRIT 1,2). **Do first — everything else assumes secrets are clean.**
2. Lock down WP plugin: auth `/register`, sign query string, Zip-Slip guard, block uploaded-dump restore, checksum plugin/theme installs, whitelist file-editor (CRIT 3-7 + WP HIGH).
3. API: pin JWT alg, fix role authz, SSRF guards, upload validation/path-traversal, backup IDOR (HIGH).
4. Infra: TLS on nginx, Redis password, unpublish DB/Redis, `npm audit fix` (HIGH).
5. Web: move token to httpOnly cookie, server-side auth, security headers (HIGH).
6. MEDIUM/LOW as hardening pass.
