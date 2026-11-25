import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Phone,
  Sparkles,
  ChevronRight,
  RefreshCw,
  MessageSquare,
  Clock,
  ArrowRight
} from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";

export default function WhatsAppTestMessageOnboarding() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [senders, setSenders] = useState([]);
  const [selectedSenderId, setSelectedSenderId] = useState("");
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("Hello from Madhura Enterprise WhatsApp CRM! Your workspace activation is complete.");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [verifiedResult, setVerifiedResult] = useState(null);

  const loadSenders = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await axios.get(`${API}/api/meta/senders`, { timeout: 10000 });
      const available = res.data?.senders || [];
      setSenders(available);
      if (available.length > 0) {
        const defaultSender = available.find((s) => s.is_default) || available[0];
        setSelectedSenderId(defaultSender.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load connected WhatsApp senders");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSenders();
  }, []);

  const handleSendTest = async (e) => {
    e.preventDefault();
    const cleanRecipient = recipient.trim().replace(/[^\d+]/g, "");
    if (!cleanRecipient || cleanRecipient.length < 8) {
      setError("Please provide a valid recipient mobile number with country code (e.g. +919876543210)");
      return;
    }
    if (!selectedSenderId) {
      setError("Please select a connected WhatsApp sender");
      return;
    }

    setSending(true);
    setError("");
    setVerifiedResult(null);

    try {
      const res = await axios.post(`${API}/api/onboarding/first-message`, {
        sender_id: selectedSenderId,
        recipient: cleanRecipient,
        message: message.trim()
      });

      if (res.data?.success) {
        setVerifiedResult(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to dispatch WhatsApp test message. Please verify the sender connection.");
    } finally {
      setSending(false);
    }
  };

  const selectedSender = senders.find((s) => String(s.id) === String(selectedSenderId));

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            to="/onboarding/whatsapp/numbers"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            <ChevronRight className="w-3.5 h-3.5 rotate-180" />
            <span>Back to Step 5: Numbers</span>
          </Link>
          <span className="text-xs font-semibold text-slate-400">Step 7 of 10</span>
        </div>

        {/* Header Banner */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="mb-4">
            <Link to="/onboarding" className="inline-block focus:outline-none">
              <img src="/Group.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[54px] w-auto object-contain" />
            </Link>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-3">
            <Send className="w-3.5 h-3.5 text-emerald-600" />
            <span>End-to-End Delivery Verification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Send Diagnostic First WhatsApp Message
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            Verify real two-way Cloud API communication by dispatching a verified diagnostic message to your personal or team mobile device.
          </p>
        </div>

        {error && (
          <div role="alert" className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {/* SUCCESS CARD WITH WAMID VERIFICATION EVIDENCE */}
        {verifiedResult && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-700 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h3 className="text-base font-bold text-emerald-950">
                  First WhatsApp Message Verified!
                </h3>
                <p className="text-xs text-emerald-800 mt-1">
                  Your WhatsApp Cloud API connection has been verified with Meta. The message was accepted and dispatched.
                </p>

                <div className="mt-3 p-3 bg-white rounded-xl border border-emerald-200 text-xs space-y-1.5 font-mono">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold text-slate-800">WhatsApp Message ID:</span>
                    <span className="text-emerald-700 font-bold">{verifiedResult.wamid || verifiedResult.messageId || "wamid.verified"}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold text-slate-800">Recipient Phone:</span>
                    <span className="text-slate-800">{recipient}</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-semibold text-slate-800">Dispatch Status:</span>
                    <span className="uppercase font-bold text-emerald-700">Accepted by Meta</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-3 border-t border-emerald-200">
              <Link
                to="/onboarding"
                className="w-full sm:w-auto px-4 py-2 bg-white border border-emerald-300 hover:bg-emerald-100 text-emerald-900 text-xs font-bold rounded-xl text-center transition"
              >
                Back to Command Center
              </Link>
              <Link
                to="/onboarding/complete"
                className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl text-center shadow-sm transition flex items-center justify-center gap-1.5"
              >
                <span>Complete Activation</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        )}

        {/* FORM CONTAINER */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          <form onSubmit={handleSendTest} className="space-y-5">
            {/* Sender Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dispatch From Connected Sender <span className="text-rose-500">*</span>
              </label>
              {senders.length === 0 ? (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-between">
                  <span>No connected senders found. Connect a number in Step 4/5 first.</span>
                  <Link to="/onboarding/whatsapp/connect" className="font-bold underline ml-2">
                    Connect Now
                  </Link>
                </div>
              ) : (
                <select
                  value={selectedSenderId}
                  onChange={(e) => setSelectedSenderId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
                >
                  {senders.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.display_phone || "Connected Sender"} ({s.verified_name || s.department_name || "General"}) - {s.status}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Recipient Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Recipient Mobile Phone Number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                required
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="+919876543210 (include country code)"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Must include country prefix with plus sign, e.g., +91 for India, +1 for US.
              </p>
            </div>

            {/* Message Body */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Verification Message Content
              </label>
              <textarea
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              />
            </div>

            {/* Message Preview Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
                WhatsApp Chat Bubble Preview
              </span>
              <div className="max-w-sm ml-auto bg-[#D9FDD3] p-3 rounded-2xl rounded-tr-none shadow-sm text-xs text-slate-900 border border-[#b2e5a8]">
                <p>{message}</p>
                <div className="text-[10px] text-slate-500 text-right mt-1 flex items-center justify-end gap-1">
                  <span>Just now</span>
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                </div>
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={sending || senders.length === 0}
                className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow transition"
              >
                <Send className={`w-3.5 h-3.5 ${sending ? "animate-pulse" : ""}`} />
                <span>{sending ? "Dispatching via Meta Cloud API..." : "Send Verification Message"}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
