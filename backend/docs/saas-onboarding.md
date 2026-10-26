# Organization and employee onboarding

Self-signup and employee invitations create different kinds of accounts.

| Entry point | Result |
| --- | --- |
| `POST /api/auth/self-signup` | A new organization, its head-office branch, an active admin account, an `organization_owner` membership, and an owner branch assignment are committed together. |
| `POST /api/auth/employees` | An authorized organization administrator creates a pending employee in an active branch belonging to that organization. Account, membership, staff record and branch assignment are committed together. The response includes the private access code. |
| `POST /api/auth/verify-access-code` | Verifies the code against the account's actual active organization membership and branch assignments; returns organization/branch details and whether activation is required. |
| `POST /api/auth/join-with-access-code` | A pending employee chooses a password and activates within the saved organization and branch assignments. A returning employee must supply their existing password. This endpoint never changes an active password or restores a banned/revoked account. |
| `POST /api/auth/login` | Email, employee ID or access code plus normal credentials resolves the existing organization membership and permitted branches. Login creates no membership or branch assignment. |

Employee sessions use the role granted by the stored organization membership. Client-supplied `role`, `tenant_id` and `branch_id` cannot override an invitation. The response includes only assigned active branches for members; organization owners and administrators receive their organization's active branches. Two-factor sign-in uses the same session resolver. Returning accounts with two-factor enabled must complete the regular login flow.

Each tenant remains isolated. A branch belonging to another organization cannot be used when creating an employee. Missing or inactive memberships and missing active branch assignments fail before a usable workspace session is returned. An owner belonging to multiple organizations can manage a selected organization only through its actual active membership.

The signup frontend preserves the organization and branch returned by the server. The access-code form shows a new-password confirmation only for first activation and asks returning employees for their existing password.

## Verification

`tests/test_saas_onboarding_mysql.js` creates and removes a dedicated `saas_onboarding_test_*` schema on a local test MySQL server. It exercises real HTTP routes for two independent owner signups, branch creation, employee creation, invitation preview, activation, normal login, two-factor completion, browser cookies and `/api/v2/me`. It also checks activation rollback, foreign branches, organization and branch isolation, role injection, employee administration denial, password replacement rejection, banned/revoked accounts, and an existing owner's second organization. It does not modify application customer data.

Configure `INBOX_TEST_MYSQL_PORT`, `INBOX_TEST_MYSQL_USER` and `INBOX_TEST_MYSQL_PASSWORD` for a local test instance, then run:

```text
node backend/tests/test_saas_onboarding_mysql.js
```

Frontend regressions are in `frontend/src/auth/signup.test.jsx`, alongside login and enterprise-context tests.
