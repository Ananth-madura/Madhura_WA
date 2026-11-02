---
type: project
created: 2026-07-18
updated: 2026-07-18
---

# Technical Decisions

- Component metadata uses SemVer while the toolkit release keeps CalVer.
- `manifest.json` and `manifest.lock.json` must remain synchronized with component frontmatter.
- WhatsApp Automations: Dedicated `wa_automation_checkpoints` table persists in-flight conversation state across backend restarts.
- WhatsApp Automations: PDF invoices/quotations streamed directly via WhatsApp Cloud media API with verified payment event triggers.
- WhatsApp Automations: Full diagnostic evaluation for nested conditions recording step-by-step telemetry in execution logs.
