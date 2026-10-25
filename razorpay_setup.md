# Razorpay billing setup

The billing page now opens Razorpay Standard Checkout. The server creates the order from the plan catalog, checks the returned signature, fetches the payment and requires a fully captured amount in the stored currency before activating the plan. Activation, the payment event, the subscription period and the wallet grant commit in one MySQL transaction. Duplicate browser/webhook confirmations do not grant credits twice.

The supplied key pair is saved only in the ignored `backend/.env`. A read-only call to Razorpay's Orders API returned HTTP 200, confirming authentication. No live order, charge, refund or transfer was initiated. Rotate the secret shared in chat and replace it in the server environment before going live. Credentials are absent from committed examples and frontend bundles.

## Server and Dashboard

1. Connect `api.madhuratech.in` to the VPS with HTTPS using [live_domains.md](live_domains.md). The VPS was not connected when this implementation was tested.
2. Securely provision these backend-only variables using the rotated key pair:

   ```dotenv
   RAZORPAY_KEY_ID=your_rotated_key_id
   RAZORPAY_KEY_SECRET=your_rotated_key_secret
   RAZORPAY_WEBHOOK_SECRET=your_independent_webhook_secret
   RAZORPAY_CHECKOUT_ENABLED=1
   BILLING_ALLOW_DEV_PAYMENTS=0
   ```

   The local backend environment has an independent webhook secret ready to copy securely into the Dashboard. The key secret and webhook secret serve different checks; do not interchange them. Never put either secret in a `REACT_APP_*` or `VITE_*` variable.
3. In the matching Razorpay Dashboard mode, add webhook URL **`https://api.madhuratech.in/webhooks/razorpay`**, set the identical webhook secret and enable `payment.captured` and `order.paid`. The `/webhooks/razorpay/webhook` compatibility URL also works; use one webhook registration to avoid unnecessary duplicates. Merely storing the secret locally does not register this Dashboard webhook.
4. Configure automatic payment capture in Razorpay. Authorized but uncaptured payments remain pending and do not activate a paid plan. Unknown orders and unrelated webhook event types do not change plans. Database/provider errors return a retryable response instead of acknowledging failed settlement.
5. Deploy the backend, run its enterprise schema migration as usual, restart the backend process, and redeploy `frontend`. The migration grants billing permissions to the built-in `billing_admin` role. Existing custom roles still need explicit `billing.read` / `billing.manage` grants. Organization owners and platform administrators retain their existing authorization.
6. Run from the backend directory:

   ```sh
   node scripts/check-razorpay.js
   node scripts/check-razorpay.js --authenticate
   ```

   The first command reports configuration without a provider request. The optional authentication check makes a read-only request and prints status only; it never creates an order or prints credentials/customer records. `configured` checks presence/shape, and `webhookConfigured` checks the local secret; neither proves Dashboard delivery. A successful authentication check does not certify account activation, every payment method or settlement eligibility.

## Billing controls and recovery

### New accounts from `/signup`

1. Signup loads the same active database plan catalog used by Checkout. It blocks submission when that catalog is unavailable, with a retry action.
2. The backend creates the user, organization, head-office branch, memberships and initial wallets in one MySQL transaction. Every new organization starts on the catalog's **free** plan. Choosing a paid plan saves its ID as `tenants.pending_plan_id`; it does not grant paid quotas.
3. Browser signup establishes the existing HttpOnly cookie session, then opens `/whatsapp/billing?onboarding=1&plan=...` for a paid selection. Free selection opens the inbox directly. The billing page offers payment or an explicit **Continue on the free plan** action.
4. Cancelling payment leaves the account usable on the free plan. Its owner can sign in later to resume the saved selection. Successful verified settlement activates the chosen plan and clears the pending selection in the same transaction. The next normal login opens the workspace.
5. The in-app plan modal opens the same billing page; its previous fake confirmation code has been removed. Creating an additional organization also starts on free quotas and records a requested paid plan for Checkout.

Deploy the backend before the frontend: schema version **7** adds `pending_plan_id`, corrects the quoted MySQL `interval` column and creates billing indexes with MySQL-compatible syntax. The migration version was bumped so existing version-6 installations run these changes. Use the normal migration/startup procedure and verify readiness before accepting signups. Existing paid organizations are not automatically downgraded by this signup change.

- `/whatsapp/billing` lists plans, quotas, balances, gateway mode and the latest 50 orders for the selected organization.
- Users with `billing.manage` can pay, renew and check payment status. Read-only billing users cannot initiate payments. The backend enforces membership and permissions on every protected request; the UI takes its manage capability from the backend.
- Checkout uses the server's actual order ID and provider-returned payment proof. Closing/failing Checkout does not submit a fake confirmation. Free plans skip the payment widget and do not repeatedly award wallet bonuses.
- Use **Check payment status** after a timeout or delayed capture. This fetches the provider's existing payment state and reconciles the recorded order; it does not charge again. Signed webhooks can also complete activation when the browser closes.
- **Renew for 30 days** adds 30 days after the current period end for the same active plan, or after now if the old period ended. Switching to a different plan starts a new 30-day period immediately. There is no proration calculation.
- Set `RAZORPAY_CHECKOUT_ENABLED=0` and restart the backend to pause new paid checkouts. Confirmation, status checks and signed webhooks remain available for payments already in progress.
- Plans use one-time monthly Checkout orders. This implementation does not create Razorpay recurring subscriptions or authorize automatic bank debits. Refunds, disputes, customer invoices/payment links and cancellation of recurring mandates are separate operations; this pass does not implement those controls or automatic reversal of already granted access. The legacy WhatsApp customer-payment-link routes are not the subscription checkout implemented here. Subscription expiry enforcement across all legacy CRM modules remains a separate entitlement-policy task.

## Verification

- 19 frontend suites / 45 tests passed, including paid/free signup, unavailable catalog retry, cookie session preservation, safe login destinations, pending signup continuation, plan-modal routing, real-proof submission, Checkout dismissal, read-only controls, an unavailable API and the widget adapter.
- The safe backend integration command passed 12 suites, including isolated MySQL and the existing inbox/session/flow pipeline. Payment tests cover tenant/plan isolation, fake signatures, amount/currency/capture/refund checks, signed raw webhooks, retryable failures, concurrent settlement, rollback/retry, manual recovery, renewal and free-plan bonus protection.
- Frontend production build passed using your production domains. Existing legacy lint warnings elsewhere remain; changed billing files pass targeted lint.
- Provider transport in payment integration tests is a local HTTP fixture. Live credentials were checked read-only. Real Checkout payment completion and Dashboard webhook delivery must still be verified after deployment, starting in Razorpay test mode.
- The actual backend startup test also creates a new paid-selection account over HTTP, verifies free quotas and cookie login, resumes its pending plan on a later login, rejects duplicate/invalid signup, forces a branch-creation failure and checks rollback, completes fixture-backed Razorpay payment, and verifies the next login, free signup and skipped payment.
- This workspace uses Node 26.1.0. Repeat the release checks under the declared Node 24 runtime.

The implementation follows Razorpay's [Standard Checkout integration](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/), [payment fetch API](https://razorpay.com/docs/api/payments/fetch-with-id/) and [webhook validation guidance](https://razorpay.com/docs/webhooks/validate-test/).
