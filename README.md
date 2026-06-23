# WP Control Center

WP Control Center là hệ thống quản trị tập trung cho nhiều website WordPress. Hệ thống gồm dashboard Next.js, API NestJS, worker BullMQ, PostgreSQL/Prisma, Redis và plugin agent cài trên từng website WordPress.

## Khả năng chính

- Đăng nhập và phân quyền `SUPER_ADMIN`, `ADMIN`, `OPERATOR`, `VIEWER` ở API.
- Thêm website, tạo connection token và kết nối plugin agent.
- Đồng bộ WordPress core, plugin, theme và thông tin hệ thống.
- Chạy tác vụ từ xa qua queue: update, activate/deactivate, cài/xóa plugin, update/xóa theme, update core, maintenance mode, clear cache, tối ưu database và sửa file cấu hình.
- Uptime monitoring, incident, audit log và thông báo qua webhook, Slack, Discord, Telegram.
- Kết nối Google OAuth, GA4 và Google Search Console.
- Diagnostics: dung lượng đĩa, WP-Cron, PHP log, SSL.
- PageSpeed/Lighthouse history.
- Backup/restore database, files hoặc full site.

Danh mục đầy đủ, mức độ hoàn thiện và kết quả review mới nhất nằm tại [Markdown/feature_inventory_and_review.md](Markdown/feature_inventory_and_review.md).

## Cấu trúc

```text
apps/web          Next.js dashboard
apps/api          NestJS REST API
apps/worker       BullMQ jobs và background schedulers
packages/database Prisma schema, migration, seed
packages/shared   Crypto và kiểu dùng chung
wordpress-agent   Plugin agent cho WordPress
```

## Chạy local

```bash
npm install
docker compose up -d
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:api
npm run dev:web
npm run dev:worker
```

Sao chép `.env.example` thành `.env` và cấu hình tối thiểu `DATABASE_URL`, `REDIS_HOST`, `REDIS_PORT`, `JWT_SECRET`, `AGENT_ENCRYPTION_KEY` trước khi chạy.

## Kiểm tra

```bash
npm run build:all
npm run lint -w apps/api
npm run lint -w apps/web
npm run test -w apps/api
npm run typecheck -w apps/api
npm run typecheck -w apps/web
```

> Trạng thái ngày 2026-06-21: web và API build/typecheck được; API test pass; worker build và web lint đang có blocker được mô tả trong tài liệu review.
