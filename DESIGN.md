---
name: Meedo v3
description: Internal business-operations platform — a dense, status-first dispatch surface for Geoplan/Geosense staff.
colors:
  primary: "#0B4EA2"
  primary-hover: "#03285A"
  primary-foreground: "#FFFFFF"
  secondary: "#E8F1FF"
  secondary-foreground: "#0B4EA2"
  accent: "#22D3EE"
  accent-foreground: "#083344"
  background: "#F8FBFF"
  heading: "#0B161F"
  body: "#365261"
  border: "#DBE5F0"
  ring: "#22D3EE"
  destructive: "#FF4B4B"
  muted-destructive: "#FFE1DE"
  success: "#3DBE81"
  muted-success: "#D1EDE0"
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
    backgroundColor: "{colors.background}"
    textColor: "{colors.heading}"
    rounded: "{rounded.base}"
    padding: "0.625rem 0.875rem"
  status-badge:
    rounded: "{rounded.pill}"
    padding: "0.25rem 0.625rem"
  card:
    backgroundColor: "{colors.background}"
    textColor: "{colors.body}"
    rounded: "{rounded.base}"
    padding: "1.25rem 1.5rem"
  nav-item-active:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    rounded: "{rounded.md}"
---

# Design System: Meedo v3

## 1. Overview

**Creative North Star: "The Dispatch Desk"**

Meedo is the surface where Geoplan/Geosense staff move work through a queue — tickets, attendance, leads — so the whole system is built like a dispatch desk: status reads first, the next action is one click away, and nothing on screen is there to impress. The aesthetic is crisp and efficient in the lineage of Linear: tight type, flat surfaces structured by thin borders, a single confident blue for action, and a quiet near-white canvas that lets dense data lead. The interface is for fluent power users at a desk all day; density is a feature, not a compromise, but density only earns its place when it stays scannable.

This system explicitly rejects three things, carried straight from the product's anti-references. It is **not** cluttered legacy enterprise (no busy toolbars, no gray-on-gray, no deeply nested menus) — density here is hierarchical, not noisy. It is **not** a playful consumer app (no bright gamified surfaces, no emoji, no mascots). And it is **not** an over-animated marketing UI (no decorative gradients, no glassmorphism, no scroll choreography); motion is reserved for conveying state. The light/dark split is real and first-class: every token flips via the `.app-dark` class.

**Key Characteristics:**
- Status-first: a ticket, attendance entry, or lead reads its state before anything else.
- Flat by default; thin 1px borders do the structural work, not shadows.
- One blue carries every primary action; cyan is a focus/accent signal, not decoration.
- Fixed rem type scale (no fluid clamp) — sized for consistent on-desk viewing.
- Sharp edges: small radii, crisp corners; rounding is restraint, not softness.

## 2. Colors

A cool, near-monochromatic blue system on a barely-tinted white canvas, with a small semantic vocabulary for status. Color is information, not decoration.

