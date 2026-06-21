# Danh mục tính năng và review dự án WP Control Center

**Ngày rà soát:** 2026-06-21  
**Nhánh:** `fix/ci-and-production-blockers`  
**Nguồn xác minh:** code trong `apps/`, `packages/`, `wordpress-agent/`, Prisma schema, migration và các lệnh build/lint/test hiện tại.

## 1. Kết luận nhanh

Dự án đang ở giai đoạn **MVP mở rộng / hardening**, chưa production-ready. Luồng đăng nhập, thêm site, kết nối agent, đồng bộ inventory, điều phối remote action, uptime, analytics, diagnostics, performance và backup đã có code thực. Tuy nhiên worker hiện không compile, web lint chưa sạch, heartbeat chủ động của agent chưa được triển khai và một số chức năng vẫn là backend-only hoặc stub.

### Quy ước trạng thái

- **Hoàn chỉnh:** Có luồng sử dụng chính từ UI/API đến dữ liệu hoặc agent và không thấy stub trực tiếp.
- **Một phần:** Có code thật nhưng thiếu UI, thiếu delivery, phụ thuộc cấu hình ngoài hoặc còn giới hạn vận hành.
- **Khung/stub:** Endpoint, model hoặc giao diện tồn tại nhưng chưa thực hiện nghiệp vụ đầy đủ.
- **Blocker:** Lỗi đang chặn build, CI hoặc khả năng vận hành chính.

## 2. Kiến trúc sản phẩm

| Thành phần | Vai trò |
|---|---|
| `apps/web` | Dashboard Next.js cho admin |
| `apps/api` | REST API NestJS, JWT/RBAC, CRUD và tạo job |
| `apps/worker` | BullMQ consumer, uptime/analytics/diagnostics/SSL/PageSpeed scheduler |
| `packages/database` | Prisma Client, PostgreSQL schema, migration, seed và rotate encryption key |
| `packages/shared` | AES-GCM, hash/verify password và kiểu dùng chung |
| `wordpress-agent` | Plugin WordPress nhận lệnh HMAC và thực thi tác vụ tại site |
| Redis | Queue `jobs` cho remote action |
| PostgreSQL | Lưu user, site, inventory, job, incident, analytics, audit, backup và integration |

Luồng chính:

```text
Admin Dashboard -> NestJS API -> PostgreSQL
                         |
                         v
                    Redis/BullMQ -> Worker -> WordPress Agent -> WordPress
                         |
                         +-> Google APIs / PageSpeed / website uptime
```

## 3. Toàn bộ tính năng hiện có

### 3.1 Xác thực và phân quyền

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Login email/password | Hoàn chỉnh | UI login, kiểm tra password hash, phát JWT, chuyển vào trang Sites |
| Lấy user hiện tại | Hoàn chỉnh ở API | `GET /api/auth/me` kiểm tra user còn active |
| Forgot/reset password | Một phần | Token hash, hạn 1 giờ, dùng một lần; chưa có UI và chưa gửi email production |
| RBAC 4 cấp | Hoàn chỉnh ở API | `SUPER_ADMIN > ADMIN > OPERATOR > VIEWER` |
| CRUD user | Một phần | Có API tạo/xem/sửa/xóa và hash password; chưa có UI quản trị user |
| Logout | Một phần | UI xóa JWT local; chưa có server-side session/revocation |

### 3.2 Quản lý website và onboarding agent

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Danh sách site | Hoàn chỉnh | Bảng site, domain, environment, WP/PHP version, connection status |
| Dashboard tổng quan site | Hoàn chỉnh | Tổng site, connected và pending |
| Thêm site | Hoàn chỉnh | Tạo site, setting mặc định, public key, secret và one-time connection token |
| Sửa/xóa/disable site | Một phần | API sửa/xóa có sẵn; UI chưa có form sửa/xóa/disable |
| Environment | Hoàn chỉnh | `PRODUCTION`, `STAGING`, `DEVELOPMENT` |
| Connection status | Hoàn chỉnh về dữ liệu | `PENDING`, `CONNECTED`, `DISCONNECTED`, `ERROR` |
| Kết nối plugin agent | Hoàn chỉnh | Form trong wp-admin gọi `/api/agent/register`, backend xác minh token và trả site ID/secret |
| Ngắt kết nối agent | Một phần | Plugin xóa credential local; backend chưa được thông báo để đổi trạng thái ngay |
| Tạo lại connection token | Một phần | Có API, chưa có UI |
| Rotate agent secret | Một phần | Có API, chưa có UI và chưa có handshake cập nhật secret tại agent |
| Heartbeat agent -> server | Khung/stub | API nhận heartbeat có sẵn nhưng `WPCC_Agent_Heartbeat::schedule()` đang rỗng |

