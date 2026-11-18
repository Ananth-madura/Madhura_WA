import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Phone,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Search,
  KeyRound,
  Check,
  Radio,
  ChevronRight,
  ExternalLink,
  PlusCircle,
  Building2,
  Zap
} from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";

export default function WhatsAppNumbersOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [senders, setSenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState("");
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Asset discovery state
  const [discovered, setDiscovered] = useState(null);
  const [discovering, setDiscovering] = useState(false);
  const [selectedWabaId, setSelectedWabaId] = useState("");
  const [selectedNumbers, setSelectedNumbers] = useState({});

  // 2-Step PIN registration modal/form state
  const [pinTargetSender, setPinTargetSender] = useState(null);
  const [sixDigitPin, setSixDigitPin] = useState("");

  const loadSenders = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/meta/senders`, { timeout: 10000 });
      setSenders(res.data?.senders || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load WhatsApp senders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSenders();
  }, []);

  // Discover Meta Assets
  const handleDiscoverAssets = async () => {
    setDiscovering(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await axios.post(`${API}/api/meta/assets/discover`, {}, { timeout: 15000 });
      if (res.data?.success) {
        setDiscovered(res.data);
        if (res.data.wabas && res.data.wabas.length > 0) {
          setSelectedWabaId(res.data.wabas[0].id);
          const initialMap = {};
          res.data.wabas[0].phoneNumbers.forEach((p) => {
            if (!p.alreadyConnected) {
              initialMap[p.id] = { selected: true, departmentName: p.verifiedName || "General" };
            }
          });
          setSelectedNumbers(initialMap);
        }
        setSuccessMsg(`Discovered ${res.data.totalNumbersFound || 0} phone number(s) across ${res.data.totalWabasFound || 0} WABA(s).`);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Asset discovery failed. Please ensure your Meta token has necessary permissions.");
    } finally {
      setDiscovering(false);
    }
  };

  // Batch Connect Discovered Numbers
  const handleBatchConnect = async () => {
    if (!selectedWabaId) return;
    const currentWaba = discovered?.wabas?.find((w) => w.id === selectedWabaId);
    if (!currentWaba) return;

    const numbersToConnect = currentWaba.phoneNumbers
      .filter((p) => selectedNumbers[p.id]?.selected)
      .map((p) => ({
        phoneNumberId: p.id,
        displayPhone: p.displayPhone,
        verifiedName: p.verifiedName,
        departmentName: selectedNumbers[p.id]?.departmentName || "General",
        isShared: true,
        branchIds: [],
        defaultBranchIds: []
      }));

    if (numbersToConnect.length === 0) {
      setError("Please select at least one phone number to connect.");
      return;
    }

    setActionBusy("Connecting selected phone numbers...");
    setError("");
    try {
      const res = await axios.post(`${API}/api/meta/senders/connect-batch`, {
        wabaId: selectedWabaId,
        numbers: numbersToConnect
      });
      if (res.data?.success) {
        setSuccessMsg(`Successfully connected ${res.data.connectedCount || numbersToConnect.length} number(s)!`);
        setDiscovered(null);
        await loadSenders();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to batch connect numbers");
    } finally {
      setActionBusy("");
    }
  };

  // Register 6-digit PIN with Meta Cloud API
  const handleRegisterPin = async (e) => {
    e.preventDefault();
    if (!pinTargetSender) return;
    const cleanPin = sixDigitPin.replace(/\D/g, "");
    if (cleanPin.length !== 6) {
      setError("Please provide a valid 6-digit PIN");
      return;
    }

    setActionBusy("Registering 2-step PIN with Meta...");
    setError("");
    try {
      const res = await axios.post(`${API}/api/meta/senders/${pinTargetSender.id}/register`, {
        pin: cleanPin
      });
      if (res.data?.success) {
        setSuccessMsg(`Phone number ${pinTargetSender.display_phone} successfully registered with Meta!`);
        setPinTargetSender(null);
        setSixDigitPin("");
        await loadSenders();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to register PIN with Meta");
    } finally {
      setActionBusy("");
    }
  };

  // Set default sender
  const handleSetDefault = async (senderId) => {
    setActionBusy("Updating default sender...");
    try {
      await axios.patch(`${API}/api/meta/senders/${senderId}/settings`, { isDefault: true });
      await loadSenders();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update default sender");
    } finally {
      setActionBusy("");
    }
  };

  const hasValidSender = senders.some((s) => s.status === "connected" || s.status === "ready");

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/onboarding/whatsapp/connect"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Step 4: Connect Account</span>
          </Link>
          <span className="text-xs font-semibold text-slate-400">Step 5 of 10</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-3">
                <Phone className="w-3.5 h-3.5 text-emerald-600" />
                <span>Multi-Number Management</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Register & Manage WhatsApp Phone Numbers
              </h1>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Connect and register phone numbers under your authorized WABA. Complete 2-step PIN registration to enable Cloud API message dispatch.
              </p>
            </div>

            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={handleDiscoverAssets}
                disabled={discovering || Boolean(actionBusy)}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
              >
                <Search className={`w-3.5 h-3.5 ${discovering ? "animate-spin" : ""}`} />
                <span>{discovering ? "Scanning Meta..." : "Discover Numbers"}</span>
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div role="alert" className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* DISCOVERED NUMBERS SECTION (If Discovery was executed) */}
        {discovered && (
          <div className="bg-white border-2 border-emerald-400 rounded-2xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Search className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Discovered Meta Business Assets
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setDiscovered(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Dismiss
              </button>
            </div>

            {discovered.wabas?.map((waba) => (
              <div key={waba.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="font-bold text-slate-800 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-slate-500" />
                    <span>{waba.name || "WhatsApp Business Account"}</span>
                    <span className="text-slate-400 font-mono text-[11px]">({waba.id})</span>
                  </div>
                </div>

                <div className="space-y-2">
                  {waba.phoneNumbers?.map((p) => {
                    const isSelected = selectedNumbers[p.id]?.selected;
                    return (
                      <div
                        key={p.id}
                        className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                          p.alreadyConnected
                            ? "bg-slate-100 border-slate-200 text-slate-400"
                            : isSelected
                            ? "bg-emerald-50/60 border-emerald-300 text-slate-900"
                            : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <input
                            type="checkbox"
                            disabled={p.alreadyConnected}
                            checked={p.alreadyConnected ? true : Boolean(isSelected)}
                            onChange={(e) =>
                              setSelectedNumbers({
                                ...selectedNumbers,
                                [p.id]: {
                                  selected: e.target.checked,
                                  departmentName: selectedNumbers[p.id]?.departmentName || p.verifiedName || "General"
                                }
                              })
                            }
                            className="rounded text-emerald-600 focus:ring-emerald-500"
                          />
                          <div>
                            <span className="font-bold font-mono">{p.displayPhone}</span>
                            <span className="ml-2 text-slate-500">({p.verifiedName || "Unverified Name"})</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {p.alreadyConnected ? (
                            <span className="px-2 py-0.5 rounded bg-slate-200 text-slate-600 text-[10px] font-bold">
                              Already Connected
                            </span>
                          ) : (
                            <input
                              type="text"
                              value={selectedNumbers[p.id]?.departmentName || ""}
                              onChange={(e) =>
                                setSelectedNumbers({
                                  ...selectedNumbers,
                                  [p.id]: {
                                    ...selectedNumbers[p.id],
                                    departmentName: e.target.value
                                  }
                                })
                              }
                              placeholder="Department Name"
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded-lg bg-white"
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleBatchConnect}
                disabled={Boolean(actionBusy)}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                {actionBusy || "Connect Selected Numbers"}
              </button>
            </div>
          </div>
        )}

        {/* ACTIVE CONNECTED NUMBERS TABLE */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 tracking-wide uppercase">
              Connected WhatsApp Senders ({senders.length})
            </h2>
            <button
              type="button"
              onClick={loadSenders}
              disabled={loading}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {senders.length === 0 ? (
            <div className="p-12 text-center">
              <Phone className="w-10 h-10 text-slate-300 mx-auto mb-3" />
              <h3 className="text-sm font-bold text-slate-900">No WhatsApp numbers connected yet</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                Authorize your Meta Business Account or discover available phone numbers to begin messaging.
              </p>
              <div className="mt-5 flex justify-center gap-3">
                <Link
                  to="/onboarding/whatsapp/connect"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Connect via Step 4
                </Link>
                <button
                  type="button"
                  onClick={handleDiscoverAssets}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-xl shadow-sm transition"
                >
                  Discover Numbers
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {senders.map((s) => {
                const isReady = s.status === "connected" || s.status === "ready";
                const isDefault = Boolean(s.is_default);

                return (
                  <div key={s.id} className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                          isReady
                            ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                            : "bg-amber-50 border-amber-200 text-amber-600"
                        }`}
                      >
                        <Phone className="w-5 h-5" />
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900 font-mono">
                            {s.display_phone || "Pending Number"}
                          </span>

                          {isDefault && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-900 text-white">
                              Default Number
                            </span>
                          )}

                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              isReady
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {s.status}
                          </span>

                          {s.quality_rating && (
                            <span className="text-[11px] text-slate-500">
                              Quality: <span className="font-semibold">{s.quality_rating}</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 mt-1 flex items-center gap-3">
                          <span>Name: {s.verified_name || s.department_name || "Enterprise"}</span>
                          {s.phone_number_id && (
                            <span className="font-mono text-[11px]">ID: {s.phone_number_id}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                      {!isReady && (
                        <button
                          type="button"
                          onClick={() => setPinTargetSender(s)}
                          className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-lg transition flex items-center gap-1.5 shadow-sm"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>Register 6-Digit PIN</span>
                        </button>
                      )}

                      {!isDefault && isReady && (
                        <button
                          type="button"
                          onClick={() => handleSetDefault(s.id)}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition"
                        >
                          Make Default
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Action Footer */}
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
            <Link
              to="/onboarding"
              className="text-xs font-bold text-slate-600 hover:text-slate-900 transition"
            >
              Back to Command Center
            </Link>
            <div className="flex items-center gap-3">
              <Link
                to="/onboarding/whatsapp/test-message"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                <span>Proceed to Step 7: Test Message</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* 2-STEP PIN MODAL */}
        {pinTargetSender && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-5 h-5 text-emerald-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Two-Step Verification PIN
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPinTargetSender(null);
                    setSixDigitPin("");
                  }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Cancel
                </button>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed">
                Enter your 6-digit PIN to register <strong>{pinTargetSender.display_phone}</strong> with Meta Cloud API.
                This is the PIN set during your WhatsApp Business configuration.
              </p>

              <form onSubmit={handleRegisterPin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    6-Digit Registration PIN
                  </label>
                  <input
                    type="password"
                    maxLength={6}
                    required
                    value={sixDigitPin}
                    onChange={(e) => setSixDigitPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full text-center text-lg tracking-widest font-mono px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPinTargetSender(null);
                      setSixDigitPin("");
                    }}
                    className="px-4 py-2 border border-slate-200 text-xs font-bold rounded-xl hover:bg-slate-50 text-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sixDigitPin.length !== 6 || Boolean(actionBusy)}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition shadow-sm"
                  >
                    {actionBusy || "Register with Meta"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
