# Meta Developer MCP Integration & Diagnostic Tools

This guide outlines the configuration, authentication, and security isolation rules for using official Meta Model Context Protocol (MCP) servers within Antigravity during the development, testing, and App Review phases of the Madhura WhatsApp SaaS platform.

---

## 1. Official Meta MCP Servers

Meta provides official developer-facing MCP endpoints to assist in building, testing, and reviewing WhatsApp Business applications:

1. **Meta Developer Tools MCP Server**:
   - **Endpoint / URL**: `https://mcp.facebook.com/devtools`
   - **Purpose**: App configuration inspection, App Review readiness checking, granular permission audits (`whatsapp_business_management`, `whatsapp_business_messaging`), and test webhook event firing.
2. **Meta WhatsApp Business Tools MCP Server**:
   - **Endpoint / URL**: `https://mcp.facebook.com/whatsapp_business_tools`
   - **Purpose**: WABA diagnostic inspection, Message Template submission/approval status checks, and phone number registration health checks.

---

## 2. Configuration in Workspace (`.agents/mcp_config.json`)

To enable developer diagnostic tools in Antigravity without exposing customer data, configure the MCP servers in `.agents/mcp_config.json`:

```json
{
  "mcpServers": {
    "metaDevTools": {
      "url": "https://mcp.facebook.com/devtools",
      "headers": {
        "Authorization": "Bearer ${META_DEVELOPER_ACCESS_TOKEN}"
      }
    },
    "metaWhatsAppBusinessTools": {
      "url": "https://mcp.facebook.com/whatsapp_business_tools",
      "headers": {
        "Authorization": "Bearer ${META_DEVELOPER_ACCESS_TOKEN}"
      }
    }
  }
}
```

---

## 3. Strict Security Isolation Boundary

> [!CAUTION]
> **Developer Diagnostic MCP vs Customer Production Tokens**:
> - **Developer MCP Scope**: Exclusively used by developers and operators to inspect Meta App Settings, review webhook field subscriptions, and verify App Review checklist requirements.
> - **Zero Customer Data Leakage**: Customer WhatsApp tokens generated via Embedded Signup are encrypted at rest with AES-256-GCM in the application database (`waba_connections`, `meta_connections`). Customer production tokens and message payloads must **NEVER** be passed to or routed through developer MCP servers.
> - **Environment Guard**: If `NODE_ENV=production`, developer MCP tools are disabled from inspecting tenant credentials.

---

## 4. App Review Checklist & Testing

Before submitting the Madhura WhatsApp Meta App for Public Mode and App Review:
1. Ensure the following permissions are approved in App Review:
   - `whatsapp_business_management`
   - `whatsapp_business_messaging`
   - `public_profile`
   - `email`
2. Configure **Tech Provider** / **Embedded Signup** in WhatsApp Manager under *Configuration > Embedded Signup*.
3. Set the Webhook Callback URL to:
   - `https://live.wa.madhuratech.in/webhook`
4. Subscribe to the `messages` field under WhatsApp Business Account Webhooks.

