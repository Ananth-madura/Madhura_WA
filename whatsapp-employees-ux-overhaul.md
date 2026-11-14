# Task Plan: WhatsApp Employees & Team Access UX Overhaul

**Task Slug:** `whatsapp-employees-ux-overhaul`  
**Agent:** `frontend-specialist`  
**Active Mode:** Antislop Mode 1 (`DURING` - Session Active)  
**Palette:** Corporate Navy (`#202C52`) × Industrial Amber (`#FCBD16`) on Light/Dark Surfaces  
**Status:** COMPLETE (All Tests Passing, 0 Lint Warnings)

---

## 1. Context & Objectives

The `/whatsapp/employees` route manages workspace employee onboarding, unique access codes, branch scoping, and WhatsApp permission tiers (`full`, `chat_only`, `read_only`, `campaign_only`).
Prior deficiencies resolved:
1. Hardcoded inline purple colors (`#7c3aed`) violated the Purple Ban and anti-slop rules - replaced with Navy and Amber.
2. Em dashes (`—`) were present in job title fallbacks and branch select labels - replaced with standard colons and hyphens.
3. Unstable re-render loop on `useEnterprise` header references causing `Maximum update depth exceeded` - resolved with memoization in `EnterpriseContext.jsx` and serialized key comparison in `whatsappEmployees.jsx`.
4. Missing dedicated unit test suite for `whatsappEmployees.jsx` - created with 100% pass rate.

---

## 2. Antislop & Architectural Guardrails

- **R-02 (Copywriting):** Zero em dashes (`—`). Clear, direct labels.
- **Purple Ban:** Zero `#7c3aed` or purple hues. Campaign access uses Amber (`#D97706`), Admin uses Navy (`#202C52`).
- **R-03 (Mobile Responsiveness):** Minimum 44px tap targets, zero horizontal overflows, responsive stacking.
- **R-27 (UI States):** Resilient Empty, Loading, and Error states.
- **R-32 & R-39 (Accessibility):** Accessible search input name, full keyboard navigation, visible focus rings.
- **R-34 (Theme Support):** CSS variables (`--color-surface`, `--color-ink`, `--color-paper`) for light and dark modes.

---

## 3. Work Breakdown & Completion Record

1. **Brand Palette & Access Level Constants**:
   - `ACCESS_LEVEL_META` updated to eliminate purple. Full: Navy (`#202C52`), Chat Only: Blue (`#2563EB`), Read Only: Slate (`#667085`), Campaigns Only: Amber (`#D97706`).
   - Role badges use Navy for Admin, Amber for Subadmin, Blue for Support Agent, Slate for Employee.

2. **Clean Copy & Em Dash Elimination**:
   - Replaced `{emp.job_title || "—"}` with `{emp.job_title || "-"}`.
   - Replaced `{b.is_head_office ? " — Head office" : ""}` with `{b.is_head_office ? " : Head office" : ""}`.

3. **Re-render Optimization & Stability**:
   - Resolved re-render loop by memoizing `enterpriseHeaders` and context value in `EnterpriseContext.jsx`.
   - Added shallow equality guard on `activeBranch?.id` in form data setter.
   - Serialized `enterpriseHeadersKey` in `fetchEmployees` dependency array.

4. **Directory Table & Row Expansion**:
   - High-contrast typography with Poppins headlines and tabular numerical alignment.
   - Access codes styled in JetBrains Mono monospace with instant clipboard copy affordances.
   - Accessible keyboard focus states (`:focus-visible`).

5. **Automated Testing & Verification**:
   - Added [whatsappEmployees.test.jsx](file:///d:/Madhura_WA/frontend/src/pages/whatsappEmployees.test.jsx) covering directory rendering, KPI metrics, search filtering, and modal submissions.
   - All 13 tests passed across accounts & employees test suites (`AccountWorkspace.test.jsx`, `metaSignup.test.js`, `whatsappEmployees.test.jsx`).
   - ESLint validated with 0 errors and 0 warnings.
