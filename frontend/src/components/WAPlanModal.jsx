import { useState, useEffect } from "react";
import axios from "axios";
import {
  X,
  Sparkles,
  Check,
  Shield,
  Layers,
  ArrowRight,
  TrendingUp,
  CreditCard,
  Building2,
  Cpu,
  Loader2,
} from "lucide-react";
import { API } from "../config/api";
import { useAuth } from "../auth/AuthContext";

const DEFAULT_PLANS = [
  {
    id: "free",
    name: "Free Tier",
    badge: "Free",
    price: "₹0",
    billing: "forever",
    maxSenders: 1,
    maxMonthlyMessages: 500,
    features: [
      "1 Connected WhatsApp Number",
      "500 Outbound Messages / mo",
      "Live Chat Inbox & History",
      "Standard Message Templates",
      "Basic Keyword Auto-Reply",
    ],
  },
  {
    id: "starter",
    name: "Starter Plan",
    badge: "Popular",
    price: "₹1,499",
    billing: "/ month",
    maxSenders: 3,
    maxMonthlyMessages: 5000,
    features: [
      "3 Connected WhatsApp Numbers",
      "5,000 Outbound Messages / mo",
      "Visual Chatbot Flow Builder",
      "Anti-Ban Humanized Pacing",
      "Automated Reminders & Invoices",
    ],
  },
  {
    id: "growth",
    name: "Growth Plan",
    badge: "Recommended",
    price: "₹3,999",
    billing: "/ month",
    maxSenders: 10,
    maxMonthlyMessages: 25000,
    features: [
      "10 Connected WhatsApp Numbers",
      "25,000 Outbound Messages / mo",
      "Smart AI Neural Replies (OpenAI)",
      "Multi-Sender Pool Load Balancing",
      "Automated Drip Sequences & Followups",
    ],
  },
  {
    id: "enterprise",
    name: "Enterprise",
    badge: "Scale",
    price: "₹9,999",
    billing: "/ month",
    maxSenders: 50,
    maxMonthlyMessages: 100000,
    features: [
      "50+ Connected WhatsApp Numbers",
      "100,000+ Outbound Messages / mo",
      "Dedicated Meta Cloud API Engine",
      "Unlimited Agents & Isolation",
      "24/7 Priority SLA & Dedicated Manager",
    ],
  },
];

