---
name: Meedo v3
description: Internal business-operations platform for Geoplan and Geosense staff. Dense, status-first, and keyboard-driven.
colors:
  primary: "#0B4EA2"
  primary-hover: "#03285A"
  primary-foreground: "#FFFFFF"
  secondary: "#E8F1FF"
  secondary-foreground: "#0B4EA2"
  accent: "#22D3EE"
  accent-foreground: "#083344"
  background: "#F1F6FC"
  surface: "#FFFFFF"
  popover: "#FFFFFF"
  heading: "#0B161F"
  body: "#365261"
  muted: "#5E7180"
  border: "#DBE5F0"
  ring: "#22D3EE"
  destructive: "#FF4B4B"
  muted-destructive: "#FFE1DE"
  muted-destructive-foreground: "#C0322F"
  success: "#3DBE81"
  muted-success: "#D1EDE0"
  muted-success-foreground: "#1B6B47"
  warning: "#E8A317"
  muted-warning: "#FEF3D6"
  muted-warning-foreground: "#92580B"
typography:
  display:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "normal"
  title:
    fontFamily: "Poppins, sans-serif"
    fontSize: "1rem"
    fontWeight: 600
    lineHeight: 1.3
  body:
    fontFamily: "Work Sans, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Work Sans, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 600
    letterSpacing: "0.05em"
  code:
    fontFamily: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.45
rounded:
  base: "4px"
  md: "6px"
  pill: "100px"
  full: "9999px"
spacing:
  xs: "0.375rem"
  sm: "0.5rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.base}"
    padding: "0.625rem 1.25rem"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.body}"
    rounded: "{rounded.base}"
    padding: "0.375rem 0.75rem"
  input-text:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.heading}"
    rounded: "{rounded.base}"
    padding: "0.625rem 0.875rem"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.body}"
    rounded: "{rounded.base}"
    padding: "1.25rem 1.5rem"
  nav-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
  command-palette:
    backgroundColor: "{colors.popover}"
    textColor: "{colors.body}"
    rounded: "{rounded.md}"
    shadow: "overlay"
  kbd:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.muted}"
    rounded: "3px"
    padding: "0.0625rem 0.3125rem"
---

# Design system: Meedo v3

## 1. Overview

Meedo is the screen where Geoplan and Geosense staff move tickets, attendance, and leads through a queue. Status is the first thing on screen. The next action is one keystroke away. Type is tight. Surfaces use thin borders and a quiet elevation ramp. One blue is reserved for actions. The canvas stays calm so dense data stays readable. The command palette (Ctrl or Cmd-K) is the main way to move around. Overlays sit on a raised layer, `kbd` hints stay visible, and the layout does not depend on the mouse. The people using it sit at a desk all day. Density stays only when the screen stays scannable.

The product's anti-references still apply. Skip cluttered legacy enterprise software, including busy toolbars, gray-on-gray, and deeply nested menus. Density here is hierarchical. Skip playful consumer apps, including bright gamified surfaces, emoji, and mascots. Skip over-animated marketing UI, including decorative gradients, glassmorphism, and scroll choreography. Motion is only for state changes. Light and dark are both designed. Every token flips with the `.app-dark` class. The dark theme is a tuned, near-neutral palette. It is not a mechanical flip of the light theme.

**Key characteristics:**
- Status first. A ticket, attendance entry, or lead shows its state before anything else.
- Keyboard first. Command palette, `g` navigation, single-key actions, and a `?` help overlay. Every action has a visible `kbd` hint.
- Depth comes from three surfaces, canvas then surface then popover, plus 1px borders. Content does not use a resting shadow.
- One blue for every primary action. Cyan is the focus and accent signal.
- Type sizes are fixed rem values, with no fluid `clamp()`, so type stays the same at a desk.
- Corners stay sharp, with small radii. The status pill is the exception.

## 2. Colors

A cool, near-monochromatic blue system on a calm canvas, with a small set of status colors. Color carries information. The surface ramp separates panels and overlays by elevation and by border.

