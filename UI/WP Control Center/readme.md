# Control Center Design System

A compact design system built on the **shadcn UI** preset `b6WKtX3tjc`. It styles **WP Control Center** — a centralized web admin for operating many WordPress sites from one dashboard.

> Source preset: shadcn theme variables supplied by the user (amber primary, neutral grays, red chart scale, `--radius: 0`). No brand font binary or product codebase was provided — see CAVEATS.

---

## Index / manifest

- `styles.css` — global entry point (link this one file). `@import`s all tokens.
- `tokens/`
  - `colors.css` — shadcn preset `:root` + `.dark`, plus semantic status (success/warning/danger).
  - `typography.css` — font stacks, type scale, weights, tracking.
  - `radius.css` — `--radius: 0` derived steps (sharp corners).
  - `spacing.css` — 4px spacing scale, elevation shadows, control heights.
- `components/core/` — `Button`, `Badge`, `Input`, `Switch`, `Card` (+ `CardHeader`/`CardBody`). Each: `.jsx` + `.d.ts` + `.prompt.md`. Specimen: `core.card.html`.
- `guidelines/` — foundation specimen cards (Colors, Type, Spacing).
- `ui_kits/wp-control-center/` — the WP Control Center wireframe canvas (first UI kit).
- `SKILL.md` — portable skill manifest.

---

## VISUAL FOUNDATIONS

**Overall vibe.** Crisp, utilitarian, ops-tool. Flat surfaces, hairline borders, square corners everywhere (`--radius: 0`) — reads as precise and technical, not playful. Amber is the single brand accent against an otherwise neutral gray UI.

**Color.**
- `--primary` is a bright amber `oklch(0.852 0.199 91.936)`; its text pair `--primary-foreground` is **dark amber**, never white — amber is too light for white text. Use primary sparingly: one primary button per action group, active nav accent, brand mark.
- Neutrals carry the UI: white `--card`/`--background`, near-black `--foreground`, `--muted`/`--muted-foreground` for secondary text and fills, `--border` (`oklch .922`) hairlines.
- `--destructive` red for danger. Charts use a **red** scale (`--chart-1…5`) — not categorical; treat as sequential/intensity.
- Status semantics (success green, warning amber, danger red) are an **extension** the preset lacks; defined in `colors.css`. Site health uses a 7px dot + tone.
- A `.dark` theme is provided by the preset (apply `class="dark"`), though the product renders light by default.

**Corners.** `--radius: 0`. Everything rectangular — cards, buttons, inputs, badges, menus. Only genuinely circular things opt out: status dots and avatars (`--radius-full` = 50%/9999px) and the Switch track (pill).

**Type.** **Geist** (variable, weights 100–900) for body, UI, running text. **Space Grotesk** (variable, weights 300–700) for headings, section labels, brand wordmark. `--font-mono` for tokens / paths / code (robots.txt, connection tokens). Scale 11.5 → 34px. Display weights 600–700 with tight tracking; uppercase micro-labels use `--tracking-caps`.

**Spacing & density.** 4px base. The product favors **information density** — compact tables fit 10–30 sites without scrolling; cards use 14–16px padding.

**Elevation.** Minimal. At rest, cards rely on the hairline border with **no shadow**. Shadows (`--shadow-md/lg`) are reserved for overlays — dropdown menus, popovers, dialogs.

**Hover / press.** Buttons darken/brighten slightly (`filter`/`opacity`) — no scale bounce. Transitions are short (.12–.15s ease). Keep motion functional.

**Layout.** Left sidebar (208px) + top bar (52–54px) shell. Content is grid/flex with `gap`. Active nav item = `--accent` fill + amber icon + foreground label.

---

## CONTENT FUNDAMENTALS

- **Voice:** terse, operational, second-person implied. Labels are commands ("Add site", "Clear cache", "Update all", "Sync now").
- **Casing:** Sentence case for buttons and headings ("Add site", not "Add Site"). Uppercase only for tiny table-header / eyebrow labels.
- **Numbers & status:** lead with the metric; pair counts with a status dot. Timestamps relative ("2m ago", "Ongoing 42m").
- **No emoji.** Use status dots, mono text, and the icon system instead.
- **Domain terms:** site, agent, heartbeat, inventory, core/plugin/theme, incident, audit log, maintenance mode.

---

## ICONOGRAPHY

**Lucide** is the icon system (the same set shadcn UI defaults to; matching 1.5px stroke). Load via CDN in product UIs (`unpkg.com/lucide-static` or the React package `lucide-react`), or copy specific SVGs into `assets/icons/` as needed. Stroke weight stays uniform; icons render at 16/20/24px with `currentColor` so they inherit `--foreground` or `--muted-foreground` naturally. No emoji.

---

## CAVEATS

- **Font:** Geist (body) + Space Grotesk (headings) shipped as variable `.ttf` in `tokens/fonts/`. Italic faces not bundled — add `Geist-Italic-Variable.ttf` if needed.
- **Icons:** Lucide (CDN). Replace inline glyph placeholders in the wireframe with real Lucide SVGs when promoting frames to hi-fi.
- **Components are static-specimen carded.** The `check_design_system` namespace tool wasn't available, so `core.card.html` renders token-styled specimens rather than mounting the compiled bundle. The real `.jsx`/`.d.ts` components are authored and will bundle.
- **UI kit is a wireframe canvas**, not per-screen hi-fi product views.
- **Status colors** (success/warning) are an opinionated extension, not from the preset.
