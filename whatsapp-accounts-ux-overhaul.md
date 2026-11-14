# Task Plan: WhatsApp Accounts & Multi-Sender Platform UX Overhaul

**Task Slug:** `whatsapp-accounts-ux-overhaul`  
**Agent:** `frontend-specialist`  
**Active Mode:** Antislop Mode 1 (`DURING` — Session Override)  
**Brand Palette:** Deep Navy (`#202C52`) × Industrial Yellow (`#FCBD16`) on Light/Dark Ceramic Surfaces  

---

## 1. Context & Objectives

The `/whatsapp/accounts` route serves as the multi-tenant orchestration hub for WhatsApp senders, Meta Cloud onboarding, team dispatch rules, and AI assistant settings.
Currently:
1. `AccountWorkspace.jsx` uses legacy minimalist borders and raw HTML inputs (`accounts.css`) that feel disconnected from the polished command center in the rest of the application.
2. The tab bar is a static link set without badge metrics or state indicators.
3. Subcomponents (`WhatsAppSenderCenter.jsx`, `WhatsAppIntegrations.jsx`, `TeamAccessWorkspace.jsx`, and `Assistant`) need consistent hierarchy, robust mobile viewport reflows, WCAG AA contrast, and zero non-functional controls (anti-slop rule R-26).
4. All 4 tabs must be fully functional, responsive, keyboard-navigable, and crafted without generic AI slop.

---

## 2. Antislop & Frontend Architecture Principles

- **R-02 (Copywriting):** No em dashes (`—`). Clear, direct human labels.
- **R-03 (Mobile Responsiveness):** Minimum 44px tap targets, zero horizontal overflows, reflowing grid to single column on mobile.
- **R-17 & R-36 (Real Data):** No fake mock metrics or fabricated uptime numbers. Only real state or honest zero states.
- **R-24 & R-26 (Interactive Elements):** Zero dead buttons. Every tab, toggle, filter, drawer, modal, and button has a working handler.
- **R-25 (Color Contrast):** Strict WCAG AA compliance (4.5:1 for body, 3:1 for headers).
- **R-27 (UI States):** Complete Empty, Loading, and Error states for every tab and data view.
- **R-32 & R-39 (Accessibility):** Full keyboard navigation (`Tab`, `Enter`, `Escape`), visible focus rings (`outline: 3px solid #FCBD16`), accessible ARIA landmarks.
- **R-34 (Theme Support):** Seamless light and dark mode support using CSS variables.
- **Purple Ban:** Zero purple, violet, indigo, or mesh gradients. Solid industrial Navy + Yellow corporate system.

---

## 3. Work Breakdown

### Phase 2.1: Navigation & Header Enhancement (`AccountWorkspace.jsx`)
- Upgrade header with live organization indicator, quick status pills, and contextual action buttons.
- Modernize tab bar with active indicator, keyboard navigation, and live count chips:
  - *WhatsApp Numbers & Operations* (with active sender count badge)
  - *Meta Integrations & Signup* (with setup readiness badge)
  - *Assign & Team Access* (with unassigned agents badge)
  - *Business Assistant* (with AI status pill)
- Global feedback notifications (dismissible, accessible banner with live aria region).

### Phase 2.2: Modernized Theme & Component CSS (`accounts.css`)
- Replace legacy styling with design-token-driven CSS:
  - Responsive layout containers (`.ac-workspace`, `.ac-columns`, `.ac-panel`)
  - Crisp form controls with visible focus rings and ergonomic sizing (44px min-height)
  - Dark mode variables aligned with `--brand-navy` and `--brand-yellow`
  - High-density data stat bars with tabular numerals (`font-variant-numeric: tabular-nums`)
  - Status badges for Meta API health, phone quality ratings, and assignment status

### Phase 2.3: Tab 1 — WhatsApp Numbers & Operations (`WhatsAppSenderCenter.jsx`)
- Ensure search, branch filter, and tier filter operate fluidly.
- Ergonomic sender cards with real-time health indicator, quality rating, rate-limit consumption bar.
- Ping & Test message interactions with immediate optimistic feedback and inline drawer.
- Zero dead links or mock states.

### Phase 2.4: Tab 2 — Meta Integrations & Embedded Signup (`WhatsAppIntegrations.jsx`)
- Clear 3-way mode switch: *Embedded Signup (Meta Official)*, *Asset Discovery (Cloud API)*, and *Manual Credentials*.
- Stepped onboarding guidance with real clipboard copy buttons, setup checklist, and live token test.
- Empty and loading states during discovery.

### Phase 2.5: Tab 3 — Assign & Team Access (`TeamAccessWorkspace.jsx`)
- Interactive routing distribution cards (Round Robin vs Lowest Workload vs Manual).
- Number-to-team assignment matrix with agent search, quick filter, and batch toggle.
- Slide-over drawer for individual agent phone assignment.

### Phase 2.6: Tab 4 — Business Assistant (`Assistant` in `AccountWorkspace.jsx`)
- Visual overhaul of AI assistant configuration:
  - Toggle switch for AI auto-reply with clear active badge.
  - Provider selector cards (OpenAI, Gemini, Groq, DeepSeek) with credential status indicator.
  - System prompt editor with expandable guidelines and character counter.
  - Explicit confirmation for API key modification.

---

## 4. Verification & Testing Protocol

1. **Babel & ESLint Syntax Verification:** Pass with 0 errors.
2. **Keyboard Navigation Audit:** Tab through all controls in all 4 tabs; verify focus rings and Escape dismissals.
3. **Responsive Breakpoint Verification:** Test 375px (mobile), 768px (tablet), and 1280px+ (desktop).
4. **Theme Verification:** Confirm contrast in both Light and Dark modes.
