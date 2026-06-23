---
name: control-center-design
description: Use this skill to generate well-branded interfaces and assets for the Control Center product (a multi-site WordPress admin), built on the shadcn UI preset (amber primary, neutral grays, square corners). Contains design guidelines, color & type tokens, and core UI components for prototyping or production.
user-invocable: true
---

Read `readme.md` in this skill, then explore the other files:

- `styles.css` + `tokens/` — link `styles.css` and use the CSS custom properties (`var(--primary)`, `var(--foreground)`, `var(--radius)`, …). Never hardcode hex; reference tokens.
- `components/core/` — `Button`, `Badge`, `Input`, `Switch`, `Card`. Read each `.prompt.md` for usage.
- `ui_kits/wp-control-center/` — the product wireframe canvas to fork from.

Core rules: square corners (`--radius: 0`), amber `--primary` used sparingly with `--primary-foreground` (dark amber, never white) as its label color, hairline `--border` separators, no rest-state shadows (shadows for overlays only), sentence-case operational copy, no emoji.

If creating visual artifacts (mocks, throwaway prototypes, slides), copy assets out and produce static HTML for the user to view. If working on production code, copy assets and follow the rules here. If invoked with no guidance, ask what they want to build, ask a few questions, and act as an expert designer outputting HTML or production code as needed.
