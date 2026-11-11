import React from "react";

/**
 * Modular inline parameter editor for multi-step Automation Pipeline actions
 * inside /whatsapp/automations/create and /whatsapp/automations/:id/edit.
 */
export default function AutomationPipelineParams({ action, flows = [], onPatchParams }) {
  const params = action?.params || {};
  const set = (patch) => onPatchParams({ ...params, ...patch });

  switch (action?.type) {
    case "send_bill":
    case "send_receipt":
    case "send_payment_link":
      return (
        <div className="space-y-2">
          <textarea
            rows={2}
            placeholder={
              action.type === "send_bill"
                ? "Custom bill message caption (uses verified CRM invoice values)"
                : action.type === "send_receipt"
                ? "Receipt confirmation text with verified reference"
                : "Payment link message caption"
            }
            value={params.caption || params.text || ""}
            onChange={(e) => set(action.type === "send_bill" ? { caption: e.target.value } : { text: e.target.value })}
            className="w-full rounded border border-slate-300 p-2 text-xs"
          />
          {action.type === "send_payment_link" && (
            <input
              type="url"
              placeholder="Optional verified payment portal base HTTPS URL"
              value={params.payment_url || ""}
              onChange={(e) => set({ payment_url: e.target.value })}
              className="w-full rounded border border-slate-300 p-1.5 text-xs font-mono"
            />
          )}
        </div>
      );

    case "start_flow":
      return (
        <div>
          <select
            value={params.flow_id || ""}
            onChange={(e) => set({ flow_id: e.target.value })}
            className="w-full rounded border border-slate-300 p-1.5 text-xs bg-white"
          >
            <option value="">-- Choose active conversational Flow Bot --</option>
            {flows.map((fl) => (
              <option key={fl.id} value={fl.id}>
                {fl.name} ({fl.status})
              </option>
            ))}
          </select>
        </div>
      );

    case "update_crm":
      return (
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            placeholder="CRM field (e.g. stage, notes, email, city)"
            value={params.field || ""}
            onChange={(e) => set({ field: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs"
          />
          <input
            type="text"
            placeholder="New value or {placeholder}"
            value={params.value || ""}
            onChange={(e) => set({ value: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs"
          />
        </div>
      );

    case "assign_employee":
      return (
        <input
          type="text"
          placeholder="Assigned agent name or team label"
          value={params.agent_name || ""}
          onChange={(e) => set({ agent_name: e.target.value })}
          className="w-full rounded border border-slate-300 p-1.5 text-xs"
        />
      );

    case "branch_condition":
      return (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-50 p-2 rounded border border-slate-200">
          <input
            type="text"
            placeholder="Field (e.g. amount)"
            value={params.field || ""}
            onChange={(e) => set({ field: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs bg-white"
          />
          <select
            value={params.operator || "equals"}
            onChange={(e) => set({ operator: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs bg-white"
          >
            <option value="equals">equals</option>
            <option value="not_equals">not equals</option>
            <option value="contains">contains</option>
            <option value="gte">&gt;=</option>
            <option value="lte">&lt;=</option>
          </select>
          <input
            type="text"
            placeholder="Compare value"
            value={params.value || ""}
            onChange={(e) => set({ value: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs bg-white"
          />
          <select
            value={params.on_false || "stop"}
            onChange={(e) => set({ on_false: e.target.value })}
            className="rounded border border-slate-300 p-1.5 text-xs bg-white"
          >
            <option value="stop">If false: Stop pipeline</option>
            <option value="skip_next">If false: Skip next step</option>
          </select>
        </div>
      );

    case "internal_notification":
      return (
        <input
          type="text"
          placeholder="Internal team alert message (supports {name}, {invoice_no}...)"
          value={params.message || ""}
          onChange={(e) => set({ message: e.target.value })}
          className="w-full rounded border border-slate-300 p-1.5 text-xs"
        />
      );

    case "call_webhook":
      return (
        <div className="space-y-2">
          <div className="grid grid-cols-4 gap-2">
            <select
              value={params.method || "POST"}
              onChange={(e) => set({ method: e.target.value })}
              className="rounded border border-slate-300 p-1.5 text-xs bg-white font-mono"
            >
              <option value="POST">POST</option>
              <option value="GET">GET</option>
              <option value="PUT">PUT</option>
            </select>
            <input
              type="url"
              placeholder="https://api.example.com/webhook"
              value={params.url || ""}
              onChange={(e) => set({ url: e.target.value })}
              className="col-span-3 rounded border border-slate-300 p-1.5 text-xs font-mono"
            />
          </div>
          <label className="flex items-center gap-2 text-[11px] text-slate-600">
            <input
              type="checkbox"
              checked={params.stop_on_error !== false}
              onChange={(e) => set({ stop_on_error: e.target.checked })}
            />
            <span>Halt pipeline &amp; log uncertain/failed status if webhook fails (prevents duplicate side effects)</span>
          </label>
        </div>
      );

    case "ai_process":
      return (
        <div className="space-y-2">
          <textarea
            rows={2}
            placeholder="AI instruction prompt (e.g. Summarize lead intent for {name})"
            value={params.prompt || ""}
            onChange={(e) => set({ prompt: e.target.value })}
            className="w-full rounded border border-slate-300 p-2 text-xs"
          />
          <div className="flex flex-wrap items-center gap-3">
            <input
              type="text"
              placeholder="Output variable (default: ai_output)"
              value={params.output_var || ""}
              onChange={(e) => set({ output_var: e.target.value })}
              className="flex-1 min-w-[160px] rounded border border-slate-300 p-1.5 text-xs font-mono"
            />
            <label className="flex items-center gap-1.5 text-[11px] text-slate-700">
              <input
                type="checkbox"
                checked={Boolean(params.send_reply)}
                onChange={(e) => set({ send_reply: e.target.checked })}
              />
              <span>Send AI output to customer</span>
            </label>
          </div>
        </div>
      );

    default:
      return null;
  }
}