### 3.3 Inventory WordPress

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Đồng bộ system info | Hoàn chỉnh | WP version, PHP version, agent version, timezone, last seen |
| Đồng bộ plugin | Hoàn chỉnh | Tên, slug/file, version hiện tại/mới nhất, active, auto-update, update available |
| Đồng bộ theme | Hoàn chỉnh | Tên, slug, version, active và update available |
| Đồng bộ WordPress core | Hoàn chỉnh | Version hiện tại/mới nhất và update available |
| Resync thủ công | Hoàn chỉnh | UI và API gọi agent, upsert inventory, xóa item không còn cài |
| Trang inventory theo site | Hoàn chỉnh | Overview, plugins, themes và core tab |

### 3.4 Remote WordPress operations

Các tác vụ dưới đây đi qua API -> PostgreSQL job -> Redis -> worker -> WordPress agent bằng HMAC SHA-256.

| Tác vụ | Backend/agent | UI |
|---|---|---|
| Update plugin | Có | Chưa có nút thao tác |
| Activate plugin | Có | Chưa có nút thao tác |
| Deactivate plugin | Có | Chưa có nút thao tác |
| Install plugin từ WordPress.org slug | Có | Có |
| Delete plugin | Có | Chưa có nút thao tác |
| Update theme | Có | Chưa có nút thao tác |
| Delete theme | Có | Chưa có nút thao tác |
| Update WordPress core | Có | Chưa có nút thao tác |
| Bật/tắt maintenance mode | Có | Chưa có control trực tiếp |
| Clear cache | Có | Có |
| Optimize database | Có | Có |
| Sửa `robots.txt` | Có | Có editor |
| Sửa `.htaccess` | Có, tạo backup file | Có editor |
| Sửa PHP config qua `.user.ini` | Có, whitelist setting | Có memory limit control |

Sau remote action thành công, worker ghi job result, audit log, snapshot cấu hình khi phù hợp và resync inventory.

### 3.5 Job queue và lịch sử thực thi

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Tạo job remote action | Hoàn chỉnh | Lưu type, target, payload, người khởi tạo và thời điểm queue |
| Job status | Hoàn chỉnh | `QUEUED`, `RUNNING`, `SUCCESS`, `FAILED`, `CANCELED`, `TIMED_OUT` |
| Job log | Hoàn chỉnh | Log level, message, context và timestamp |
| Danh sách/chi tiết job | Hoàn chỉnh | Có API và tab Jobs trên trang site |
| Retry job failed | Hoàn chỉnh ở nghiệp vụ | Reset DB job và enqueue lại |
| Cancel job | Hoàn chỉnh ở nghiệp vụ | Đổi trạng thái và xóa BullMQ attempt best-effort |
| Auto retry/backoff worker | Blocker | Cấu hình đang đặt sai trong `WorkerOptions`, khiến worker không compile |

### 3.6 Uptime, incident và monitoring

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| HTTP uptime check | Hoàn chỉnh ở code | Mặc định mỗi 5 phút, timeout 15 giây |
| Response time/status code | Hoàn chỉnh | Lưu từng lần check |
| Tạo incident khi down | Hoàn chỉnh | Mở incident sau 3 lần fail liên tiếp |
| Auto resolve incident | Hoàn chỉnh | Resolve khi site hoạt động trở lại |
| Uptime ratio 24 giờ | Hoàn chỉnh | API và UI theo site |
| Monitoring overview | Hoàn chỉnh ở API | Tổng site active, incident open, trạng thái gần nhất |
| Incident history | Hoàn chỉnh | API và UI theo site |

### 3.7 Notification

| Kênh | Trạng thái | Ghi chú |
|---|---|---|
| Webhook | Hoàn chỉnh ở code | POST JSON khi incident mở/đóng |
| Slack | Hoàn chỉnh ở code | Gửi webhook text |
| Discord | Hoàn chỉnh ở code | Gửi webhook text |
| Telegram | Hoàn chỉnh ở code | Dùng định dạng `botToken:chatId` |
| Email | Khung/stub | Chỉ log mô phỏng nhưng hiện được ghi là `SENT` |
| CRUD channel | Hoàn chỉnh | UI thêm/xóa, API có update và enable/disable |
| Delivery history | Hoàn chỉnh | UI hiển thị event gần nhất và trạng thái |