> **Implementation status.** Applied in `src/styles.css`: new `--surface`, `--popover`, `--text-muted`, `--border-strong`, the `--warning` and `--info` trios, and the `--muted-*-foreground` badge-text tokens in both `:root` and `.app-dark`, mapped in `@theme inline`. Canvas deepened to `#F1F6FC`. The `.app-dark` block was retuned. Applied in `src/app/app.preset.ts`: the PrimeNG `surface` ramp matches these tokens per scheme, so overlays, inputs, and menus no longer use Aura's zinc-gray in dark. Card and chrome surfaces moved from `bg-background` to `bg-surface` (header, sidebar, settings tiles, ticket comments, empty states). Inline amber and orange, and the lead status and stat blues, moved to `warning`, `info`, and `success` tokens. Status badge text uses `--muted-*-foreground` so it meets AA in both themes. Primary blue is unchanged. The build was verified. Still to do: build the command palette (`craft`), and visually check both themes in the running app (`npm start`), especially dark.

### The surface ramp

Three stacked surfaces. Depth comes from this ramp plus borders. Content does not use a resting shadow.

| Role | Token | Light | Dark | Used for |
|---|---|---|---|---|
| Canvas | `--background` | `#F1F6FC` | `#0B0F14` | App body, the plane everything sits on |
| Surface | `--surface` | `#FFFFFF` | `#10151C` | Cards, panels, sidebar, table card, inputs |
| Popover | `--popover` | `#FFFFFF` | `#1A212B` | Command palette, dropdowns, dialogs. The one floating layer |

In light, surface and popover are pure white on the faint-blue canvas (`#F1F6FC`, deeper than the old `#F8FBFF`, so white cards and chrome read as raised). Depth comes from tone, border, and the overlay shadow on popovers. In dark, each tier steps up about 4 to 6 percent in lightness, so a card reads off the canvas and the palette reads off the card. The old single-background dark theme looked flat. This ramp does not.

### Primary (unchanged)
- **Dispatch Blue** (`--primary`): the single action color. Used for primary buttons, active nav, links, current selection, and the fuzzy-match highlight in the palette. Light `#0B4EA2`, hover Deep Navy `#03285A`. Dark brightens to `#7AA1FD` (hover `#9EB7FD`) for contrast on dark surfaces. Foreground on primary is white in light, `#01183C` in dark.
- **Wash Blue** (`--secondary`): the selected and active fill. Used for the active-nav background, table headers, the selected palette row, and paginator chrome. Light `#E8F1FF` (text `#0B4EA2`). Dark `#1B2942` (text `#AFC8FF`).

### Accent (unchanged)
- **Signal Cyan** (`--accent` / `--ring`, `#22D3EE` both themes): the focus-ring and accent hue. Reserved for keyboard-focus rings and the occasional accent indicator. Do not use it as a fill for primary actions. Paired ink `#083344` (light) / `#062A38` (dark).

### Neutral / text
| Role | Token | Light | Dark |
|---|---|---|---|
| Heading / high-emphasis | `--text-heading` / `--foreground` | `#0B161F` | `#ECF1F8` |
| Body, table cells | `--text-body` | `#365261` | `#AEBDCC` |
| Muted: timestamps, placeholders, secondary labels | `--text-muted` *(new)* | `#5E7180` | `#8A99A8` |
| Hairline: dividers, card/input edges, row separators | `--border` | `#DBE5F0` | `#232C38` |
| Strong border: inputs, popover edges, emphasized dividers | `--border-strong` *(new)* | `#C7D6E6` | `#2E3A48` |

All four text tones meet WCAG AA (at least 4.5:1) on every surface tier in both themes. That includes `--text-muted`, which carries placeholder and timestamp text, so it is held to the full 4.5:1.

### Status (warning included)
Each status has a **solid** color (dots, borders, solid fills, icons), a **muted fill** (badge background), and a **muted-foreground** (badge text/icon, tuned to meet AA on its own muted fill).

| Status | Solid (light / dark) | Muted fill (light / dark) | Badge text (light / dark) |
|---|---|---|---|
| Success | `#3DBE81` / `#45C98A` | `#D1EDE0` / `#14271E` | `#1B6B47` / `#45C98A` |
| Destructive | `#FF4B4B` / `#FF6B6B` | `#FFE1DE` / `#2E1A1C` | `#C0322F` / `#FF6B6B` |
| Warning *(new)* | `#E8A317` / `#F4B740` | `#FEF3D6` / `#2C2113` | `#92580B` / `#FBC56B` |
| Info *(new)* | `#2F6FE0` / `#39A0E0` | `#DCE9FB` / `#11283A` | `#1A4F9C` / `#86C4EF` |

