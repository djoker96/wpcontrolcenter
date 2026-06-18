# Sprint Plan - WP Control Center

## Sprint 0 - Foundation & Discovery
### Mục tiêu
- Chốt scope MVP
- Setup monorepo
- Setup coding standards
- Setup CI/CD cơ bản
- Setup design system cơ bản

### Deliverables
- PRD finalized
- architecture doc
- repo bootstrap
- DB schema draft
- API conventions

## Sprint 1 - Auth + Core App Shell
### Backend
- auth module
- user table
- session handling
- role middleware cơ bản

### Frontend
- login page
- app layout
- sidebar/header
- dashboard shell

### Deliverables
- user login được
- app shell hoạt động

## Sprint 2 - Site Management + Onboarding
### Backend
- site CRUD
- connection token generation
- site settings
- site credentials storage

### Frontend
- site list
- add/edit site
- site detail shell
- onboarding flow UI

### Plugin
- WP agent plugin skeleton
- register endpoint
- heartbeat endpoint

### Deliverables
- thêm site được
- plugin connect được
- site hiển thị connected/disconnected

## Sprint 3 - Inventory Sync
### Backend
- sync endpoints
- plugins/themes/core tables
- inventory upsert logic

### Plugin
- sync plugin list
- sync theme list
- sync core version
- system info sync

### Frontend
- overview tab
- plugins tab
- themes tab
- core tab

### Deliverables
- nhìn thấy trạng thái core/plugin/theme từng site

## Sprint 4 - Remote Actions Engine
### Backend
- jobs table
- BullMQ setup
- job status flow
- action orchestration

### Plugin
- execute update core/plugin/theme
- activate/deactivate plugin
- install plugin
- delete plugin/theme

### Frontend
- actions UI
- jobs list
- job detail/logs

### Deliverables
- thao tác từ xa được với queue và log

## Sprint 5 - Technical Maintenance Actions
### Backend
- maintenance jobs
- snapshot handling cho file text config

### Plugin
- maintenance mode
- clear cache
- optimize database
- update robots.txt
- update .htaccess
- update php config abstraction

### Frontend
- settings/actions tab
- editors cho robots/.htaccess/php config

### Deliverables
- các thao tác kỹ thuật từ xa chạy được

## Sprint 6 - Monitoring & Alerts
### Backend/Worker
- uptime checker mỗi 5 phút
-- incidents
-- notifications

### Frontend
- monitoring overview
- incidents page
- response time charts

### Deliverables
- monitor uptime hoạt động
- alert cơ bản hoạt động

## Sprint 7 - Analytics Integrations
### Backend
- Google OAuth
- GA4 sync
- Search Console sync
- analytics_daily + top_pages_daily

### Frontend
- analytics dashboard
- charts/tables

### Deliverables
- xem traffic cơ bản theo site

## Sprint 8 - Hardening & Release
### To-do
- QA
- edge cases
- permission review
- retry handling
- empty states
- docs
- release checklist

### Deliverables
- bản release candidate ổn định
