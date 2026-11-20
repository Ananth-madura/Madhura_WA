import React, { useState } from "react";
import {
  ShieldCheck,
  CheckCircle2,
  Building2,
  Phone,
  Layers,
  Sparkles,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  ExternalLink,
  Lock,
  Radio,
  Copy,
  Check,
  BookOpen,
  Key,
  AlertCircle
} from "lucide-react";
import MetaConnectWizard from "./MetaConnectWizard";

export default function WhatsAppIntegrations({
  setup = null,
  admin = false,
  busy = "",
  branches = [],
  senders = [],
  onStartEmbeddedSignup,
  onDiscoverAssets,
  onBatchConnect,
  onManualConnect,
  onPing,
  onRegisterPin,
  onRefresh,
}) {
  const [tab, setTab] = useState("embedded"); // "embedded" | "discovery" | "manual" | "guide"
  const [discovered, setDiscovered] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [directTokenInput, setDirectTokenInput] = useState("");
  const [selectedWabaId, setSelectedWabaId] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState({});
  const [connectingBatch, setConnectingBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // Manual token connection state
  const [manualData, setManualData] = useState({
    wabaId: "",
    phoneNumberId: "",
    accessToken: "",
    appSecret: "",
    isShared: true,
    branchIds: [],
    defaultBranchIds: [],
  });

  const webhookCallbackUrl = setup?.webhookUrl || setup?.webhook_url || "https://api.madhuratech.in/webhook";
  const webhookVerifyToken = setup?.verifyToken || setup?.verify_token || "madhura_wa_verify_2026";

  const handleCopyText = (text, type) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    if (type === "url") {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } else {
      setCopiedToken(true);
      setTimeout(() => setCopiedToken(false), 2000);
    }
  };

  const handleRunDiscovery = async (wabaId = null) => {
    setDiscovering(true);
    setDiscoveryError("");
    setBatchNotice("");
    try {
      const payload = {};
      if (wabaId) payload.targetWabaId = wabaId;
      if (directTokenInput && directTokenInput.trim()) {
        payload.directToken = directTokenInput.trim();
      }
      const res = await onDiscoverAssets(payload);
      setDiscovered(res);
      setTab("discovery");
      if (res.wabas && res.wabas.length > 0) {
        setSelectedWabaId(res.wabas[0].id);
        // Pre-select non-connected numbers
        const initialMap = {};
        res.wabas[0].phoneNumbers.forEach((p) => {
          if (!p.alreadyConnected) {
            initialMap[p.id] = { selected: true, departmentName: p.verifiedName || "General" };
          }
        });
        setSelectedNumbers(initialMap);
      }
    } catch (err) {
      setDiscoveryError(err.message || "Failed to discover Meta assets. Ensure you have authorized Meta or provide a valid System User Token.");
    } finally {
      setDiscovering(false);
    }
  };

  const handleExecuteBatchConnect = async () => {
    if (!selectedWabaId) return;
    const currentWaba = discovered?.wabas?.find((w) => w.id === selectedWabaId);
    if (!currentWaba) return;

    const numbersToConnect = currentWaba.phoneNumbers
      .filter((p) => selectedNumbers[p.id]?.selected)
      .map((p, idx) => ({
        id: p.id,
        phoneId: p.id,
        displayPhone: p.displayPhone,
        verifiedName: p.verifiedName,
        quality: p.quality,
        messagingTier: p.messagingTier,
        codeVerificationStatus: p.codeVerificationStatus,
        departmentName: selectedNumbers[p.id]?.departmentName || "General",
        isDefault: idx === 0, // Mark first selected as default
      }));

    if (!numbersToConnect.length) {
      alert("Please select at least one phone number to connect");
      return;
    }

    setConnectingBatch(true);
    setBatchNotice("");
    try {
      const res = await onBatchConnect({
        wabaId: selectedWabaId,
        numbers: numbersToConnect,
        branchIds: branches.filter((b) => b.status === "active").map((b) => Number(b.id)),
        isShared: true,
      });
      setBatchNotice(`Successfully connected ${res.totalConnected} phone numbers!`);
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Batch connection failed: " + (err.message || "Unknown error"));
    } finally {
      setConnectingBatch(false);
    }
  };

  const handleExecuteManualConnect = async (e) => {
    e.preventDefault();
    try {
      await onManualConnect(manualData);
      alert("WhatsApp number connected and verified with Meta!");
      if (onRefresh) onRefresh();
    } catch (err) {
      alert("Connection failed: " + (err.message || "Check credentials"));
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex border-b border-slate-200 gap-4 overflow-x-auto">
        <button
          onClick={() => setTab("embedded")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            tab === "embedded"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Meta Embedded Signup
        </button>
        <button
          onClick={() => {
            setTab("discovery");
            if (!discovered) handleRunDiscovery();
          }}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            tab === "discovery"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Discovered Portfolios &amp; WABAs ({discovered?.wabas?.length || 0})
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            tab === "manual"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Direct Token / Custom Setup
        </button>
        <button
          onClick={() => setTab("guide")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
            tab === "guide"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          11-Step Setup Guide
        </button>
      </div>

      {/* Tab 1: Embedded Signup */}
      {tab === "embedded" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          {!setup?.embeddedSignupConfigured && (
            <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  <strong>Setup Notice:</strong> Meta Embedded Signup requires Meta App configuration. You can connect your WhatsApp numbers immediately using <strong>Direct Token / Custom Setup</strong> or scan existing WABAs in <strong>Discovered Portfolios &amp; WABAs</strong>.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setTab("manual")}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0 cursor-pointer"
              >
                Use Direct Token
              </button>
            </div>
          )}

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-emerald-600" />
                Connect via Meta Embedded Signup
              </h3>
              <p className="text-sm text-slate-600 mt-1 max-w-xl">
                Log in directly with your Meta Business account to authorize your Business Portfolios, select or create WhatsApp Business Accounts (WABAs), and link multiple phone numbers seamlessly.
              </p>
            </div>

            {admin && (
              <button
                onClick={onStartEmbeddedSignup}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex-shrink-0 cursor-pointer"
              >
                <Lock className="w-4 h-4" />
                {busy === "signup" ? "Connecting with Meta..." : "Continue with Meta"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-100 text-xs text-slate-600">
            <div className="bg-slate-50 p-4 rounded-lg space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 1. Real Meta Authorization
              </span>
              <p>No simulated states. Exchanges real OAuth authorization codes directly with Meta Graph API v22.0.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-emerald-600" /> 2. Multi-Number Operation
              </span>
              <p>Supports connecting and operating 5 or more concurrent numbers under independent sender identities.</p>
            </div>
            <div className="bg-slate-50 p-4 rounded-lg space-y-1">
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" /> 3. AES-256-GCM Encryption
              </span>
              <p>Credentials and tokens are encrypted at rest on the server and never exposed in browser storage.</p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-500">
              Already authorized? Discover all numbers available under your Meta account.
            </span>
            <button
              onClick={() => handleRunDiscovery()}
              disabled={discovering}
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? "animate-spin" : ""}`} />
              {discovering ? "Scanning Meta Assets..." : "Discover Assets & Numbers"}
            </button>
          </div>
        </div>
      )}

      {/* Tab 2: Discovered Assets & Multi-Number Batch Connect */}
      {tab === "discovery" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-emerald-600" />
                Discovered Meta Business Portfolios &amp; WABAs
              </h3>
              <p className="text-sm text-slate-600">
                Select discovered phone numbers to connect them to your organization simultaneously.
              </p>
            </div>
            <button
              onClick={() => handleRunDiscovery()}
              disabled={discovering}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? "animate-spin" : ""}`} />
              Re-scan Meta
            </button>
          </div>

          {/* Quick Token Scanning Bar */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
              <label htmlFor="discovery-token-input" className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-amber-500" />
                Scan via System User Token (Optional):
              </label>
              <span className="text-[11px] text-slate-500">
                If already authorized via Embedded Signup, leave blank and click Scan.
              </span>
            </div>
            <div className="flex flex-col sm:flex-row items-stretch gap-2">
              <input
                id="discovery-token-input"
                type="password"
                placeholder="Paste Permanent System User Access Token (EAAB...)"
                value={directTokenInput}
                onChange={(e) => setDirectTokenInput(e.target.value)}
                className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-lg font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => handleRunDiscovery()}
                disabled={discovering}
                className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${discovering ? "animate-spin" : ""}`} />
                <span>{discovering ? "Scanning..." : "Scan Meta Assets"}</span>
              </button>
            </div>
          </div>

          {discoveryError && (
            <div className="p-4 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">
              {discoveryError}
            </div>
          )}

          {batchNotice && (
            <div className="p-4 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-800 text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              {batchNotice}
            </div>
          )}

          {discovered?.wabas && discovered.wabas.length > 0 ? (
            <div className="space-y-6">
              {/* WABA Selector if multiple */}
              {discovered.wabas.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select WhatsApp Business Account (WABA):
                  </label>
                  <select
                    value={selectedWabaId}
                    onChange={(e) => {
                      setSelectedWabaId(e.target.value);
                      const waba = discovered.wabas.find((w) => w.id === e.target.value);
                      const nextMap = {};
                      waba?.phoneNumbers.forEach((p) => {
                        if (!p.alreadyConnected) {
                          nextMap[p.id] = { selected: true, departmentName: p.verifiedName || "General" };
                        }
                      });
                      setSelectedNumbers(nextMap);
                    }}
                    className="px-3 py-2 text-sm border border-slate-300 rounded-lg w-full max-w-md"
                  >
                    {discovered.wabas.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} (ID: {w.id}) : {w.phoneNumbers.length} numbers
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Numbers under selected WABA */}
              {(() => {
                const activeWaba = discovered.wabas.find((w) => w.id === selectedWabaId) || discovered.wabas[0];
                if (!activeWaba) return null;

                return (
                  <div className="space-y-4">
                    <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                      <div>
                        <span className="font-bold text-slate-900 text-sm">{activeWaba.name}</span>
                        <span className="block text-slate-500 font-mono">WABA ID: {activeWaba.id} · Currency: {activeWaba.currency}</span>
                      </div>
                      <span className="text-slate-600 self-center font-semibold">
                        {activeWaba.phoneNumbers.length} phone numbers discovered
                      </span>
                    </div>

                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                      <table className="min-w-full divide-y divide-slate-200 text-left text-xs">
                        <thead className="bg-slate-50 font-bold text-slate-700">
                          <tr>
                            <th className="py-3 px-4 w-12 text-center">Select</th>
                            <th className="py-3 px-4">Display Phone</th>
                            <th className="py-3 px-4">Verified Name</th>
                            <th className="py-3 px-4">Quality / Tier</th>
                            <th className="py-3 px-4">Department Tag</th>
                            <th className="py-3 px-4">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 bg-white">
                          {activeWaba.phoneNumbers.map((p) => {
                            const isChecked = Boolean(selectedNumbers[p.id]?.selected);
                            const dept = selectedNumbers[p.id]?.departmentName || "";

                            return (
                              <tr key={p.id} className={p.alreadyConnected ? "bg-slate-50/50" : "hover:bg-slate-50"}>
                                <td className="py-3 px-4 text-center">
                                  <input
                                    type="checkbox"
                                    disabled={p.alreadyConnected}
                                    checked={isChecked}
                                    onChange={(e) => {
                                      setSelectedNumbers((prev) => ({
                                        ...prev,
                                        [p.id]: {
                                          selected: e.target.checked,
                                          departmentName: dept || p.verifiedName || "General",
                                        },
                                      }));
                                    }}
                                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                                  />
                                </td>
                                <td className="py-3 px-4 font-bold text-slate-900">{p.displayPhone}</td>
                                <td className="py-3 px-4 text-slate-700">{p.verifiedName || "-"}</td>
                                <td className="py-3 px-4">
                                  <span className="font-semibold text-emerald-700">{p.quality}</span> · {p.messagingTier}
                                </td>
                                <td className="py-3 px-4">
                                  <input
                                    type="text"
                                    disabled={p.alreadyConnected}
                                    placeholder="e.g. Sales, Support"
                                    value={dept}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setSelectedNumbers((prev) => ({
                                        ...prev,
                                        [p.id]: { ...prev[p.id], departmentName: val },
                                      }));
                                    }}
                                    className="px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-emerald-500 w-36"
                                  />
                                </td>
                                <td className="py-3 px-4">
                                  {p.alreadyConnected ? (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                      Connected
                                    </span>
                                  ) : (
                                    <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-600">
                                      Available to Connect
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {admin && (
                      <div className="flex justify-end pt-2">
                        <button
                          onClick={handleExecuteBatchConnect}
                          disabled={connectingBatch || !Object.values(selectedNumbers).some((x) => x.selected)}
                          className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition flex items-center gap-2"
                        >
                          <PlusCircle className="w-4 h-4" />
                          {connectingBatch ? "Connecting Numbers..." : "Connect Selected Numbers"}
                        </button>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="text-center py-8 text-slate-500 space-y-2">
              <Building2 className="w-10 h-10 mx-auto text-slate-400" />
              <p className="font-semibold">No WABAs or phone numbers discovered yet.</p>
              <p className="text-xs">Click "Re-scan Meta" above or use "Continue with Meta" in the Embedded Signup tab.</p>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Direct Token / Bring Your Own Meta API */}
      {tab === "manual" && (
        <div className="space-y-6">
          {/* Webhook Configuration Guide */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  Meta Webhook Configuration
                </h4>
                <p className="text-xs text-slate-600 mt-1 max-w-xl leading-relaxed">
                  Configure these endpoints in your <strong>Meta App Dashboard &gt; WhatsApp &gt; Configuration</strong> to receive incoming messages, customer delivery receipts, and flow events in real-time.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Webhook Callback URL:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(webhookCallbackUrl, "url")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 focus:outline-none"
                  >
                    {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedUrl ? "Copied!" : "Copy URL"}</span>
                  </button>
                </div>
                <code className="block bg-slate-50 px-2 py-1 rounded text-slate-800 font-mono text-[11px] break-all border border-slate-100">
                  {webhookCallbackUrl}
                </code>
              </div>

              <div className="bg-white p-3 rounded-lg border border-slate-200 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-700">Verify Token:</span>
                  <button
                    type="button"
                    onClick={() => handleCopyText(webhookVerifyToken, "token")}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:text-emerald-800 focus:outline-none"
                  >
                    {copiedToken ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedToken ? "Copied!" : "Copy Token"}</span>
                  </button>
                </div>
                <code className="block bg-slate-50 px-2 py-1 rounded text-slate-800 font-mono text-[11px] break-all border border-slate-100">
                  {webhookVerifyToken}
                </code>
              </div>
            </div>

            <div className="pt-2 text-[11px] text-slate-500 border-t border-slate-200/60 flex items-center gap-2">
              <span className="font-semibold text-slate-700">Required Webhook Subscriptions:</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[10px]">messages</span>
              <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-mono text-[10px]">message_template_status_update</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleExecuteManualConnect} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Direct Token / Bring Your Own Credentials</h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Enter your WhatsApp Business Account ID, Phone Number ID, and Permanent System User Access Token.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Business Account ID (WABA ID) *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 109876543210987"
                  value={manualData.wabaId}
                  onChange={(e) => setManualData({ ...manualData, wabaId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number ID *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 102938475610293"
                  value={manualData.phoneNumberId}
                  onChange={(e) => setManualData({ ...manualData, phoneNumberId: e.target.value })}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">System User Permanent Access Token *</label>
                <span className="text-[11px] text-slate-500">Requires whatsapp_business_messaging &amp; whatsapp_business_management</span>
              </div>
              <input
                type="password"
                required
                autoComplete="off"
                placeholder="EAAB..."
                value={manualData.accessToken}
                onChange={(e) => setManualData({ ...manualData, accessToken: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold text-slate-700">Meta App Secret (for Webhook SHA256 Signature Verification)</label>
                <span className="text-[11px] text-slate-500">Found in Meta App Dashboard &gt; App Settings &gt; Basic</span>
              </div>
              <input
                type="password"
                autoComplete="off"
                placeholder="App Secret"
                value={manualData.appSecret}
                onChange={(e) => setManualData({ ...manualData, appSecret: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            {admin && (
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow hover:shadow-md transition cursor-pointer"
                >
                  Verify &amp; Connect Direct Token
                </button>
              </div>
            )}
          </form>
        </div>
      )}

      {/* Tab 4: 11-Step Setup Guide */}
      {tab === "guide" && (
        <div className="space-y-4">
          <MetaConnectWizard
            branches={branches}
            senders={senders}
            setup={setup}
            onStartEmbeddedSignup={onStartEmbeddedSignup}
            onDiscoverAssets={onDiscoverAssets}
            onBatchConnect={onBatchConnect}
            onPing={onPing}
            onRegisterPin={onRegisterPin}
            onComplete={() => {
              if (onRefresh) onRefresh();
              setTab("embedded");
            }}
            onCancel={() => setTab("embedded")}
          />
        </div>
      )}
    </div>
  );
}

