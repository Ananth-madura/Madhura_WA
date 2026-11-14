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
  Radio
} from "lucide-react";

export default function WhatsAppIntegrations({
  setup = null,
  admin = false,
  busy = "",
  branches = [],
  onStartEmbeddedSignup,
  onDiscoverAssets,
  onBatchConnect,
  onManualConnect,
  onRefresh,
}) {
  const [tab, setTab] = useState("embedded"); // "embedded" | "discovery" | "manual"
  const [discovered, setDiscovered] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [discoveryError, setDiscoveryError] = useState("");
  const [selectedWabaId, setSelectedWabaId] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState({});
  const [connectingBatch, setConnectingBatch] = useState(false);
  const [batchNotice, setBatchNotice] = useState("");

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

  const handleRunDiscovery = async (wabaId = null) => {
    setDiscovering(true);
    setDiscoveryError("");
    setBatchNotice("");
    try {
      const res = await onDiscoverAssets(wabaId ? { targetWabaId: wabaId } : {});
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
      setDiscoveryError(err.message || "Failed to discover Meta assets");
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
      <div className="flex border-b border-slate-200 gap-4">
        <button
          onClick={() => setTab("embedded")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition ${
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
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition ${
            tab === "discovery"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Discovered Portfolios & WABAs ({discovered?.wabas?.length || 0})
        </button>
        <button
          onClick={() => setTab("manual")}
          className={`pb-3 px-2 text-sm font-bold border-b-2 transition ${
            tab === "manual"
              ? "border-emerald-600 text-emerald-700"
              : "border-transparent text-slate-500 hover:text-slate-700"
          }`}
        >
          Direct Token / Custom Setup
        </button>
      </div>

      {/* Tab 1: Embedded Signup */}
      {tab === "embedded" && (
        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-6">
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md hover:shadow-lg transition flex-shrink-0"
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
              className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1"
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
                Discovered Meta Business Portfolios & WABAs
              </h3>
              <p className="text-sm text-slate-600">
                Select discovered phone numbers to connect them to your organization simultaneously.
              </p>
            </div>
            <button
              onClick={() => handleRunDiscovery()}
              disabled={discovering}
              className="px-3 py-2 text-xs font-semibold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${discovering ? "animate-spin" : ""}`} />
              Re-scan Meta
            </button>
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

      {/* Tab 3: Direct Token Fallback */}
      {tab === "manual" && (
        <form onSubmit={handleExecuteManualConnect} className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <h3 className="text-lg font-bold text-slate-900">Direct Token / Custom Setup</h3>
          <p className="text-xs text-slate-600">
            For power users using direct System User access tokens or custom Meta applications.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">WhatsApp Business Account ID:</label>
              <input
                type="text"
                required
                value={manualData.wabaId}
                onChange={(e) => setManualData({ ...manualData, wabaId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Phone Number ID:</label>
              <input
                type="text"
                required
                value={manualData.phoneNumberId}
                onChange={(e) => setManualData({ ...manualData, phoneNumberId: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">System User Access Token:</label>
            <input
              type="password"
              required
              autoComplete="off"
              value={manualData.accessToken}
              onChange={(e) => setManualData({ ...manualData, accessToken: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">App Secret (for Webhook Signature Verification):</label>
            <input
              type="password"
              autoComplete="off"
              value={manualData.appSecret}
              onChange={(e) => setManualData({ ...manualData, appSecret: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono"
            />
          </div>

          {admin && (
            <div className="flex justify-end pt-2">
              <button
                type="submit"
                className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow transition"
              >
                Verify & Connect Direct Token
              </button>
            </div>
          )}
        </form>
      )}
    </div>
  );
}