### Primary
- **Dispatch Blue** (#0B4EA2): The single action color — primary buttons, active nav, table-header text, current selection, links. Hover deepens to **Deep Navy** (#03285A, `primary-hover`). Foreground on primary is pure white (#FFFFFF).
- **Wash Blue** (#E8F1FF, `secondary`): The second surface layer — table headers, hover rows, active-nav fill, paginator chrome, empty-state icon wells. Its paired text is **Dispatch Blue** (`secondary-foreground`).

### Secondary
- **Signal Cyan** (#22D3EE, `accent` / `ring`): The focus-ring and accent hue. Reserved for keyboard-focus rings and the occasional accent indicator — never a fill for primary actions. Paired ink is **Deep Teal** (#083344).

### Neutral
- **Canvas** (#F8FBFF, `background`): The app body and card surface — an almost-white with the faintest blue tint, never a warm cream.
- **Ink** (#0B161F, `heading`): Headings and high-emphasis values.
- **Slate Body** (#365261, `body`): Body text, secondary values, table cells. Meets AA on Canvas.
- **Hairline** (#DBE5F0, `border` / `input`): Every divider, card edge, input stroke, row separator. The structural workhorse.

### Status
- **Success** (#3DBE81) with muted fill (#D1EDE0); **Destructive** (#FF4B4B) with muted fill (#FFE1DE). Used for resolved/urgent states, form errors, and the `required` marker.
- **Gap — no warning token.** Priority "medium/high" and some stat icons currently hardcode amber/orange (#FEF3C7/#92400E, #FFEDD5/#9A3412) because the theme has no `warning` / `muted-warning` pair. These are flagged inline in code as off-theme.

### Named Rules
**The One Blue Rule.** There is exactly one action color: Dispatch Blue. If a button, link, or active state needs to say "this is the thing to act on," it is this blue or it is wrong. Cyan is for focus, not action.

**The Information-Only Color Rule.** Color always carries meaning (state, selection, focus). A colored surface that means nothing is decoration — remove it.

## 3. Typography

**Display Font:** Poppins (fallback sans-serif) — headings h1–h6, titles, numeric values.
**Body Font:** Work Sans (fallback sans-serif) — body, buttons, inputs, table data, labels.

**Character:** A geometric/humanist pairing on a clear contrast axis — Poppins is geometric and slightly tighter for headings and big numbers; Work Sans is a calm humanist workhorse for everything read at length. The pairing is deliberately restrained: no third family, no display flourish.

### Hierarchy
- **Display** (Poppins 700, 1.75rem, line-height 1.1, letter-spacing −0.02em): Page titles. This is the ceiling — no fluid clamp, no hero-scale type.
- **Headline** (Poppins 700, 1.5rem, line-height 1): Big numeric values (stat cards) and prominent section headings.
- **Title** (Poppins 600, 1rem): Dialog titles, detail-panel titles, card headings.
- **Body** (Work Sans 400, 0.875rem, line-height 1.5): Table cells, descriptions, general prose. Cap prose at 65–75ch; data tables may run denser.
- **Label** (Work Sans 600, 0.75rem, letter-spacing 0.05em, often UPPERCASE): Table headers, detail labels, stat labels, sidebar section titles (11px). The uppercase tracked label is the one place tracking is used.

### Named Rules
**The Fixed-Scale Rule.** Type sizes are fixed rem values, never `clamp()`. Users view at a consistent desk DPI; a headline that shrinks inside a sidebar looks worse, not better.

## 4. Elevation

This is a flat system. Depth is conveyed by thin 1px Hairline borders and the Wash Blue second surface — not by resting shadows. Cards, tables, and panels sit flat on the Canvas with a border; they do not float.

Shadows exist **only as a response to state**, and only two of them:

### Shadow Vocabulary
- **Action lift** (`box-shadow: 0 4px 12px color-mix(in srgb, var(--primary) 25%, transparent)`): Appears on primary-button hover only — a brief blue-tinted lift that confirms the action is live.
- **Focus glow** (`box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 10%, transparent)`): The soft inner ring on focused inputs, paired with a primary-colored border. (Keyboard focus elsewhere uses the Signal Cyan `--ring` outline.)

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. A shadow is a verb, not a noun — it only appears in response to hover or focus. If a card has a resting shadow, it's wrong; give it a border instead.

## 5. Components

Components are **crisp and efficient, Linear-flavored**: tight padding, sharp corners, thin borders, color used sparingly. They recede so the data leads.

### Buttons
- **Shape:** Sharp — 4px radius (`rounded.base`). Icon-only chrome buttons (PrimeNG `p-button` `[text]` `severity="secondary"`) live in the header and toolbars.
- **Primary** (`.add-btn`): Dispatch Blue fill, white text, 0.625rem 1.25rem padding, Work Sans 600. Hover → Deep Navy + Action-lift shadow. Focus-visible → 2px Signal Cyan outline, 2px offset.
- **Ghost / Secondary** (`.view-btn`): Transparent fill, 1px Hairline border, Slate Body text. Hover → Wash Blue fill, Dispatch Blue border + text. Used for row-level/low-emphasis actions.

### Status & Priority Badges (signature component)
- **Status badge** (`.status-badge`): Pill (100px radius), 0.75rem/600, color pair driven by the status. The status-first pill is the most repeated atom in the app.
- **Priority badge** (`.priority-badge`): Pill with a 6px leading dot; semantic color pairs — low (muted-success), urgent (muted-destructive), medium/high (amber/orange, see the color gap). Capitalized, never uppercase.

### Cards / Containers
- **Corner Style:** 4px (`rounded.base`). **Background:** Canvas. **Border:** 1px Hairline. **Shadow:** none (see Elevation). **Padding:** 1.25rem–1.5rem.
- Stat cards and the table card are the two patterns; do not nest cards.

### Inputs / Fields
- **Style** (`.search-input`, PrimeNG `p-select` / `p-multiSelect`): 1px Hairline border, 4px radius, Canvas background, Work Sans 0.875rem.
- **Focus:** Dispatch Blue border + Focus-glow ring. **Error:** `.form-error` in Destructive, 0.75rem; required marker is a Destructive asterisk.
- Multi-selects use `display="chip"`; dropdowns `appendTo="body"` to escape overflow clipping.

### Navigation
- **Sidebar:** 256px (`w-64`), Canvas with a right Hairline border, grouped sections with 11px uppercase tracked titles. Items are `rounded-md` (6px), Work Sans 0.875rem. **Active** → Wash Blue fill + Dispatch Blue text + medium weight + `aria-current="page"`; **hover** → Wash Blue at 60%. Mobile: off-canvas drawer with a `foreground/20` scrim, 200ms slide.
- **Header:** 64px tall, bottom Hairline border, icon-only `p-button`s (theme toggle, notifications, settings, sign-out) + circular avatar.

### Table (signature component)
- Custom `.tickets-table`: Wash Blue header with 0.75rem UPPERCASE tracked column labels, 1px Hairline row dividers, hover row → Wash Blue. Loading uses **skeleton rows**, not a centered spinner. Empty state is a centered Wash-Blue icon well + title + body, never a bare "nothing here."

### Named Rules
**The Sharp Edge Rule.** Default to sharp: 4px on buttons/cards/inputs, 6px on nav items. The 100px status/priority pills are the single deliberate exception — a capsule reads as "status" at a glance. Do not soften the system with `rounded-lg`/`rounded-xl`; crispness is the brand.

**The Earned-Familiarity Rule.** Every interactive element ships its full state set — default, hover, focus-visible, active, disabled, loading. The Save button looks identical in every module; if it differs, one is wrong.

## 6. Do's and Don'ts

### Do:
- **Do** use theme tokens (`bg-primary`, `text-body`, `border-border`, `var(--primary)`, …) for every color. Hex literals belong only in `app.preset.ts` and `styles.css`.
- **Do** keep one action color (Dispatch Blue) and reserve Signal Cyan for focus rings and accents.
- **Do** keep surfaces flat with 1px Hairline borders; let shadows appear only on hover/focus.
- **Do** keep type on the fixed rem scale (display ceiling 1.75rem) and lean on Poppins for headings/numbers, Work Sans for everything read.
- **Do** ship skeletons for loading and teaching empty states; pair every status color with text or an icon (never color alone).
- **Do** keep edges sharp (4px / 6px); the pill is only for status/priority badges.
- **Do** honor `prefers-reduced-motion` and keep transitions at 150–250ms, conveying state only.

### Don't:
- **Don't** drift toward cluttered legacy enterprise — no busy toolbars, gray-on-gray, or deeply nested menus. Density must stay hierarchical and scannable.
- **Don't** make it feel like a playful consumer app — no bright gamified surfaces, emoji, mascots, or casual copy.
- **Don't** add over-animated / flashy marketing motion — no decorative gradients, glassmorphism, scroll choreography, or hero-metric template tiles.
- **Don't** introduce a warm cream/sand body background; the canvas is a cool near-white (#F8FBFF).
- **Don't** soften the system with large radii (`rounded-lg`/`rounded-xl`) or resting card shadows.
- **Don't** keep hardcoding amber/orange for warning states — promote a `warning` / `muted-warning` token pair into the theme instead of inline off-theme hex.
- **Don't** use gradient text, side-stripe (`border-left`) accents, or nested cards.
