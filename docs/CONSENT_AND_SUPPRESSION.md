# Consent, Opt-In & Suppression Engine

Implemented in `backend/services/campaign/consentSuppressionService.js` and `/dashboard/campaigns/consent` + `/dashboard/campaigns/suppression`.

## Core Compliance Invariants
1. **Explicit Evidence Required**: Marketing consent (`marketing`, `promotional_updates`, `product_updates`) requires a valid `collection_method` and evidence (`captured_wording`, `form_reference`, or `evidence_payload`) persisted in `contact_consents`, `consent_evidence`, and `consent_events`.
2. **No Inferred Consent**: Saved contacts, uploaded spreadsheets, or past orders never implicitly grant marketing consent.
3. **Suppression Precedence**: Active entries in `contact_suppressions` (company, workspace, agency client, or compliance scope; `ALL` or category-specific) always override positive segment matches and granted consents.
4. **Live Opt-Out Cancellation**: Inbound opt-out keywords (`STOP`, `UNSUBSCRIBE`, `CANCEL`, `OPT OUT`, `OPTOUT`, `STOP ALL`, `REMOVE ME`, `NO MORE`) immediately revoke consent, create an active suppression, cancel all queued unsent `campaign_recipients` & `campaign_jobs`, and stop active journeys.
5. **Import Protection**: CSV/XLSX re-imports cannot silently re-enable revoked consent (`OPT_OUT_PROTECTED`).
