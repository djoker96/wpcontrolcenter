# Hướng dẫn triển khai Production (DEPLOY.md)

Tài liệu mô tả cách build, cấu hình và triển khai **WP Control Center** lên môi trường production bằng Docker Compose.

---

## 1. Kiến trúc tổng quan

Stack production gồm **6 container** chạy trên cùng một bridge network (`wpcc-network`):

| Container       | Image                  | Vai trò                                                              | Port (host) |
|-----------------|------------------------|----------------------------------------------------------------------|-------------|
| `wpcc-nginx-prod`    | `nginx:alpine`         | Reverse proxy, TLS termination, security headers, rate limit auth    | `80` (mặc định) |
| `wpcc-web-prod`      | build `apps/web`       | Next.js standalone server (SSR + static)                            | nội bộ `5001` |
| `wpcc-api-prod`      | build `apps/api`       | NestJS REST API (auth, jobs, sites, monitoring)                     | nội bộ `3003` |
| `wpcc-worker-prod`   | build `apps/worker`    | BullMQ worker (chạy jobs gửi tới WordPress agent)                   | không expose |
| `wpcc-postgres-prod` | `postgres:16-alpine`   | Cơ sở dữ liệu chính                                                  | nội bộ `5432` |
| `wpcc-redis-prod`    | `redis:7-alpine`       | Hàng đợi BullMQ + cache                                              | nội bộ `6379` |

> **Lưu ý quan trọng về bảo mật**: Chỉ `nginx` được publish ra host. Các service còn lại giao tiếp nội bộ qua `wpcc-network`, không cần (và không nên) mở ra Internet.

---

## 2. Yêu cầu hệ thống (Prerequisites)

Trên server production cần:

- **Docker Engine** `>= 24.0`
- **Docker Compose** `>= 2.20` (plugin `docker compose`)
- **RAM** tối thiểu `2 GB` (khuyến nghị `4 GB` cho môi trường có nhiều site)
- **Disk** tối thiểu `20 GB` (DB + log + backup)
- **OS**: Linux x86_64 (Ubuntu 22.04 / Debian 12 / Rocky 9 đều OK)
- **Internet**: chỉ cần khi pull image và build lần đầu; sau đó có thể chạy offline

---

## 3. Chuẩn bị biến môi trường

### 3.1. Sinh secrets

Trước khi tạo file env, sinh các giá trị mạnh. Chạy một lần trên máy an toàn:

```bash
# JWT_SECRET — random string ≥ 64 ký tự
openssl rand -base64 48

# AGENT_ENCRYPTION_KEY — BẮT BUỘC 32 byte hex (AES-256-GCM)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# hoặc: openssl rand -hex 32

# POSTGRES_PASSWORD — mật khẩu mạnh cho DB
openssl rand -base64 24

# SEED_ADMIN_PASSWORD (optional) — mật khẩu admin ban đầu, ≥ 12 ký tự
openssl rand -base64 18
```

