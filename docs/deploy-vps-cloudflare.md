# Hướng Dẫn Deploy WP Control Center lên VPS Ubuntu 22.04

## Kiến trúc

```
                          Cloudflare CDN
                              │
                    Cloudflare Tunnel (Zero Trust)
                              │
                     ┌────────┴────────┐
                     │  cloudflared     │
                     │  (container)     │
                     └────────┬────────┘
                              │ (internal HTTP)
                     ┌────────┴────────┐
                     │  Nginx (port 80) │
                     │  reverse proxy   │
                     └────┬───────┬─────┘
                          │       │
                    ┌─────┘       └─────┐
                    ▼                    ▼
              ┌──────────┐       ┌──────────┐
              │  Web      │       │  API     │
              │ :5001     │       │ :3003    │
              │ Next.js   │       │ NestJS   │
              └──────────┘       └────┬─────┘
                                      │
                              ┌───────┴───────┐
                              │   Worker       │
                              │   (BullMQ)     │
                              └───────┬───────┘
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
              ┌──────────┐     ┌──────────┐     ┌──────────┐
              │PostgreSQL│     │  Redis   │     │   NFS     │
              │   :5432  │     │  :6379   │     │(optional) │
              └──────────┘     └──────────┘     └──────────┘
```

---

## I. Chuẩn Bị

### Yêu cầu
- **VPS**: Ubuntu 22.04, tối thiểu 2GB RAM, 2 CPU
- **Tên miền**: đã trỏ về Cloudflare (DNS proxied — biểu tượng đám mây màu cam ☁️)
- **GitHub repo**: source code của dự án
- **Cloudflare account**: gói Free là đủ

### Kết nối VPS

```bash
ssh user@ip-vps-cua-ban
```

---

## II. Cài Đặt Hệ Thống

### Bước 1: Cài Docker & Dependencies

SSH vào VPS và chạy:

```bash
# Cập nhật hệ thống
sudo apt update && sudo apt upgrade -y

# Cài dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release git ufw

# Thêm Docker repository
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user vào docker group
sudo usermod -aG docker $USER

# Áp dụng (đăng xuất hoặc dùng lệnh này):
newgrp docker
```

### Bước 2: Cấu hình Firewall (UFW)

```bash
# Chỉ mở SSH - Cloudflare Tunnel không cần port HTTP
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw --force enable

# Kiểm tra
sudo ufw status verbose
```

> **Tại sao không mở port 80/443?** Vì Cloudflare Tunnel tạo kết nối *outbound* từ VPS đến Cloudflare, không cần mở port inbound nào.

---

## III. Clone & Cấu Hình Dự Án

### Bước 3: Clone Repository

```bash
cd ~
git clone <your-repo-url> wp-control-center
cd wp-control-center
```

### Bước 4: Tạo File .env

```bash
cp .env.production.example .env
nano .env
```

**Thay đổi các giá trị sau:**

| Variable | Ghi chú |
|----------|---------|
| `POSTGRES_PASSWORD` | Mật khẩu mạnh, ít nhất 16 ký tự; dùng ký tự URL-safe như chữ, số, `-`, `_` |
| `JWT_SECRET` | `openssl rand -hex 32` để tạo |
| `AGENT_ENCRYPTION_KEY` | `openssl rand -hex 32` để tạo |
| `SEED_ADMIN_EMAIL` | Email admin dùng khi chạy seed staging |
| `SEED_ADMIN_PASSWORD` | Mật khẩu admin mạnh, bắt buộc khi seed bằng image production |
| `RUN_SEED` | Đặt `true` cho lần seed staging đầu tiên; đặt lại `false` sau khi seed xong nếu không muốn reset mật khẩu admin ở lần deploy sau |
| `NEXT_PUBLIC_API_URL` | `https://domain-cua-ban.com/api` |
| `CORS_ORIGIN` | Origin frontend, ví dụ `https://domain-cua-ban.com` |
| `CLOUDFLARE_TUNNEL_TOKEN` | Lấy ở bước V |

---

## IV. Build & Chạy

### Bước 5: Pull & Build Images

```bash
cd ~/wp-control-center
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env build
```

> Lần đầu build có thể mất 5-10 phút tùy VPS.

### Bước 6: Chạy Database Migrations

```bash
# Khởi động database trước
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres redis

# Đợi database ready (khoảng 10 giây)
sleep 10

# Chạy Prisma migration
docker compose -f docker-compose.prod.yml --env-file .env run --rm api sh -c "cd packages/database && npx prisma migrate deploy"
```

Nếu cần seed dữ liệu staging và tài khoản admin, đặt `RUN_SEED=true` trong `.env`, sau đó chạy:

```bash
docker compose -f docker-compose.prod.yml --env-file .env run --rm api sh -c "cd packages/database && npm run seed"
```

### Bước 7: Khởi động Toàn Bộ Hệ Thống

```bash
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

### Bước 8: Kiểm Tra

```bash
# Xem trạng thái
docker compose -f docker-compose.prod.yml --env-file .env ps

# Xem logs (tất cả services)
docker compose -f docker-compose.prod.yml --env-file .env logs --tail=50

