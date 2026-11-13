# AUTHENTICATION, RBAC & ABAC POLICY SPECIFICATION
## Madhura Role-Based & Attribute-Based Access Control

---

### 1. Authentication System

- **Token Protocol**: JSON Web Token (JWT) with HMAC-SHA256 signature (`JWT_SECRET`).
- **Token Claims**:
  ```json
  {
    "id": 723,
    "email": "admin@madhuratech.com",
    "role": "admin",
    "tenant_id": 1,
    "exp": 1794567890
  }
  ```
- **Two-Factor Authentication (2FA)**: Time-based OTP via email/SMS, toggleable per user profile in `users.two_factor_enabled`.
- **Session Management**: Revocable refresh tokens and browser session records in `browser_sessions`.

---

### 2. Role Hierarchy (RBAC)

| Role Code | Hierarchy Level | Capabilities & Scope |
| :--- | :--- | :--- |
| **`superadmin`** | Platform | Global system maintenance, agency provisioning, plan limits configuration. |
| **`organization_owner`** | Company / Agency | Full control over organization, billing, Meta accounts, WABA connections, branch creation, member invites. |
| **`organization_admin`** | Company | Administrative rights over CRM, campaigns, automations, templates, and employee management. |
| **`branch_manager`** | Branch / Workspace | Oversight of branch-specific contacts, conversations, sender assignments, and local staff. |
| **`agent` / `employee`** | Branch / Team | Live chat responding, contact management, deal creation, viewing assigned conversations. |
| **`read_only`** | Company / Branch | Reporting, audit logs, and dashboard viewing with zero write or export capabilities. |

---

### 3. Attribute-Based Access Control (ABAC) Policies

Policy decisions evaluate context dynamically:
1. **User Identity & Assigned Role**
2. **Resource Ownership** (`record.created_by == user.id` OR `record.assigned_agent_id == user.id`)
3. **Team Membership** (`user.team_id IN record.shared_teams`)
4. **Branch Affiliation** (`user.branch_id == record.branch_id`)
5. **Record Status** (e.g., locked after deal won, or closed ticket)
6. **Time / Business Hours** (e.g., outbound campaign dispatch limited to business windows)

#### ABAC Policy Matrix Example:

```javascript
function canAccessConversation(user, conversation) {
  // 1. Superadmin and Organization Admins have full access within tenant
  if (user.role === 'admin' || user.membershipRole === 'organization_owner' || user.membershipRole === 'organization_admin') {
    return true;
  }
  
  // 2. Branch Managers can access all conversations within their branch
  if (user.membershipRole === 'branch_manager' && user.branch_id === conversation.branch_id) {
    return true;
  }
  
  // 3. Agents can only access conversations explicitly assigned to them or shared with their team
  if (conversation.assigned_agent_id === user.id) return true;
  if (conversation.sharedUserIds?.includes(user.id)) return true;
  
  return false;
}
```

---

### 4. Granular Feature Permissions

| Permission Key | Description | Applicable Roles |
| :--- | :--- | :--- |
| `contacts:read` | View contact list and details | All |
| `contacts:write` | Create and edit contacts | Owner, Admin, Manager, Agent |
| `contacts:export` | Export contacts to CSV / Excel | Owner, Admin |
| `chats:send` | Send live WhatsApp messages | Owner, Admin, Manager, Agent |
| `campaigns:manage` | Create, schedule, and pause broadcasts | Owner, Admin, Manager |
| `automations:edit` | Modify workflow rules and chatbot flows | Owner, Admin |
| `accounts:connect` | Authorize Meta accounts and link WABAs | Owner, Admin |
| `billing:manage` | Manage subscriptions and payment methods | Owner |
| `audit:view` | Inspect operational audit trails | Owner, Admin, Manager |

---

### 5. Audit Logging
Every sensitive action produces an audit record:
- Table: `wa_workspace_audit` and `branch_audit_events`
- Logged attributes: `timestamp`, `tenant_id`, `branch_id`, `actor_user_id`, `action_type`, `resource_type`, `resource_id`, `ip_address`, `before_state_json`, `after_state_json`.
