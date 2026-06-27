#!/usr/bin/env bash
# ======================================================
# Hướng dẫn tạo Cloudflare Tunnel token
# Chạy TRÊN MÁY CỦA BẠN (local), không phải VPS
# Yêu cầu: đã cài cloudflared (https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
# ======================================================
#
# Các bước thực hiện:
#   1. Đăng nhập Cloudflare Dashboard
#   2. Vào Zero Trust → Networks → Tunnels
#   3. Create a tunnel → Chọn cloudflared
#   4. Đặt tên tunnel (vd: wpcc-tunnel)
#   5. Cấu hình Public hostname: domain-cua-ban.com → service: http://nginx:80
#   6. Save → Copy tunnel token
#   7. Dán token vào file .env (CLOUDFLARE_TUNNEL_TOKEN)
#
# Script này sẽ giúp cài cloudflared local để tạo tunnel (nếu bạn muốn dùng CLI)
# ======================================================

set -euo pipefail

echo ""
echo "Cloudflare Tunnel Setup"
echo "======================="
echo ""
echo "Cách 1: Dùng Dashboard (dễ nhất)"
echo "--------------------------------"
echo "1. Vào https://dash.cloudflare.com/ → Zero Trust"
echo "2. Networks → Tunnels → Create a tunnel"
echo "3. Chọn cloudflared → Đặt tên → Save"
echo "4. Trong tab Public Hostname:"
echo "   - Subdomain: (để trống hoặc www)"
echo "   - Domain: domain-cua-ban.com"
echo "   - Path: (để trống)"
echo "   - Service: HTTP://nginx:80"
echo "5. Save tunnel"
echo "6. Copy tunnel token (dạng: eyJhIjoi...) và dán vào .env"
echo ""
echo "Cách 2: Dùng CLI (advanced)"
echo "----------------------------"
echo "Cài cloudflared local:"
echo "  brew install cloudflared          # macOS"
echo "  sudo apt install cloudflared      # Linux (có repo)"
echo "  # Hoặc download từ: https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/"
echo ""
echo "  cloudflared tunnel login          # Đăng nhập browser"
echo "  cloudflared tunnel create wpcc    # Tạo tunnel"
echo "  # Copy token từ output hoặc ~/.cloudflared/<tunnel-id>.json"
echo ""
echo "Sau đó dán token vào: CLOUDFLARE_TUNNEL_TOKEN trong .env"
echo ""
