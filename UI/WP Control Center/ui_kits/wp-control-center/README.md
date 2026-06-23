# WP Control Center — UI kit

Centralized admin for managing many WordPress sites from one dashboard (no per-site wp-admin login). MVP / Release 1 scope.

`index.dc.html` is a single horizontally-scrolling wireframe **canvas** holding 10 screens, mid-fi in the shadcn preset (square corners, amber primary):

| # | Screen |
|---|--------|
| A | Login + 3-step agent connection wizard |
| B | Dashboard / overview (left-sidebar nav, KPI cards + attention list) |
| C | Sites list (card / list view with per-item action menu) |
| D | Single site detail (tabbed operations hub) |
| E | Updates manager (core / plugin / theme, multi-select) |
| F | Remote tools (cache, DB, maintenance + robots.txt / .htaccess / php.ini editor) |
| G | Monitoring / uptime + incident history |
| H | Traffic (GA4 metrics + Search Console overview) |
| I | Audit log |

Committed directions: **left-sidebar navigation** and a **card/list sites view** with per-item action menus.

Two props (Tweaks): `statusColors` (color vs grayscale health dots) and `showNotes` (per-frame design annotations).

> This is a wireframe canvas, not a production screen build. To evolve it into hi-fi product screens, fork individual frames into their own `Screen.jsx` files composing the `core` components.
