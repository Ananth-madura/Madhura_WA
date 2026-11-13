import React, { useCallback, useEffect, useRef, useState } from "react";
import axios from "axios";
import { Link, useSearchParams } from "react-router-dom";
import { API } from "../../config/api";
import { useEnterprise } from "../../context/EnterpriseContext";
import { metaSignup } from "./metaSignup";
import TeamAccessWorkspace from "./TeamAccessWorkspace";
import WhatsAppSenderCenter from "../../components/WhatsAppSenderCenter";
import WhatsAppIntegrations from "../../components/WhatsAppIntegrations";
import "./accounts.css";

const message = error => error.response?.data?.message || error.message || "The request failed. Try again.";

function Assistant({ request, admin, run, busy }) {
  const [value, setValue] = useState(null), [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    request("get", "/inbox/assistant/settings")
      .then(data => {
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
      .catch(e => {
        if (active) setError(message(e));
      });
    return () => {
      active = false;
    };
  }, [request]);

  if (error) return <p role="alert">{error}</p>;
  if (!value) return <p role="status">Loading assistant settings…</p>;
  const change = (key, next) => setValue(v => ({ ...v, [key]: next }));

  return (
    <section aria-labelledby="assistant-heading">
      <h2 id="assistant-heading">Business assistant</h2>
      <p>Settings apply to this organization. Employees can take over a conversation in the inbox.</p>
      <form
        onSubmit={e => {
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
              setValue(v => ({ ...v, hasApiKey: data.settings.hasApiKey, apiKey: "", clearKey: false }));
            },
            "Assistant settings saved."
          );
        }}
      >
        <fieldset disabled={!admin || Boolean(busy)}>
          <legend className="ac-sr">Assistant configuration</legend>
          <label className="ac-check">
            <input type="checkbox" checked={value.enabled} onChange={e => change("enabled", e.target.checked)} />
            Enable AI replies
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={value.autoStart} onChange={e => change("autoStart", e.target.checked)} />
            Start the assistant on new conversations
          </label>
          <div className="ac-fields">
            <label>
              Provider
              <select
                value={value.provider}
                onChange={e => {
                  change("provider", e.target.value);
                  change("apiKey", "");
                  change("hasApiKey", false);
                }}
              >
                {["openai", "openrouter", "groq", "gemini", "deepseek"].map(name => (
                  <option key={name}>{name}</option>
                ))}
              </select>
            </label>
            <label>
              Model ID
              <input required={value.enabled} value={value.model} maxLength={150} onChange={e => change("model", e.target.value)} />
            </label>
          </div>
          <label>
            Provider API key {value.hasApiKey ? "(saved; leave blank to keep)" : "(not saved)"}
            <input type="password" autoComplete="off" maxLength={2000} value={value.apiKey} onChange={e => change("apiKey", e.target.value)} />
          </label>
          <label className="ac-check">
            <input type="checkbox" checked={value.clearKey} onChange={e => change("clearKey", e.target.checked)} />
            Remove saved API key
          </label>
          <label>
            Business instructions
            <textarea rows={7} maxLength={10000} value={value.systemPrompt} onChange={e => change("systemPrompt", e.target.value)} />
          </label>
          <p>The assistant answers messages. It cannot verify payments or change business records. Use configured workflows for those actions.</p>
          {admin && <button className="ac-primary" type="submit">{busy === "assistant" ? "Saving…" : "Save assistant settings"}</button>}
        </fieldset>
      </form>
    </section>
  );
}

export default function AccountWorkspace() {
  const enterprise = useEnterprise();
  if (enterprise.loading) return <p className="ac-workspace" role="status">Loading organization…</p>;
  if (!enterprise.activeTenant) return <p className="ac-workspace">Select an organization to manage WhatsApp accounts.</p>;
  return <Workspace key={enterprise.activeTenant.id} enterprise={enterprise} />;
}

export function Workspace({ enterprise }) {
  const { activeTenant, branches = [], isOwnerOrAdmin: admin, getHeaders } = enterprise;
  const [params, setParams] = useSearchParams();
  const [senders, setSenders] = useState([]), [setup, setSetup] = useState(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState(""), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  const alive = useRef(true), signup = useRef(null), operation = useRef(false), loadVersion = useRef(0);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      signup.current?.abort();
    };
  }, []);

  const request = useCallback(async (method, path, data) => {
    const headers = { ...(getHeaders ? getHeaders() : {}), "x-tenant-id": String(activeTenant.id) };
    const response = await axios({
      method,
      url: `${API}/api/v2${path}`,
      headers,
      withCredentials: true,
      ...(data !== undefined ? { data } : {}),
    });
    if (response.data.success === false) throw new Error(response.data.message || "The operation failed.");
    return response.data;
  }, [getHeaders, activeTenant.id]);

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
    refresh().catch(e => {
      if (alive.current) setError(message(e));
    });
  }, [refresh]);

  const tabParam = params.get("tab");
  const tab = tabParam === "assistant" ? "assistant"
    : tabParam === "integrations" ? "integrations"
    : tabParam === "assign" || tabParam === "team-access" ? "assign"
    : "senders";

  const navigate = patch => {
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
          branchIds: branches.filter(b => b.status === "active").map(b => Number(b.id)),
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

  return (
    <section className="ac-workspace" aria-labelledby="accounts-title">
      <header className="ac-header">
        <div>
          <p className="ac-context">{activeTenant.name} / WhatsApp</p>
          <h1 id="accounts-title">Accounts & Multi-Sender Platform</h1>
          <p>Operate multiple Meta phone numbers concurrently with independent routing and rate limiting.</p>
        </div>
        <div className="ac-actions">
          <button disabled={loading || Boolean(busy)} onClick={() => run("refresh", refresh, "Sender list refreshed.")}>
            Refresh
          </button>
          {admin && (
            <button className="ac-primary" disabled={Boolean(busy)} onClick={() => navigate({ tab: "integrations" })}>
              Connect WhatsApp Number
            </button>
          )}
        </div>
      </header>

      <nav className="ac-tabs" aria-label="Account sections">
        <Link aria-current={tab === "senders" ? "page" : undefined} to="?tab=senders">
          WhatsApp Numbers & Operations
        </Link>
        <Link aria-current={tab === "integrations" ? "page" : undefined} to="?tab=integrations">
          Meta Integrations & Signup
        </Link>
        <Link aria-current={tab === "assign" ? "page" : undefined} to="?tab=assign">
          Assign & Team Access
        </Link>
        <Link aria-current={tab === "assistant" ? "page" : undefined} to="?tab=assistant">
          Business Assistant
        </Link>
        <Link to="/whatsapp/automations">Automations</Link>
        <Link to="/whatsapp/flows">Workflow Builder</Link>
        <Link to="/whatsapp">Inbox</Link>
      </nav>

      <div className="ac-feedback" aria-live="polite">
        {notice && <p role="status">{notice}</p>}
        {error && <p className="ac-error" role="alert">{error}</p>}
      </div>

      {!admin && <p>Connection settings are managed by your organization owner or administrator.</p>}

      {tab === "assistant" ? (
        <div className="ac-panel ac-assistant">
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
          onManualConnect={async data => {
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
          onDisconnect={id => run("disconnect", () => request("delete", `/meta/senders/${id}`).then(refresh), "Sender disconnected.")}
          onRefresh={refresh}
          request={request}
        />
      )}
    </section>
  );
}
