import React from "react";
export default function AutomationWorkspaceSummary({ stats, senders, templates, navigate, onLogs }) {
  const connected = senders.filter(sender => sender.status === "connected").length;
  const approved = templates.filter(template => template.meta_status === "APPROVED").length;
  return <section aria-label="Automation workspace readiness" className="hl-card p-4 sm:p-5 space-y-4 mb-5">
    <div className="flex flex-wrap justify-between gap-3"><div><h2 className="font-semibold">Workspace readiness</h2><p className="text-xs mt-1">{stats.scheduler?.running ? "Scheduled dispatch is running" : "Scheduled dispatch is not running"}{stats.scheduler?.lastSweepAt ? ` · Last checked ${new Date(stats.scheduler.lastSweepAt).toLocaleTimeString()}` : ""}</p>{stats.scheduler?.lastError && <p role="alert" className="text-xs text-red-700 mt-1">{stats.scheduler.lastError}</p>}</div><button type="button" className="hl-btn-secondary" onClick={onLogs}>Inspect executions</button></div>
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-sm"><div><strong>{connected}</strong> connected senders</div><div><strong>{approved}</strong> approved templates</div><div><strong>{stats.scheduledCount || 0}</strong> scheduled messages</div><div><strong>{stats.unknownCount || 0}</strong> uncertain deliveries</div></div>
    <nav aria-label="Connected automation workspaces" className="flex flex-wrap gap-3">{[["accounts", "Manage senders"], ["templates", "Manage templates"], ["flows", "Build workflows"], ["groups", "Contact groups"], ["contacts", "Contacts and consent"]].map(([path, label]) => <button type="button" key={path} className="text-xs underline underline-offset-4" onClick={() => navigate(`/whatsapp/${path}`)}>{label}</button>)}</nav>
    {(!connected || !approved) && <p className="text-xs">{!connected ? "Connect a Meta sender before enabling rules. " : ""}{!approved ? "Approved templates are required for messages outside the customer service window." : ""}</p>}
  </section>;
}
