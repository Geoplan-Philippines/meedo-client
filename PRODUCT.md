# Product

## Register

product

## Users

Internal staff at Geoplan / Geosense — operations and support agents, sales/CRM users, and the team leads and managers who configure and review their work. They use Meedo daily, at a desk, as a primary work tool, and many become fluent power users who value speed and information density over whitespace, reaching for the keyboard before the mouse. There is no public-facing or client-facing surface; everything behind auth assumes a logged-in employee in the middle of a task.

## Product Purpose

Meedo v3 is the internal business-operations platform for the company — a single authenticated app (shared header + sidebar shell, fronted by a global command palette) that consolidates several back-office workflows that would otherwise live in separate tools:

- **Tickets** — a help desk: ticket list, threaded ticket view (markdown description, plain-text comments + activity), a metrics dashboard, plus configurable categories and statuses.
- **Timekeeping** — attendance and timesheets (webcam-based clock-in is wired in).
- **CRM** — leads management (markdown lead descriptions) and newsletter/subscriber + campaign tooling.
- **Settings** — teams, categories, and statuses that the other modules consume.

Success looks like staff getting through their queue faster: fewer clicks (often zero — the keyboard does it), fast scanning, consistent behavior across modules, and a UI that never gets in the way of the task.

## Brand Personality

Dense, structured, trustworthy. The voice is plain and direct — no marketing language, no cute copy. The interface should feel like a sharp internal tool built by people who use it: efficient, quiet, and confidently professional. Speed is part of the personality — the keyboard is a first-class input and the mouse is optional. Personality lives in precision and responsiveness, not in decoration. Three words: **efficient, structured, dependable.**

## Anti-references

- **Cluttered legacy enterprise** (SAP / Jira / ServiceNow): busy toolbars, gray-on-gray, deeply nested menus, sluggish screens. Density is welcome; clutter is not — density must stay scannable and hierarchical.
- **Playful consumer apps**: bright rounded gamified UI, emoji, mascots, casual tone. Too informal for an all-day work tool.
- **Over-animated / flashy marketing UI**: decorative motion, gradients, glassmorphism, scroll choreography, hero-metric tiles. Motion is reserved for conveying state.
- **Hidden power-user lore**: shortcuts that exist but are undiscoverable. Keyboard speed is a feature only when every action is also visible and the full map is one keypress away.

## Design Principles

1. **The tool disappears into the task.** Optimize for the agent mid-flow: fast load, fast scan, minimal clicks. Familiar affordances over invented ones. The interface earns trust by being predictable.
2. **Keyboard-first, command-driven.** Every primary action is reachable from the keyboard. A global command palette (Ctrl/Cmd-K) is the universal entry point — search any record, run any action, jump anywhere. `g`-prefixed shortcuts move between modules (`g` then `t` → Tickets); single-key actions act on the focused row or open item; `?` reveals the full map. Shortcuts are consistent across modules and **discoverable**, never hidden lore. The mouse is supported everywhere but required nowhere.
3. **Density with hierarchy.** Fit a lot of information per screen — that's a feature for power users — but never at the cost of legibility. Structure carries the density: clear grouping, alignment, and type hierarchy, not walls of gray.
4. **One system, many modules.** Tickets, Timekeeping, CRM, and Settings share one shell and must share one visual vocabulary: the same button, the same form control, the same table, the same status treatment, the same shortcuts everywhere. Consistency across modules beats per-screen cleverness.
5. **Status is a first-class language.** Tickets, attendance, and leads are all state machines. Lean on the semantic tokens (destructive / success / warning) so a status reads the same way in every module.
6. **Markdown-native authoring.** Long-form **description** fields (tickets, leads) are written and rendered as markdown so structure — headings, lists, code, links — survives and reads cleanly. Comments and short notes stay plain text: fast to write, nothing to learn. The renderer is shared, so a description looks identical in every module.
7. **Motion conveys state, never decorates.** 150–250 ms transitions for feedback, state change, and reveal — nothing orchestrated, nothing that makes a busy operator wait.

## Accessibility & Inclusion

WCAG AA is the floor and is already mandated by the project rules: every surface must pass AXE checks and meet WCAG AA minimums — focus management, color contrast (≥4.5:1 body, ≥3:1 large text), and correct ARIA. The keyboard-first model carries its own obligations:

- The command palette is an ARIA combobox/listbox: arrow-navigable, type-to-filter, `Esc` closes, and focus returns to the trigger on close.
- Shortcuts must **not** fire while the user is typing in an input, textarea, or contenteditable; they must never trap focus and must always be escapable.
- Every shortcut has a visible, mouse-reachable equivalent, and the full map is one `?` away — keyboard power is never the *only* path.

Honor `prefers-reduced-motion` on every transition (the app ships a light/dark theme via the `.app-dark` class, so respect user theme preference too). Don't rely on color alone to communicate ticket/attendance status — pair it with text or an icon.
