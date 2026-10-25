/**
 * whatsappBilling.jsx
 *
 * Enterprise Subscriptions, Resource Entitlement Quotas & Razorpay Checkout.
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
} from "lucide-react";
import { API } from "../config/api";
import { useEnterprise } from "../context/EnterpriseContext";
import {openRazorpayCheckout} from "../utils/razorpayCheckout";
import {requireRecords} from "../utils/apiPayload";
import {useLocation,useNavigate} from "react-router-dom";

export default function WABilling() {
  const location=useLocation(),navigate=useNavigate();
  const { activeTenant, refreshEnterpriseContext } = useEnterprise();
  const [billingData, setBillingData] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [upgradingPlan, setUpgradingPlan] = useState(null);
  const [notice, setNotice] = useState(null);
  const [gateway,setGateway]=useState(null);
  const canManage=gateway?.canManage===true;
  const [orders,setOrders]=useState([]);
  const fetchVersion=useRef(0);
  const cancelPendingFetch=useCallback(()=>{fetchVersion.current++;},[]);
  const requestedPlan=billingData?.organization?.pending_plan_id||new URLSearchParams(location.search).get("plan");
  const onboardingPlan=plans.find(plan=>plan.id===requestedPlan&&plan.id!==billingData?.organization?.plan&&Number(plan.price_inr)>0);

  const getHeaders = useCallback(() => {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    if (activeTenant?.id) headers["x-tenant-id"] = activeTenant.id;
    return headers;
  }, [activeTenant?.id]);

  const fetchData = useCallback(async () => {
    const version=++fetchVersion.current;
    setLoading(true);
    try {
      const headers = getHeaders();

      const [subRes, plansRes, gatewayRes, ordersRes] = await Promise.all([
        axios.get(`${API}/api/v2/billing/subscription`, { headers }),
        axios.get(`${API}/api/v2/billing/plans`, { headers }),
        axios.get(`${API}/api/v2/billing/gateway`, { headers }),
        axios.get(`${API}/api/v2/billing/orders`, { headers }),
      ]);

      if(version!==fetchVersion.current)return;
      if(!subRes?.data?.success)throw new Error("Invalid billing response");
      setBillingData(subRes.data);
      setPlans(requireRecords(plansRes.data?.plans));
      setOrders(requireRecords(ordersRes.data?.orders));setGateway(gatewayRes.data);
    } catch (err) {
      if(version!==fetchVersion.current)return;
      setNotice({type:"error",text:err.response?.data?.message||"Billing is unavailable. Check the API connection and refresh."});
      setBillingData(null);setPlans([]);setOrders([]);setGateway(null);
    } finally {
      if(version===fetchVersion.current)setLoading(false);
    }
  }, [getHeaders]);

  useEffect(() => {
    fetchData();
    return cancelPendingFetch;
  }, [fetchData,cancelPendingFetch]);

  const handleCheckout = async (planId) => {
    if(upgradingPlan||!canManage)return;
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

      if(!session?.success||!session.orderId)throw new Error("Checkout could not be created.");
      const payment=session.amount===0?{orderId:session.orderId}:await openRazorpayCheckout(session);
      const confirmRes = await axios.post(
        `${API}/api/v2/billing/confirm-payment`,
        {
          planId,
          ...payment,
        },
        { headers, timeout:20000 }
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

  const checkPayment=async order=>{
    if(upgradingPlan||!canManage)return;
    setUpgradingPlan(`order:${order.id}`);setNotice(null);
    try{
      await axios.post(`${API}/api/v2/billing/orders/${encodeURIComponent(order.provider_order_id)}/reconcile`,{},{headers:getHeaders(),timeout:20000});
      await fetchData();await refreshEnterpriseContext();setNotice({type:"success",text:"Payment confirmed. Your billing details are updated."});
    }catch(error){setNotice({type:"error",text:error.response?.data?.message||"Payment status is unavailable. Check again before making another payment."});}
    finally{setUpgradingPlan(null);}
  };

  const continueFree=async()=>{
    if(upgradingPlan||!canManage)return;
    setUpgradingPlan("skip");
    try{await axios.post(`${API}/api/v2/billing/onboarding/skip`,{},{headers:getHeaders(),timeout:15000});await refreshEnterpriseContext();navigate("/whatsapp",{replace:true});}
    catch(error){setNotice({type:"error",text:error.response?.data?.message||"Could not continue. Please retry."});}
    finally{setUpgradingPlan(null);}
  };

  const usage = billingData?.usage || {
    branches: { used: 1, max: 1 },
    seats: { used: 1, max: 5 },
    senders: { used: 0, max: 1 },
    monthly_messages: { used: 0, max: 5000 },
  };

  const wallets = billingData?.wallets || {};

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
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">Subscription & Metered Quotas</h1>
            <span className="ml-2 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
              {billingData?.organization?.plan_badge || billingData?.organization?.plan || "Starter"}
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Manage your organization plan, payment history, resource quotas, and credit wallets. Payments renew access for 30 days; automatic recurring debits are not enabled.
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

      {gateway&&<p className="mt-4 text-sm text-slate-300" role="status">Razorpay: {gateway.checkoutEnabled?`${gateway.mode} checkout ready`:"checkout unavailable"}. {gateway.webhookConfigured?"Payment notifications configured.":"Payment notifications still need configuration."}</p>}
      {billingData?.subscription?.current_period_end&&<p className="mt-2 text-sm text-slate-300">Current billing period ends: {new Date(billingData.subscription.current_period_end).toLocaleDateString()}</p>}
      {onboardingPlan&&canManage&&<section className="my-5 border border-emerald-700 rounded-lg p-4" aria-label="Complete signup payment"><h2 className="font-bold">Your account is ready. Complete payment for {onboardingPlan.name}.</h2><p className="my-2 text-sm text-slate-300">Your workspace currently uses the free plan. Your selected plan activates after verified payment. You can sign in later to resume.</p><div className="flex flex-wrap gap-3"><button className="border rounded p-2" disabled={Boolean(upgradingPlan)||!gateway?.checkoutEnabled} onClick={()=>handleCheckout(onboardingPlan.id)}>Pay for {onboardingPlan.name}</button><button className="border rounded p-2" disabled={Boolean(upgradingPlan)} onClick={continueFree}>Continue on the free plan</button></div></section>}
      {!canManage&&<p className="mt-3 text-sm text-slate-300">An organization owner or billing administrator can change the plan.</p>}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500">
          <Loader2 size={32} className="animate-spin mb-3 text-amber-500" />
          <p className="text-sm">Loading billing entitlements...</p>
        </div>
      ) : !billingData ? <p className="mt-6 text-slate-300">Billing details will appear when the API connection is restored.</p> : (
        <>
          {/* Quota Usage Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {/* Branches */}
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

            {/* Seats */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <Users size={14} className="text-blue-400" />
                  Staff Seats
                </span>
                <span className="font-mono text-white">
                  {usage.seats.used} / {usage.seats.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all"
                  style={{ width: `${Math.min(100, (usage.seats.used / Math.max(1, usage.seats.max)) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-2">
                {Math.max(0, usage.seats.max - usage.seats.used)} seats available
              </p>
            </div>

            {/* Senders */}
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

            {/* Monthly Messages */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                <span className="flex items-center gap-1.5 font-medium">
                  <MessageSquare size={14} className="text-purple-400" />
                  Monthly Outbound
                </span>
                <span className="font-mono text-white">
                  {usage.monthly_messages.used} / {usage.monthly_messages.max}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-purple-500 h-full rounded-full transition-all"
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

          {/* Wallets & Credit Balance */}
          <div className="mt-8 bg-slate-900/50 border border-slate-800 rounded-xl p-5">
            <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
              <Sparkles size={16} className="text-amber-400" />
              Prepaid Credit Wallets
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">AI Agent Credits</span>
                  <span className="text-2xl font-extrabold text-amber-300 mt-1 block">
                    {wallets.ai_credits?.balance || 0}
                  </span>
                  <span className="text-[11px] text-slate-500">For RAG knowledge retrieval and automated neural replies</span>
                </div>
              </div>

              <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-4 flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-400 block font-medium">Software Action Credits</span>
                  <span className="text-2xl font-extrabold text-emerald-300 mt-1 block">
                    {wallets.software_actions?.balance || 0}
                  </span>
                  <span className="text-[11px] text-slate-500">For workflow triggers and high-volume broadcast queues</span>
                </div>
              </div>
            </div>
          </div>

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
                        <span className="text-xs text-slate-400"> / month</span>
                      </div>

                      <ul className="space-y-2 text-xs text-slate-300 pt-3 border-t border-slate-800">
                        {(Array.isArray(p.features)?p.features:[]).map((feat, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check size={14} className="text-emerald-400 shrink-0 mt-0.5" />
                            <span>{feat}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800">
                      {isCurrent && Number(p.price_inr)===0 ? (
                        <div className="w-full py-2 bg-slate-800 text-amber-300 rounded-lg text-xs font-bold text-center border border-amber-500/30 flex items-center justify-center gap-1.5">
                          <ShieldCheck size={14} />
                          <span>Current Active Plan</span>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckout(p.id)}
                          disabled={!canManage||Boolean(upgradingPlan)||(Number(p.price_inr)>0&&!gateway?.checkoutEnabled)}
                          className="w-full py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition flex items-center justify-center gap-2 shadow-sm"
                        >
                          {isProcessing && <Loader2 size={13} className="animate-spin" />}
                          <span>{Number(p.price_inr) === 0 ? "Select Plan" : isCurrent?"Renew for 30 days":"Pay with Razorpay"}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <section className="mt-8 overflow-x-auto" aria-label="Payment history"><h2 className="text-lg font-bold mb-3">Recent checkout orders</h2><table className="w-full text-sm text-left"><thead><tr><th>Plan</th><th>Amount</th><th>Status</th><th>Order reference</th><th>Action</th></tr></thead><tbody>{orders.map(order=><tr key={order.id} className="border-t border-slate-800"><td className="py-3">{order.plan_id}</td><td>{order.currency} {(Number(order.amount_minor)/100).toLocaleString("en-IN")}</td><td>{order.status}</td><td>{order.provider_order_id}</td><td>{canManage&&order.source==="gateway"&&order.status==="created"&&<button disabled={Boolean(upgradingPlan)} className="border rounded p-2" onClick={()=>checkPayment(order)}>Check payment status</button>}</td></tr>)}</tbody></table>{!orders.length&&<p className="mt-3 text-slate-400">No checkout orders yet.</p>}</section>
        </>
      )}
    </div>
  );
}
