import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  UserPlus,
  Shield,
  Trash2,
  UserCheck,
  Star,
  Search,
  AlertCircle,
  ArrowRightLeft,
  Crown,
  KeyRound,
  Copy,
  Check,
  MessageCircle,
  Eye,
  Send,
  ShieldCheck,
  CheckCircle2,
  X,
  Phone,
  Mail,
  Briefcase,
} from "lucide-react";
import { useBranch } from "../../context/BranchContext";
import {
  getBranchMembers,
  addBranchMember,
  removeBranchMember,
  transferBranchManager,
  createBranchEmployee,
} from "../../api/branches";
import api from "../../config/axios";

const ACCESS_LEVEL_META = {
  full: {
    label: "Full Access",
    badge: "bg-emerald-950/80 text-emerald-300 border-emerald-800",
    icon: ShieldCheck,
  },
  chat_only: {
    label: "Live Chat Only",
    badge: "bg-blue-950/80 text-blue-300 border-blue-800",
    icon: MessageCircle,
  },
  read_only: {
    label: "Read Only",
    badge: "bg-slate-800 text-slate-300 border-slate-700",
    icon: Eye,
  },
  campaign_only: {
    label: "Campaigns Only",
    badge: "bg-purple-950/80 text-purple-300 border-purple-800",
    icon: Send,
  },
};

