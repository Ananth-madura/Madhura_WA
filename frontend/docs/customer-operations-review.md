# Customer operations page update

Routes: `/whatsapp/team-inbox`, `/whatsapp/workspace`, `/whatsapp/enquiries`.

The existing product identity supplies the direction: navy text and conversation bubbles, yellow primary actions, neutral working surfaces, and the application's existing typography. Compact record headers and selected rows repeat across the pages so staff can move between conversations and customer work without relearning controls. ENERGY 2 / RHYTHM 2 / MOTION 1. No new animation or generated content is needed for these working screens.

## Layout and behavior

- Inbox: three panes on wide screens; a customer-record toggle on tablets; list, conversation, and record views on phones. Back controls restore access to the list. Thread loading is explicit; selection resets conversation-specific drafts. Read-only users cannot submit text replies. New messages follow the scroll position when the reader is already near the bottom.
- Workspace: customer list and work area on desktop; separate list and customer views on phones. Profile and consent forms are disclosures so records remain the focus. Record loading and empty states are separate. A permitted customer module is selected when the current module is unavailable.
- Enquiries: one shared header and actionable metrics; labeled search and filters; desktop rows reflow to cards on phones. Search is debounced, older responses cannot replace newer results, and temperature filters follow browser history. Dialog fields have associated labels; the conversion result traps focus and closes with Escape. Edit controls follow enquiry permissions.

New CSS is scoped to `.crm-ops`; the only shell rule applies on narrow screens containing these pages, allowing header controls to scroll without overlapping the logo or organization selector.

## Verification

- Production build: `npm.cmd run build` in `frontend`.
- Changed JSX lint: local ESLint with `--max-warnings=0`.
- Component regressions: `EmployeeWorkspace.test.jsx` and `whatsappEnquiries.test.jsx`, including stale search responses and read-only controls.
- Browser regression: `node backend/tests/test_customer_operations_browser.js`, using fixture APIs and the production build. Covers 320, 390, 768, 1024 and 1440 pixel layouts, replies, shared notes, customer tasks, filter history, enquiry create/convert/edit/delete dialogs, and error retry. Screenshots are saved in `scratch/customer-ops-*.png`.
- Core contrast pairs: muted text/white 6.36:1; navy/yellow 8.05:1; navy/white 13.61:1; input border/white 3.11:1.

Browser checks use fixture data. They do not send live WhatsApp messages or verify production provider delivery. The full frontend test run has an unrelated navigation-suite setup failure: the Axios mock in `WhatsAppNav.test.jsx` lacks the interceptors used by `AuthContext`.
