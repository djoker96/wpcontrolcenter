# PRD - WP Control Center

## 1. Tổng quan sản phẩm

### 1.1 Mục tiêu
Xây dựng một hệ thống web quản trị tập trung dành cho nhiều website WordPress, giúp quản trị viên vận hành, theo dõi và bảo trì website mà không cần đăng nhập vào từng wp-admin riêng lẻ.

### 1.2 Vấn đề cần giải quyết
Hiện tại việc quản trị nhiều website WordPress thường gặp các vấn đề sau:

- phải đăng nhập vào từng website riêng lẻ
- khó theo dõi website nào đang lỗi, down, hoặc cần update
- thao tác nâng cấp plugin/theme/core mất thời gian
- thiếu lịch sử thao tác tập trung
- theo dõi traffic và trạng thái vận hành bị phân tán ở nhiều nền tảng

### 1.3 Giải pháp
Tạo một dashboard trung tâm kết nối với từng website WordPress qua plugin agent riêng. Dashboard này nhận dữ liệu, hiển thị trạng thái, gửi lệnh cập nhật và quản trị từ xa.

## 2. Mục tiêu sản phẩm

### 2.1 Mục tiêu chính
- Quản trị nhiều website WordPress từ một dashboard
- Không cần vào wp-admin của từng website cho các tác vụ kỹ thuật phổ biến
- Giảm thời gian bảo trì và update
- Tăng khả năng giám sát uptime / downtime
- Có lịch sử thao tác rõ ràng

### 2.2 Non-goals ở MVP
- Không quản lý post/page/media/comments
- Không quản lý WooCommerce
- Không backup/restore
- Không multi-tenant
- Không client portal
- Không mobile app
- Không security suite nâng cao

## 3. Đối tượng sử dụng
- Admin kỹ thuật
- Người vận hành website
- Chủ hệ thống quản nhiều WordPress site

## 4. Phạm vi MVP

### 4.1 Chức năng bắt buộc
1. Authentication cơ bản
2. CRUD website cần quản trị
3. Kết nối website thông qua plugin agent
4. Đồng bộ thông tin core, plugin, theme
5. Cập nhật core/plugin/theme từ dashboard
6. Activate/deactivate plugin
7. Cài plugin mới
8. Xóa plugin/theme
9. Maintenance mode
10. Clear cache
11. Database optimize
12. Chỉnh sửa robots.txt
13. Chỉnh sửa .htaccess
14. Chỉnh sửa php.ini hoặc PHP config được plugin cho phép
15. Uptime monitor mỗi 5 phút
16. Dashboard traffic cơ bản từ GA4
17. Search Console overview cơ bản
18. Audit log
19. Notification cơ bản

### 4.2 Chức năng hoãn sang phase sau
- SSL expiry
- domain expiry
- page speed
- cron health
- disk usage
- PHP errors/logs
- backup/restore
- security hardening
- vulnerability scan
- multi-tenant

## 5. Use cases chính

### 5.1 Quản trị site
- Admin thêm website mới vào hệ thống
- Admin cài plugin agent vào website WordPress
- Site được kết nối và đồng bộ dữ liệu ban đầu

### 5.2 Quản trị update
- Admin xem website nào có plugin/theme/core cần update
- Admin update từng item hoặc nhiều item
- Hệ thống ghi nhận kết quả và log

### 5.3 Vận hành kỹ thuật từ xa
- Admin bật/tắt plugin
- Admin cài plugin từ file zip hoặc slug từ WordPress repo
- Admin xóa plugin/theme
- Admin bật maintenance mode
- Admin clear cache
- Admin optimize database
- Admin chỉnh sửa robots.txt / .htaccess / php.ini theo phạm vi cho phép

### 5.4 Giám sát
- Hệ thống kiểm tra uptime mỗi 5 phút
- Hệ thống tạo incident khi website down
- Hệ thống gửi cảnh báo khi có sự cố

### 5.5 Theo dõi traffic
- Admin xem sessions, users, pageviews
- Admin xem top pages và click/impression cơ bản từ Search Console

## 6. Yêu cầu chức năng chi tiết

### 6.1 Authentication
- Login bằng email/password
- Forgot password
- Session management

### 6.2 Site management
- Thêm site
- Sửa site
- Xóa / disable site
- Gán tag
- Lưu thông tin domain, environment, connection status

### 6.3 Agent connection
- Tạo token kết nối
- Plugin agent register về hệ thống
- Đồng bộ heartbeat
- Đồng bộ inventory core/plugin/theme

### 6.4 WordPress operations
- Update WordPress core
- Update plugin
- Update theme
- Activate/deactivate plugin
- Install plugin
- Delete plugin/theme
- Maintenance mode on/off
- Clear cache
- Database optimize
- Edit robots.txt
- Edit .htaccess
- Edit php.ini hoặc config được ánh xạ

### 6.5 Monitoring
- HTTP uptime check mỗi 5 phút
- Response time tracking
- Incident history

### 6.6 Traffic
- Kết nối GA4 property
- Kết nối Search Console property
- Đồng bộ dữ liệu theo ngày
- Dashboard hiển thị metrics cơ bản

### 6.7 Logging
- Ghi lại tất cả hành động người dùng và kết quả xử lý

## 7. Yêu cầu phi chức năng

### 7.1 Hiệu năng
- Dashboard overview tải dưới 3 giây với 10–30 website
- Actions dùng queue, không block request lâu

### 7.2 Ổn định
- Retry với job lỗi
- Timeout rõ ràng
- Idempotency cho remote actions

### 7.3 Bảo mật
- Site-to-server authentication bằng secret/token
- Encrypt secrets trong database
- Ghi audit log đầy đủ

### 7.4 Khả năng mở rộng
- Thiết kế module hóa để sau này nâng lên multi-tenant mà không phải viết lại toàn bộ

## 8. Success metrics
- Số website kết nối thành công
- Tỷ lệ update thành công
- Thời gian phát hiện downtime
- Số thao tác không cần login wp-admin
- Tỷ lệ job thất bại

## 9. Release strategy

### Release 1
- Auth
- Site onboarding
- Plugin agent
- Core/plugin/theme inventory
- Update actions
- Uptime monitor
- Audit log

### Release 2
- Remote technical tools
- GA4/Search Console
- Notifications
- Dashboard reporting
