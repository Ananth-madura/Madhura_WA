# CSV & XLSX Audience Import

Implemented in `backend/services/campaign/audienceBuilderService.js` (`processImport`, `getImportReport`) and `/dashboard/campaigns/import`.

## Workflow
1. Client parses CSV/XLSX (`xlsx`) and previews columns.
2. Operator maps columns (`phone`, `name`, `email`, `tags`, `custom_fields`), chooses duplicate policy (`skip`, `update`, `merge`), and optionally maps consent evidence.
3. Backend normalizes international phone numbers, detects invalid characters/lengths and duplicates, and persists per-row results in `audience_imports` & `audience_import_rows`.
4. Syntactic validity is never equated with WhatsApp registration.
5. Prior opt-outs and blocked flags are strictly preserved; downloadable error CSV omits unnecessary PII.
