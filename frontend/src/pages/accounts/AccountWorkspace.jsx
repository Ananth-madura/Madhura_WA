import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import {
  Building2,
  Phone,
  ShieldCheck,
  Users,
  Bot,
  RefreshCw,
  Plus,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Sparkles,
  Layers,
  Radio,
  Cpu,
  Lock,
  MessageSquare
} from "lucide-react";
import { API } from "../../config/api";
import { useEnterprise } from "../../context/EnterpriseContext";
import { metaSignup } from "./metaSignup";
import TeamAccessWorkspace from "./TeamAccessWorkspace";
import WhatsAppSenderCenter from "../../components/WhatsAppSenderCenter";
import WhatsAppIntegrations from "../../components/WhatsAppIntegrations";
import "./accounts.css";

const message = (error) =>
  error.response?.data?.message || error.message || "The request failed. Try again.";

const PROVIDER_PRESETS = {
  gemini: {
    label: "Google Gemini",
    models: ["gemini-1.5-flash", "gemini-1.5-pro", "gemini-2.0-flash-exp"],
    hint: "Recommended for fast conversational replies and large context."
  },
  openai: {
    label: "OpenAI",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-3.5-turbo"],
    hint: "Industry standard for structured formatting and reasoning."
  },
  groq: {
    label: "Groq (Ultra-Low Latency)",
    models: ["llama-3.3-70b-versatile", "mixtral-8x7b-32768"],
    hint: "Sub-second response streaming for instant customer replies."
  },
  deepseek: {
    label: "DeepSeek",
    models: ["deepseek-chat", "deepseek-coder"],
    hint: "Cost-effective high-intelligence open model."
  },
  openrouter: {
    label: "OpenRouter",
    models: ["anthropic/claude-3.5-sonnet", "meta-llama/llama-3.1-70b-instruct"],
    hint: "Unified gateway across multiple top AI frontier models."
  }
};

