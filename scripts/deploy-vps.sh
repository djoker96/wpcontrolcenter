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

env_value() {
  local key="$1"
  local line
  line=$(grep -E "^${key}=" "$DEPLOY_DIR/.env" | tail -n 1 || true)
  line="${line#*=}"
  line="${line%\"}"
  line="${line#\"}"
  line="${line%\'}"
  line="${line#\'}"
  printf '%s' "$line"
}

is_placeholder() {
  case "$1" in
    *change-this*|*replace-with*|*your-domain*|*domain-cua-ban*|*example.com*|*localhost*|*dummy-token*)
      return 0
      ;;
  esac
  return 1
}

require_real_env() {
  local key="$1"
  local value
  value=$(env_value "$key")

  if [ -z "$value" ]; then
    log_err "$key đang trống trong .env"
    return 1
  fi

  if is_placeholder "$value"; then
    log_err "$key vẫn là giá trị mẫu/placeholder trong .env"
    return 1
  fi

  return 0
}

validate_env_file() {
  log_info "Validate production .env..."

  local failed=0
  local required_keys=(
    POSTGRES_USER
    POSTGRES_PASSWORD
    POSTGRES_DB
    JWT_SECRET
    AGENT_ENCRYPTION_KEY
    SEED_ADMIN_EMAIL
    SEED_ADMIN_PASSWORD
    NEXT_PUBLIC_API_URL
    CLOUDFLARE_TUNNEL_TOKEN
  )

  for key in "${required_keys[@]}"; do
    require_real_env "$key" || failed=1
  done

  local postgres_password jwt_secret encryption_key api_url cors_origin
  postgres_password=$(env_value POSTGRES_PASSWORD)
  jwt_secret=$(env_value JWT_SECRET)
  encryption_key=$(env_value AGENT_ENCRYPTION_KEY)
  api_url=$(env_value NEXT_PUBLIC_API_URL)
  cors_origin=$(env_value CORS_ORIGIN)

  if [ "${#postgres_password}" -lt 16 ]; then
    log_err "POSTGRES_PASSWORD nên dài tối thiểu 16 ký tự."
    failed=1
  fi

  if [ "${#jwt_secret}" -lt 32 ]; then
    log_err "JWT_SECRET phải dài tối thiểu 32 ký tự."
    failed=1
  fi

  if ! [[ "$encryption_key" =~ ^[0-9a-fA-F]{64}$ ]]; then
    log_err "AGENT_ENCRYPTION_KEY phải là 64 ký tự hex. Tạo bằng: openssl rand -hex 32"
    failed=1
  fi

  if ! [[ "$api_url" =~ ^https://.+/api$ ]]; then
    log_err "NEXT_PUBLIC_API_URL phải dùng HTTPS và kết thúc bằng /api."
    failed=1
  fi

  if [ -n "$cors_origin" ]; then
    if is_placeholder "$cors_origin" || ! [[ "$cors_origin" =~ ^https://.+ ]]; then
      log_err "CORS_ORIGIN phải là HTTPS origin thật, ví dụ https://app.example.com"
      failed=1
    fi
  fi

  if [ "$failed" -ne 0 ]; then
    log_err "Dừng deploy vì .env chưa đạt điều kiện staging/production."
    exit 1
  fi

  log_ok ".env hợp lệ cho staging/production."
}

compose() {
  docker compose -f docker-compose.prod.yml --env-file .env "$@"
}

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
  git pull --ff-only
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
validate_env_file

# === 6. Pull latest images & rebuild ===
log_info "Kéo image và build services..."
cd "$DEPLOY_DIR"
compose pull
compose build

# === 7. Database migrations ===
log_info "Chạy database migrations..."

# Khởi động postgres và redis trước
compose up -d postgres redis

# Đợi postgres sẵn sàng (thay vì sleep cứng)
log_info "Đợi PostgreSQL sẵn sàng..."
for i in {1..30}; do
  if compose exec -T postgres sh -c 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"' >/dev/null 2>&1; then
    log_ok "PostgreSQL sẵn sàng."
    break
  fi
  if [ "$i" -eq 30 ]; then
    log_err "PostgreSQL không khởi động được. Kiểm tra logs:"
    compose logs postgres --tail=20
    exit 1
  fi
  sleep 2
done

# Chạy migration — schema ở packages/database/prisma/schema.prisma
log_info "Chạy Prisma migrations..."
compose run --rm api sh -c "cd packages/database && npx prisma migrate deploy"
log_ok "Database migrations hoàn tất."

if [ "$(env_value RUN_SEED)" = "true" ]; then
  log_info "RUN_SEED=true, chạy seed dữ liệu staging..."
  compose run --rm api sh -c "cd packages/database && npm run seed"
  log_ok "Seed dữ liệu hoàn tất."
else
  log_warn "Bỏ qua seed vì RUN_SEED không phải true. Để seed staging, đặt RUN_SEED=true trong .env."
fi

# === 8. Start all services ===
log_info "Khởi động tất cả services..."
compose up -d

# === 9. Verify ===
log_info "Kiểm tra trạng thái..."
sleep 10
compose ps

# Kiểm tra service đang chạy
required_services=(postgres redis api worker web nginx cloudflared)
running_services=$(compose ps --services --status running)
missing_services=()

for service in "${required_services[@]}"; do
  if ! printf '%s\n' "$running_services" | grep -qx "$service"; then
    missing_services+=("$service")
  fi
done

if [ "${#missing_services[@]}" -gt 0 ]; then
  log_err "Các service chưa ở trạng thái running: ${missing_services[*]}"
  compose logs "${missing_services[@]}" --tail=120
  exit 1
fi

log_ok "Tất cả service bắt buộc đang running."

log_info "Kiểm tra nginx gateway nội bộ..."
if compose exec -T nginx wget -qO- http://localhost >/dev/null 2>&1; then
  log_ok "Nginx gateway phản hồi nội bộ."
else
  log_err "Nginx gateway chưa phản hồi. Logs gần nhất:"
  compose logs nginx web api --tail=120
  exit 1
fi

public_url="$(env_value NEXT_PUBLIC_API_URL)"
public_url="${public_url%/api}"

echo ""
echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}  Deploy hoàn tất!${NC}"
echo -e "${GREEN}==============================================${NC}"
echo ""
echo -e "Truy cập: ${public_url}"
echo -e "Logs:     docker compose -f docker-compose.prod.yml --env-file .env logs -f"
echo -e "Restart:  docker compose -f docker-compose.prod.yml --env-file .env restart"
echo -e "Stop:     docker compose -f docker-compose.prod.yml --env-file .env down"
echo ""
