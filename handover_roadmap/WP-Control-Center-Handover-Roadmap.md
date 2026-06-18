# HANDOVER NEXT STEPS - WP Control Center

## 1. Mục đích tài liệu
File này dùng để handover giai đoạn tiếp theo cho team phát triển sau khi đã có:
- PRD v1
- schema.prisma
- migration init
- openapi.yaml
- starter docs
- NestJS skeleton
- WordPress agent plugin skeleton

Mục tiêu của giai đoạn tiếp theo là chuyển từ scaffold sang backend và plugin có thể chạy thật.

---

## 2. Trạng thái hiện tại

### Đã có
- Product scope v1 cho WP Control Center
- Kiến trúc tổng thể: Next.js + NestJS + Worker + WordPress Agent Plugin
- Prisma schema v1
- Migration init
- OpenAPI v1
- Seed cơ bản
- NestJS app skeleton
- Worker skeleton
- WordPress plugin skeleton
- Bộ docs nền tảng

### Chưa hoàn thiện
- Auth thật
- Prisma service thật
- CRUD thực sự với database
- Queue BullMQ thật
- Remote actions thật
- HMAC/signature verification thật
- Google OAuth + GA4 + Search Console thật
- Uptime monitoring thật
- Notification channels thật
- Robots/.htaccess/php config execution thật
- QA automation
- Production deployment flow

---

## 3. Mục tiêu giai đoạn tiếp theo
Ưu tiên cao nhất là làm cho hệ thống đạt mức **usable internal alpha**.

### Alpha definition
Hệ thống được xem là đạt internal alpha khi:
1. Admin login được
2. Tạo site được
3. Kết nối 1 site WordPress qua agent được
4. Sync được core/plugin/theme inventory
5. Tạo job update plugin/theme/core được
6. Agent nhận job và trả kết quả được
7. Uptime check chạy mỗi 5 phút được
8. Audit log ghi dữ liệu thật
9. Dashboard đọc được dữ liệu thật từ database

---

## 4. Thứ tự triển khai khuyến nghị

### Phase A - Backend foundation
Mục tiêu: dựng backend thật để mọi module sau có nền ổn định.

#### Việc cần làm
1. Hoàn thiện env config
2. PrismaService
3. DatabaseModule
4. AuthModule thật
5. UserModule thật
6. Common error handling
7. Logging/interceptor/filter
8. DTO validation
9. RBAC cơ bản

#### Deliverables
- API chạy local ổn định
- connect PostgreSQL thật
- login/logout/me dùng được
- swagger hoặc openapi route đồng bộ

#### Definition of Done
- `pnpm dev` chạy được toàn bộ api
- Prisma migrate + seed chạy được
- có admin user mặc định
- ít nhất 5 endpoint auth/users chạy thật với DB

---

### Phase B - Sites & onboarding
Mục tiêu: cho phép thêm site và kết nối WordPress agent thật.

#### Việc cần làm
1. Site CRUD thật
2. Site settings CRUD
3. Site credentials storage + encryption
4. Generate connection token
5. Rotate secret
6. Register handshake giữa agent và backend
7. Heartbeat endpoint thật
8. Last seen / connection status update

#### Deliverables
- tạo site từ dashboard hoặc API
- plugin agent connect được vào backend
- site chuyển trạng thái connected

#### Definition of Done
- test thành công với 1 site WordPress local/staging
- register + heartbeat chạy thật
- secret được lưu encrypted
- audit log có record khi connect site

---

### Phase C - Inventory sync
Mục tiêu: backend đọc được dữ liệu WordPress thật.

#### Việc cần làm
1. Sync system info
2. Sync plugin list
3. Sync theme list
4. Sync core version
5. Upsert inventory data
6. Site overview aggregation query

#### Deliverables
- backend có inventory thật
- UI/API hiển thị plugin/theme/core chính xác

#### Definition of Done
- site detail trả về đúng plugin/theme/core
- update_available tính đúng
- sync lặp lại không tạo dữ liệu rác

---

### Phase D - Jobs & remote actions
Mục tiêu: có cơ chế job thật để thực thi lệnh từ xa.

#### Việc cần làm
1. BullMQ setup thật
2. Queue module
3. Jobs service
4. Job processor
5. Job logs
6. Remote dispatch to agent
7. HMAC signature verification
8. Timeout/retry/failure handling

#### Remote actions ưu tiên
1. update plugin
2. update theme
3. update core
4. activate plugin
5. deactivate plugin
6. delete plugin
7. delete theme
8. maintenance mode on/off

#### Deliverables
- job lifecycle đầy đủ: queued > running > success/fail
- agent execute được ít nhất 4 action đầu tiên

#### Definition of Done
- tạo job từ API được
- worker xử lý job thật
- plugin agent nhận request thật
- version được sync lại sau khi update
- log hiển thị được trên dashboard/API

---

### Phase E - Monitoring
Mục tiêu: site health và incident tracking thật.

#### Việc cần làm
1. Uptime checker worker
2. HTTP check mỗi 5 phút
3. Response time capture
4. Incident creation rule
5. Incident recovery rule
6. Monitoring overview query

#### Deliverables
- phát hiện site down
- tạo incident
- đóng incident khi recover

#### Definition of Done
- check ít nhất 1 lần / 5 phút
- down 2-3 lần liên tiếp thì mở incident
- recover thì close incident
- dashboard/API xem được lịch sử

---