### 3.8 Google, GA4 và Search Console

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Google OAuth | Hoàn chỉnh, phụ thuộc env | Authorization URL, code exchange, token encryption, refresh token |
| Danh sách GA4 properties | Hoàn chỉnh, phụ thuộc Google API | Đọc Analytics Admin API |
| Danh sách GSC sites | Hoàn chỉnh, phụ thuộc Google API | Đọc Webmasters API |
| Map property vào site | Hoàn chỉnh | Lưu account, GA4 property và GSC site identifier |
| Sync GA4 | Hoàn chỉnh ở worker | Sessions, users, pageviews và top pages theo giờ |
| Sync GSC | Hoàn chỉnh ở worker | Clicks, impressions, CTR, position và pages theo giờ |
| Dashboard analytics | Hoàn chỉnh | Chọn 7/30/90 ngày, traffic trend và top pages |
| Endpoint site analytics cũ | Khung/stub | `GET /api/sites/:id/analytics` vẫn trả `summary: {}`; UI dùng module `/api/analytics/...` mới |
| Endpoint attach integration cũ | Khung/stub | Chỉ echo request, không lưu dữ liệu |

### 3.9 Diagnostics và hạ tầng website

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Disk usage | Hoàn chỉnh | Agent thu thập total/free/used, API/worker lưu và UI hiển thị |
| Disk incident | Hoàn chỉnh ở code | Cảnh báo khi dùng từ 90% và auto resolve |
| WP-Cron health | Hoàn chỉnh | Phát hiện job trễ trên 5 phút, giới hạn 50 mục |
| PHP error log | Hoàn chỉnh | Đọc số dòng yêu cầu từ agent và hiển thị trên UI |
| SSL expiry | Hoàn chỉnh ở code | Kiểm tra mỗi 12 giờ, lưu issuer/expiry/status và tạo incident |
| Domain expiry | Chưa triển khai | Tên hàm worker có nhắc domain nhưng code chỉ kiểm tra SSL |

### 3.10 Performance và Core Web Vitals

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| PageSpeed audit thủ công | Hoàn chỉnh, phụ thuộc Google API | API gọi PageSpeed và lưu kết quả |
| PageSpeed audit định kỳ | Hoàn chỉnh ở worker | Mỗi 24 giờ, chạy sau startup 1 phút |
| Điểm Lighthouse | Hoàn chỉnh | Performance, accessibility, best practices, SEO |
| LCP và CLS | Hoàn chỉnh | Lưu lịch sử tối đa 30 bản trên API |
| INP | Sai nhãn/giá trị | Hiện lấy audit `interactive` (TTI) rồi lưu vào `inpMs`, không phải INP thực |

### 3.11 Backup và restore

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Database backup | Hoàn chỉnh ở code | Agent dump database và đóng gói |
| Files backup | Hoàn chỉnh ở code | Agent đóng gói file WordPress |
| Full backup | Hoàn chỉnh ở code | Database + files |
| Tải backup về backend | Hoàn chỉnh | Worker tải file và xóa bản tạm tại agent |
| Download backup | Hoàn chỉnh | API stream file, UI tải xuống |
| Restore backup | Hoàn chỉnh ở code | Backend upload file lại agent và gọi restore |
| Xóa backup | Hoàn chỉnh | Xóa file local và DB record |
| Storage production | Một phần | Lưu local filesystem, chưa có object storage/retention/distributed storage |

### 3.12 Audit và maintenance history

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Audit remote action | Hoàn chỉnh | Ghi success/failure, site, entity và payload kết quả |
| Audit resync | Hoàn chỉnh | Ghi success/failure |
| Audit API toàn hệ thống | Hoàn chỉnh | Filter site/action, giới hạn 200 |
| Audit UI | Một phần | Có tab theo từng site; chưa có trang audit toàn hệ thống |
| Maintenance snapshot | Hoàn chỉnh ở dữ liệu | Lưu robots, htaccess hoặc PHP config sau khi sửa thành công |

### 3.13 WordPress agent admin

| Tính năng | Trạng thái | Phạm vi hiện tại |
|---|---|---|
| Trang WPCC Agent trong wp-admin | Hoàn chỉnh | Kết nối/ngắt kết nối và hiển thị site ID/API URL/version |
| Nonce và capability | Hoàn chỉnh | Form dùng WordPress nonce và `manage_options` |
| HMAC request validation | Hoàn chỉnh | Kiểm tra timestamp 5 phút và `hash_equals` |
| REST register local | Không an toàn/stub | Route public chỉ đặt option `connected=true`; không dùng handshake token |
| Agent heartbeat scheduler | Khung/stub | Class tồn tại nhưng method `schedule()` rỗng và chưa được boot |

