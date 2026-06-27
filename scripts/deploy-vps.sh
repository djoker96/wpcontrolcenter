#!/usr/bin/env bash
# ======================================================
# WP Control Center - Deploy Script (Ubuntu 22.04 VPS)
# Dùng: bash scripts/deploy-vps.sh
# ======================================================

set -euo pipefail

# === Color ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

log_info()  { echo -e "${CYAN}[INFO]${NC} $1"; }
log_ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
log_err()   { echo -e "${RED}[ERR]${NC} $1"; }

# === Check root ===
if [ "$EUID" -eq 0 ]; then
  log_err "Không chạy với quyền root. Dùng user thường có sudo."
  exit 1
fi

echo ""
echo -e "${CYAN}==============================================${NC}"
echo -e "${CYAN}  WP Control Center - Deploy Script${NC}"
echo -e "${CYAN}==============================================${NC}"
echo ""

# === 1. System update ===
log_info "Cập nhật hệ thống..."
sudo apt-get update -qq && sudo apt-get upgrade -y -qq
log_ok "Hệ thống đã cập nhật."

# === 2. Install dependencies ===
log_info "Cài đặt Docker + dependencies..."

# Remove old versions
for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do
  sudo apt-get remove -qq -y $pkg 2>/dev/null || true
done

# Install prerequisites
sudo apt-get install -y -qq \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  ufw \
  git

# Docker official GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Docker repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update -qq
sudo apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Add user to docker group
sudo usermod -aG docker "$USER"
log_ok "Docker đã cài đặt. User ${USER} đã được thêm vào group docker."
log_warn "ĐĂNG XUẤT & LOGIN LẠI để áp dụng group docker (hoặc chạy 'newgrp docker')."

# === 3. Firewall (UFW) ===
log_info "Cấu hình UFW..."
sudo ufw --force disable 2>/dev/null || true
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Cloudflare IP ranges được update động qua script
# Chỉ mở SSH và Cloudflare Tunnel
sudo ufw allow ssh
sudo ufw allow 22/tcp comment 'SSH'
sudo ufw --force enable
log_ok "UFW đã cấu hình: chỉ mở SSH (22). Cloudflare Tunnel không cần mở port."

# # === 4. Clone project (nếu chưa có) ===
DEPLOY_DIR="$HOME/wp-control-center"
REPO_URL="${REPO_URL:-}"  # Set biến môi trường REPO_URL trước khi chạy script

if [ -d "$DEPLOY_DIR" ]; then
  log_info "Thư mục $DEPLOY_DIR đã tồn tại. Pull code mới..."
  cd "$DEPLOY_DIR"
  git pull
else
  if [ -z "${REPO_URL}" ]; then
    log_err "Bạn cần set REPO_URL trước khi chạy:"
    log_err "  export REPO_URL=https://github.com/your-org/wp-control-center.git"
    log_err "  bash scripts/deploy-vps.sh"
    log_err ""
    log_err "Hoặc clone thủ công:"
    log_err "  cd ~ && git clone <repo-url> wp-control-center"
    log_err "  bash scripts/deploy-vps.sh"
    exit 1
  fi
  log_info "Clone repository từ $REPO_URL ..."
  cd "$HOME"
  git clone "$REPO_URL" "$DEPLOY_DIR"
  cd "$DEPLOY_DIR"
fi

# === 5. Setup .env ===
log_info "Kiểm tra file .env..."
if [ ! -f "$DEPLOY_DIR/.env" ]; then
  log_warn "File .env chưa tồn tại!"
  log_info "Tạo từ .env.production.example template..."
  cp "$DEPLOY_DIR/.env.production.example" "$DEPLOY_DIR/.env"
  log_err "✋ VUI LÒNG: Chỉnh sửa file .env với secrets thực tế, sau đó chạy lại script."
  log_err "   nano $DEPLOY_DIR/.env"
  exit 1
fi
log_ok "File .env đã tồn tại."

# === 6. Pull latest images & rebuild ===
log_info "Kéo image và build services..."
cd "$DEPLOY_DIR"
docker compose -f docker-compose.prod.yml --env-file .env pull
docker compose -f docker-compose.prod.yml --env-file .env build

# === 7. Database migrations ===
log_info "Chạy database migrations..."

# Khởi động postgres và redis trước
docker compose -f docker-compose.prod.yml --env-file .env up -d postgres redis

# Đợi postgres sẵn sàng (thay vì sleep cứng)
log_info "Đợi PostgreSQL sẵn sàng..."
for i in {1..30}; do
  if docker compose -f docker-compose.prod.yml --env-file .env exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    log_ok "PostgreSQL sẵn sàng."
    break
  fi
  if [ "$i" -eq 30 ]; then
    log_err "PostgreSQL không khởi động được. Kiểm tra logs:"
    docker compose -f docker-compose.prod.yml --env-file .env logs postgres --tail=20
    exit 1
  fi
  sleep 2
done

# Chạy migration — schema ở packages/database/prisma/schema.prisma
log_info "Chạy Prisma migrations..."
docker compose -f docker-compose.prod.yml --env-file .env run --rm api sh -c "cd packages/database && npx prisma migrate deploy"
log_ok "Database migrations hoàn tất."

# === 8. Start all services ===
log_info "Khởi động tất cả services..."
docker compose -f docker-compose.prod.yml --env-file .env up -d

# === 9. Verify ===
log_info "Kiểm tra trạng thái..."
sleep 10
docker compose -f docker-compose.prod.yml --env-file .env ps

# Kiểm tra health
if docker compose -f docker-compose.prod.yml --env-file .env ps | grep -q "(healthy)"; then
  log_ok "Services đã chạy!"
else
  log_warn "Một số service chưa healthy. Kiểm tra logs:"
  log_warn "  docker compose -f docker-compose.prod.yml --env-file .env logs --tail=50"
fi

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  Deploy hoàn tất!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo -e "Truy cập: https://domain-cua-ban.com"
echo -e "Logs:     docker compose -f docker-compose.prod.yml --env-file .env logs -f"
echo -e "Restart:  docker compose -f docker-compose.prod.yml --env-file .env restart"
echo -e "Stop:     docker compose -f docker-compose.prod.yml --env-file .env down"
echo ""