**Resolved gap.** Priority "medium/high" and stat icons previously hardcoded amber/orange (`#FEF3C7`/`#92400E`, etc.) because the theme had no warning token. That pair now exists and **every inline amber/orange has been migrated** to `--warning` / `--muted-warning` / `--muted-warning-foreground` (tickets priority + stat icons, leads pending). All status badge text was also moved to the `--muted-*-foreground` tokens so badges hit AA in both themes. No status color may be hardcoded again.

**Info token (added).** An `--info` / `--muted-info` / `--muted-info-foreground` trio now exists for in-progress informational states (CRM lead "contacted"). It is a status-only blue. It appears only as a muted badge and dot with a text label, never as a button, link, or active state, so the One Blue Rule (action = Dispatch Blue) still holds. In dark it shifts to azure (`#39A0E0`) so it stays distinct from the periwinkle primary (`#7AA1FD`) and the cyan focus ring. "Converted" is green (success) everywhere, on the status pill and the stat icon. Decorative `.avatar-*` identity colors stay a separate hardcoded palette, outside the status system.

### Named Rules
**The One Blue Rule.** There is exactly one action color: Dispatch Blue. If a button, link, or active state needs to say "this is the thing to act on," it is this blue or it is wrong. Cyan is for focus, not action.

**The Information-Only Color Rule.** Color always carries meaning (state, selection, focus). Remove a colored surface that means nothing.

**The Designed-Dark Rule.** Dark is not `invert(light)`. Dark neutrals are near-hueless with only a whisper of the brand's cool (low chroma); the saturated navy tints of the old dark theme are gone. Saturation in dark belongs to the primary blue and the status colors, nowhere else.

## 3. Typography

**Display font:** Poppins (fallback sans-serif) for headings h1–h6, titles, and numeric values.
**Body font:** Work Sans (fallback sans-serif) for body, buttons, inputs, table data, and labels.
**Mono font:** system monospace stack (`ui-monospace, SFMono-Regular, Menlo, Consolas, monospace`) for `kbd` hints and markdown inline code and code blocks only. System fonts, so no new web-font import (the theming rule against extra Google Fonts holds).

**Character:** Poppins is geometric and slightly tighter, for headings and big numbers. Work Sans is for everything read at length. No third display family. Mono appears only for keys and code.

### Hierarchy
- **Display** (Poppins 700, 1.75rem, line-height 1.1, letter-spacing −0.02em): page titles. This is the ceiling. No fluid clamp, and no hero-scale type.
- **Headline** (Poppins 700, 1.5rem, line-height 1): big numeric values (stat cards), prominent section headings.
- **Title** (Poppins 600, 1rem): dialog titles, detail-panel titles, card headings.
- **Body** (Work Sans 400, 0.875rem, line-height 1.5): table cells, descriptions, general prose. Cap prose at 65–75ch; data tables may run denser.
- **Label** (Work Sans 600, 0.75rem, letter-spacing 0.05em, often UPPERCASE): table headers, detail labels, stat labels, sidebar section titles (11px). The uppercase tracked label is the one place tracking is used.
- **Code** (system mono, 0.8125rem): inline code, code blocks, and `kbd` caps.

### Named Rules
**The Fixed-Scale Rule.** Type sizes are fixed rem values, never `clamp()`. Users view at a consistent desk DPI; a headline that shrinks inside a sidebar looks worse, not better.

## 4. Elevation

Content stays flat, with exactly one floating layer for transient overlays. Depth on content comes from the surface ramp (canvas, then surface) and thin 1px borders, not from resting shadows. Cards, tables, and panels sit on `--surface` with a border. They do not float. Overlays (command palette, dropdowns, dialogs) are the exception. They live on `--popover` and must carry an elevation shadow, because they sit above content and have to read as detached.