## 4. API modules hiện có

API hiện chia thành 13 nhóm nghiệp vụ:

1. `auth`
2. `users`
3. `sites`
4. `agent`
5. `jobs`
6. `monitoring`
7. `audit`
8. `notifications`
9. `integrations`
10. `analytics`
11. `diagnostics`
12. `performance`
13. `backups`

## 5. Review kỹ thuật: vấn đề cần ưu tiên

### P1 — Blocker trước khi production

1. **Worker không compile.** `apps/worker/src/index.ts` truyền `attempts` và `backoff` vào `WorkerOptions`; đây là job options. Hậu quả: `npm run build -w apps/worker` fail và `npm run build:all` không thể hoàn tất.
2. **Heartbeat agent chưa chạy.** `wordpress-agent/plugin/includes/class-heartbeat.php` chỉ có method rỗng và loader không schedule heartbeat. `lastSeenAt`/connection freshness vì thế phụ thuộc resync thủ công, không đúng yêu cầu monitoring chủ động.
3. **Cấu hình auth phía browser chưa phù hợp production.** JWT lưu trong `localStorage`, trong khi API mở CORS cho mọi origin. Cần giới hạn origin và cân nhắc HttpOnly/SameSite cookie hoặc CSP mạnh trước khi public Internet.

### P2 — Correctness và độ tin cậy

1. **Web lint fail 2 lỗi** tại `apps/web/app/sites/[id]/page.tsx`: `fetchJobs` và `fetchAuditLogs` được dùng trước khi khai báo theo rule React hooks immutability.
2. **Email notification tạo cảm giác gửi thành công sai.** Worker chỉ log simulation nhưng đánh dấu event `SENT`.
3. **Backup không ràng buộc backup với site trên path.** Restore/delete/download tìm backup chỉ bằng `backupId`, không kiểm tra `backup.siteId === siteId`.
4. **Chỉ số INP không đúng.** Code đọc Lighthouse audit `interactive` (Time to Interactive) rồi lưu vào cột `inpMs`.
5. **Hai endpoint legacy là stub.** `/sites/:id/analytics` trả object rỗng và `/sites/:id/integrations/:provider` chỉ echo body.
6. **Forgot password chưa có delivery production.** Token chỉ được trả trong development/test; production không gửi email nên người dùng không thể hoàn tất luồng.
7. **Agent REST `/register` public có side effect.** Bất kỳ request nào cũng có thể đặt trạng thái local `connected=true`, dù route này không phải handshake đang dùng trong wp-admin.

### P3 — Hoàn thiện sản phẩm

1. Thiếu UI cho user management, edit/delete site, rotate secret/token và nhiều remote action đã có backend.
2. Backup dùng local filesystem, chưa có retention policy, quota, object storage và chiến lược multi-instance.
3. README cũ là template Next.js; đã được thay bằng README mô tả đúng hệ thống trong lần rà soát này.
4. Test coverage còn mỏng: 5 API unit tests, chưa có worker test, PHP agent test hay integration test giữa API-worker-agent.

## 6. Kết quả kiểm tra ngày 2026-06-21

| Kiểm tra | Kết quả |
|---|---|
| `npm run build -w apps/web` | Pass |
| `npm run typecheck -w apps/web` | Pass |
| `npm run typecheck -w apps/api` | Pass |
| `npm run lint -w apps/api` | Pass |
| `npm run test -w apps/api` | Pass, 5/5 tests |
| `npm run lint -w apps/web` | Fail, 2 lỗi |
| `npm run build -w apps/worker` | Fail, `attempts` không thuộc `WorkerOptions` |
| `npm run build:all` | Fail tại web trong sandbox; web build riêng ngoài sandbox pass, nhưng build tổng vẫn sẽ bị chặn ở worker |
| E2E Playwright | Chưa chạy; cần API, DB, Redis và web runtime |

## 7. Đề xuất thứ tự xử lý

1. Sửa worker build và chuyển retry/backoff thành default job options tại queue producer.
2. Sửa web lint để CI sạch.
3. Triển khai heartbeat scheduler và đồng bộ trạng thái connect/disconnect.
4. Khóa CORS, hoàn thiện session/token security và password reset delivery.
5. Sửa backup site ownership, INP metric và email delivery.
6. Xóa hoặc triển khai dứt điểm endpoint stub.
7. Bổ sung test worker, agent HMAC, remote action và E2E API-worker-agent.
8. Hoàn thiện UI cho các API backend-only.