> ⚠️ **Không bao giờ commit** các giá trị thật vào git. File `.env` ở root đang bị track — xem mục [9. Dọn dẹp bảo mật](#9-dọn-dẹp-bảo-mật) để gỡ ra.

### 3.2. Tạo `.env.production`

Copy template rồi điền giá trị thật:

```bash
cp .env.ci.example .env.production
```

Sửa các trường (xem chú thích từng dòng trong `.env.ci.example`):

```ini
# PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<điền mật khẩu đã sinh>
POSTGRES_DB=wp_control_center
DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@postgres:5432/wp_control_center?schema=public

# Redis (giữ nguyên — service name trong compose)
REDIS_HOST=redis
REDIS_PORT=6379

# Auth
JWT_SECRET=<điền JWT_SECRET đã sinh>
JWT_EXPIRES_IN=1d

# Encryption (32 byte hex)
AGENT_ENCRYPTION_KEY=<điền AGENT_ENCRYPTION_KEY đã sinh>

# (optional) Mật khẩu admin ban đầu, bỏ trống sẽ sinh random in ra log
SEED_ADMIN_PASSWORD=<điền mật khẩu admin ≥ 12 ký tự>

# Frontend — URL public mà người dùng truy cập (qua nginx)
NEXT_PUBLIC_API_URL=https://wpcc.example.com/api

# Port host của nginx (đổi sang 8080 nếu sau reverse proxy khác)
NGINX_PORT=80
```

> `NEXT_PUBLIC_API_URL` được inline vào bundle ở lúc build — phải đặt đúng domain public **trước khi build**.

---

## 4. Build & khởi động

### 4.1. Lấy code về server

```bash
git clone <repo-url> /opt/wpcc
cd /opt/wpcc
git checkout <tag-or-commit>   # luôn deploy một tag cố định
```

### 4.2. Build image & start

```bash
# Load env từ .env.production
set -a && . ./.env.production && set +a

# Build tất cả image (api, web, worker)
docker compose -f docker-compose.prod.yml --env-file .env.production build

# Start full stack (detached)
docker compose -f docker-compose.prod.yml --env-file .env.production up -d
```

Lần đầu build mất ~5–10 phút (ci deps + prisma generate + next build).

### 4.3. Chạy database migration

**Bắt buộc** trước khi có traffic:

```bash
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy \
    --schema=packages/database/prisma/schema.prisma
```

`migrate deploy` chỉ chạy các migration chưa áp dụng — an toàn chạy lại nhiều lần. 8 migration sẽ được apply (từ `20260617_init` đến `20260622105842_add_object_cache_fields`).

### 4.4. Seed admin user

```bash
docker compose -f docker-compose.prod.yml exec api \
  node packages/database/dist/seed.js
```

- Nếu `SEED_ADMIN_PASSWORD` được set: admin dùng mật khẩu đó.
- Nếu không: một mật khẩu random được sinh và **in ra stdout một lần** — copy ngay.
- Tài khoản mặc định: `admin@example.com` (role `SUPER_ADMIN`).

> Đăng nhập lần đầu, đổi email + mật khẩu ngay trong UI (Account page).

### 4.5. Kiểm tra health

```bash
# nginx trả về 200 nếu web + api đều sống
curl -fsS http://localhost/ && echo "OK web"
curl -fsS http://localhost/api/health && echo "OK api"   # nếu có health endpoint

# Trạng thái container
docker compose -f docker-compose.prod.yml ps
```

---

## 5. Cập nhật phiên bản mới (Update / Redeploy)

```bash
cd /opt/wpcc
git pull --ff-only
git checkout <new-tag>

set -a && . ./.env.production && set +a

# Rebuild và restart — không chạm tới volume dữ liệu
docker compose -f docker-compose.prod.yml --env-file .env.production up -d --build

# Áp dụng migration mới (nếu có)
docker compose -f docker-compose.prod.yml exec api \
  npx prisma migrate deploy \
    --schema=packages/database/prisma/schema.prisma
```

> Nếu chỉ đổi code (không có migration), bỏ bước `prisma migrate deploy`.

---

## 6. Reverse proxy / TLS (HTTPS)

Nginx trong compose đang nghe HTTP port 80. **Production thật cần HTTPS.** Hai cách:

### Cách A — Để nginx nội bộ chạy HTTP, đặt TLS ở edge

Phổ biến nhất (Cloudflare, ALB, Caddy, Traefik đứng trước). Chỉ cần:

```bash
# Trong .env.production
NGINX_PORT=8080          # expose nội bộ, không ra Internet trực tiếp
NEXT_PUBLIC_API_URL=https://wpcc.example.com/api
```

Edge termination TLS rồi forward HTTP vào port `8080`. HSTS header trong `nginx/nginx.conf` đã sẵn.

### Cách B — Thêm TLS trực tiếp vào nginx nội bộ

Mount certificate vào container và đổi `listen 80` → `listen 443 ssl`. Cần sửa `nginx/nginx.conf` + thêm volume + mở port 443 trong compose. Khuyến nghị dùng **Cách A** cho đơn giản.

---

## 7. Backup & restore

### 7.1. Backup database

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U postgres wp_control_center | gzip > backup_$(date +%F).sql.gz
```

Khuyến nghị crontab hằng đêm:

```cron
0 2 * * * cd /opt/wpcc && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres wp_control_center | gzip > /backups/wpcc_$(date +\%F).sql.gz && find /backups -name 'wpcc_*.sql.gz' -mtime +14 -delete
```

### 7.2. Restore

```bash
gunzip -c backup_2026-06-23.sql.gz | \
  docker compose -f docker-compose.prod.yml exec -T postgres \
    psql -U postgres wp_control_center
```

### 7.3. Volume dữ liệu

Postgres data nằm trong named volume `postgres_prod_data`. Đừng bao giờ `docker volume rm` volume này.

```bash
# Xem vị trí vật lý
docker volume inspect wpcc_postgres_prod_data
```

---

## 8. Vận hành (Day-2 operations)

### Xem log

```bash
docker compose -f docker-compose.prod.yml logs -f api
docker compose -f docker-compose.prod.yml logs -f worker    # quan trọng nhất — xử lý jobs
docker compose -f docker-compose.prod.yml logs -f nginx
docker compose -f docker-compose.prod.yml logs --tail=200 web
```

### Restart một service

```bash
docker compose -f docker-compose.prod.yml restart worker
```

### Vào shell trong container

```bash
docker compose -f docker-compose.prod.yml exec api sh
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres wp_control_center
```

### Triển khai WordPress Agent plugin

Plugin ở `wordpress-agent/plugin/` cần được cài trên **mỗi site WordPress được quản lý**. Sau khi user "Add site" qua UI, agent dùng HMAC + endpoint `/wp-json/wp-control-center/v1/*` để giao tiếp. Xem hướng dẫn cài plugin trong README của `wordpress-agent/`.

---

## 9. Dọn dẹp bảo mật (Security cleanup)

Trước khi đi production thật, thực hiện:

1. **Gỡ `.env` khỏi git** — hiện đang bị track với secret hardcode:
   ```bash
   git rm --cached .env .env.example
   printf '.env\n.env.*\n!.env.ci.example\n!.env.production.example\n' >> .gitignore
   git commit -m "chore: stop tracking .env (contains secrets)"
   ```
   Lưu ý: secret cũ vẫn còn trong git history. Rotate `JWT_SECRET` + `AGENT_ENCRYPTION_KEY` + `POSTGRES_PASSWORD` sau khi gỡ. Xem `git filter-repo` hoặc BFG nếu cần xoá sạch history.

2. **Đổi `admin@example.com`** ngay sau khi đăng nhập lần đầu.

3. **Giới hạn port**: chỉ mở `80/443` ra Internet, SSH dùng key + fail2ban, đóng `5432`/`6379`/`3003`/`5001`.

4. **Enable Docker log rotation** (thêm vào `/etc/docker/daemon.json`):
   ```json
   { "log-driver": "json-file", "log-opts": { "max-size": "10m", "max-file": "3" } }
   ```

---

## 10. Checklist trước khi go-live

- [ ] `.env.production` có secrets thật, không còn `CHANGE_ME_*`
- [ ] `NEXT_PUBLIC_API_URL` trỏ đúng domain public qua HTTPS
- [ ] `prisma migrate deploy` chạy thành công (8 migration)
- [ ] Seed admin chạy, password đã capture/đổi
- [ ] `curl https://<domain>/` trả về 200
- [ ] TLS hoạt động (lock icon xanh, HSTS header có mặt)
- [ ] Backup crontab đã đặt, test restore 1 lần
- [ ] WordPress Agent plugin đã cài trên ít nhất 1 site test
- [ ] Test end-to-end: add site → run "Clear Cache" job → thấy job hoàn tất
- [ ] `.env` đã gỡ khỏi git, secret đã rotate
- [ ] Docker log rotation đã bật

---

## 11. Khắc phục sự cố thường gặp

| Triệu chứng | Nguyên nhân | Khắc phục |
|-------------|-------------|-----------|
| `api` crash, log `Can't reach database server` | postgres chưa ready | `docker compose ... depends_on` đã có; đợi 30s rồi restart api |
| `worker` log `ECONNREFUSED redis:6379` | redis chết hoặc sai `REDIS_HOST` | kiểm tra `REDIS_HOST=redis` trong env, `docker compose ps redis` |
| Web trắng, console lỗi `fetch ... failed` | `NEXT_PUBLIC_API_URL` sai ở build time | rebuild web với đúng URL |
| Login trả 429 Too Many Requests | nginx rate limit (10 req/phút) | bình thường — chống brute-force; chờ 1 phút |
| Job "pending" mãi không chạy | worker chết | `docker compose logs worker`, restart worker |
| Migration lỗi `relation already exists` | chạy migration cũ trên DB đã có | dùng `migrate deploy` (không phải `migrate dev`) — chỉ chạy cái thiếu |
| `prisma generate` fail trong build | schema path sai | Dockerfile đã hardcode đúng path; kiểm tra không bị override |

---

## 12. CI/CD (tham khảo)

Pipeline `.github/workflows/ci.yml` chạy 4 job trên mỗi PR/push tới `main`:

1. **code-quality** — lint + typecheck toàn workspace
2. **unit-tests** — `npm test --workspaces`
3. **build** — `npm run build:all`
4. **e2e-tests** — dựng full `docker-compose.prod.yml`, migrate, seed, chạy Playwright

CI build image tại chỗ (không push lên registry). Nếu muốn CD tự động lên server, cân nhắc thêm bước push image lên registry + SSH deploy script.

---

*Tài liệu này phản ánh kiến trúc tại branch `fix/ci-and-production-blockers`. Nếu thêm service/migration mới, cập nhật tương ứng mục [1](#1-kiến-trúc-tổng-quan) và [4.3](#43-chạy-database-migration).*
