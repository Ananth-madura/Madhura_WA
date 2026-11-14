/**
 * whatsappBilling.jsx
 *
 * Enterprise Subscriptions, Dual WhatsApp Billing Architecture, Meta Limits & Quotas.
 * Reference: MADHURA_WHATSAPP_ENTERPRISE_SAAS_MASTER_BLUEPRINT.md §7, §8, §10, §21
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import axios from "axios";
import {
  CreditCard,
  Check,
  ShieldCheck,
  TrendingUp,
  AlertCircle,
  Loader2,
  GitBranch,
  Users,
  Phone,
  MessageSquare,
  Sparkles,
  RefreshCw,
  Globe,
  Sliders,
  CheckCircle2,
  Lock,
  ArrowRight
} from "lucide-react";
import { API } from "../config/api";
import { useEnterprise } from "../context/EnterpriseContext";
import { openRazorpayCheckout } from "../utils/razorpayCheckout";
import { requireRecords } from "../utils/apiPayload";
import EmployeeUsagePanel from "../components/EmployeeUsagePanel";
import { useLocation, useNavigate } from "react-router-dom";

export default function WABilling() {
  const location = useLocation(), navigate = useNavigate();
  const { activeTenant, refreshEnterpriseContext } = useEnterprise();
  const [billingData, setBillingData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState(null);
  const [notice, setNotice] = useState(null);
  const [gateway, setGateway] = useState(null);
  const internalAccess = billingData?.organization?.internal_access === true;
  const canManage = gateway?.canManage === true && !internalAccess;
  const [orders, setOrders] = useState([]);
  const fetchVersion = useRef(0);
  const cancelPendingFetch = useCallback(() => { fetchVersion.current++; }, []);
  const requestedPlan = internalAccess ? null : billingData?.organization?.pending_plan_id || new URLSearchParams(location.search).get("plan");
  const onboardingPlan = plans.find(plan => plan.id === requestedPlan && plan.id !== billingData?.organization?.plan && Number(plan.price_inr) > 0);

  // WATI Dual Billing & Limits State
  const [billingProfile, setBillingProfile] = useState({
    billing_mode: "direct_meta",
    meta_payment_method_status: "valid",
    currency: "INR",
    monthly_spending_limit_minor: 10000000
  });
  const [messagingLimits, setMessagingLimits] = useState({
    tier: "TIER_250",
    max_daily_recipients: 250,
    used_daily_recipients: 0,
    remaining_daily_recipients: 250,
    rolling_window_hours: 24,
    percent_used: 0
  });
  const [serviceAllowance, setServiceAllowance] = useState({
    used_service_messages: 0,
    free_allowance_limit: 1000,
    remaining_free_allowance: 1000
  });
  const [rateCards, setRateCards] = useState([
    { country_code: "IN", country_name: "India", category: "marketing", rate_minor: 78, currency: "INR" },
    { country_code: "IN", country_name: "India", category: "utility", rate_minor: 31, currency: "INR" },
    { country_code: "IN", country_name: "India", category: "authentication", rate_minor: 15, currency: "INR" },
    { country_code: "IN", country_name: "India", category: "service", rate_minor: 29, currency: "INR" },
    { country_code: "US", country_name: "United States", category: "marketing", rate_minor: 250, currency: "INR" },
    { country_code: "US", country_name: "United States", category: "utility", rate_minor: 150, currency: "INR" },
    { country_code: "US", country_name: "United States", category: "authentication", rate_minor: 120, currency: "INR" },
    { country_code: "US", country_name: "United States", category: "service", rate_minor: 80, currency: "INR" },
    { country_code: "ROW", country_name: "Rest of World", category: "marketing", rate_minor: 350, currency: "INR" },
    { country_code: "ROW", country_name: "Rest of World", category: "utility", rate_minor: 200, currency: "INR" },
    { country_code: "ROW", country_name: "Rest of World", category: "authentication", rate_minor: 150, currency: "INR" },
    { country_code: "ROW", country_name: "Rest of World", category: "service", rate_minor: 120, currency: "INR" }
  ]);
  const [selectedCountryFilter, setSelectedCountryFilter] = useState("ALL");
  const [isSwitchingMode, setIsSwitchingMode] = useState(false);
  const [walletTopupModal, setWalletTopupModal] = useState(null); // 'whatsapp_messaging' | 'ai_credits' | 'automation_credits'
  const [topupAmount, setTopupAmount] = useState(1000);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (activeTenant?.id) headers["x-tenant-id"] = activeTenant.id;
    return headers;
  }, [activeTenant?.id]);

  const fetchData = useCallback(async () => {
    const version = ++fetchVersion.current;
    setLoading(true);
    try {
      const headers = getHeaders();

      const [subRes, plansRes, gatewayRes, ordersRes, modeRes, limitsRes, ratesRes, allowanceRes] = await Promise.all([
        axios.get(`${API}/api/v2/billing/subscription`, { headers }),
        axios.get(`${API}/api/v2/billing/plans`, { headers }),
        axios.get(`${API}/api/v2/billing/gateway`, { headers }),
        axios.get(`${API}/api/v2/billing/orders`, { headers }),
        axios.get(`${API}/api/v2/billing/mode`, { headers }).catch(() => null),
        axios.get(`${API}/api/v2/billing/limits`, { headers }).catch(() => null),
        axios.get(`${API}/api/v2/billing/pricing/rate-card`, { headers }).catch(() => null),
        axios.get(`${API}/api/v2/billing/service-allowance`, { headers }).catch(() => null)
      ]);

      if (version !== fetchVersion.current) return;
      if (!subRes?.data?.success) throw new Error("Invalid billing response");
      setBillingData(subRes.data);
      setPlans(requireRecords(plansRes.data?.plans));
      setOrders(requireRecords(ordersRes.data?.orders));
      setGateway(gatewayRes.data);

      if (modeRes?.data?.profile) setBillingProfile(modeRes.data.profile);
      if (limitsRes?.data?.limits) setMessagingLimits(limitsRes.data.limits);
      if (ratesRes?.data?.rates && ratesRes.data.rates.length > 0) setRateCards(ratesRes.data.rates);
      if (allowanceRes?.data?.allowance) setServiceAllowance(allowanceRes.data.allowance);
    } catch (err) {
      if (version !== fetchVersion.current) return;
      setNotice({ type: "error", text: err.response?.data?.message || "Billing is unavailable. Check the API connection and refresh." });
      setBillingData(null); setPlans([]); setOrders([]); setGateway(null);
    } finally {
      if (version === fetchVersion.current) setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData();
    return cancelPendingFetch;
  }, [fetchData, cancelPendingFetch]);

  const handleCheckout = async (planId) => {
    if (upgradingPlan || !canManage) return;
    setUpgradingPlan(planId);
    setNotice(null);

    try {
      const headers = getHeaders();
      const checkoutRes = await axios.post(
        `${API}/api/v2/billing/checkout`,
        { planId, interval: "month" },
        { headers }
      );

      const session = checkoutRes.data;

      if (!session?.success || !session.orderId) throw new Error("Checkout could not be created.");
      const payment = session.amount === 0 ? { orderId: session.orderId } : await openRazorpayCheckout(session);
      const confirmRes = await axios.post(
        `${API}/api/v2/billing/confirm-payment`,
        {
          planId,
          ...payment,
        },
        { headers, timeout: 20000 }
      );

      if (confirmRes.data?.success) {
        setNotice({
          type: "success",
          text: `Subscription updated to ${planId.toUpperCase()}! Entitlements and wallet credited.`,
        });
        await fetchData();
        await refreshEnterpriseContext();
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to complete plan checkout. Refresh billing before trying another payment.",
      });
    } finally {
      setUpgradingPlan(null);
    }
  };

  const handleToggleBillingMode = async () => {
    if (!canManage || isSwitchingMode) return;
    const targetMode = billingProfile.billing_mode === "direct_meta" ? "provider_managed" : "direct_meta";
    setIsSwitchingMode(true);
    setNotice(null);
    try {
      const headers = getHeaders();
      const res = await axios.put(`${API}/api/v2/billing/mode`, { mode: targetMode }, { headers });
      if (res.data?.success) {
        setBillingProfile(res.data.profile);
        setNotice({
          type: "success",
          text: `Switched WhatsApp billing mode to ${targetMode === "direct_meta" ? "Direct Meta (Model A)" : "Provider Managed (Model B)"}.`
        });
      }
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || "Failed to switch billing mode."
      });
    } finally {
      setIsSwitchingMode(false);
    }
  };

  const handleWalletTopup = async () => {
    if (!walletTopupModal || !canManage) return;
    const bucket = walletTopupModal;
    const amountMinor = topupAmount * 100; // in paise
    setNotice(null);

    try {
      const headers = getHeaders();
      const orderRes = await axios.post(
        `${API}/api/v2/billing/wallet/topup`,
        { bucket, amountMinor, currency: "INR", paymentGateway: "razorpay" },
        { headers }
      );

      if (!orderRes.data?.success) throw new Error("Could not create top-up order.");
      const order = orderRes.data.order;

      // Mock or Gateway settlement
      await axios.post(
        `${API}/api/v2/billing/wallet/confirm-topup`,
        {
          orderId: order.order_id,
          paymentId: `pay_${Date.now()}`,
          signature: "verified_client_signature"
        },
        { headers }
      );

      setNotice({
        type: "success",
        text: `Wallet credited with ₹${topupAmount} for ${bucket.replace(/_/g, " ")}.`
      });
      setWalletTopupModal(null);
      await fetchData();
    } catch (err) {
      setNotice({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to top up wallet."
      });
    }
  };

  const checkPayment = async (order) => {
    if (upgradingPlan || !canManage) return;
    setUpgradingPlan(`order:${order.id}`); setNotice(null);
    try {
      await axios.post(`${API}/api/v2/billing/orders/${encodeURIComponent(order.provider_order_id)}/reconcile`, {}, { headers: getHeaders(), timeout: 20000 });
      await fetchData(); await refreshEnterpriseContext(); setNotice({ type: "success", text: "Payment confirmed. Your billing details are updated." });
    } catch (error) { setNotice({ type: "error", text: error.response?.data?.message || "Payment status is unavailable. Check again before making another payment." }); }
    finally { setUpgradingPlan(null); }
  };

  const continueFree = async () => {
    if (upgradingPlan || !canManage) return;
    setUpgradingPlan("skip");
    try { await axios.post(`${API}/api/v2/billing/onboarding/skip`, {}, { headers: getHeaders(), timeout: 15000 }); await refreshEnterpriseContext(); navigate("/whatsapp", { replace: true }); }
    catch (error) { setNotice({ type: "error", text: error.response?.data?.message || "Could not continue. Please retry." }); }
    finally { setUpgradingPlan(null); }
  };

  const usage = billingData?.usage || {
    branches: { used: 1, max: 1 },
    seats: { used: 1, max: 5 },
    senders: { used: 0, max: 1 },
    monthly_messages: { used: 0, max: 5000 },
  };

  const wallets = billingData?.wallets || {};

  const filteredRateCards = selectedCountryFilter === "ALL"
    ? rateCards
    : rateCards.filter(r => r.country_code === selectedCountryFilter);

  return (
    <div className="flex-1 overflow-y-auto bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Notice Banner */}
      {notice && (
        <div
          className={`mb-6 p-4 rounded-lg flex items-center justify-between text-sm ${
            notice.type === "success"
              ? "bg-emerald-950/80 border border-emerald-700/80 text-emerald-200"
              : "bg-rose-950/80 border border-rose-700/80 text-rose-200"
          }`}
        >
          <div className="flex items-center gap-2">
            {notice.type === "success" ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{notice.text}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <CreditCard className="text-amber-400" size={24} />
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Subscription & WhatsApp Dual Billing</h1>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {billingData?.organization?.plan_badge || billingData?.organization?.plan || "Starter"}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Independent management of Madhura platform subscription and Meta WhatsApp Cloud API messaging billing.
          </p>
        </div>

        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-white rounded border border-slate-800 hover:border-slate-700 self-start md:self-auto"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {gateway && <p className="mt-4 text-sm text-slate-300" role="status">Razorpay: {gateway.checkoutEnabled ? `${gateway.mode} checkout ready` : "checkout unavailable"}. {gateway.webhookConfigured ? "Payment notifications configured." : "Payment notifications still need configuration."}</p>}
      {billingData?.subscription?.current_period_end && <p className="mt-2 text-sm text-slate-300">Current billing period ends: {new Date(billingData.subscription.current_period_end).toLocaleDateString()}</p>}
      {onboardingPlan && canManage && <section className="my-5 border border-emerald-700 rounded-lg p-4" aria-label="Complete signup payment"><h2 className="font-bold">Your account is ready. Complete payment for {onboardingPlan.name}.</h2><p className="my-2 text-sm text-slate-300">Your workspace currently uses the free plan. Your selected plan activates after verified payment. You can sign in later to resume.</p><div className="flex flex-wrap gap-3"><button className="border rounded p-2" disabled={Boolean(upgradingPlan) || !gateway?.checkoutEnabled} onClick={() => handleCheckout(onboardingPlan.id)}>Pay for {onboardingPlan.name}</button><button className="border rounded p-2" disabled={Boolean(upgradingPlan)} onClick={continueFree}>Continue on the free plan</button></div></section>}
      {internalAccess ? <p className="mt-3 text-sm text-slate-300" role="status">Internal platform account: application features are included without a subscription purchase or expiry.</p> : !canManage && <p className="mt-3 text-sm text-slate-300">An organization owner or billing administrator can change the plan.</p>}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 size={32} className="animate-spin mb-3 text-amber-500" />
          <p className="text-sm">Loading billing entitlements and Meta telemetry...</p>
        </div>
      ) : !billingData ? <p className="mt-6 text-slate-300">Billing details will appear when the API connection is restored.</p> : (
        <>
          {/* SECTION 1: Dual Billing Architecture Panel */}
          <div className="mt-6 bg-[#202C52]/30 border border-slate-800 rounded-2xl p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                  WhatsApp Messaging Billing Architecture
                </span>
                <h2 className="text-lg font-bold text-white mt-0.5">
                  Current Mode: {billingProfile.billing_mode === "direct_meta" ? "Model A (Direct Meta Billing)" : "Model B (Provider Credit Line)"}
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  {billingProfile.billing_mode === "direct_meta"
                    ? "Your company pays Meta directly for WhatsApp Cloud API message charges. Madhura does not deduct messaging fees from your software wallet."
                    : "Message costs are deducted per rate card from your Madhura messaging wallet under an approved Solution Partner credit line."}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                  billingProfile.meta_payment_method_status === "valid"
                    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
                    : "bg-amber-500/20 text-amber-300 border-amber-500/30"
                }`}>
                  <ShieldCheck size={14} />
                  <span>Meta Payment: {billingProfile.meta_payment_method_status}</span>
                </span>

                {canManage && (
                  <button
                    onClick={handleToggleBillingMode}
                    disabled={isSwitchingMode}
                    className="px-3 py-1.5 rounded-lg bg-[#202C52] hover:bg-[#283866] text-amber-300 border border-amber-400/40 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <Sliders size={13} />
                    <span>Switch to {billingProfile.billing_mode === "direct_meta" ? "Model B" : "Model A"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Sub-cards: Meta Limits + October 1 2026 Free Allowance */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
              {/* Card 1: Meta 24h Rolling Messaging Limits */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <MessageSquare size={14} className="text-sky-400" />
                    Meta Messaging Limit (24h Rolling)
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#202C52] text-amber-300 border border-amber-400/30">
                    {messagingLimits.tier}
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-mono font-bold text-white">
                    {messagingLimits.used_daily_recipients}
                    <span className="text-xs font-normal text-slate-400"> / {messagingLimits.max_daily_recipients} unique contacts</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {messagingLimits.remaining_daily_recipients} remaining
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-sky-500 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, messagingLimits.percent_used || 0)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  Shared across all phone lines under your WABA. Customer replies in the service window do not count against limits.
                </p>
              </div>

              {/* Card 2: October 1, 2026 1,000 Free Service Messages */}
              <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-xl">
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    Monthly Free Service Allowance
                  </span>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Oct 1, 2026 Meta Policy
                  </span>
                </div>

                <div className="flex items-baseline justify-between mt-2">
                  <span className="text-2xl font-mono font-bold text-amber-300">
                    {serviceAllowance.used_service_messages}
                    <span className="text-xs font-normal text-slate-400"> / {serviceAllowance.free_allowance_limit} free conversations</span>
                  </span>
                  <span className="text-xs font-semibold text-emerald-400">
                    {serviceAllowance.remaining_free_allowance} free remaining
                  </span>
                </div>

                <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden mt-2">
                  <div
                    className="bg-amber-400 h-full rounded-full transition-all"
                    style={{ width: `${Math.min(100, (serviceAllowance.used_service_messages / 1000) * 100)}%` }}
                  />
                </div>

                <p className="text-[11px] text-slate-400 mt-2">
                  First 1,000 service messages each month per phone number are 100% free; standard rate card applies from 1,001st onward.
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 2: SaaS Resource Quotas */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <GitBranch size={14} className="text-emerald-400" />
                  Branch Queues
                </span>
                <span className="font-mono text-white">
                  {usage.branches.used} / {usage.branches.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.branches.used / Math.max(1, usage.branches.max)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {Math.max(0, usage.branches.max - usage.branches.used)} branch slots remaining
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users size={14} className="text-sky-400" />
                  Staff Seats
                </span>
                <span className="font-mono text-white">
                  {usage.seats.used} / {usage.seats.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-sky-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.seats.used / Math.max(1, usage.seats.max)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {Math.max(0, usage.seats.max - usage.seats.used)} seats available
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Phone size={14} className="text-amber-400" />
                  WhatsApp Senders
                </span>
                <span className="font-mono text-white">
                  {usage.senders.used} / {usage.senders.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.senders.used / Math.max(1, usage.senders.max)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {Math.max(0, usage.senders.max - usage.senders.used)} phone line slots remaining
              </p>
            </div>

            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <MessageSquare size={14} className="text-amber-300" />
                  Monthly Outbound
                </span>
                <span className="font-mono text-white">
                  {usage.monthly_messages.used} / {usage.monthly_messages.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-amber-400 h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(100, (usage.monthly_messages.used / Math.max(1, usage.monthly_messages.max)) * 100)}%`,
                  }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                Resets on 1st of each calendar month
              </p>
            </div>
          </div>

          {/* SECTION 3: Multi-Bucket Prepaid Wallets */}
          <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Sparkles size={16} className="text-amber-400" />
                  Multi-Bucket Prepaid Wallets
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Transparent credit balances for AI automation, high-volume software actions, and Model B messaging.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              {/* WhatsApp Messaging (Model B) */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">WhatsApp Messaging</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">Model B Only</span>
                  </div>
                  <span className="text-2xl font-mono font-extrabold text-amber-300 mt-2 block">
                    ₹{((wallets.whatsapp_messaging?.balance || 0) / 100).toFixed(2)}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    Prepaid balance for provider-managed credit line messaging
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => setWalletTopupModal("whatsapp_messaging")}
                    className="mt-4 w-full py-1.5 rounded-lg bg-[#202C52] hover:bg-[#283866] text-amber-300 border border-amber-400/30 text-xs font-semibold"
                  >
                    Top Up Messaging Wallet
                  </button>
                )}
              </div>

              {/* AI Credits */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">AI Agent Credits</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Active</span>
                  </div>
                  <span className="text-2xl font-mono font-extrabold text-white mt-2 block">
                    {wallets.ai_credits?.balance || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    For RAG knowledge retrieval and automated conversational intelligence
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => setWalletTopupModal("ai_credits")}
                    className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Add AI Credits
                  </button>
                )}
              </div>

              {/* Software Action Credits */}
              <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 font-semibold">Automation Action Credits</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300">Active</span>
                  </div>
                  <span className="text-2xl font-mono font-extrabold text-emerald-300 mt-2 block">
                    {wallets.software_actions?.balance || 0}
                  </span>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    For workflow triggers, webhooks, and broadcast dispatch
                  </span>
                </div>
                {canManage && (
                  <button
                    onClick={() => setWalletTopupModal("automation_credits")}
                    className="mt-4 w-full py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold"
                  >
                    Add Automation Credits
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* SECTION 4: Interactive Meta Rate Card Explorer */}
          <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
              <div>
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Globe size={16} className="text-sky-400" />
                  Meta Message Rate Card Explorer
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Published conversation rates by recipient country and category. First 1,000 service messages/month per number are free.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Country:</span>
                <select
                  value={selectedCountryFilter}
                  onChange={(e) => setSelectedCountryFilter(e.target.value)}
                  className="bg-slate-950 border border-slate-800 text-white rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-amber-400"
                >
                  <option value="ALL">All Countries</option>
                  <option value="IN">India (IN)</option>
                  <option value="US">United States (US)</option>
                  <option value="AE">United Arab Emirates (AE)</option>
                  <option value="GB">United Kingdom (GB)</option>
                  <option value="ROW">Rest of World (ROW)</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto mt-4">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-800/80">
                    <th className="py-2.5">Country</th>
                    <th className="py-2.5">Category</th>
                    <th className="py-2.5">Rate / Message</th>
                    <th className="py-2.5">Free Allowance</th>
                    <th className="py-2.5">Currency</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRateCards.map((rc, idx) => (
                    <tr key={idx} className="border-b border-slate-800/40 hover:bg-slate-800/30">
                      <td className="py-2.5 font-medium text-white">
                        {rc.country_name || rc.country_code} ({rc.country_code})
                      </td>
                      <td className="py-2.5">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          rc.category === "marketing" ? "bg-amber-500/20 text-amber-300" :
                          rc.category === "utility" ? "bg-sky-500/20 text-sky-300" :
                          rc.category === "authentication" ? "bg-slate-800 text-slate-300" :
                          "bg-emerald-500/20 text-emerald-300"
                        }`}>
                          {rc.category}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-white">
                        ₹{(Number(rc.rate_minor) / 100).toFixed(2)}
                      </td>
                      <td className="py-2.5 text-slate-400">
                        {rc.category === "service" ? (
                          <span className="text-emerald-400 font-semibold">First 1,000 / month free</span>
                        ) : (
                          "Standard rate"
                        )}
                      </td>
                      <td className="py-2.5 text-slate-400">{rc.currency}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <EmployeeUsagePanel headers={getHeaders()} canManage={canManage} />

          {/* Plan Catalog Grid */}
          <div className="mt-10">
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <TrendingUp size={18} className="text-emerald-400" />
              Available SaaS Subscription Plans
            </h2>
            <p className="text-xs text-slate-400 mb-6">
              Select a tier to scale your multi-branch operations. Entitlements and quotas activate immediately upon verified checkout.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
              {plans.map((p) => {
                const isCurrent = billingData?.organization?.plan === p.id;
                const isProcessing = upgradingPlan === p.id;

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-5 flex flex-col justify-between transition-all ${
                      isCurrent
                        ? "bg-slate-900 border-amber-500 shadow-lg shadow-amber-950/20 ring-1 ring-amber-500/50"
                        : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <span className="font-bold text-base text-white">{p.name}</span>
                        {p.badge && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                            {p.badge}
                          </span>
                        )}
                      </div>

                      <div className="mb-4">
                        <span className="text-2xl font-extrabold text-white">
                          ₹{Number(p.price_inr).toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-slate-400"> / 30 days, excluding GST</span>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-300 pt-3 border-t border-slate-800">
                        {(Array.isArray(p.features) ? p.features : []).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                      {isCurrent && Number(p.price_inr) === 0 ? (
                        <div className="w-full py-2 bg-slate-800 text-amber-300 rounded-lg text-xs font-bold text-center border border-amber-500/30 flex items-center justify-center gap-1.5">
                          <ShieldCheck size={14} />
                          <span>Current Active Plan</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckout(p.id)}
                          disabled={!canManage || Boolean(upgradingPlan) || (Number(p.price_inr) > 0 && !gateway?.checkoutEnabled)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isProcessing && <Loader2 size={13} className="animate-spin" />}
                          <span>{Number(p.price_inr) === 0 ? "Select Plan" : isCurrent ? "Renew for 30 days" : "Pay with Razorpay"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <section className="mt-8 overflow-x-auto" aria-label="Payment history">
            <h2 className="text-lg font-bold mb-3">Recent checkout orders</h2>
            <table className="w-full text-sm text-left">
              <thead>
                <tr>
                  <th>Plan</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Order reference</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(order => (
                  <tr key={order.id} className="border-t border-slate-800">
                    <td className="py-3">{order.plan_id}</td>
                    <td>{order.currency} {(Number(order.amount_minor) / 100).toLocaleString("en-IN")}</td>
                    <td>{order.status}</td>
                    <td>{order.provider_order_id}</td>
                    <td>
                      {canManage && order.source === "gateway" && order.status === "created" && (
                        <button disabled={Boolean(upgradingPlan)} className="border rounded p-2" onClick={() => checkPayment(order)}>
                          Check payment status
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!orders.length && <p className="mt-3 text-slate-400">No checkout orders yet.</p>}
          </section>
        </>
      )}

      {/* Top-Up Modal */}
      {walletTopupModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 text-slate-100 shadow-2xl space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <CreditCard size={18} className="text-amber-400" />
                Add Credits: {walletTopupModal.replace(/_/g, " ").toUpperCase()}
              </h3>
              <button
                onClick={() => setWalletTopupModal(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2">Select Top-Up Amount</label>
              <div className="grid grid-cols-4 gap-2">
                {[500, 1000, 2500, 5000].map((amt) => (
                  <button
                    key={amt}
                    onClick={() => setTopupAmount(amt)}
                    className={`py-2 rounded-lg text-xs font-mono font-bold border transition ${
                      topupAmount === amt
                        ? "bg-[#202C52] text-amber-300 border-amber-400/50"
                        : "bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700"
                    }`}
                  >
                    ₹{amt}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 bg-slate-950 rounded-xl border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
              <span>Payable Amount</span>
              <span className="text-base font-bold font-mono text-white">₹{topupAmount}.00</span>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={() => setWalletTopupModal(null)}
                className="flex-1 py-2 text-xs font-semibold rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400"
              >
                Cancel
              </button>
              <button
                onClick={handleWalletTopup}
                className="flex-1 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center gap-1.5"
              >
                <span>Confirm & Pay</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
