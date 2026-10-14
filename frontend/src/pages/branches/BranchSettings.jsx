import React, { useState, useEffect } from "react";
import { Settings, Save, AlertTriangle, Archive, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useBranch } from "../../context/BranchContext";
import { updateBranch, archiveBranch } from "../../api/branches";

export default function BranchSettings() {
  const navigate = useNavigate();
  const { activeBranch, can, refreshBranch } = useBranch();

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    city: "",
    timezone: "Asia/Kolkata",
    address: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);

  useEffect(() => {
    if (activeBranch) {
      setFormData({
        name: activeBranch.name || "",
        code: activeBranch.code || "",
        city: activeBranch.city || "",
        timezone: activeBranch.timezone || "Asia/Kolkata",
        address: activeBranch.address || "",
      });
    }
  }, [activeBranch]);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!activeBranch?.id) return;

    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await updateBranch(activeBranch.id, formData);
      if (res.success) {
        setSaveSuccess(true);
        refreshBranch();
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        alert(res.message || "Failed to update branch profile");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (
      !window.confirm(
        `Are you sure you want to archive "${activeBranch.name}"? Active outbound and automated flows will be halted.`
      )
    ) {
      return;
    }

    setArchiveLoading(true);
    try {
      const res = await archiveBranch(activeBranch.id);
      if (res.success) {
        alert("Branch has been archived.");
        navigate("/whatsapp/branches");
      } else {
        alert(res.message || "Failed to archive branch");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setArchiveLoading(false);
    }
  };

  if (!activeBranch) return null;

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Settings size={22} className="text-emerald-400" />
            Branch Configuration & Profile
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage identification, short code, and operational settings for {activeBranch.name}.
          </p>
        </div>

        {saveSuccess && (
          <span className="text-xs font-semibold text-emerald-400 bg-emerald-950/60 border border-emerald-800 px-3 py-1.5 rounded-xl flex items-center gap-1.5 animate-in fade-in">
            <CheckCircle2 size={14} />
            <span>Changes Saved</span>
          </span>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6 text-xs">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <h3 className="text-sm font-bold text-slate-100">General Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-300 mb-1">Branch Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Branch Short Code</label>
              <input
                type="text"
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                required
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 font-mono focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">City / Region</label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-300 mb-1">Timezone</label>
              <select
                value={formData.timezone}
                onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
              >
                <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                <option value="Asia/Dubai">Asia/Dubai (GST)</option>
                <option value="Asia/Singapore">Asia/Singapore (SGT)</option>
                <option value="Europe/London">Europe/London (GMT)</option>
                <option value="America/New_York">America/New_York (EST)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-300 mb-1">Physical Address</label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <Save size={13} />
              <span>{saving ? "Saving..." : "Save Profile"}</span>
            </button>
          </div>
        </div>
      </form>

      {/* Danger Zone */}
      {can("branches.manage") && (
        <div className="bg-rose-950/20 border border-rose-900/40 rounded-2xl p-5 space-y-3">
          <div className="flex items-center gap-2 text-rose-400 font-bold text-sm">
            <AlertTriangle size={16} />
            <span>Danger Zone</span>
          </div>
          <p className="text-xs text-rose-300/80">
            Archiving a branch deactivates outbound campaigns and detaches live queues, while preserving audit trails and conversation history.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={handleArchive}
              disabled={archiveLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
            >
              <Archive size={14} />
              <span>{archiveLoading ? "Archiving..." : "Archive Branch"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
