# MADHURA pricing

Updated 30 October 2026. This is the current pricing specification, applying the B+ recommendation in [profit.md](profit.md). [price.md](price.md) preserves the earlier proposal for comparison.

## Subscription catalog

All amounts are INR, excluding GST. Current checkout purchases 30 days of access and does not automatically renew.

| Plan | Monthly | Annual proposal | Branches | Seats | Numbers | Contacts | Monthly message grant | Monthly AI credits |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Free | ₹0 | — | 1 | 3 | 1 | 250 | ₹0 | 0 |
| Starter | ₹2,499 | ₹24,990 | 1 | 6 | 1 | 2,500 | ₹100 | 300 |
| Growth (Recommended) | ₹5,999 | ₹59,990 | 3 | 15 | 3 | 25,000 | ₹300 | 1,500 |
| Business | ₹17,499 | ₹1,74,990 | 10 | 40 | 10 | 1,00,000 | ₹1,000 | 5,000 |
| Enterprise | from ₹49,999 | ₹4,99,990 | 50 | 150 | 50 | 5,00,000 | ₹2,500 | 15,000 |

Enterprise has defined allowances. Larger deployments require a quote. ₹59,999 is a future Enterprise price experiment mentioned in `profit.md`, not the current price.

The monthly outbound ceilings are 1,000 / 10,000 / 50,000 / 2,00,000 / 10,00,000. These are operational limits, not prepaid message bundles. Message fees must be shown separately from the software price.

## Usage and add-on proposals

These are specifications for further implementation, not checkout options currently available in the app.

| Item | Proposed charge |
|---|---|
| Standard AI credit | ₹0.50; provider delivery fees billed separately |
| AI packs | 1,000 for ₹499; 5,000 for ₹1,749; 20,000 for ₹5,999 |
| Extra seat | ₹199/month, paid plans |
| Extra branch | ₹799/month, Growth and above |
| Extra WhatsApp number | ₹349/month, Business and above |
| White-label portal | ₹999/month, Growth and Business |
| Onboarding | ₹4,999 Starter/Growth; ₹9,999 Business, one time |
| BSP migration | ₹7,499, one time |
| Compliance pack | ₹1,999/month, Business and above |
| Message wallet packs | ₹500 / ₹1,000 / ₹5,000 / ₹10,000 / ₹25,000 face value |
| Wallet processing fee | ₹49 below ₹5,000; waived for first top-up and for ₹5,000 or more |

The 1,000-credit AI pack is aligned to the ₹0.50 retail target; larger packs retain the volume prices specified in the source documents. ₹0.13 per reply is a cost target, not a measured cost or a guaranteed margin. No additional percentage surcharge is specified: the flat processing-fee proposal replaces the earlier card-surcharge proposal pending payment-provider review.

Verify Meta's current official rate card before implementing message debits or publishing specific message prices. The historical rate tables and competitor claims in the source documents have not been independently verified by this implementation.

## Implementation status

- Shared subscription definitions: `backend/services/planCatalog.js`.
- Fresh database seeds and the legacy plan service use those definitions.
- The versioned `profit_pricing` migration updates the database catalog and stores annual proposals and grant metadata. Existing tenant allowances, subscriptions, and stored checkout amounts are preserved.
- The public billing catalog, signup plan selection and monthly checkout read the database catalog. The landing-page demo quotes the new ladder.
- Verified monthly payments now read the AI grant from the database plan (300 / 1,500 / 5,000 / 15,000). Grants are currently added to the existing wallet balance; expiry still requires implementation.
- Annual checkout, automatic renewals, message-wallet charging and grants, grant expiry, AI pack checkout and add-on checkout still require implementation. Grant metadata must not be interpreted as a working expiring message wallet.
- Existing contract price protection at renewal requires a versioned subscription-price policy before rollout; the current renewal checkout uses the current catalog price.

## Rollout and measurement

Deploy and validate the migration before accepting new-price orders. Honor existing paid terms. Measure new-signup conversion, tier mix, support costs, retention, and actual AI spend before expanding a price test to existing contracts. The margin and customer-count projections in `profit.md` are scenarios, not forecasts.
