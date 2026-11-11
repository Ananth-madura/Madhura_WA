import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API } from "../config/api";
import { Users, Activity, ShieldAlert, CheckCircle2, RefreshCw } from "lucide-react";

/**
 * Usage Ledger, Cost Attribution & Employee Credit Limits panel
 * mounted inside /whatsapp/billing for Organization Owners and Billing Managers.
 */
export default function EmployeeUsagePanel({ headers, canManage }) {
  const [usageSummary, setUsageSummary] = useState(null);
  const [employeeData, setEmployeeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editingUser, setEditingUser] = useState(null);
  const [limitForm, setLimitForm] = useState({
    daily_credit_limit: "",
    monthly_credit_limit: "",
    monthly_message_limit: "",
    allow_ai: true,
    allow_campaigns: true,
    allow_automations: true,
    is_suspended: false,
  });
  const [saving, setSaving] = useState(false);

  const loadUsage = useCallback(async () => {
    setLoading(true);
    setError("");
    const [sumRes, empRes] = await Promise.allSettled([
      axios.get(`${API}/api/v2/billing/usage-summary`, { headers }),
      axios.get(`${API}/api/v2/billing/employee-usage`, { headers }),
    ]);
    if (sumRes.status === "fulfilled" && sumRes.value?.data?.success) {
      setUsageSummary(sumRes.value.data);
    }
    if (empRes.status === "fulfilled" && empRes.value?.data?.success) {
      setEmployeeData(empRes.value.data.employees || []);
    }
    if (sumRes.status === "rejected" && empRes.status === "rejected") {
      setError("Detailed usage ledger is temporarily unavailable.");
    }
    setLoading(false);
  }, [headers]);

  useEffect(() => {
    loadUsage();
  }, [loadUsage]);

  const openEditLimit = (emp) => {
    setEditingUser(emp);
    setLimitForm({
      daily_credit_limit: emp.daily_credit_limit ?? "",
      monthly_credit_limit: emp.monthly_credit_limit ?? "",
      monthly_message_limit: emp.monthly_message_limit ?? "",
      allow_ai: emp.allow_ai !== 0,
      allow_campaigns: emp.allow_campaigns !== 0,
      allow_automations: emp.allow_automations !== 0,
      is_suspended: emp.is_suspended === 1,
    });
  };

  const saveLimit = async (e) => {
    e.preventDefault();
    if (!editingUser || !canManage) return;
    setSaving(true);
    setError("");
    try {
      await axios.put(
        `${API}/api/v2/billing/employee-limits/${editingUser.user_id}`,
        limitForm,
        { headers }
      );
      setEditingUser(null);
      await loadUsage();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save employee limit.");
    } finally {
      setSaving(false);
    }
  };

  if (!usageSummary && !employeeData.length && !error) return null;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Activity size={18} className="text-emerald-400" />
            Unified Usage Ledger &amp; Employee Controls
          </h2>
          <p className="text-xs text-slate-400">
            Track real-time AI/message consumption, wallet reconciliation, and per-employee credit caps.
          </p>
        </div>
        <button
          type="button"
          onClick={loadUsage}
          disabled={loading}
          className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh Usage</span>
        </button>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
          {error}
        </div>
      )}

      {/* Reconciliation & Breakdown */}
      {usageSummary && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Wallet Reconciliation &amp; Operation Breakdown</h3>
            <div className="flex flex-wrap gap-2">
              {(usageSummary.reconciliation || []).map((rec) => (
                <span
                  key={rec.creditType}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border ${
                    rec.balanced
                      ? "bg-emerald-950/60 border-emerald-700 text-emerald-300"
                      : "bg-rose-950/60 border-rose-700 text-rose-300"
                  }`}
                >
                  {rec.balanced ? <CheckCircle2 size={12} /> : <ShieldAlert size={12} />}
                  <span>
                    {rec.creditType}: {rec.storedBalance} avail ({rec.reservedBalance} reserved)
                  </span>
                </span>
              ))}
            </div>
            {(usageSummary.byOperation || []).length === 0 ? (
              <p className="text-xs text-slate-400">No metered usage events recorded this billing cycle yet.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {usageSummary.byOperation.map((op) => (
                  <div key={op.meter_key} className="flex justify-between p-2 rounded bg-slate-950 border border-slate-800/80">
                    <span className="font-mono text-slate-300">{op.meter_key}</span>
                    <span className="text-emerald-300 font-semibold">
                      {op.total_units} ops · {op.total_credits} credits
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-white">Recent Wallet Ledger Entries</h3>
            {!(usageSummary.recentLedger || []).length ? (
              <p className="text-xs text-slate-400">No credit or debit ledger entries recorded yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                {usageSummary.recentLedger.slice(0, 12).map((entry) => (
                  <div key={entry.id} className="flex justify-between items-center p-2 rounded bg-slate-950 border border-slate-800/80">
                    <div>
                      <span className={`font-bold uppercase mr-2 ${entry.entry_type === "credit" ? "text-emerald-400" : "text-amber-300"}`}>
                        {entry.entry_type === "credit" ? `+${entry.amount}` : `-${entry.amount}`}
                      </span>
                      <span className="text-slate-300">{entry.reason}</span>
                    </div>
                    <span className="font-mono text-[11px] text-slate-400">Bal: {entry.balance_after}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Employee Usage Accounting Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 overflow-x-auto">
        <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
          <Users size={15} className="text-amber-400" />
          Employee Usage Accounting &amp; Credit Controls
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="text-[11px] uppercase text-slate-400 border-b border-slate-800">
            <tr>
              <th className="py-2 pr-3">Actor / Employee</th>
              <th className="py-2 px-2">Actions</th>
              <th className="py-2 px-2">AI Credits</th>
              <th className="py-2 px-2">Messages</th>
              <th className="py-2 px-2">Controls</th>
              <th className="py-2 pl-2 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/80 text-slate-200">
            {!employeeData.length ? (
              <tr>
                <td colSpan={6} className="py-4 text-center text-slate-400">
                  No employee usage records recorded yet.
                </td>
              </tr>
            ) : (
              employeeData.map((emp) => (
                <tr key={emp.user_id}>
                  <td className="py-2.5 pr-3">
                    <strong>{emp.name}</strong>
                    <span className="block text-[10px] text-slate-400">{emp.role}</span>
                  </td>
                  <td className="py-2.5 px-2 font-mono">{emp.actions_count || 0}</td>
                  <td className="py-2.5 px-2 font-mono text-amber-300">
                    {emp.ai_credits_used || 0}
                    {emp.monthly_credit_limit ? ` / ${emp.monthly_credit_limit}` : ""}
                  </td>
                  <td className="py-2.5 px-2 font-mono text-emerald-300">
                    {emp.messages_sent || 0}
                    {emp.monthly_message_limit ? ` / ${emp.monthly_message_limit}` : ""}
                  </td>
                  <td className="py-2.5 px-2">
                    <div className="flex flex-wrap gap-1 text-[10px]">
                      {emp.is_suspended === 1 ? (
                        <span className="px-1.5 py-0.5 rounded bg-rose-900/60 text-rose-200">Suspended</span>
                      ) : (
                        <>
                          {emp.allow_ai === 0 && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">No AI</span>}
                          {emp.allow_campaigns === 0 && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300">No Campaigns</span>}
                          {emp.allow_ai !== 0 && emp.allow_campaigns !== 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300">Active</span>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 pl-2 text-right">
                    {canManage && emp.user_id > 0 && (
                      <button
                        type="button"
                        onClick={() => openEditLimit(emp)}
                        className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold"
                      >
                        Set Limits
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Inline Limit Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setEditingUser(null)}>
          <form
            onSubmit={saveLimit}
            onClick={(e) => e.stopPropagation()}
            className="bg-slate-900 border border-slate-700 rounded-2xl p-5 w-full max-w-md space-y-4 text-xs text-slate-200"
          >
            <h3 className="text-sm font-bold text-white">Usage Controls: {editingUser.name}</h3>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                Daily Credit Limit
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={limitForm.daily_credit_limit}
                  onChange={(e) => setLimitForm({ ...limitForm, daily_credit_limit: e.target.value })}
                  className="mt-1 w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </label>
              <label className="block">
                Monthly Credit Limit
                <input
                  type="number"
                  min="0"
                  placeholder="Unlimited"
                  value={limitForm.monthly_credit_limit}
                  onChange={(e) => setLimitForm({ ...limitForm, monthly_credit_limit: e.target.value })}
                  className="mt-1 w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
                />
              </label>
            </div>
            <label className="block">
              Monthly Message Limit
              <input
                type="number"
                min="0"
                placeholder="Unlimited"
                value={limitForm.monthly_message_limit}
                onChange={(e) => setLimitForm({ ...limitForm, monthly_message_limit: e.target.value })}
                className="mt-1 w-full p-2 rounded bg-slate-950 border border-slate-700 text-white"
              />
            </label>
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={limitForm.allow_ai} onChange={(e) => setLimitForm({ ...limitForm, allow_ai: e.target.checked })} />
                <span>Allow AI replies &amp; KB search</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={limitForm.allow_campaigns} onChange={(e) => setLimitForm({ ...limitForm, allow_campaigns: e.target.checked })} />
                <span>Allow Campaign sending</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={limitForm.allow_automations} onChange={(e) => setLimitForm({ ...limitForm, allow_automations: e.target.checked })} />
                <span>Allow Automation creation / trigger</span>
              </label>
              <label className="flex items-center gap-2 text-rose-300 font-semibold">
                <input type="checkbox" checked={limitForm.is_suspended} onChange={(e) => setLimitForm({ ...limitForm, is_suspended: e.target.checked })} />
                <span>Suspend usage access immediately</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingUser(null)} className="px-3 py-1.5 rounded bg-slate-800 text-slate-300">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="px-4 py-1.5 rounded bg-emerald-600 text-white font-bold">
                {saving ? "Saving..." : "Save Controls"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
