import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Building2,
  UserCheck,
  Shield,
  Phone,
  Sliders,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  AlertCircle,
  HelpCircle,
  Clock,
  MapPin,
  Mail,
} from "lucide-react";
import { createBranch } from "../../api/branches";
import api from "../../config/axios";
import { useEnterprise } from "../../context/EnterpriseContext";

export default function BranchCreateWizard() {
  const navigate = useNavigate();
  const { activeTenant } = useEnterprise();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Available staff and numbers
  const [availableStaff, setAvailableStaff] = useState([]);
  const [availableSenders, setAvailableSenders] = useState([]);

  // Form State
  const [formData, setFormData] = useState({
    // Step A: Profile
    name: "",
    code: "",
    slug: "",
    city: "",
    state: "",
    country: "India",
    address: "",
    phone: "",
    email: "",
    timezone: "Asia/Kolkata",
    operatingHoursOpen: "09:00",
    operatingHoursClose: "19:00",
    // Step B: Manager
    managerType: "existing", // "existing" | "invite"
    managerUserId: "",
    inviteEmail: "",
    inviteName: "",
    // Step C: Access & Permissions
    roleTemplate: "branch_admin",
    allowInterBranchTransfer: true,
    transferApprovalRequired: false,
    // Step D: WhatsApp Senders
    senderMode: "later", // "dedicated" | "shared" | "later"
    selectedSenderId: "",
    routingRule: "round_robin", // "round_robin" | "least_busy" | "manual"
    // Step E: Workflows
    assignmentStrategy: "round_robin",
    enableWelcomeFlow: true,
    enableAiAgent: true,
    slaResponseMinutes: 15,
  });

  // Auto-slug generator
  const handleNameChange = (val) => {
    const slug = val
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    const code = val
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, "")
      .slice(0, 4) + "-01";

    setFormData((prev) => ({
      ...prev,
      name: val,
      slug: prev.slug === "" || prev.slug === prev.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") ? slug : prev.slug,
      code: prev.code === "" ? code : prev.code,
    }));
  };

  // Load existing tenant staff and senders
  useEffect(() => {
    async function loadResources() {
      try {
        const staffRes = await api.get("/api/teammember").catch(() => null);
        if (staffRes?.data) {
          setAvailableStaff(Array.isArray(staffRes.data) ? staffRes.data : staffRes.data.members || []);
        }

        const senderRes = await api.get("/api/v2/meta/numbers").catch(() => null);
        if (senderRes?.data?.numbers) {
          setAvailableSenders(senderRes.data.numbers);
        }
      } catch (err) {
        console.warn("Notice loading resources for wizard:", err?.message);
      }
    }
    loadResources();
  }, []);

  const validateStep = (currentStep) => {
    setError(null);
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        setError("Branch Name is required.");
        return false;
      }
      if (!formData.code.trim()) {
        setError("Branch Code is required.");
        return false;
      }
    }
    if (currentStep === 2) {
      if (formData.managerType === "invite" && !formData.inviteEmail.trim()) {
        setError("Manager invitation email is required.");
        return false;
      }
    }
    return true;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((prev) => Math.min(prev + 1, 6));
    }
  };

  const handleBack = () => {
    setError(null);
    setStep((prev) => Math.max(prev - 1, 1));
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);

    try {
      const payload = {
        name: formData.name.trim(),
        code: formData.code.trim(),
        slug: formData.slug.trim(),
        city: formData.city.trim(),
        timezone: formData.timezone,
        address: formData.address,
        phone: formData.phone,
        email: formData.email,
        managerUserId: formData.managerUserId ? Number(formData.managerUserId) : null,
        senderAssignments:
          formData.senderMode !== "later" && formData.selectedSenderId
            ? [
                {
                  senderId: Number(formData.selectedSenderId),
                  assignmentType: formData.senderMode,
                },
              ]
            : [],
        settings: {
          operating_hours: {
            open: formData.operatingHoursOpen,
            close: formData.operatingHoursClose,
          },
          allow_inter_branch_transfer: formData.allowInterBranchTransfer,
          transfer_approval_required: formData.transferApprovalRequired,
          assignment_strategy: formData.assignmentStrategy,
          routing_rule: formData.routingRule,
          enable_welcome_flow: formData.enableWelcomeFlow,
          enable_ai_agent: formData.enableAiAgent,
          sla_response_minutes: Number(formData.slaResponseMinutes),
          routing_configured: formData.senderMode !== "later",
        },
        activate: true,
      };

      const res = await createBranch(payload);

      if (res?.success) {
        const branchId = res.branch?.id || res.id;
        const slug = res.branch?.slug || res.slug || "workspace";
        navigate(`/whatsapp/branches/${branchId}/${slug}/dashboard`);
      } else {
        setError(res?.message || "Failed to create branch");
      }
    } catch (err) {
      setError(
        err?.response?.data?.message || err?.message || "Creation error. Please verify your entries."
      );
    } finally {
      setLoading(false);
    }
  };

  const stepTitles = [
    { num: 1, title: "Profile", icon: Building2 },
    { num: 2, title: "Manager", icon: UserCheck },
    { num: 3, title: "Access", icon: Shield },
    { num: 4, title: "WhatsApp", icon: Phone },
    { num: 5, title: "Workflows", icon: Sliders },
    { num: 6, title: "Review", icon: Sparkles },
  ];

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* Wizard Header */}
      <div>
        <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
          <span>{activeTenant?.name || "Organization"}</span>
          <span>·</span>
          <span>New Branch Operating Setup</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-100 tracking-tight mt-1">
          Branch Creation Wizard
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure an isolated operating branch with independent inboxes, WhatsApp senders, local rules, and granular RBAC.
        </p>
      </div>

      {/* Step Indicators */}
      <div className="grid grid-cols-6 gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
        {stepTitles.map((s) => {
          const Icon = s.icon;
          const isCurrent = step === s.num;
          const isDone = step > s.num;
          return (
            <div
              key={s.num}
              className={`flex flex-col items-center justify-center p-2 rounded-xl text-center transition-all ${
                isCurrent
                  ? "bg-emerald-950/60 border border-emerald-800/80 text-emerald-300"
                  : isDone
                  ? "bg-slate-800/60 text-slate-300"
                  : "text-slate-500"
              }`}
            >
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mb-1 ${
                  isCurrent
                    ? "bg-emerald-500 text-slate-950"
                    : isDone
                    ? "bg-emerald-900/60 text-emerald-400"
                    : "bg-slate-800 text-slate-500"
                }`}
              >
                {isDone ? <CheckCircle2 size={14} /> : s.num}
              </div>
              <span className="text-[11px] font-semibold hidden sm:inline">{s.title}</span>
            </div>
          );
        })}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs flex items-center gap-3">
          <AlertCircle size={16} className="text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step Forms */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        {/* Step 1: Profile */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Building2 size={18} className="text-emerald-400" />
                Step A — Branch Profile & Identification
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Establish the branch name, unique short code, city, and operating hours.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Name <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Coimbatore Main"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Branch Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                  placeholder="e.g. CBE-01"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cosmetic URL Slug
                </label>
                <input
                  type="text"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  placeholder="coimbatore"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 font-mono focus:outline-none focus:border-emerald-600"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Canonical URL: /whatsapp/branches/:id/{formData.slug || "coimbatore"}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">City / Region</label>
                <input
                  type="text"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="Coimbatore"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Timezone</label>
                <select
                  value={formData.timezone}
                  onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="Asia/Kolkata">Asia/Kolkata (IST - UTC+05:30)</option>
                  <option value="Asia/Dubai">Asia/Dubai (GST - UTC+04:00)</option>
                  <option value="Asia/Singapore">Asia/Singapore (SGT - UTC+08:00)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Operating Hours (Open - Close)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    value={formData.operatingHoursOpen}
                    onChange={(e) => setFormData({ ...formData, operatingHoursOpen: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                  />
                  <span className="text-slate-500 text-xs">to</span>
                  <input
                    type="time"
                    value={formData.operatingHoursClose}
                    onChange={(e) => setFormData({ ...formData, operatingHoursClose: e.target.value })}
                    className="w-full px-2 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Physical Business Address (Optional)
              </label>
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="104 Cross Cut Road, Gandhipuram, Coimbatore, Tamil Nadu 641012"
                rows={2}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>
        )}

        {/* Step 2: Manager */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <UserCheck size={18} className="text-emerald-400" />
                Step B — Branch Manager Leadership
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Assign an authorized organization user or send an invitation. Existing users may manage multiple branches.
              </p>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="managerType"
                  checked={formData.managerType === "existing"}
                  onChange={() => setFormData({ ...formData, managerType: "existing" })}
                  className="text-emerald-500"
                />
                Select Existing Organization User
              </label>
              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="radio"
                  name="managerType"
                  checked={formData.managerType === "invite"}
                  onChange={() => setFormData({ ...formData, managerType: "invite" })}
                  className="text-emerald-500"
                />
                Invite New Manager via Email
              </label>
            </div>

            {formData.managerType === "existing" ? (
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Choose Manager
                </label>
                <select
                  value={formData.managerUserId}
                  onChange={(e) => setFormData({ ...formData, managerUserId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- Assign Manager Later (Draft State) --</option>
                  {availableStaff.map((staff) => (
                    <option key={staff.id || staff.user_id} value={staff.user_id || staff.id}>
                      {staff.first_name ? `${staff.first_name} ${staff.last_name || ""}` : staff.emp_email || staff.email}
                      {" "}({staff.job_title || staff.emp_role || "Staff"})
                    </option>
                  ))}
                </select>
                <span className="text-[11px] text-slate-500 mt-1.5 block">
                  Assigning a manager automatically creates their Branch Admin membership record.
                </span>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Manager Full Name
                  </label>
                  <input
                    type="text"
                    value={formData.inviteName}
                    onChange={(e) => setFormData({ ...formData, inviteName: e.target.value })}
                    placeholder="Priya Ramanathan"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Manager Email Address
                  </label>
                  <input
                    type="email"
                    value={formData.inviteEmail}
                    onChange={(e) => setFormData({ ...formData, inviteEmail: e.target.value })}
                    placeholder="priya@company.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 3: Access & Capabilities */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Shield size={18} className="text-emerald-400" />
                Step C — Branch Security & Inter-Branch Policies
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Configure role templates and cross-branch conversation transfer controls.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Inter-Branch Conversation Transfers</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Allow agents to transfer incoming WhatsApp conversations to another branch in the organization.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.allowInterBranchTransfer}
                  onChange={(e) =>
                    setFormData({ ...formData, allowInterBranchTransfer: e.target.checked })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 mt-1"
                />
              </div>

              <div className="p-4 rounded-xl bg-slate-950/60 border border-slate-800 flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Require Transfer Manager Approval</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Pending cross-branch transfers must be approved by the receiving branch manager before inbox handoff.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.transferApprovalRequired}
                  onChange={(e) =>
                    setFormData({ ...formData, transferApprovalRequired: e.target.checked })
                  }
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0 mt-1"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 4: WhatsApp Senders */}
        {step === 4 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Phone size={18} className="text-emerald-400" />
                Step D — Meta WhatsApp Sender Allocation
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Attach a dedicated or shared WhatsApp sender number owned by your organization WABA.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, senderMode: "dedicated" })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  formData.senderMode === "dedicated"
                    ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">Dedicated Sender</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  100% of incoming messages route to this branch only.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, senderMode: "shared" })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  formData.senderMode === "shared"
                    ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">Shared Sender</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Shared across multiple branches with deterministic keyword/menu routing.
                </div>
              </button>

              <button
                type="button"
                onClick={() => setFormData({ ...formData, senderMode: "later" })}
                className={`p-3.5 rounded-xl border text-left transition-all ${
                  formData.senderMode === "later"
                    ? "bg-emerald-950/40 border-emerald-600 text-emerald-200"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <div className="font-bold text-xs">Connect Later</div>
                <div className="text-[10px] text-slate-500 mt-1">
                  Keep in setup state; attach a Meta sender after branch creation.
                </div>
              </button>
            </div>

            {formData.senderMode !== "later" && (
              <div className="space-y-3 pt-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Organization WhatsApp Number
                </label>
                <select
                  value={formData.selectedSenderId}
                  onChange={(e) => setFormData({ ...formData, selectedSenderId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="">-- Choose Connected Sender --</option>
                  {availableSenders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_phone_number || s.phone_number || `Sender #${s.id}`} ({s.verified_name || "Meta WABA"})
                    </option>
                  ))}
                </select>
                {availableSenders.length === 0 && (
                  <div className="text-[11px] text-amber-400 bg-amber-950/20 p-2.5 rounded-xl border border-amber-800/40">
                    No active Meta numbers detected in your organization. You can still complete branch creation and attach senders under Branch Numbers.
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Step 5: Workflows & Routing */}
        {step === 5 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sliders size={18} className="text-emerald-400" />
                Step E — Automated Assignment & Response Policies
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Define how incoming conversations are allocated among local agents.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Inbound Assignment Strategy
                </label>
                <select
                  value={formData.assignmentStrategy}
                  onChange={(e) => setFormData({ ...formData, assignmentStrategy: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                >
                  <option value="round_robin">Round Robin (Evenly Distribute)</option>
                  <option value="least_busy">Least Busy (Fewest Open Conversations)</option>
                  <option value="manual">Manual Queue (Unassigned Inbox Pool)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  First Response SLA Target (Minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={formData.slaResponseMinutes}
                  onChange={(e) => setFormData({ ...formData, slaResponseMinutes: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-200 focus:outline-none focus:border-emerald-600"
                />
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Send Welcome Auto-Response</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Automatically acknowledge new customer chats on this branch.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enableWelcomeFlow}
                  onChange={(e) => setFormData({ ...formData, enableWelcomeFlow: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                />
              </div>

              <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Enable AI Agent Assistant</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Allow AI co-pilot suggestions and automated after-hours responses.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={formData.enableAiAgent}
                  onChange={(e) => setFormData({ ...formData, enableAiAgent: e.target.checked })}
                  className="rounded bg-slate-900 border-slate-700 text-emerald-500 focus:ring-0"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 6: Review & Launch */}
        {step === 6 && (
          <div className="space-y-4">
            <div className="border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles size={18} className="text-emerald-400" />
                Step F — Review & Provision Branch
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Verify branch parameters. Server will atomically create the branch, assign manager roles, and initialize operating queues.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Profile Summary
                </span>
                <div className="flex justify-between text-slate-300">
                  <span>Name:</span>
                  <strong className="text-slate-100">{formData.name}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Code:</span>
                  <strong className="font-mono text-emerald-400">{formData.code}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Slug:</span>
                  <strong className="font-mono text-slate-400">{formData.slug}</strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>City:</span>
                  <span>{formData.city || "Not specified"}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Hours:</span>
                  <span>
                    {formData.operatingHoursOpen} - {formData.operatingHoursClose}
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Operations & Routing
                </span>
                <div className="flex justify-between text-slate-300">
                  <span>Manager:</span>
                  <strong className="text-slate-100">
                    {formData.managerType === "existing"
                      ? formData.managerUserId
                        ? "Assigned User"
                        : "Draft (Unassigned)"
                      : formData.inviteEmail || "Email Invitation"}
                  </strong>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>WhatsApp Sender:</span>
                  <span className="capitalize">{formData.senderMode}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Assignment:</span>
                  <span className="capitalize">{formData.assignmentStrategy}</span>
                </div>
                <div className="flex justify-between text-slate-300">
                  <span>Target SLA:</span>
                  <span>{formData.slaResponseMinutes} mins</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Wizard Controls */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-800">
          {step > 1 ? (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all"
            >
              <ArrowLeft size={14} />
              <span>Back</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate("/whatsapp/branches")}
              className="text-xs text-slate-500 hover:text-slate-400"
            >
              Cancel
            </button>
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl shadow-lg transition-all"
            >
              <span>Continue</span>
              <ArrowRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-emerald-950/60 transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Sparkles size={16} />
              <span>{loading ? "Provisioning Branch..." : "Launch Branch Operating System"}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