function Assistant({ request, admin, run, busy }) {
  const [value, setValue] = useState(null);
  const [error, setError] = useState("");
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    let active = true;
    request("get", "/inbox/assistant/settings")
      .then((data) => {
        if (active) {
          setValue({
            ...data.settings,
            enabled: Boolean(data.settings.enabled),
            autoStart: Boolean(data.settings.auto_start),
            systemPrompt: data.settings.system_prompt || "",
            apiKey: "",
            clearKey: false,
          });
        }
      })
      .catch((e) => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [request]);

  if (error) {
    return (
      <div className="ac-notice-banner is-error" role="alert">
        <AlertCircle size={18} className="shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  if (!value) {
    return (
      <div className="ac-panel text-center py-12" role="status">
        <RefreshCw size={24} className="animate-spin text-amber-500 mx-auto mb-3" />
        <p className="font-semibold text-slate-700">Loading Assistant Configuration...</p>
      </div>
    );
  }

  const change = (key, next) => setValue((v) => ({ ...v, [key]: next }));
  const activeProviderMeta = PROVIDER_PRESETS[value.provider] || PROVIDER_PRESETS.gemini;

  return (
    <section aria-labelledby="assistant-heading" className="ac-assistant-container">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[var(--ac-border)] pb-4">
        <div>
          <h2 id="assistant-heading" className="flex items-center gap-2">
            <Bot size={22} className="text-amber-500" />
            <span>AI Business Assistant</span>
          </h2>
          <p className="text-sm text-[var(--ac-muted)] m-0">
            Automate customer replies across all linked WhatsApp phone numbers. Agents can seamlessly take over in the live inbox.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`px-3 py-1 text-xs font-bold rounded-full border ${
              value.enabled
                ? "bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400"
            }`}
          >
            {value.enabled ? "● Assistant Active" : "○ Assistant Inactive"}
          </span>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(
            "assistant",
            async () => {
              const data = await request("put", "/inbox/assistant/settings", {
                enabled: value.enabled,
                autoStart: value.autoStart,
                provider: value.provider,
                model: value.model,
                systemPrompt: value.systemPrompt,
                ...(value.apiKey ? { apiKey: value.apiKey } : {}),
                clearKey: value.clearKey,
              });
              setValue((v) => ({ ...v, hasApiKey: data.settings.hasApiKey, apiKey: "", clearKey: false }));
            },
            "Assistant settings saved."
          );
        }}
      >
        <fieldset disabled={!admin || Boolean(busy)} className="ac-assistant-grid">
          {/* Group 1: Activation Switches */}
          <div className="ac-setting-group">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-ink)] mb-4">
              <Sparkles size={16} className="text-amber-500" />
              <span>Activation & Incoming Trigger Policies</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="ac-toggle-switch p-3 rounded-xl border border-[var(--ac-border)] bg-[var(--ac-paper)] hover:border-[var(--ac-border-hover)] transition">
                <input
                  type="checkbox"
                  className="ac-toggle-input"
                  checked={value.enabled}
                  onChange={(e) => change("enabled", e.target.checked)}
                />
                <span className="ac-toggle-slider" />
                <div>
                  <span className="font-bold text-sm block text-[var(--ac-ink)]">Enable AI Auto-Replies</span>
                  <span className="text-xs text-[var(--ac-muted)] block">Allow the AI engine to generate messages to customer inquiries.</span>
                </div>
              </label>

              <label className="ac-toggle-switch p-3 rounded-xl border border-[var(--ac-border)] bg-[var(--ac-paper)] hover:border-[var(--ac-border-hover)] transition">
                <input
                  type="checkbox"
                  className="ac-toggle-input"
                  checked={value.autoStart}
                  onChange={(e) => change("autoStart", e.target.checked)}
                />
                <span className="ac-toggle-slider" />
                <div>
                  <span className="font-bold text-sm block text-[var(--ac-ink)]">Auto-Start on New Chats</span>
                  <span className="text-xs text-[var(--ac-muted)] block">Automatically assign the AI assistant as first responder.</span>
                </div>
              </label>
            </div>
          </div>

          {/* Group 2: AI Provider & Engine */}
          <div className="ac-setting-group">
            <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-ink)] mb-2">
              <Cpu size={16} className="text-amber-500" />
              <span>LLM Engine & Provider Selection</span>
            </h3>
            <p className="text-xs text-[var(--ac-muted)] mb-4">Select your preferred model provider. Each provider runs with low latency and dedicated rate quotas.</p>

            <div className="ac-provider-grid">
              {Object.entries(PROVIDER_PRESETS).map(([key, item]) => {
                const isSelected = value.provider === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      change("provider", key);
                      change("model", item.models[0] || "");
                      change("apiKey", "");
                      change("hasApiKey", false);
                    }}
                    className={`ac-provider-card ${isSelected ? "is-selected" : ""}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-[var(--ac-ink)]">{item.label}</span>
                      {isSelected ? (
                        <CheckCircle2 size={15} className="text-amber-600 dark:text-amber-400" />
                      ) : (
                        <span className="w-3.5 h-3.5 rounded-full border border-[var(--ac-border)]" />
                      )}
                    </div>
                    <span className="text-[11px] text-[var(--ac-muted)] leading-tight">{item.hint}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="ac-form-group mb-0">
                <label className="ac-form-label" htmlFor="assistant-model-input">
                  Model ID
                </label>
                <input
                  id="assistant-model-input"
                  required={value.enabled}
                  value={value.model}
                  maxLength={150}
                  onChange={(e) => change("model", e.target.value)}
                  className="ac-input font-mono text-xs"
                  placeholder="e.g. gemini-1.5-flash"
                />
                <div className="ac-preset-pills">
                  <span className="text-[11px] text-[var(--ac-muted)] self-center mr-1">Presets:</span>
                  {activeProviderMeta.models.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => change("model", m)}
                      className={`ac-preset-pill ${value.model === m ? "border-amber-500 font-bold" : ""}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="ac-form-group mb-0">
                <div className="flex items-center justify-between mb-1">
                  <label className="ac-form-label mb-0" htmlFor="assistant-api-key">
                    Provider API Key
                  </label>
                  {value.hasApiKey && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      <Lock size={11} /> Saved securely
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="assistant-api-key"
                    type={showKey ? "text" : "password"}
                    autoComplete="off"
                    maxLength={2000}
                    value={value.apiKey}
                    onChange={(e) => change("apiKey", e.target.value)}
                    className="ac-input font-mono text-xs pr-10"
                    placeholder={value.hasApiKey ? "(Saved on server. Leave empty to keep)" : "Enter API secret key"}
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(!showKey)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--ac-muted)] hover:text-[var(--ac-ink)] transition"
                    aria-label={showKey ? "Hide API key" : "Show API key"}
                  >
                    {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>

                {value.hasApiKey && (
                  <label className="flex items-center gap-2 mt-2 cursor-pointer text-xs text-[var(--ac-error)]">
                    <input
                      type="checkbox"
                      checked={value.clearKey}
                      onChange={(e) => change("clearKey", e.target.checked)}
                      className="rounded text-red-600"
                    />
                    <span>Remove saved API key on save</span>
                  </label>
                )}
              </div>
            </div>
          </div>

          {/* Group 3: System Prompt Instructions */}
          <div className="ac-setting-group">
            <div className="flex items-center justify-between mb-2">
              <h3 className="flex items-center gap-2 text-sm font-bold text-[var(--ac-ink)] m-0">
                <MessageSquare size={16} className="text-amber-500" />
                <span>Business Knowledge & System Instructions</span>
              </h3>
              <span className="text-xs text-[var(--ac-muted)] font-mono">
                {value.systemPrompt.length} / 10,000 characters
              </span>
            </div>
            <p className="text-xs text-[var(--ac-muted)] mb-3">
              Define product catalog facts, business hours, polite greeting tone, and boundary instructions. The assistant handles conversations but cannot execute financial transactions.
            </p>

            <textarea
              rows={8}
              maxLength={10000}
              value={value.systemPrompt}
              onChange={(e) => change("systemPrompt", e.target.value)}
              className="ac-textarea text-xs leading-relaxed"
              placeholder="You are the official WhatsApp assistant for our business. Always greet customers politely. Provide store hours (9am - 8pm), answer FAQs regarding order tracking, and invite users to leave their contact details for human follow-up."
            />

            <div className="mt-3 p-3 rounded-lg bg-[var(--ac-paper)] border border-[var(--ac-border)] text-xs text-[var(--ac-muted)] flex items-start gap-2">
              <ShieldCheck size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Safety Guardrail:</strong> The assistant answers conversations based on your instructions. It cannot modify business invoices, change tenant settings, or trigger unconfigured automations.
              </span>
            </div>
          </div>

          {/* Form Actions */}
          {admin && (
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="submit"
                disabled={Boolean(busy)}
                className="ac-btn ac-btn-primary min-w-[180px] shadow-sm font-bold"
              >
                {busy === "assistant" ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={14} />
                    <span>Save assistant settings</span>
                  </>
                )}
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </section>
  );
}

export default function AccountWorkspace() {
  const enterprise = useEnterprise();
  if (enterprise.loading) {
    return (
      <div className="ac-workspace flex items-center justify-center min-h-[300px]" role="status">
        <div className="flex items-center gap-3">
          <RefreshCw size={20} className="animate-spin text-amber-500" />
          <span className="font-semibold text-slate-700">Loading organization details...</span>
        </div>
      </div>
    );
  }

  if (!enterprise.activeTenant) {
    return (
      <div className="ac-workspace flex flex-col items-center justify-center min-h-[300px] text-center p-8">
        <Building2 size={44} className="text-[var(--ac-muted)] mb-3" />
        <h2 className="text-lg font-bold">No Organization Selected</h2>
        <p className="max-w-md text-sm text-[var(--ac-muted)]">
          Please select an active organization tenant to manage linked WhatsApp accounts, Meta Cloud numbers, and team dispatch rules.
        </p>
      </div>
    );
  }

  return <Workspace key={enterprise.activeTenant.id} enterprise={enterprise} />;
}

export function Workspace({ enterprise }) {
  const { activeTenant, branches = [], isOwnerOrAdmin: admin, getHeaders } = enterprise;
  const [params, setParams] = useSearchParams();
  const [senders, setSenders] = useState([]);
  const [setup, setSetup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState("");

  const alive = useRef(true);
  const signup = useRef(null);
  const operation = useRef(false);
  const loadVersion = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      signup.current?.abort();
    };
  }, []);

  const request = useCallback(
    async (method, path, data) => {
      const headers = { ...(getHeaders ? getHeaders() : {}), "x-tenant-id": String(activeTenant.id) };
      const response = await axios({
        method,
        url: `${API}/api/v2${path}`,
        headers,
        withCredentials: true,
        ...(data !== undefined ? { data } : {}),
      });
      if (response.data.success === false) {
        throw new Error(response.data.message || "The operation failed.");
      }
      return response.data;
    },
    [getHeaders, activeTenant.id]
  );

  const refresh = useCallback(async () => {
    const version = ++loadVersion.current;
    setLoading(true);
    try {
      const [list, config] = await Promise.all([request("get", "/meta/senders"), request("get", "/meta/setup")]);
      if (alive.current && version === loadVersion.current) {
        setSenders(list.senders || []);
        setSetup(config);
      }
    } finally {
      if (alive.current && version === loadVersion.current) setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    refresh().catch((e) => {
      if (alive.current) setError(message(e));
    });
  }, [refresh]);

  const tabParam = params.get("tab");
  const tab =
    tabParam === "assistant"
      ? "assistant"
      : tabParam === "integrations"
      ? "integrations"
      : tabParam === "assign" || tabParam === "team-access"
      ? "assign"
      : "senders";

  const navigate = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next);
  };

  const run = async (name, work, success) => {
    if (operation.current) return;
    operation.current = true;
    setBusy(name);
    setError("");
    setNotice("");
    try {
      await work();
      if (alive.current) setNotice(success);
    } catch (e) {
      if (alive.current) setError(message(e));
    } finally {
      operation.current = false;
      if (alive.current) setBusy("");
    }
  };

  const saveSender = async (method, path, data) => {
    const result = await request(method, path, data);
    await refresh();
    return result.sender || result.data;
  };

  const startSignup = () =>
    run(
      "signup",
      async () => {
        const { session } = await request("post", "/meta/onboarding/sessions", {});
        signup.current = new AbortController();
        const result = await metaSignup(session, signup.current.signal);
        const data = await saveSender("post", "/meta/onboarding/complete", {
          ...result,
          isShared: true,
          branchIds: branches.filter((b) => b.status === "active").map((b) => Number(b.id)),
        });
        if (alive.current) navigate({ sender: String(data.id), tab: "senders" });
      },
      "WhatsApp connection saved. Review branch routing and webhook setup."
    );

  // Sender Operations Callbacks
  const handlePing = (id) => request("post", `/meta/senders/${id}/ping`, {});
  const handleTestSend = (id, data) => request("post", `/meta/senders/${id}/test-send`, data);
  const handleDiscoverAssets = (data) => request("post", "/meta/assets/discover", data);
  const handleBatchConnect = (data) => request("post", "/meta/senders/connect-batch", data);
  const handleRegisterPin = (id, pinCode) => request("post", `/meta/senders/${id}/register`, { pin: pinCode });
  const handleUpdateSettings = (id, patch) => request("patch", `/meta/senders/${id}/settings`, patch);
  const handleRoutingChange = (id, patch) => request("patch", `/meta/senders/${id}/branch-assignments`, patch);

  // Summary Metrics calculations
  const connectedCount = senders.filter((s) => s.status === "connected" || s.verified_name).length;
  const activeBranchCount = branches.filter((b) => b.status === "active").length;

  return (
    <section className="ac-workspace" aria-labelledby="accounts-title">
      {/* Header with Breadcrumb & Context */}
      <header className="ac-header">
        <div>
          <div className="ac-context-badge">
            <Building2 size={13} className="text-amber-500" />
            <span>{activeTenant.name} / WhatsApp Multi-Sender</span>
          </div>
          <h1 id="accounts-title">Accounts & Multi-Sender Platform</h1>
          <p>Operate multiple Meta phone numbers concurrently with independent department routing and dispatch policies.</p>
        </div>

        <div className="ac-actions">
          <button
            type="button"
            className="ac-btn"
            disabled={loading || Boolean(busy)}
            onClick={() => run("refresh", refresh, "Sender list refreshed successfully.")}
          >
            <RefreshCw size={14} className={loading || busy === "refresh" ? "animate-spin text-amber-500" : ""} />
            <span>Refresh</span>
          </button>

          {admin && (
            <button
              type="button"
              className="ac-btn ac-btn-primary"
              disabled={Boolean(busy)}
              onClick={() => navigate({ tab: "integrations" })}
            >
              <Plus size={15} />
              <span>Connect WhatsApp Number</span>
            </button>
          )}

          <Link to="/whatsapp" className="ac-btn" title="Jump to Live Chat Workspace">
            <MessageSquare size={14} />
            <span>Live Inbox</span>
          </Link>
        </div>
      </header>

      {/* Diagnostics / Metric Overview Strip */}
      <div className="ac-metrics-strip">
        <div className="ac-metric-card">
          <div className="ac-metric-info">
            <span className="ac-metric-label">Active Senders</span>
            <span className="ac-metric-value">{connectedCount} / {senders.length}</span>
            <span className="ac-metric-sub">{senders.length === 1 ? "1 number configured" : `${senders.length} numbers configured`}</span>
          </div>
          <div className="ac-metric-icon">
            <Phone size={20} className={connectedCount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"} />
          </div>
        </div>

        <div className="ac-metric-card">
          <div className="ac-metric-info">
            <span className="ac-metric-label">Meta Cloud Platform</span>
            <span className="ac-metric-value">{setup?.configured ? "Ready" : "Pending"}</span>
            <span className="ac-metric-sub">{setup?.configured ? "Official Cloud API linked" : "Credentials required"}</span>
          </div>
          <div className="ac-metric-icon">
            <ShieldCheck size={20} className={setup?.configured ? "text-emerald-600 dark:text-emerald-400" : "text-amber-500"} />
          </div>
        </div>

        <div className="ac-metric-card">
          <div className="ac-metric-info">
            <span className="ac-metric-label">Multi-Branch Routing</span>
            <span className="ac-metric-value">{activeBranchCount}</span>
            <span className="ac-metric-sub">{activeBranchCount === 1 ? "1 branch linked" : `${activeBranchCount} branches linked`}</span>
          </div>
          <div className="ac-metric-icon">
            <Layers size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
        </div>

        <div className="ac-metric-card">
          <div className="ac-metric-info">
            <span className="ac-metric-label">AI Automation</span>
            <span className="ac-metric-value">Assistant</span>
            <span className="ac-metric-sub">Dedicated auto-reply engine</span>
          </div>
          <div className="ac-metric-icon">
            <Bot size={20} className="text-amber-500" />
          </div>
        </div>
      </div>

      {/* Main Tab Navigation */}
      <div className="ac-tabs-wrapper">
        <nav className="ac-tabs" role="tablist" aria-label="Account management tabs">
          <Link
            role="tab"
            aria-selected={tab === "senders"}
            aria-current={tab === "senders" ? "page" : undefined}
            to="?tab=senders"
            className={`ac-tab ${tab === "senders" ? "is-active" : ""}`}
          >
            <Phone size={15} />
            <span>Numbers & Operations</span>
            <span className="ac-tab-chip">{senders.length}</span>
          </Link>

          <Link
            role="tab"
            aria-selected={tab === "integrations"}
            aria-current={tab === "integrations" ? "page" : undefined}
            to="?tab=integrations"
            className={`ac-tab ${tab === "integrations" ? "is-active" : ""}`}
          >
            <ShieldCheck size={15} />
            <span>Meta Integrations & Signup</span>
            <span className="ac-tab-chip">{setup?.configured ? "Active" : "Setup"}</span>
          </Link>

          <Link
            role="tab"
            aria-selected={tab === "assign"}
            aria-current={tab === "assign" ? "page" : undefined}
            to="?tab=assign"
            className={`ac-tab ${tab === "assign" ? "is-active" : ""}`}
          >
            <Users size={15} />
            <span>Assign & Team Access</span>
          </Link>

          <Link
            role="tab"
            aria-selected={tab === "assistant"}
            aria-current={tab === "assistant" ? "page" : undefined}
            to="?tab=assistant"
            className={`ac-tab ${tab === "assistant" ? "is-active" : ""}`}
          >
            <Bot size={15} />
            <span>Business Assistant</span>
          </Link>

          <div className="ac-tab-divider" role="separator" />

          <Link to="/whatsapp/automations" className="ac-tab ac-tab-jump" title="Open Marketing & System Automations">
            <Radio size={14} />
            <span>Automations</span>
            <ExternalLink size={11} className="opacity-60" />
          </Link>

          <Link to="/whatsapp/flows" className="ac-tab ac-tab-jump" title="Open WhatsApp Interactive Flow Builder">
            <Layers size={14} />
            <span>Workflow builder</span>
            <ExternalLink size={11} className="opacity-60" />
          </Link>
        </nav>
      </div>

      {/* Global Feedback Notifications */}
      <div className="ac-feedback" aria-live="polite">
        {notice && (
          <div className="ac-notice-banner is-success" role="status">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
              <span>{notice}</span>
            </div>
            <button
              type="button"
              onClick={() => setNotice("")}
              className="text-xs font-bold opacity-70 hover:opacity-100 p-1"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        )}

        {error && (
          <div className="ac-notice-banner is-error" role="alert">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-xs font-bold opacity-70 hover:opacity-100 p-1"
              aria-label="Dismiss alert"
            >
              ✕
            </button>
          </div>
        )}
      </div>

      {!admin && (
        <div className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
          <AlertCircle size={15} className="shrink-0 text-amber-600" />
          <span>Read-only Mode: Phone credentials and routing assignments are managed by organization administrators.</span>
        </div>
      )}

      {/* Active Tab Workspace Panel */}
      {tab === "assistant" ? (
        <div className="ac-panel">
          <Assistant request={request} run={run} busy={busy} admin={admin} />
        </div>
      ) : tab === "assign" ? (
        <TeamAccessWorkspace enterprise={enterprise} request={request} admin={admin} />
      ) : tab === "integrations" ? (
        <WhatsAppIntegrations
          setup={setup}
          admin={admin}
          busy={busy}
          branches={branches}
          onStartEmbeddedSignup={startSignup}
          onDiscoverAssets={handleDiscoverAssets}
          onBatchConnect={handleBatchConnect}
          onManualConnect={async (data) => {
            const saved = await saveSender("post", "/meta/senders/manual", data);
            navigate({ sender: String(saved.id), tab: "senders" });
          }}
          onRefresh={refresh}
        />
      ) : (
        <WhatsAppSenderCenter
          senders={senders}
          branches={branches}
          admin={admin}
          busy={busy}
          onPing={handlePing}
          onTestSend={handleTestSend}
          onRegister={handleRegisterPin}
          onUpdateSettings={handleUpdateSettings}
          onRoutingChange={handleRoutingChange}
          onDisconnect={(id) =>
            run(
              "disconnect",
              () => request("delete", `/meta/senders/${id}`).then(refresh),
              "Sender disconnected successfully."
            )
          }
          onRefresh={refresh}
          request={request}
        />
      )}
    </section>
  );
}