### Shadow Vocabulary
- **Action lift** (`0 4px 12px color-mix(in srgb, var(--primary) 25%, transparent)`): primary-button hover only. A brief blue-tinted lift confirming the action is live.
- **Focus glow** (`0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent)`): the soft inner ring on focused inputs, paired with a primary-colored border. (Keyboard focus elsewhere uses the Signal Cyan `--ring` outline.)
- **Overlay** *(new)*, the floating-layer shadow for palette, dropdown, and dialog.
  - Light: `0 12px 32px -8px rgb(11 22 31 / 0.18), 0 0 0 1px var(--border)`.
  - Dark: `0 16px 40px -12px rgb(0 0 0 / 0.55), 0 0 0 1px var(--border-strong)`.

### Hover / subtle fills
Non-selected hover (rows, nav items, menu items) uses a translucent ink wash, not a hardcoded tint, so it works identically in both themes: `background: color-mix(in srgb, var(--foreground) 6%, transparent)`. The strong **selected** state still uses solid `--secondary`.

### Named Rules
**The Flat-Content, Floating-Overlay Rule.** Content surfaces are flat at rest. A resting shadow on a card is wrong. Give it a border. Overlays are the one place a shadow is mandatory, because elevation tells the user the layer is temporary and above everything. A shadow marks hover, focus, or a floating layer.

## 5. Components

Components are **crisp and efficient, Linear-flavored**: tight padding, sharp corners, thin borders, color used sparingly. They recede so the data leads.

### Command Palette (signature component)
The spine of the keyboard-first model. Opened with **Ctrl/Cmd-K** from anywhere.
- **Shell:** centered overlay on `--popover`, `rounded-md` (6px), **Overlay** shadow, max-width ~640px, capped height with an internal scroll. Backdrop scrim `color-mix(in srgb, var(--foreground) 40%, transparent)`.
- **Search:** a borderless full-width input at top (title-size text, `--text-muted` placeholder "Search or run a command…"), a hairline divider below it. Autofocused on open.
- **Results:** grouped with 11px UPPERCASE tracked section labels (`Navigation`, `Tickets`, `Actions`, `Recent`). Each row: leading icon (`--text-muted`) + label + right-aligned `kbd` hint. The active row is filled `--secondary` and is the only highlighted row; `↑`/`↓` move it, `Enter` runs it, `Esc` closes.
- **Match feedback:** matched characters tint to `--primary`. Color does the work, not weight alone. Do not use a bold-only match.
- **A11y:** ARIA combobox over a listbox; focus is trapped while open and returns to the trigger on close. Open: 120–150 ms fade + 4px upward translate (scale 0.98→1); `prefers-reduced-motion` → instant fade, no translate.

### Keyboard hint (`kbd`)
The repeated atom of the keyboard model.
- Small key cap: `--surface` background, 1px `--border`, `--text-muted` text, system mono 0.6875rem, 3px radius, `0.0625rem 0.3125rem` padding, min-width so single keys stay square-ish.
- Appears in palette rows, the `?` overlay, tooltips, and menu items. Multi-key shows as separate caps (`g` `t`) or a cap with `+` for chords.

### Shortcut help overlay (`?`)
- A dialog (on `--popover`, Overlay shadow) opened by `?`, listing every shortcut grouped by scope: **Global**, **Navigation**, **List**, **Detail**. Two columns: `kbd` cap(s) + plain-language description. This is what keeps shortcuts discoverable rather than lore.

### Keyboard Map (v1)

The canonical map the `?` overlay and the palette render. Two layers. `g` navigation is "go to" only: top-level destinations, nothing deeper. Deeper pages live in the palette, not in chords. Actions are scoped to Tickets for now (the only built-out module). Other modules get go-to only until their detail flows exist. Single-key actions fire only when no input, textarea, or contenteditable is focused.

| Scope | Keys | Action |
|---|---|---|
| Global | `Ctrl/⌘ K` | Open command palette |
| Global | `?` | Open shortcuts overlay |
| Global | `Esc` | Close palette / overlay / dialog |
| Nav (go to) | `g` `h` | Home |
| Nav (go to) | `g` `t` | Tickets |
| Nav (go to) | `g` `a` | Attendance |
| Nav (go to) | `g` `c` | CRM (Leads) |
| Nav (go to) | `g` `s` | Settings |
| List (table focused) | `j` / `k` or `↓` / `↑` | Move row focus |
| List | `Enter` | Open focused row |
| Tickets | `c` | Create ticket |
| Ticket detail | `r` | Reply / focus the comment composer |

