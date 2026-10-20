# WhatsApp operations workspaces

The inbox at `/whatsapp` is the visual reference. Its page and stylesheet were not edited in this work. New CSS is scoped to the operations workspace and the flow studio.

## Direction

Use the existing `design.md`: navy ink, white work surfaces, cool paper, restrained yellow selection, Poppins headings and Inter body text. Energy 2, rhythm 2, motion 1. Dense customer records, visible actions and readable settings take priority over decoration. No new illustration or image assets.

The shared breadcrumb and optional quick guide explain each workspace's actual task. Longer pages expose section shortcuts. Metric strips use existing API data. Table dividers support scanning; yellow marks selection; animations are limited to existing transitions with a reduced motion fallback.

## Changes

- Contacts: request ordering, consent filters in demo mode, phone validation, save progress, inline errors and recoverable block/delete failures.
- Templates: collapsible variable reference, separate first-use and filtered empty states, and selected-template handoff to the automation form.
- Groups: name/description search, sorting, keyboard expansion, request ordering, create progress and dialog focus.
- Automations: message validation, duplicate submission protection, partial-save recovery, inline errors and selected-template handling.
- Reminders: workspace-specific error recovery and clearer action labels. The shared component keeps its existing presentation when used without the workspace prop.
- Flows: block/step/settings navigation, searchable outline, issue-to-step navigation, trigger and entry configuration, load-error save protection, blocking publish checks and execution history across flows. Save a draft, create a published version, then activate it through the existing status endpoint.
- Analytics: request ordering, log filter pagination reset and export URL cleanup.
- Branches: light work surfaces, search, empty states, refresh, save guard and accessible editing dialog.
- Accounts: shared typography, surfaces, section navigation and service-setting hierarchy.
- Employees: shared command bar, clearer copy, dialog focus and honest clipboard feedback.
- Client portal administration: shared navigation, client selection styling and responsive document/access panels.

## Review

JSX and CSS parsing and a production build are used for implementation validation. The project contains existing lint warnings. New primary text, secondary text, selection, focus and error palette pairs were checked using WCAG relative luminance: all checked text pairs exceed 4.5:1.

An interactive browser tool was unavailable in this session. Mobile rendering, 200% zoom, end-to-end keyboard use and authenticated API mutations still require runtime review. Source-level responsive and focus rules do not establish that those browser checks passed. No live messages were sent and no backend data was changed during validation.