### Phase F - Technical maintenance actions
Mục tiêu: hoàn thiện nhóm thao tác kỹ thuật ngoài update.

#### Việc cần làm
1. install plugin từ wp.org slug
2. clear cache abstraction
3. optimize database
4. robots.txt editor
5. .htaccess editor + snapshot
6. php config abstraction layer

#### Lưu ý
- `.htaccess` phải snapshot trước khi ghi
- `php.ini` không cam kết sửa full mọi môi trường
- clear cache nên hỗ trợ theo adapter, không hardcode một kiểu

#### Deliverables
- nhóm action kỹ thuật cơ bản dùng được

#### Definition of Done
- mỗi action có pre-check
- mỗi action có log
- failure không làm crash agent/site

---

### Phase G - Analytics
Mục tiêu: traffic cơ bản cho từng site.

#### Việc cần làm
1. Google OAuth flow
2. integration account storage
3. map GA4 property vào site
4. map Search Console property vào site
5. sync analytics_daily
6. sync top_pages_daily
7. analytics overview endpoint

#### Deliverables
- sessions/users/pageviews
- impressions/clicks/ctr/avg_position
- top pages cơ bản

#### Definition of Done
- ít nhất 1 site connect GA4 + GSC thành công
- sync dữ liệu 7/30 ngày
- site analytics API trả dữ liệu thật

---

## 5. Backlog ưu tiên thực tế

### P0 - phải làm trước
- PrismaService
- Auth thật
- Site CRUD thật
- Agent register + heartbeat
- Inventory sync
- BullMQ thật
- update plugin/theme/core
- activate/deactivate plugin
- uptime monitor
- audit log

### P1 - làm ngay sau P0
- delete plugin/theme
- maintenance mode
- install plugin from slug
- robots.txt editor
- .htaccess editor
- clear cache
- optimize database

### P2
- GA4
- Search Console
- analytics dashboard

### P3
- php config abstraction
- notification channels
- SSL/domain expiry
- page speed
- cron health
- disk usage
- PHP logs

---

## 6. Rủi ro kỹ thuật cần lưu ý

### 6.1 Update từ xa
Rủi ro:
- timeout
- thiếu permission filesystem
- plugin conflict
- site bị maintenance treo

Giảm rủi ro:
- timeout cứng
- log rõ
- snapshot/trạng thái trước action
- retry có kiểm soát
- idempotent jobs

### 6.2 .htaccess và robots.txt
Rủi ro:
- ghi sai file
- rewrite sai
- hỏng SEO/canonical

Giảm rủi ro:
- snapshot trước khi ghi
- validate cơ bản
- restore flow

### 6.3 php config
Rủi ro:
- không phải hosting nào cũng cho sửa
- vị trí config không đồng nhất

Giảm rủi ro:
- chỉ hỗ trợ abstraction config
- detect unsupported environment
- báo rõ unsupported

### 6.4 Agent security
Rủi ro:
- lộ secret
- replay request
- fake job callback

Giảm rủi ro:
- HMAC signature
- timestamp + nonce
- rotate secret
- reject expired request

---

## 7. Đề xuất phân công team

### Backend dev
- Prisma + NestJS modules
- auth
- jobs
- monitoring
- integrations

### WordPress/PHP dev
- plugin agent
- WordPress filesystem actions
- updater handlers
- maintenance/file editors

### Frontend dev
- sites pages
- site detail tabs
- jobs UI
- monitoring UI
- analytics UI

### QA
- onboarding test
- update test
- failure/retry test
- monitoring incident test
- file edit safety test

### DevOps
- docker compose
- env secrets
- postgres/redis
- nginx reverse proxy
- backup DB
- deploy pipeline

---

## 8. Checklist handover cho dev team

### Trước khi code
- đọc PRD
- đọc SYSTEM_ARCHITECTURE
- đọc WORDPRESS_AGENT_SPEC
- đọc JOB_SYSTEM
- đọc SECURITY_MODEL
- đọc schema.prisma
- đọc openapi.yaml

### Trước khi merge feature
- có migration nếu đổi schema
- có update docs nếu đổi contract
- có test manual checklist
- có audit log nếu là action nhạy cảm
- có error handling
- có retry/timeout nếu là remote action

---

## 9. Checklist handover cho PM
- scope release 1 chốt rõ
- không nhét analytics vào trước khi P0 xong
- không mở rộng sang multi-tenant
- không cho thêm content management ở phase này
- mọi feature mới phải map vào backlog P0/P1/P2/P3

---

## 10. Gợi ý milestone giao hàng

### Milestone 1
- auth + site CRUD + agent connect

### Milestone 2
- inventory sync + site detail usable

### Milestone 3
- jobs + update actions usable

### Milestone 4
- monitoring usable

### Milestone 5
- technical maintenance actions usable

### Milestone 6
- analytics usable

---

## 11. File cần mở tiếp nếu làm tiếp
- `packages/database/prisma/schema.prisma`
- `packages/database/prisma/seed.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/*`
- `apps/worker/src/*`
- `wordpress-agent/plugin/wp-control-center-agent.php`
- `wordpress-agent/plugin/includes/*`
- `docs/api/openapi.yaml`

---

## 12. Kết luận
Thứ tự đúng để tránh làm loạn dự án là:

1. backend foundation
2. site onboarding
3. inventory sync
4. jobs engine
5. remote actions
6. monitoring
7. maintenance tools
8. analytics

Không nên làm analytics hoặc file editing sâu trước khi jobs engine và agent auth chạy ổn.
