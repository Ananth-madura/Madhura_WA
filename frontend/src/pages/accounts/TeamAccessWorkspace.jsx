import React, { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Shield,
  Phone,
  Settings,
  AlertCircle,
  X,
  Plus,
  Trash2,
  Share2,
  Save,
  RotateCw,
  GitBranch,
  Building,
  Check,
  UserCheck,
  UserX
} from "lucide-react";
import { API } from "../../config/api";
import "./accounts.css";

const STRATEGY_LABELS = {
  round_robin: "Round Robin (Balanced Rotation)",
  workload: "Lowest Workload (Capacity Based)",
  manual: "Manual Assignment Only"
};

export default function TeamAccessWorkspace({ enterprise, request, admin }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Overview data
  const [overview, setOverview] = useState({
    totalNumbers: 0,
    connectedNumbers: 0,
    totalEmployees: 0,
    assignedEmployees: 0,
    unassignedEmployees: 0,
    routingStrategy: "round_robin"
  });
  const [numbers, setNumbers] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [routingSettings, setRoutingSettings] = useState(null);
  const [auditRecords, setAuditRecords] = useState([]);

  // Active view tab: 'numbers' | 'settings' | 'audit'
  const [subTab, setSubTab] = useState("numbers");

  // Manage assignments modal state
  const [selectedSender, setSelectedSender] = useState(null);
  const [modalSearch, setModalSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [branchFilter, setBranchFilter] = useState("all");
  const [selectedUserIds, setSelectedUserIds] = useState([]);
  const [numberPermissions, setNumberPermissions] = useState({
    can_view: 1,
    can_reply: 1,
    can_send_templates: 1,
    can_send_attachments: 1,
    can_add_notes: 1,
    can_transfer: 1,
    can_share: 1,
    can_manage_collaborators: 1,
    role_in_sender: "member"
  });

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [overviewRes, routingRes, empRes, auditRes] = await Promise.all([
        request("get", "/inbox/routing/number-assignments"),
        request("get", "/inbox/routing/settings").catch(() => ({ settings: {} })),
        request("get", "/inbox/routing/employees").catch(() => ({ employees: [] })),
        request("get", "/inbox/routing/audit?limit=25").catch(() => ({ records: [] }))
      ]);

      if (overviewRes.overview) setOverview(overviewRes.overview);
      if (overviewRes.numbers) setNumbers(overviewRes.numbers);
      if (routingRes.settings) setRoutingSettings(routingRes.settings);
      if (empRes.employees) setAllEmployees(empRes.employees);
      if (auditRes.records) setAuditRecords(auditRes.records);
    } catch (e) {
      setError(e.response?.data?.message || e.message || "Could not load team access overview.");
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  // Open Manage Assignments Modal for a Number
  const openManageModal = (sender) => {
    setSelectedSender(sender);
    setModalSearch("");
    setDeptFilter("all");
    setBranchFilter("all");

    // Initialize with currently assigned user IDs on this sender
    const currentAssigned = Array.isArray(sender.assignedEmployees)
      ? sender.assignedEmployees.map((e) => Number(e.user_id))
      : [];
    setSelectedUserIds(currentAssigned);

    // If there is existing permission configuration, inherit from first assigned
    if (sender.assignedEmployees && sender.assignedEmployees.length > 0) {
      const first = sender.assignedEmployees[0];
      setNumberPermissions({
        can_view: first.can_view ?? 1,
        can_reply: first.can_reply ?? 1,
        can_send_templates: first.can_send_templates ?? 1,
        can_send_attachments: first.can_send_attachments ?? 1,
        can_add_notes: first.can_add_notes ?? 1,
        can_transfer: first.can_transfer ?? 1,
        can_share: first.can_share ?? 1,
        can_manage_collaborators: first.can_manage_collaborators ?? 1,
        role_in_sender: first.role_in_sender || "member"
      });
    } else {
      setNumberPermissions({
        can_view: 1,
        can_reply: 1,
        can_send_templates: 1,
        can_send_attachments: 1,
        can_add_notes: 1,
        can_transfer: 1,
        can_share: 1,
        can_manage_collaborators: 1,
        role_in_sender: "member"
      });
    }
  };

  const closeManageModal = () => {
    setSelectedSender(null);
  };

  // Distinct departments and branches for filtering
  const departments = useMemo(() => {
    const set = new Set();
    allEmployees.forEach((emp) => {
      if (emp.department) set.add(emp.department);
    });
    return Array.from(set).sort();
  }, [allEmployees]);

  const branches = useMemo(() => {
    const map = new Map();
    allEmployees.forEach((emp) => {
      if (emp.branch_id && emp.branch_name) {
        map.set(Number(emp.branch_id), emp.branch_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allEmployees]);

  // Filter employees inside modal
  const filteredModalEmployees = useMemo(() => {
    return allEmployees.filter((emp) => {
      const q = modalSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        (emp.first_name || "").toLowerCase().includes(q) ||
        (emp.email || "").toLowerCase().includes(q) ||
        (emp.branch_name || "").toLowerCase().includes(q) ||
        (emp.department || "").toLowerCase().includes(q);

      const matchDept = deptFilter === "all" || emp.department === deptFilter;
      const matchBranch = branchFilter === "all" || String(emp.branch_id) === String(branchFilter);

      return matchSearch && matchDept && matchBranch;
    });
  }, [allEmployees, modalSearch, deptFilter, branchFilter]);

  const toggleUserAssignment = (userId) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const selectAllFiltered = () => {
    const ids = filteredModalEmployees.map((e) => Number(e.user_id));
    setSelectedUserIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const deselectAllFiltered = () => {
    const filterSet = new Set(filteredModalEmployees.map((e) => Number(e.user_id)));
    setSelectedUserIds((prev) => prev.filter((id) => !filterSet.has(id)));
  };

  // Save number assignments
  const handleSaveAssignments = async (e) => {
    e.preventDefault();
    if (!selectedSender) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await request("post", `/inbox/routing/senders/${selectedSender.id}/assignments`, {
        userIds: selectedUserIds,
        permissions: numberPermissions
      });
      setNotice(`Updated employee team assignments for ${selectedSender.verified_name || selectedSender.display_phone}.`);
      closeManageModal();
      await fetchOverview();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to save assignments.");
    } finally {
      setSubmitting(false);
    }
  };

  // Save routing settings
  const handleSaveRoutingSettings = async (e) => {
    e.preventDefault();
    if (!admin) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await request("put", "/inbox/routing/settings", {
        strategy: routingSettings.strategy,
        required_skill: routingSettings.required_skill || null,
        crm_strategy: routingSettings.crm_strategy || "round_robin"
      });
      setNotice("Global conversation routing configuration updated.");
      await fetchOverview();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update routing settings.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="ac-team-workspace">
      {/* Overview Metric Banner */}
      <div className="ac-summary" aria-label="Organization numbers overview">
        <span>
          <strong>{overview.connectedNumbers}</strong> Connected numbers
        </span>
        <span>
          <strong>{overview.totalEmployees}</strong> Employees
        </span>
        <span>
          <strong>{overview.assignedEmployees}</strong> Assigned employees
        </span>
        <span>
          <strong>{overview.unassignedEmployees}</strong> Unassigned
        </span>
        <span>
          Strategy: <strong>{STRATEGY_LABELS[overview.routingStrategy] || "Round Robin"}</strong>
        </span>
      </div>

      {/* Sub Tabs */}
      <div className="ac-team-subtabs" style={{ display: "flex", gap: "16px", padding: "16px 0", borderBottom: "1px solid var(--ac-border)" }}>
        <button
          type="button"
          onClick={() => setSubTab("numbers")}
          className={subTab === "numbers" ? "ac-primary" : ""}
          style={{ minHeight: "36px", padding: "6px 16px", borderRadius: "6px", fontSize: "13px" }}
        >
          WhatsApp Number Assignments ({numbers.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab("settings")}
          className={subTab === "settings" ? "ac-primary" : ""}
          style={{ minHeight: "36px", padding: "6px 16px", borderRadius: "6px", fontSize: "13px" }}
        >
          Routing Configuration
        </button>
        <button
          type="button"
          onClick={() => setSubTab("audit")}
          className={subTab === "audit" ? "ac-primary" : ""}
          style={{ minHeight: "36px", padding: "6px 16px", borderRadius: "6px", fontSize: "13px" }}
        >
          Assignment & Sharing Audit Log
        </button>
      </div>

      {notice && <p role="status" style={{ color: "var(--ac-ink)", background: "var(--ac-selected)", padding: "10px 14px", borderRadius: "4px", margin: "14px 0" }}>{notice}</p>}
      {error && <p role="alert" className="ac-error" style={{ padding: "10px 14px", margin: "14px 0" }}>{error}</p>}

      {loading && <p role="status" style={{ padding: "20px 0" }}>Loading team access configuration…</p>}

      {!loading && subTab === "numbers" && (
        <div className="ac-numbers-section" style={{ marginTop: "20px" }}>
          <div className="ac-section-heading">
            <div>
              <h2>Shared Multi-User WhatsApp Numbers</h2>
              <p>
                Each phone number connects multiple employees. Incoming chats route automatically according to your
                strategy, and team members can collaborate without changing ownership.
              </p>
            </div>
            {admin && (
              <button
                type="button"
                onClick={fetchOverview}
                disabled={loading}
                style={{ display: "flex", alignItems: "center", gap: "6px", minHeight: "38px" }}
              >
                <RotateCw size={14} /> Refresh
              </button>
            )}
          </div>

          <div
            className="ac-numbers-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
              gap: "20px",
              marginTop: "16px"
            }}
          >
            {numbers.map((num) => {
              const assigned = Array.isArray(num.assignedEmployees) ? num.assignedEmployees : [];
              const preview = Array.isArray(num.previewNames) ? num.previewNames : [];
              const count = num.assigned_employee_count || assigned.length;
              const isConnected = num.status === "connected";

              return (
                <div
                  key={num.id}
                  className="ac-panel"
                  style={{
                    padding: "20px",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: "220px",
                    borderLeft: isConnected ? "4px solid #10b981" : "4px solid #ef4444"
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                      <div>
                        <h3 style={{ margin: "0 0 4px", fontSize: "16px" }}>
                          {num.verified_name || "WhatsApp Business"}
                        </h3>
                        <div style={{ fontFamily: "monospace", fontSize: "14px", fontWeight: "600", color: "var(--ac-ink)" }}>
                          {num.display_phone}
                        </div>
                      </div>
                      <span
                        className="ac-status"
                        style={{
                          background: isConnected ? "#10b98115" : "#ef444415",
                          borderColor: isConnected ? "#10b98140" : "#ef444440",
                          color: isConnected ? "#059669" : "#dc2626",
                          fontWeight: "600"
                        }}
                      >
                        {num.status}
                      </span>
                    </div>

                    <div style={{ fontSize: "12px", color: "var(--ac-muted)", marginBottom: "12px" }}>
                      Branches: <strong>{num.assigned_branches || "All branches"}</strong>
                    </div>

                    <div style={{ margin: "14px 0", padding: "10px 12px", background: "var(--ac-paper)", borderRadius: "6px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--ac-ink)" }}>
                          {count} assigned {count === 1 ? "employee" : "employees"}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--ac-muted)" }}>
                          {num.active_chat_count || 0} active chats
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "var(--ac-muted)", lineHeight: "1.4" }}>
                        {preview.length > 0 ? (
                          <>
                            {preview.join(" · ")}
                            {count > preview.length && <span> · +{count - preview.length} others</span>}
                          </>
                        ) : (
                          <span style={{ color: "var(--ac-error)", fontWeight: "500" }}>
                            No employees assigned yet. Incoming chats will remain unassigned.
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", fontSize: "11px", color: "var(--ac-muted)", marginBottom: "14px" }}>
                      <span style={{ padding: "2px 8px", background: "var(--ac-surface)", border: "1px solid var(--ac-border)", borderRadius: "4px" }}>
                        {STRATEGY_LABELS[num.routingStrategy] || "Round robin"}
                      </span>
                      <span style={{ padding: "2px 8px", background: "var(--ac-surface)", border: "1px solid var(--ac-border)", borderRadius: "4px" }}>
                        Shared Inbox Enabled
                      </span>
                    </div>
                  </div>

                  {admin && (
                    <div style={{ paddingTop: "12px", borderTop: "1px solid var(--ac-border)", display: "flex", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => openManageModal(num)}
                        className="ac-primary"
                        style={{ fontSize: "12px", minHeight: "34px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "6px" }}
                      >
                        <Users size={13} /> Manage assignments
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sub Tab: Global Routing Settings */}
      {!loading && subTab === "settings" && routingSettings && (
        <div className="ac-panel" style={{ maxWidth: "720px", marginTop: "20px", padding: "24px" }}>
          <h2>Automatic Conversation Routing Engine</h2>
          <p>
            When customer WhatsApp messages arrive, eligible employees assigned to that number receive the conversation
            according to this strategy.
          </p>

          <form onSubmit={handleSaveRoutingSettings}>
            <fieldset disabled={!admin || submitting}>
              <label>
                Routing Strategy
                <select
                  value={routingSettings.strategy}
                  onChange={(e) => setRoutingSettings((v) => ({ ...v, strategy: e.target.value }))}
                >
                  <option value="round_robin">Round Robin (Distribute conversations evenly across active staff)</option>
                  <option value="workload">Lowest Workload (Assign to agent with fewest open conversations)</option>
                  <option value="manual">Manual Assignment Only (Place in shared queue for team pickup)</option>
                </select>
              </label>

              <label>
                Required Employee Skill Filter (Optional)
                <input
                  type="text"
                  placeholder="e.g. Sales, Billing, Hindi, Technical Support"
                  maxLength={80}
                  value={routingSettings.required_skill || ""}
                  onChange={(e) => setRoutingSettings((v) => ({ ...v, required_skill: e.target.value }))}
                />
              </label>

              <p style={{ fontSize: "12px", color: "var(--ac-muted)" }}>
                Note: Collaborators invited to individual conversations via conversation sharing do not consume
                workload capacity.
              </p>

              {admin && (
                <button type="submit" className="ac-primary" disabled={submitting} style={{ marginTop: "12px" }}>
                  {submitting ? "Saving settings…" : "Save routing configuration"}
                </button>
              )}
            </fieldset>
          </form>
        </div>
      )}

      {/* Sub Tab: Audit Log */}
      {!loading && subTab === "audit" && (
        <div className="ac-panel" style={{ marginTop: "20px", padding: "24px" }}>
          <div className="ac-section-heading">
            <div>
              <h2>Assignment & Sharing Audit Trail</h2>
              <p>Append-only audit history of number assignments, conversation sharing, and permission changes.</p>
            </div>
            <button type="button" onClick={fetchOverview} disabled={loading} style={{ minHeight: "36px", fontSize: "12px" }}>
              Refresh
            </button>
          </div>

          {auditRecords.length === 0 ? (
            <p>No recorded audit events yet.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "16px", fontSize: "13px" }}>
              <thead>
                <tr style={{ borderBottom: "2px solid var(--ac-border)", textAlign: "left" }}>
                  <th style={{ padding: "8px 12px" }}>Timestamp</th>
                  <th style={{ padding: "8px 12px" }}>Actor</th>
                  <th style={{ padding: "8px 12px" }}>Action</th>
                  <th style={{ padding: "8px 12px" }}>Target</th>
                  <th style={{ padding: "8px 12px" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {auditRecords.map((rec) => (
                  <tr key={rec.id} style={{ borderBottom: "1px solid var(--ac-border)" }}>
                    <td style={{ padding: "10px 12px", color: "var(--ac-muted)", whiteSpace: "nowrap" }}>
                      {new Date(rec.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </td>
                    <td style={{ padding: "10px 12px", fontWeight: "600" }}>{rec.actor?.name || "System"}</td>
                    <td style={{ padding: "10px 12px" }}>
                      <span
                        style={{
                          fontSize: "11px",
                          padding: "2px 8px",
                          borderRadius: "4px",
                          background: "var(--ac-paper)",
                          border: "1px solid var(--ac-border)",
                          fontFamily: "monospace"
                        }}
                      >
                        {rec.action}
                      </span>
                    </td>
                    <td style={{ padding: "10px 12px" }}>{rec.subject?.name || "—"}</td>
                    <td style={{ padding: "10px 12px", color: "var(--ac-muted)", maxWidth: "300px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {typeof rec.details === "object" ? JSON.stringify(rec.details) : String(rec.details || "")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Manage Number Assignments Modal */}
      {selectedSender && (
        <div
          className="ac-modal-overlay"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.55)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={closeManageModal}
        >
          <div
            className="ac-panel"
            style={{
              width: "100%",
              maxWidth: "760px",
              maxHeight: "90vh",
              overflowY: "auto",
              padding: "24px",
              background: "var(--ac-surface)",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.2)"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--ac-border)", paddingBottom: "14px", marginBottom: "16px" }}>
              <div>
                <h2 style={{ margin: "0 0 4px" }}>
                  Manage Assignments — {selectedSender.verified_name || selectedSender.display_phone}
                </h2>
                <p style={{ margin: 0, fontSize: "13px" }}>
                  Select employees who receive conversations from{" "}
                  <strong>{selectedSender.display_phone}</strong> ({selectedSender.assigned_branches || "All branches"}).
                </p>
              </div>
              <button type="button" onClick={closeManageModal} style={{ minHeight: "32px", padding: "4px 8px" }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveAssignments}>
              {/* Filters */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                <input
                  type="search"
                  placeholder="Search staff by name or email…"
                  value={modalSearch}
                  onChange={(e) => setModalSearch(e.target.value)}
                  style={{ minHeight: "38px", fontSize: "13px" }}
                />
                <select
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                  style={{ minHeight: "38px", fontSize: "13px" }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  style={{ minHeight: "38px", fontSize: "13px" }}
                >
                  <option value="all">All Branches</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Selection Bar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", fontSize: "12px" }}>
                <span>
                  <strong>{selectedUserIds.length}</strong> employees assigned to this number
                </span>
                <div style={{ display: "flex", gap: "10px" }}>
                  <button type="button" onClick={selectAllFiltered} style={{ minHeight: "28px", padding: "2px 8px", fontSize: "11px" }}>
                    Select all filtered
                  </button>
                  <button type="button" onClick={deselectAllFiltered} style={{ minHeight: "28px", padding: "2px 8px", fontSize: "11px" }}>
                    Deselect all filtered
                  </button>
                </div>
              </div>

              {/* Employee Checklist */}
              <div
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  border: "1px solid var(--ac-border)",
                  borderRadius: "6px",
                  background: "var(--ac-paper)",
                  padding: "6px"
                }}
              >
                {filteredModalEmployees.length === 0 ? (
                  <p style={{ padding: "16px", textAlign: "center", color: "var(--ac-muted)" }}>
                    No matching employees found in this branch or department.
                  </p>
                ) : (
                  filteredModalEmployees.map((emp) => {
                    const isChecked = selectedUserIds.includes(Number(emp.user_id));
                    return (
                      <label
                        key={emp.user_id}
                        className="ac-check"
                        style={{
                          padding: "8px 10px",
                          margin: "2px 0",
                          borderRadius: "4px",
                          background: isChecked ? "var(--ac-selected)" : "var(--ac-surface)",
                          border: isChecked ? "1px solid #fcbd1680" : "1px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleUserAssignment(Number(emp.user_id))}
                          />
                          <div>
                            <span style={{ fontWeight: "700", color: "var(--ac-ink)", marginRight: "8px" }}>
                              {emp.first_name}
                            </span>
                            <span style={{ fontSize: "12px", color: "var(--ac-muted)" }}>({emp.email})</span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
                          {emp.department && (
                            <span style={{ padding: "2px 6px", background: "var(--ac-paper)", border: "1px solid var(--ac-border)", borderRadius: "3px" }}>
                              {emp.department}
                            </span>
                          )}
                          <span style={{ padding: "2px 6px", background: "var(--ac-paper)", border: "1px solid var(--ac-border)", borderRadius: "3px" }}>
                            {emp.branch_name}
                          </span>
                          {emp.is_available ? (
                            <span style={{ color: "#059669", fontWeight: "600" }}>Available</span>
                          ) : (
                            <span style={{ color: "#d97706" }}>Unavailable</span>
                          )}
                        </div>
                      </label>
                    );
                  })
                )}
              </div>

              {/* Granular Permissions for this WhatsApp Number */}
              <div style={{ marginTop: "18px", padding: "14px", border: "1px solid var(--ac-border)", borderRadius: "6px", background: "var(--ac-surface)" }}>
                <h4 style={{ margin: "0 0 10px", fontSize: "13px", fontWeight: "700" }}>
                  Default Access Level for Assigned Staff on this Number
                </h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px" }}>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_reply)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_reply: e.target.checked ? 1 : 0 }))}
                    />
                    Can reply to customer conversations
                  </label>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_send_templates)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_send_templates: e.target.checked ? 1 : 0 }))}
                    />
                    Can send approved message templates
                  </label>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_send_attachments)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_send_attachments: e.target.checked ? 1 : 0 }))}
                    />
                    Can send documents and attachments
                  </label>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_add_notes)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_add_notes: e.target.checked ? 1 : 0 }))}
                    />
                    Can add internal team notes
                  </label>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_transfer)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_transfer: e.target.checked ? 1 : 0 }))}
                    />
                    Can transfer conversation to other agents/branches
                  </label>
                  <label className="ac-check" style={{ minHeight: "30px", margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={Boolean(numberPermissions.can_share)}
                      onChange={(e) => setNumberPermissions((v) => ({ ...v, can_share: e.target.checked ? 1 : 0 }))}
                    />
                    Can share conversations with collaborators
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px", paddingTop: "14px", borderTop: "1px solid var(--ac-border)" }}>
                <button type="button" onClick={closeManageModal} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="ac-primary" disabled={submitting}>
                  {submitting ? "Saving assignments…" : `Save Assignments (${selectedUserIds.length} staff)`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

