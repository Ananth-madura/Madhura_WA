import React, { useState, useEffect } from "react";
import { Sliders, Clock, Bot, CheckCircle2, Save, Sparkles, MessageSquare, AlertCircle } from "lucide-react";
import { useBranch } from "../../context/BranchContext";
import { getBranchSettings, updateBranchSettings } from "../../api/branches";

export default function BranchAutomations() {
  const { activeBranch, refreshBranch } = useBranch();

  const [settings, setSettings] = useState({
    assignment_strategy: "round_robin",
    enable_welcome_flow: true,
    enable_ai_agent: true,
    sla_response_minutes: 15,
    operating_hours: { open: "09:00", close: "19:00" },
    after_hours_message: "Thank you for reaching out! Our branch is currently closed. We will respond tomorrow during business hours.",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    async function load() {
      if (!activeBranch?.id) return;
      try {
        setLoading(true);
        const res = await getBranchSettings(activeBranch.id);
        if (res.success && res.settings) {
          setSettings((prev) => ({
            ...prev,
            ...res.settings,
            operating_hours: res.settings.operating_hours || prev.operating_hours,
          }));
        }
      } catch (err) {
        console.warn("Notice loading branch settings:", err?.message);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeBranch?.id]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeBranch?.id) return;

    setSaving(true);
    setSavedSuccess(false);
    try {
      const res = await updateBranchSettings(activeBranch.id, settings);
      if (res.success) {
        setSavedSuccess(true);
        refreshBranch();
        setTimeout(() => setSavedSuccess(false), 3000);
      } else {
        alert(res.message || "Failed to update automation settings");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Sliders size={22} className="text-emerald-400" />
            Branch Routing & Automated Workflows
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Configure conversational auto-assignment, operating hours, after-hours responses, and AI assistant behavior.
          </p>
        </div>

        {savedSuccess && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 size={14} />
            <span>Settings Saved</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        {/* Assignment Engine */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-400" />
            Inbound Conversation Assignment
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                Queue Distribution Strategy
              </label>
              <select
                value={settings.assignment_strategy}
                onChange={(e) => setSettings({ ...settings, assignment_strategy: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
              >
                <option value="round_robin">Round Robin (Distribute evenly among online staff)</option>
                <option value="least_busy">Least Busy (Assign to staff with fewest open chats)</option>
                <option value="manual">Manual Pool (Staff claim chats from unassigned queue)</option>
              </select>
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">
                SLA First-Response Target (Minutes)
              </label>
              <input
                type="number"
                min="1"
                max="1440"
                value={settings.sla_response_minutes}
                onChange={(e) =>
                  setSettings({ ...settings, sla_response_minutes: Number(e.target.value) })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        </div>

        {/* Operating Hours & Auto-Responders */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Clock size={16} className="text-purple-400" />
            Business Hours & Auto-Responders
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Open Time</label>
              <input
                type="time"
                value={settings.operating_hours?.open || "09:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operating_hours: { ...settings.operating_hours, open: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Close Time</label>
              <input
                type="time"
                value={settings.operating_hours?.close || "19:00"}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    operating_hours: { ...settings.operating_hours, close: e.target.value },
                  })
                }
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">
              After-Hours WhatsApp Response
            </label>
            <textarea
              value={settings.after_hours_message || ""}
              onChange={(e) => setSettings({ ...settings, after_hours_message: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
            />
          </div>
        </div>

        {/* AI & Welcome Features */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Sparkles size={16} className="text-amber-400" />
            AI & Instant Automation
          </h3>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Send Welcome Auto-Response</div>
              <div className="text-[11px] text-slate-400">
                Instantly greet first-time incoming contacts on this branch.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.enable_welcome_flow}
              onChange={(e) =>
                setSettings({ ...settings, enable_welcome_flow: e.target.checked })
              }
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
          </label>

          <label className="flex items-center justify-between p-3 rounded-xl bg-slate-950/60 border border-slate-800 cursor-pointer">
            <div>
              <div className="font-semibold text-slate-200">Enable AI Agent Assistant</div>
              <div className="text-[11px] text-slate-400">
                Provide smart response suggestions to local agents and handle FAQ replies.
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.enable_ai_agent}
              onChange={(e) =>
                setSettings({ ...settings, enable_ai_agent: e.target.checked })
              }
              className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
            />
          </label>
        </div>

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
          >
            <Save size={14} />
            <span>{saving ? "Saving Changes..." : "Save Automation Settings"}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