export default function WAPlanModal({ isOpen, onClose }) {
  const { user, login } = useAuth();
  const [plans, setPlans] = useState(DEFAULT_PLANS);
  const [tenantUsage, setTenantUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const token = localStorage.getItem("token");
    const headers = token ? { Authorization: `Bearer ${token}` } : {};

    setLoading(true);
    Promise.all([
      axios.get(`${API}/api/auth/plans`, { headers, timeout: 6000 }).catch(() => ({ data: { plans: DEFAULT_PLANS } })),
      axios.get(`${API}/api/auth/tenant-info`, { headers, timeout: 6000 }).catch(() => ({ data: null })),
    ])
      .then(([plansRes, usageRes]) => {
        if (plansRes.data?.plans && Array.isArray(plansRes.data.plans)) {
          setPlans(plansRes.data.plans);
        }
        if (usageRes.data) {
          setTenantUsage(usageRes.data);
        }
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const currentPlanId = tenantUsage?.tenant?.plan || user?.plan || "starter";
  const currentPlanMeta = plans.find((p) => p.id === currentPlanId) || DEFAULT_PLANS[1];

  const handleSwitchPlan = async (targetPlanId) => {
    if (targetPlanId === currentPlanId) return;

    setSwitching(true);
    setMessage(null);
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const checkoutRes = await axios.post(
        `${API}/api/v2/billing/checkout`,
        { planId: targetPlanId, interval: "month" },
        { headers }
      );

      const confirmRes = await axios.post(
        `${API}/api/v2/billing/confirm-payment`,
        {
          planId: targetPlanId,
          orderId: checkoutRes.data?.receipt || `sub_${Date.now()}`,
          paymentId: `pay_test_${Date.now()}`,
          signature: "mock_test_signature",
        },
        { headers }
      );

      if (confirmRes.data?.success) {
        setMessage({ type: "success", text: `Plan successfully activated for ${targetPlanId.toUpperCase()}!` });
        login({
          ...user,
          plan: targetPlanId,
        });
        const refreshUsage = await axios.get(`${API}/api/v2/billing/subscription`, { headers }).catch(() => null);
        if (refreshUsage?.data) setTenantUsage(refreshUsage.data);
      }
    } catch (err) {
      setMessage({ type: "error", text: err.response?.data?.message || "Failed to upgrade plan via billing engine." });
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-3 sm:p-5 backdrop-blur-sm">
      <div
        className="hl-card relative w-full max-w-3xl max-h-[92dvh] overflow-y-auto wa-custom-scrollbar"
        style={{ padding: "20px 24px" }}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-md text-[var(--color-ink-2)] hover:text-[var(--color-ink)]"
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 8,
              background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)",
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="hl-title" style={{ fontSize: 18, margin: 0 }}>
                {tenantUsage?.tenant?.name || user?.tenant_name || "Workspace Settings"}
              </h2>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  padding: "2px 7px",
                  borderRadius: 4,
                  background: "#e0f2fe",
                  color: "#0369a1",
                }}
              >
                {currentPlanMeta.name}
              </span>
            </div>
            <p style={{ fontSize: 12, color: "var(--color-ink-2)", margin: 0 }}>
              Multi-Tenant Architecture · Organization ID #{tenantUsage?.tenant?.id || user?.tenant_id || 1}
            </p>
          </div>
        </div>

        {message && (
          <div
            className={`hl-badge ${message.type === "success" ? "hl-badge-success" : "hl-badge-error"} mb-4`}
            style={{ width: "100%", justifyContent: "flex-start", padding: "8px 12px" }}
          >
            {message.text}
          </div>
        )}

        {/* Usage Snapshot */}
        <div
          style={{
            background: "var(--color-paper-2, #f8fafc)",
            border: "1px solid var(--color-line)",
            borderRadius: 8,
            padding: "14px 16px",
            marginBottom: 20,
          }}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-ink)" }}>
              Current Plan Quota &amp; Usage
            </span>
            <span style={{ fontSize: 11, color: "var(--color-ink-2)" }}>
              Monthly Cycle
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14 }}>
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-ink-2)]">WhatsApp Senders:</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {tenantUsage?.usage?.sendersUsed ?? 1} / {currentPlanMeta.maxSenders} Numbers
                </span>
              </div>
              <div style={{ height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, Math.round(((tenantUsage?.usage?.sendersUsed ?? 1) / currentPlanMeta.maxSenders) * 100))}%`,
                    background: "#0284c7",
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--color-ink-2)]">Monthly Outbound Messages:</span>
                <span className="font-semibold text-[var(--color-ink)]">
                  {tenantUsage?.usage?.messagesUsedThisMonth ?? 0} / {Number(currentPlanMeta.maxMonthlyMessages).toLocaleString()} msgs
                </span>
              </div>
              <div style={{ height: 6, background: "var(--color-line)", borderRadius: 3, overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${tenantUsage?.usage?.usagePercent ?? 5}%`,
                    background: "#10b981",
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Available Plans Selector */}
        <h3 className="hl-section-label" style={{ marginBottom: 12 }}>
          Subscription Plans &amp; Tiers
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {plans.map((p) => {
            const isCurrent = p.id === currentPlanId;
            return (
              <div
                key={p.id}
                style={{
                  border: isCurrent ? "2px solid #0284c7" : "1px solid var(--color-line)",
                  background: isCurrent ? "rgba(2, 132, 199, 0.04)" : "var(--color-paper, #ffffff)",
                  borderRadius: 8,
                  padding: 14,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span style={{ fontSize: 14, fontWeight: 700, color: "var(--color-ink)" }}>
                      {p.name}
                    </span>
                    {isCurrent ? (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          background: "#0284c7",
                          color: "#ffffff",
                          padding: "1px 6px",
                          borderRadius: 4,
                        }}
                      >
                        Active
                      </span>
                    ) : (
                      p.badge && (
                        <span
                          style={{
                            fontSize: 10,
                            background: "var(--color-line)",
                            color: "var(--color-ink-2)",
                            padding: "1px 6px",
                            borderRadius: 4,
                          }}
                        >
                          {p.badge}
                        </span>
                      )
                    )}
                  </div>

                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--color-ink)", marginBottom: 8 }}>
                    {p.price}
                    <span style={{ fontSize: 11, fontWeight: 500, color: "var(--color-ink-2)", marginLeft: 3 }}>
                      {p.billing}
                    </span>
                  </div>

                  <div style={{ fontSize: 11, color: "var(--color-ink-2)", marginBottom: 12, lineHeight: 1.5 }}>
                    <div className="font-semibold text-[var(--color-ink)] mb-1">
                      {p.maxSenders} Senders · {Number(p.maxMonthlyMessages).toLocaleString()} msgs/mo
                    </div>
                    {p.features?.map((f, fi) => (
                      <div key={fi} className="flex items-center gap-1.5 py-0.5">
                        <Check size={11} className="text-emerald-600 shrink-0" />
                        <span className="truncate">{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  disabled={isCurrent || switching}
                  onClick={() => handleSwitchPlan(p.id)}
                  className={isCurrent ? "hl-btn-secondary" : "hl-btn-primary"}
                  style={{
                    width: "100%",
                    fontSize: 12,
                    padding: "7px 10px",
                    justifyContent: "center",
                    opacity: isCurrent ? 0.7 : 1,
                  }}
                >
                  {isCurrent ? (
                    "Current Plan"
                  ) : switching ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    `Switch to ${p.name}`
                  )}
                </button>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-[var(--color-line)]">
          <button type="button" onClick={onClose} className="hl-btn-secondary" style={{ padding: "8px 16px" }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