### Command palette destinations (v1 = every route in the repo)

The palette searches **all** navigable destinations plus actions, so anything not on the `g`-nav map is still one Ctrl/⌘-K away:

- **Navigate:** Home `/` · Tickets `/tickets` · Tickets Dashboard `/tickets/dashboard` · Attendance `/timekeeping/attendance` · Face-recognition clock-in `/timekeeping/attendance/recognition` · Leads `/crm/leads` · Newsletter `/crm/newsletter` · Subscribers `/crm/newsletter/subscribers` · Settings `/settings` · Teams `/settings/teams` · Categories `/settings/categories` · Statuses `/settings/statuses`
- **Act:** New ticket · Reply to ticket (when a ticket is open) · Toggle theme · Sign out

Each palette row that has a shortcut shows its `kbd` hint on the right; the two systems share one source of truth so they never drift.

### Buttons
- **Shape:** sharp, 4px radius (`rounded.base`). Icon-only chrome buttons (PrimeNG `p-button` `[text]` `severity="secondary"`) live in the header and toolbars.
- **Primary** (`.add-btn`): Dispatch Blue fill, contrast text, 0.625rem 1.25rem padding, Work Sans 600. Hover → Deep Navy + Action-lift shadow. Focus-visible → 2px Signal Cyan outline, 2px offset.
- **Ghost / Secondary** (`.view-btn`): transparent fill, 1px `--border`, `--text-body`. Hover → translucent ink wash + Dispatch Blue border + text. Row-level/low-emphasis actions.

### Status & Priority Badges (signature component)
- **Status badge** (`.status-badge`): pill (100px radius), 0.75rem/600. Background `--muted-{status}`, text `--muted-{status}-foreground`, the pair that meets AA. The status pill is the most repeated element in the app.
- **Priority badge** (`.priority-badge`): pill with a 6px leading solid-`--{status}` dot. Low maps to success, medium and high map to warning (no inline amber), urgent maps to destructive. Capitalized, never uppercase. The label text carries the same meaning as the color.

### Cards / Containers
- **Background:** `--surface` (not canvas; that is the elevation fix). **Border:** 1px `--border`. **Corners:** 4px. **Shadow:** none at rest (see Elevation). **Padding:** 1.25rem–1.5rem.
- Stat cards and the table card are the two patterns; do not nest cards.

### Inputs / Fields
- **Style** (`.search-input`, PrimeNG `p-select` / `p-multiSelect`): `--surface` background, 1px `--border` (dark uses `--border-strong` so the field reads against the dark card), 4px radius, Work Sans 0.875rem, `--text-muted` placeholder.
- **Focus:** Dispatch Blue border + Focus-glow ring. **Error:** `.form-error` in `--destructive`, 0.75rem; required marker is a destructive asterisk.
- Multi-selects use `display="chip"`; dropdowns/overlays render on `--popover` with the Overlay shadow and `appendTo="body"` to escape overflow clipping.

### Navigation
- **Sidebar:** 256px (`w-64`), `--surface` with a right `--border`, grouped sections with 11px uppercase tracked titles. Items `rounded-md` (6px), Work Sans 0.875rem. **Active** → `--secondary` fill + `--secondary-foreground` + medium weight + `aria-current="page"`; **hover** → translucent ink wash. Mobile: off-canvas drawer with a `foreground/40` scrim, 200ms slide.
- **Header:** 64px tall, bottom `--border`, icon-only `p-button`s (palette/⌘K trigger, theme toggle, notifications, settings, sign-out) + circular avatar. The palette trigger shows a `kbd` hint (`⌘K`) so the entry point is visible.

### Table (signature component)
- Custom `.tickets-table` on `--surface`: `--secondary` header with 0.75rem UPPERCASE tracked column labels, 1px `--border` row dividers, hover row → translucent ink wash, focused/selected row (keyboard `j`/`k`) → `--secondary`. Loading uses **skeleton rows**, not a centered spinner. Empty state is a centered icon well + title + body, never a bare "nothing here."

