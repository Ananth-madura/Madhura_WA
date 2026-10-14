import React, { useState, useEffect, useCallback } from "react";
import {
  Phone,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Share2,
  Lock,
  Star,
} from "lucide-react";
import { useBranch } from "../../context/BranchContext";
import {
  getBranchSenders,
  assignBranchSender,
  unassignBranchSender,
} from "../../api/branches";
import api from "../../config/axios";

export default function BranchNumbers() {
  const { activeBranch, can, refreshBranch } = useBranch();

  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableNumbers, setAvailableNumbers] = useState([]);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [assignmentType, setAssignmentType] = useState("dedicated");
  const [isDefault, setIsDefault] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchSenders = useCallback(async () => {
    if (!activeBranch?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getBranchSenders(activeBranch.id);
      if (res.success) {
        setSenders(res.senders || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load senders");
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchSenders();
  }, [fetchSenders]);

  // Load tenant's Meta connected phone numbers
  useEffect(() => {
    async function loadTenantNumbers() {
      try {
        const res = await api.get("/api/v2/meta/numbers").catch(() => null);
        if (res?.data?.numbers) {
          setAvailableNumbers(res.data.numbers);
        }
      } catch (err) {
        console.warn("Notice loading tenant numbers:", err?.message);
      }
    }
    loadTenantNumbers();
  }, []);

  const handleAssign = async (e) => {
    e.preventDefault();
    if (!selectedSenderId || !activeBranch?.id) return;

    setAssignLoading(true);
    try {
      const res = await assignBranchSender(activeBranch.id, {
        senderId: Number(selectedSenderId),
        assignmentType,
        isDefault,
      });

      if (res.success) {
        setModalOpen(false);
        setSelectedSenderId("");
        await fetchSenders();
        refreshBranch();
      } else {
        alert(res.message || "Failed to assign sender to branch");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleUnassign = async (senderId, phoneDisplay) => {
    if (!window.confirm(`Unassign WhatsApp sender ${phoneDisplay || senderId} from ${activeBranch.name}?`)) {
      return;
    }

    try {
      const res = await unassignBranchSender(activeBranch.id, senderId);
      if (res.success) {
        await fetchSenders();
        refreshBranch();
      } else {
        alert(res.message || "Failed to unassign sender");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Phone size={22} className="text-emerald-400" />
            Assigned WhatsApp Numbers & WABAs
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Dedicated and shared Meta WhatsApp Business API senders routed to {activeBranch?.name}.
          </p>
        </div>

        {can("senders.assign") && (
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
          >
            <Plus size={14} />
            <span>Attach WhatsApp Sender</span>
          </button>
        )}
      </div>

      {/* Info Notice */}
      <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <HelpCircle size={18} className="text-sky-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-200">Sender Ownership vs Branch Allocation</p>
          <p className="text-slate-400 leading-relaxed">
            Meta WhatsApp senders are owned at the Organization level and assigned to branches.
            <strong> Dedicated senders</strong> route 100% of customer chats directly into this branch inbox.
            <strong> Shared senders</strong> route deterministically based on customer menu choices, tags, or campaign entry points.
          </p>
        </div>
      </div>

      {/* Senders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          [1, 2].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-slate-900 animate-pulse border border-slate-800" />
          ))
        ) : senders.length === 0 ? (
          <div className="col-span-full p-12 text-center rounded-2xl bg-slate-900/40 border border-dashed border-slate-800">
            <Phone size={36} className="mx-auto text-slate-600 mb-2" />
            <h4 className="text-sm font-semibold text-slate-200">No WhatsApp Senders Attached</h4>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              Attach a dedicated or shared WhatsApp phone number to enable messaging on this branch.
            </p>
            {can("senders.assign") && (
              <div className="mt-4">
                <button
                  onClick={() => setModalOpen(true)}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5"
                >
                  <Plus size={14} />
                  <span>Attach Sender</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          senders.map((s) => {
            const isDedicated = s.assignment_type === "dedicated";
            const phoneDisplay = s.display_phone_number || s.phone_number || `Sender #${s.sender_id}`;

            return (
              <div
                key={s.id || s.sender_id}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between space-y-4"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-100 font-mono text-sm">
                          {phoneDisplay}
                        </span>
                        {s.is_default === 1 && (
                          <span className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800">
                            <Star size={9} className="fill-amber-300" /> Default
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {s.verified_name || "Meta Business API"}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                        isDedicated
                          ? "bg-emerald-950/80 text-emerald-300 border-emerald-800"
                          : "bg-sky-950/80 text-sky-300 border-sky-800"
                      }`}
                    >
                      {isDedicated ? <Lock size={10} /> : <Share2 size={10} />}
                      <span className="capitalize">{s.assignment_type}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>Outbound Enabled</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <CheckCircle2 size={12} className="text-emerald-400" />
                      <span>Inbound Routing</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500 font-mono">
                    ID: {s.sender_id}
                  </span>
                  {can("senders.assign") && (
                    <button
                      onClick={() => handleUnassign(s.sender_id, phoneDisplay)}
                      className="text-slate-500 hover:text-rose-400 transition-colors p-1"
                      title="Unassign sender"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Attach Sender Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Phone size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Attach WhatsApp Sender</h3>
                <p className="text-[11px] text-slate-400">
                  Select an organization Meta number to route through {activeBranch?.name}.
                </p>
              </div>
            </div>

            <form onSubmit={handleAssign} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Connected Meta Phone Number <span className="text-rose-400">*</span>
                </label>
                <select
                  value={selectedSenderId}
                  onChange={(e) => setSelectedSenderId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- Select Phone Number --</option>
                  {availableNumbers.map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.display_phone_number || n.phone_number || `Sender #${n.id}`} ({n.verified_name || "Meta WABA"})
                    </option>
                  ))}
                </select>
                {availableNumbers.length === 0 && (
                  <p className="text-[11px] text-amber-400 mt-1">
                    No connected Meta senders detected. Connect a Meta WABA number under WhatsApp Accounts.
                  </p>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">
                  Assignment Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAssignmentType("dedicated")}
                    className={`p-2.5 rounded-xl border text-left ${
                      assignmentType === "dedicated"
                        ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold">Dedicated</div>
                    <div className="text-[10px] text-slate-500">Only this branch</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAssignmentType("shared")}
                    className={`p-2.5 rounded-xl border text-left ${
                      assignmentType === "shared"
                        ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                        : "bg-slate-950 border-slate-800 text-slate-400"
                    }`}
                  >
                    <div className="font-bold">Shared</div>
                    <div className="text-[10px] text-slate-500">Multi-branch router</div>
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                />
                <span>Set as default outbound sender for this branch</span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !selectedSenderId}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {assignLoading ? "Attaching..." : "Attach Sender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