# Xem logs của từng service
docker compose -f docker-compose.prod.yml --env-file .env logs -f api
docker compose -f docker-compose.prod.yml --env-file .env logs -f web
docker compose -f docker-compose.prod.yml --env-file .env logs -f nginx
docker compose -f docker-compose.prod.yml --env-file .env logs -f cloudflared
```

---

## V. Cấu Hình Cloudflare Tunnel ⭐

### Cách 1: Dùng Dashboard (khuyên dùng)

1. **Login Cloudflare Dashboard** → [dash.cloudflare.com](https://dash.cloudflare.com/)
2. **Zero Trust** → **Networks** → **Tunnels**
3. **Create a tunnel** → chọn **cloudflared**
4. Đặt tên: `wpcc-tunnel`
5. **Public Hostname**:
   - **Subdomain**: `www` (hoặc để trống)
   - **Domain**: chọn domain của bạn
   - **Path**: để trống
   - **Service**: `HTTP://` → `nginx:80`
6. **Save Tunnel**
7. Copy **Token** (dạng `eyJhIjoi...`) → dán vào `CLOUDFLARE_TUNNEL_TOKEN` trong `.env`

### Cách 2: Dùng CLI

```bash
# Cài cloudflared trên máy local (macOS)
brew install cloudflared

# Login
cloudflared tunnel login

# Tạo tunnel
cloudflared tunnel create wpcc

# Config file ~/.cloudflared/wpcc.yml
# tunnel: <tunnel-id>
# credentials-file: /Users/you/.cloudflared/<tunnel-id>.json
# ingress:
#   - hostname: domain-cua-ban.com
#     service: http://nginx:80
#   - service: http_status:404

# Route DNS
cloudflared tunnel route dns wpcc domain-cua-ban.com

# Lấy token
cloudflared tunnel token wpcc
# → Dán token vào .env
```

### Kiểm tra tunnel

Sau khi chạy `docker compose up -d`, kiểm tra:

```bash
docker compose -f docker-compose.prod.yml --env-file .env logs cloudflared
```

Bạn sẽ thấy:
```
Registered tunnel connection
Connection registered
```

---

## VI. Mở Rộng & Tối Ưu

### Tạo User Admin Đầu Tiên

Seed script dùng `SEED_ADMIN_EMAIL` và `SEED_ADMIN_PASSWORD` trong `.env` để tạo hoặc cập nhật tài khoản `SUPER_ADMIN`:

```bash
docker compose -f docker-compose.prod.yml --env-file .env run --rm api sh -c "cd packages/database && npm run seed"
```

### Backup Database

```bash
# Backup
docker compose -f docker-compose.prod.yml --env-file .env exec postgres sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > ~/backups/backup-$(date +%Y%m%d).sql

# Restore
cat ~/backups/backup-20240101.sql | docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres sh -c 'psql -U "$POSTGRES_USER" "$POSTGRES_DB"'
```

### Cập Nhật Code

```bash
cd ~/wp-control-center
git pull
docker compose -f docker-compose.prod.yml --env-file .env build
docker compose -f docker-compose.prod.yml --env-file .env up -d
```

Nếu có migration mới:

```bash
docker compose -f docker-compose.prod.yml --env-file .env run --rm api sh -c "cd packages/database && npx prisma migrate deploy"
```

### Monitoring

```bash
# Xem resource usage của containers
docker stats

# Xem logs realtime
docker compose -f docker-compose.prod.yml --env-file .env logs -f --tail=100

# Kiểm tra health
docker compose -f docker-compose.prod.yml --env-file .env ps
```

---

## VII. Troubleshooting

### Vấn đề: Container không start

```bash
# Xem logs chi tiết
docker compose -f docker-compose.prod.yml --env-file .env logs --tail=100
docker compose -f docker-compose.prod.yml --env-file .env logs api --tail=50
```

### Vấn đề: Database connection refused

```bash
# Kiểm tra postgres
docker compose -f docker-compose.prod.yml --env-file .env exec postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# Kiểm tra DATABASE_URL trong .env
# Đảm bảo dùng hostname "postgres" chứ không phải "localhost"
```

### Vấn đề: Cloudflare Tunnel không kết nối

```bash
# Kiểm tra token
docker compose -f docker-compose.prod.yml --env-file .env exec cloudflared tunnel info

# Kiểm tra nginx có chạy không từ trong Docker network
docker compose -f docker-compose.prod.yml --env-file .env exec nginx wget -qO- http://localhost
```

### Vấn đề: Permission denied cho /var/run/docker.sock

```bash
# Thêm user vào docker group
sudo usermod -aG docker $USER
# Sau đó logout & login lại
```

---

## VIII. Chi Phí Tham Khảo

| Item | Chi phí (tháng) |
|------|-----------------|
| VPS 2GB RAM, 2 CPU | ~$6-12 (DigitalOcean / Vultr / Hetzner) |
| Cloudflare Free | $0 |
| Tên miền .com | ~$10/năm |
| **Tổng** | **~$6-12/tháng** |

---

## File Cheatsheet

| File | Mô tả |
|------|-------|
| `docker-compose.prod.yml` | Production Compose (đã sửa — secrets từ .env) |
| `.env.production.example` | Template biến môi trường production |
| `nginx/nginx.conf` | Nginx config (đã hỗ trợ Cloudflare real IP) |
| `scripts/deploy-vps.sh` | Script tự động deploy lên VPS (chạy sau khi config .env) |
| `scripts/setup-cloudflare-tunnel.sh` | Hướng dẫn tạo Cloudflare Tunnel |

---

> **Security Note**: Port 80 của Nginx KHÔNG exposed ra host. Chỉ cloudflared mới có thể kết nối tới Nginx qua internal network. VPS của bạn gần như "tàng hình" trên internet.