### Markdown content (descriptions)
Shared renderer for ticket/lead **descriptions** (comments and notes stay plain text). Rendered in `--text-body`, structure in the type scale below the page level:
- **Headings:** Poppins, capped at Title size (a description `#` is a section, never a page-display heading). h1→1rem/600, h2→0.9375rem/600, h3→0.875rem/600.
- **Lists / paragraphs:** Work Sans 0.875rem, line-height 1.5, prose capped 65–75ch.
- **Links:** `--primary`, underline on hover; visited not recolored.
- **Inline code:** system mono 0.8125rem on `--secondary` fill, 3px radius, 0.1rem 0.3rem padding.
- **Code block:** system mono on `--surface` (dark: one tier up), 1px `--border`, 4px radius, horizontal scroll; no syntax-color theme by default.
- **Blockquote:** indented, `--text-muted` text on a subtle `--secondary` tint. Do not use a colored left stripe (see bans). 
- **Editor (decided):** an inline live-rendered markdown editor. Markdown syntax renders in place as you type, on a `--surface` field, with no heavy WYSIWYG toolbar. When the field isn't focused it shows the rendered description. Focusing it reveals the markdown and a thin formatting affordance. A split pane wastes width in a side panel. A raw textarea that renders only after you leave it makes you switch modes to read your own text. If build time is tight, a `--surface` markdown textarea that renders on blur or save is an acceptable v1, using the same tokens. Typing speed is the point either way.

### Named Rules
**The Sharp Edge Rule.** Default to sharp: 4px on buttons, cards, and inputs, 6px on nav items and overlays, 3px on `kbd`. The 100px status and priority pills are the single deliberate exception. A capsule reads as "status" at a glance. Do not soften the system with `rounded-lg` or `rounded-xl`.

**The Earned-Familiarity Rule.** Every interactive element ships its full state set: default, hover, focus-visible, active, disabled, and loading. The Save button, the status badge, and the `⌘K` shortcut look and behave the same in every module. If one differs, it's wrong.

## 6. Do's and Don'ts

### Do:
- **Do** use theme tokens (`bg-surface`, `text-body`, `text-muted`, `border-border`, `bg-warning`, `var(--popover)`, …) for every color. Hex literals belong only in `app.preset.ts` and `styles.css`.
- **Do** build depth with the surface ramp (canvas → surface → popover) plus borders; let shadows appear only on overlays, hover, and focus.
- **Do** keep one action color (Dispatch Blue) and reserve Signal Cyan for focus rings and accents.
- **Do** give every action a keyboard path and a visible `kbd` hint; keep the `?` overlay and palette in sync with reality.
- **Do** keep type on the fixed rem scale (display ceiling 1.75rem); Poppins for headings/numbers, Work Sans for everything read, system mono only for code/keys.
- **Do** ship skeletons for loading and teaching empty states; pair every status color with text or an icon (never color alone).
- **Do** use the `warning` token pair for medium and high priority and for caution states. Do not use inline amber or orange again.
- **Do** keep edges sharp (4px / 6px); the pill is only for status/priority badges.
- **Do** honor `prefers-reduced-motion` and keep transitions at 150–250ms, conveying state only.

### Don't:
- **Don't** treat dark mode as an inversion of light. It is a separately tuned, near-neutral palette. No saturated navy surfaces, and no mechanical flips.
- **Don't** put content cards on the canvas color or float them with a resting shadow; cards sit on `--surface` with a border.
- **Don't** drift toward cluttered legacy enterprise. No busy toolbars, gray-on-gray, or deeply nested menus. Density must stay hierarchical and scannable.
- **Don't** make it feel like a playful consumer app. No bright gamified surfaces, emoji, mascots, or casual copy.
- **Don't** add flashy motion. No decorative gradients, glassmorphism, scroll choreography, or hero-metric template tiles.
- **Don't** hide shortcuts: if a key does something, it appears in the `?` overlay and (where relevant) the palette. No undiscoverable lore.
- **Don't** introduce a warm cream/sand body background; the canvas is a cool near-white (`#F1F6FC`) / near-neutral dark (`#0B0F14`).
- **Don't** soften the system with large radii (`rounded-lg`/`rounded-xl`).
- **Don't** use gradient text or side-stripe (`border-left`) accents, including on markdown blockquotes, or nested cards.
