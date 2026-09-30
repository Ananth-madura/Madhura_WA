# Design — Madhura WhatsApp CRM

A locked design system for this app. Every page redesign reads this file before
emitting code. Do not regenerate per page — extend or amend this file when the
system needs to grow.

*Mood: Corporate sharp — deep navy surfaces, restrained yellow accents, dense and efficient.*

## Genre
modern-minimal

## Macrostructure family
- Marketing pages: n/a (this app has none)
- App pages: Workbench — command bar (page title + primary action right) → KPI strip → dense work surface (table/board/chat) → detail drawer/modal. Pages vary only in work-surface archetype.
- Entry page (login): single centered card on deep-navy field. No enrichment.

## Theme
- `--color-paper`     oklch(97.02% 0.0000 89.88)  (cool paper #F5F5F5)
- `--color-paper-2`   oklch(100.00% 0.0000 89.88) (card white #FFFFFF)
- `--color-ink`       oklch(30.35% 0.0706 268.74) (navy ink #202C52)
- `--color-ink-2`     oklch(54.44% 0.0350 265.11) (secondary #667085)
- `--color-rule`      oklch(93.10% 0.0000 89.88)  (hairline #E8E8E8)
- `--color-accent`    oklch(83.37% 0.1679 83.66)  (signal yellow #FCBD16)
- `--color-accent-ink` oklch(30.35% 0.0706 268.74) (navy text on yellow)
- `--color-focus`     oklch(77.67% 0.1601 81.75)  (deep yellow #E9AA00)
- `--color-shell`     oklch(18.06% 0.0676 266.57) (deep navy #050E2F)
- `--color-shell-2`   oklch(34.92% 0.0704 268.65) (raised navy #2B385F)

Accent budget: yellow ≤ 5% per viewport — primary actions, active states, one brand mark. Never large fills.

## Typography
- Display: Poppins, weight 600–700, style normal (italic headers banned)
- Body: Inter, weight 400–500
- Mono: JetBrains Mono, weight 400–500 (IDs, timestamps, phone numbers)
- Display tracking: -0.02em on page titles
- Type scale anchor: page title = clamp(1.25rem, 1rem + 1vw, 1.75rem), Poppins 600

## Spacing
4-point named scale. Values live in `:root` (`--space-*`). Pages must use named
tokens or the Tailwind 4-pt scale, never raw values.

## Motion
- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (primary), `--ease-in-out` for drawers
- Reveal pattern: fade + 8px rise, 220ms, staggered ≤ 60ms on lists. No scroll-jacking.
- Reduced-motion fallback: opacity-only, ≤ 150ms.

## Microinteractions stance
- Silent success (inline confirmation, never celebratory toasts)
- Hover delay 800ms on tooltips · focus delay 0ms
- Optimistic update + Undo over confirmation dialogs
- `:focus-visible` ring: 2px `--color-focus`, instant (never animated)

## CTA voice
- Primary CTA: solid navy (`--color-ink`) fill, white text, 10px radius, 600 weight. Yellow is NOT a button fill — it marks the active/selected state.
- Secondary CTA: 1px `--color-rule` outline, navy text, same radius/padding rhythm.
- Destructive: text-only or outline in `--color-error`, never solid red fill.
- Copy pattern: verb-first, ≤ 3 words ("Send campaign", "New template", "Save flow").

## Per-page allowances
- App pages MUST NOT use enrichment — function carries the page.
- Login MAY use one Tier-A CSS-art detail (radial glow field, no imagery).

## What pages MUST share
- The wordmark: yellow square-cut mark + "Madhura WhatsApp CRM" in Poppins 600.
- Accent placement: active nav item, primary-action affordance, status dots only.
- Display + body fonts. CTA voice above. Command-bar rhythm (title left, actions right).
- Table voice: 13px Inter, 44px rows, hairline dividers, navy header labels at 11px uppercase 600.

## What pages MAY differ on
- Work-surface archetype (chat split-pane, board, table, builder canvas, stat grid).
- KPI strip composition (only metrics the backend actually returns — no invented stats).
- Drawer vs modal for detail views.

## Exports

### tokens.css (appended to `src/index.css`, never inlined elsewhere)
```css
:root {
  --color-paper:      oklch(97.02% 0.0000 89.88);
  --color-paper-2:    oklch(100.00% 0.0000 89.88);
  --color-ink:        oklch(30.35% 0.0706 268.74);
  --color-ink-2:      oklch(54.44% 0.0350 265.11);
  --color-rule:       oklch(93.10% 0.0000 89.88);
  --color-accent:     oklch(83.37% 0.1679 83.66);
  --color-accent-ink: oklch(30.35% 0.0706 268.74);
  --color-focus:      oklch(77.67% 0.1601 81.75);
  --color-shell:      oklch(18.06% 0.0676 266.57);
  --color-shell-2:    oklch(34.92% 0.0704 268.65);

  --font-display: "Poppins", "Inter", sans-serif;
  --font-body: "Inter", -apple-system, "BlinkMacSystemFont", sans-serif;

  --space-3xs: 0.25rem; --space-2xs: 0.5rem; --space-xs: 0.75rem;
  --space-sm: 1rem;     --space-md: 1.5rem;  --space-lg: 2rem;
  --space-xl: 3rem;     --space-2xl: 4.5rem; --space-3xl: 7rem;

  --text-xs: 0.75rem; --text-sm: 0.875rem; --text-md: 1.125rem;
  --text-lg: 1.375rem; --text-xl: 1.75rem; --text-2xl: 2.25rem;

  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --dur-short: 220ms;
  --radius-card: 14px; --radius-pill: 999px; --radius-input: 10px;
}
```