export default function BranchEmployees() {
  const { activeBranch, can, refreshBranch } = useBranch();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [toast, setToast] = useState(null);
  const [copiedCodeId, setCopiedCodeId] = useState(null);

  // Create New Employee Modal State
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    mobile: "",
    job_title: "Branch WhatsApp Specialist",
    role: "agent",
    whatsapp_access_level: "full",
  });
  const [createLoading, setCreateLoading] = useState(false);
  const [createdResult, setCreatedResult] = useState(null);

  // Assign Existing Member Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedRole, setSelectedRole] = useState("agent");
  const [assignLoading, setAssignLoading] = useState(false);

  // Transfer Manager Modal State
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [newManagerId, setNewManagerId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);

  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchMembers = useCallback(async () => {
    if (!activeBranch?.id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await getBranchMembers(activeBranch.id);
      if (res.success) {
        setMembers(res.members || []);
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Failed to load team members");
    } finally {
      setLoading(false);
    }
  }, [activeBranch?.id]);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Load organization users for assign member modal
  useEffect(() => {
    async function loadOrgUsers() {
      try {
        const res = await api.get("/api/teammember").catch(() => null);
        if (res?.data) {
          setAvailableUsers(Array.isArray(res.data) ? res.data : res.data.members || []);
        }
      } catch (err) {
        console.warn("Notice loading org users:", err?.message);
      }
    }
    loadOrgUsers();
  }, []);

  const handleCopyCode = (code, id) => {
    if (!code) return;
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    showToast(`Access code "${code}" copied to clipboard!`);
    setTimeout(() => setCopiedCodeId(null), 2500);
  };

  const handleCreateEmployee = async (e) => {
    e.preventDefault();
    if (!createForm.first_name.trim() || !createForm.email.trim() || !activeBranch?.id) return;

    setCreateLoading(true);
    try {
      const res = await createBranchEmployee(activeBranch.id, {
        first_name: createForm.first_name.trim(),
        last_name: createForm.last_name.trim(),
        email: createForm.email.trim(),
        mobile: createForm.mobile.trim(),
        job_title: createForm.job_title.trim(),
        role: createForm.role,
        whatsapp_access_level: createForm.whatsapp_access_level,
      });

      if (res?.success) {
        setCreatedResult(res.employee);
        setCreateModalOpen(false);
        setCreateForm({
          first_name: "",
          last_name: "",
          email: "",
          mobile: "",
          job_title: "Branch WhatsApp Specialist",
          role: "agent",
          whatsapp_access_level: "full",
        });
        showToast(`Employee "${res.employee.first_name}" created for ${activeBranch.name}!`);
        await fetchMembers();
        refreshBranch();
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message || "Failed to create branch employee");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleAssignExisting = async (e) => {
    e.preventDefault();
    if (!selectedUserId || !activeBranch?.id) return;

    setAssignLoading(true);
    try {
      const res = await addBranchMember(activeBranch.id, {
        userId: Number(selectedUserId),
        role: selectedRole,
      });

      if (res.success) {
        setAssignModalOpen(false);
        setSelectedUserId("");
        showToast("Team member assigned to branch!");
        await fetchMembers();
        refreshBranch();
      } else {
        alert(res.message || "Failed to add member to branch");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setAssignLoading(false);
    }
  };

  const handleRemoveMember = async (userId, memberName) => {
    if (!window.confirm(`Remove ${memberName || "this user"} from ${activeBranch.name}?`)) {
      return;
    }

    try {
      const res = await removeBranchMember(activeBranch.id, userId);
      if (res.success) {
        showToast("Member removed from branch.");
        await fetchMembers();
        refreshBranch();
      } else {
        alert(res.message || "Failed to remove member");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    }
  };

  const handleTransferManager = async (e) => {
    e.preventDefault();
    if (!newManagerId || !activeBranch?.id) return;

    setTransferLoading(true);
    try {
      const res = await transferBranchManager(activeBranch.id, Number(newManagerId));
      if (res.success) {
        showToast(`Manager transferred to ${res.manager?.name || "new manager"}`);
        setTransferModalOpen(false);
        setNewManagerId("");
        await fetchMembers();
        refreshBranch();
      } else {
        alert(res.message || "Failed to transfer manager");
      }
    } catch (err) {
      alert(err?.response?.data?.message || err.message);
    } finally {
      setTransferLoading(false);
    }
  };

  const filteredMembers = members.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      m.first_name?.toLowerCase().includes(term) ||
      m.last_name?.toLowerCase().includes(term) ||
      m.email?.toLowerCase().includes(term) ||
      m.job_title?.toLowerCase().includes(term) ||
      m.emp_role?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Toast Alert */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-950 border border-emerald-500/50 text-emerald-100 rounded-xl shadow-2xl animate-in slide-in-from-top-2 text-xs font-semibold">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Users size={22} className="text-emerald-400" />
            Branch Staff & Access Memberships
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Employees assigned to <strong className="text-emerald-300">{activeBranch?.name}</strong>. Members have scoped live inbox queues and WhatsApp messaging rights.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCreateModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs rounded-xl shadow-lg transition-all"
          >
            <UserPlus size={14} />
            <span>Create Employee</span>
          </button>

          <button
            onClick={() => setAssignModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs rounded-xl border border-slate-700 transition-all shadow-sm"
          >
            <UserCheck size={14} />
            <span className="hidden sm:inline">Assign Existing Member</span>
          </button>

          {can("branches.manage") && (
            <button
              onClick={() => setTransferModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-amber-400 font-semibold text-xs rounded-xl border border-slate-700 transition-all"
            >
              <Crown size={14} />
              <span className="hidden md:inline">Transfer Manager</span>
            </button>
          )}
        </div>
      </div>

      {/* Current Manager Banner */}
      <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
            <Crown size={20} />
          </div>
          <div>
            <div className="text-xs text-slate-400 font-medium">Branch Manager</div>
            <div className="text-sm font-bold text-slate-100 mt-0.5 flex items-center gap-2">
              <span>{activeBranch?.manager?.name || activeBranch?.manager?.email || "No manager assigned"}</span>
              {activeBranch?.manager?.email && (
                <span className="text-xs text-slate-400 font-normal font-mono hidden sm:inline">({activeBranch.manager.email})</span>
              )}
            </div>
          </div>
        </div>

        {can("branches.manage") && (
          <button
            onClick={() => setTransferModalOpen(true)}
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold underline"
          >
            Change Manager
          </button>
        )}
      </div>

      {/* Search Bar & Counter */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-2.5 rounded-xl border border-slate-800">
        <div className="relative w-full sm:w-80">
          <Search size={14} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee by name, title, or email..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-600 font-medium"
          />
        </div>
        <span className="text-xs text-slate-400 px-2 font-mono">
          <strong className="text-slate-200">{filteredMembers.length}</strong> employee(s) in {activeBranch?.code}
        </span>
      </div>

      {/* Members Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-950/80 border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3 pl-4">Employee</th>
              <th className="p-3">Role & Title</th>
              <th className="p-3">WhatsApp Access</th>
              <th className="p-3 hidden md:table-cell">Access Code</th>
              <th className="p-3 hidden lg:table-cell">Status</th>
              <th className="p-3 text-right pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-500">
                  Loading branch employees...
                </td>
              </tr>
            ) : filteredMembers.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-10 text-center space-y-2">
                  <Users size={32} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-slate-300 font-semibold text-sm">No employees assigned to this branch yet</p>
                  <p className="text-slate-500 text-xs max-w-sm mx-auto">
                    Create a new employee or assign existing team members to {activeBranch?.name}.
                  </p>
                </td>
              </tr>
            ) : (
              filteredMembers.map((member) => {
                const displayName =
                  member.first_name ? `${member.first_name} ${member.last_name || ""}`.trim() : member.email;
                const isManager =
                  activeBranch?.manager_id === (member.user_id || member.id) ||
                  member.organization_role === "organization_owner" ||
                  member.is_manager === 1;
                const accessLevelKey = member.whatsapp_access_level || "full";
                const accessMeta = ACCESS_LEVEL_META[accessLevelKey] || ACCESS_LEVEL_META.full;
                const AccessIcon = accessMeta.icon;

                return (
                  <tr key={member.id || member.user_id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="p-3 pl-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-emerald-950 border border-emerald-700/60 flex items-center justify-center font-bold text-emerald-300 text-xs">
                          {displayName.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                            <span>{displayName}</span>
                            {isManager && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 flex items-center gap-0.5">
                                <Crown size={9} /> Manager
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2">
                            <span>{member.email}</span>
                            {member.mobile && <span className="font-mono text-slate-500">· {member.mobile}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="font-semibold text-slate-300">{member.job_title || "Staff"}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{member.organization_role || member.emp_role || "Agent"}</div>
                    </td>
                    <td className="p-3">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-medium border px-2 py-0.5 rounded-md ${accessMeta.badge}`}>
                        <AccessIcon size={12} />
                        <span>{accessMeta.label}</span>
                      </span>
                    </td>
                    <td className="p-3 hidden md:table-cell font-mono">
                      {member.access_code ? (
                        <button
                          onClick={() => handleCopyCode(member.access_code, member.id || member.user_id)}
                          title="Click to copy Access Code"
                          className="flex items-center gap-1.5 px-2 py-0.5 bg-slate-950 border border-slate-800 hover:border-emerald-600/60 rounded text-[11px] text-emerald-400 hover:text-emerald-300 transition-colors"
                        >
                          <KeyRound size={11} />
                          <span>{member.access_code}</span>
                          {copiedCodeId === (member.id || member.user_id) ? (
                            <Check size={11} className="text-emerald-400" />
                          ) : (
                            <Copy size={11} className="text-slate-500" />
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-600 text-[11px]">Activated</span>
                      )}
                    </td>
                    <td className="p-3 hidden lg:table-cell">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${member.user_status === 'active' || member.status === 'active' ? 'bg-emerald-950 text-emerald-400' : 'bg-amber-950 text-amber-400'}`}>
                        {member.user_status || member.status || "Active"}
                      </span>
                    </td>
                    <td className="p-3 text-right pr-4">
                      {!isManager && (
                        <button
                          onClick={() => handleRemoveMember(member.user_id || member.id, displayName)}
                          title="Unassign from branch"
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create New Employee Modal */}
      {createModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <UserPlus size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Create Employee for {activeBranch.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    Generates an Access Code for instant staff onboarding.
                  </p>
                </div>
              </div>
              <button onClick={() => setCreateModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={createForm.first_name}
                    onChange={(e) => setCreateForm({ ...createForm, first_name: e.target.value })}
                    required
                    placeholder="e.g. Priya"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={createForm.last_name}
                    onChange={(e) => setCreateForm({ ...createForm, last_name: e.target.value })}
                    placeholder="e.g. Sharma"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Work Email *</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  required
                  placeholder="priya@company.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Mobile Number</label>
                  <input
                    type="text"
                    value={createForm.mobile}
                    onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                    placeholder="9876543210"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-300 mb-1">Job Title</label>
                  <input
                    type="text"
                    value={createForm.job_title}
                    onChange={(e) => setCreateForm({ ...createForm, job_title: e.target.value })}
                    placeholder="Support Lead"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">WhatsApp Permission Scope</label>
                <select
                  value={createForm.whatsapp_access_level}
                  onChange={(e) => setCreateForm({ ...createForm, whatsapp_access_level: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="full">Full Access (Chat, Broadcasts, Contacts)</option>
                  <option value="chat_only">Live Chat Only (Customer Inquiries)</option>
                  <option value="read_only">Read Only (Logs & Analytics)</option>
                  <option value="campaign_only">Campaigns Only (Marketing Broadcasts)</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCreateModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading || !createForm.first_name || !createForm.email}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {createLoading ? "Creating..." : "Generate Access Code & Add"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Created Employee Success Modal */}
      {createdResult && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-emerald-500/20 text-emerald-400 rounded-2xl mx-auto flex items-center justify-center mb-2">
                <KeyRound size={24} />
              </div>
              <h3 className="text-base font-bold text-slate-100">Employee Created for {activeBranch.name}!</h3>
              <p className="text-xs text-slate-400">
                Share this unique Access Code with {createdResult.first_name} to activate their account.
              </p>
            </div>

            <div className="p-4 bg-slate-950 border border-slate-800 rounded-xl text-center space-y-2">
              <div className="text-[11px] text-slate-400 uppercase font-semibold">One-Time Access Code</div>
              <div className="text-2xl font-mono font-bold text-emerald-400 tracking-wider">
                {createdResult.access_code}
              </div>
              <div className="text-[10px] text-slate-500">
                Branch: {activeBranch.name} ({activeBranch.code})
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(
                    `Hi ${createdResult.first_name},\n\nYou have been invited to join the ${activeBranch.name} branch on WhatsApp CRM!\n\n1. Go to: ${window.location.origin}/signup\n2. Select "Join with Access Code"\n3. Enter Access Code: ${createdResult.access_code}\n4. Email: ${createdResult.email}`
                  );
                  showToast("Invitation details copied to clipboard!");
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
              >
                <Copy size={14} />
                <span>Copy Invitation Instructions</span>
              </button>
            </div>

            <button
              onClick={() => setCreatedResult(null)}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-200 font-semibold pt-1"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* Assign Existing Member Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
                  <UserCheck size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Assign Member to {activeBranch.name}</h3>
                  <p className="text-[11px] text-slate-400">
                    Give an existing company member access to this branch queue.
                  </p>
                </div>
              </div>
              <button onClick={() => setAssignModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAssignExisting} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">Select Member</label>
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="" disabled>Select staff member...</option>
                  {availableUsers.map((u) => (
                    <option key={u.user_id || u.id} value={u.user_id || u.id}>
                      {u.first_name} {u.last_name || ""} ({u.emp_email || u.email || "No email"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-300 mb-1">Branch Role</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="agent">Support / Sales Agent</option>
                  <option value="branch_manager">Branch Manager</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setAssignModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={assignLoading || !selectedUserId}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {assignLoading ? "Assigning..." : "Assign to Branch"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Transfer Manager Modal */}
      {transferModalOpen && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
                  <Crown size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Designate Branch Manager</h3>
                  <p className="text-[11px] text-slate-400">
                    Transfers manager capabilities and operational approvals for {activeBranch.name}.
                  </p>
                </div>
              </div>
              <button onClick={() => setTransferModalOpen(false)} className="text-slate-500 hover:text-slate-300">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTransferManager} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-300 mb-1">New Manager</label>
                <select
                  value={newManagerId}
                  onChange={(e) => setNewManagerId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="" disabled>Select member...</option>
                  {members.map((m) => (
                    <option key={m.user_id || m.id} value={m.user_id || m.id}>
                      {m.first_name} {m.last_name || ""} ({m.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setTransferModalOpen(false)}
                  className="px-3.5 py-2 text-slate-400 hover:text-slate-200 text-xs font-semibold rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferLoading || !newManagerId}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 text-white font-bold text-xs rounded-xl shadow-lg transition-all"
                >
                  {transferLoading ? "Saving..." : "Confirm Manager Transfer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
