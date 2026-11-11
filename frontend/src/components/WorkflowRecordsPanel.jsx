import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { API } from "../config/api";
import { RefreshCw, CheckCircle2, AlertTriangle, Plus, Calendar, LifeBuoy, ShoppingBag, Users, ShieldAlert } from "lucide-react";

/**
 * Live CRM Records & Error Alerts Panel for workflows executed via Built-in CRM.
 * Displays Appointments, Support Tickets, Catalog/Orders, HR Requests, Approvals,
 * and persistent Flow Execution Error Alerts with management actions.
 */
export default function WorkflowRecordsPanel() {
  const [subTab, setSubTab] = useState("appointments");
  const [records, setRecords] = useState({
    appointments: [],
    waitlist: [],
    tickets: [],
    products: [],
    orders: [],
    hrRequests: [],
    approvals: [],
  });
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [productDraft, setProductDraft] = useState({ sku: "", name: "", category: "general", price: "499", stock_qty: "25" });
  const [savingProd, setSavingProd] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [recRes, alertRes] = await Promise.all([
        axios.get(`${API}/api/wa-flows/records`),
        axios.get(`${API}/api/wa-flows/alerts`),
      ]);
      setRecords({
        appointments: recRes.data?.appointments || [],
        waitlist: recRes.data?.waitlist || [],
        tickets: recRes.data?.tickets || [],
        products: recRes.data?.products || [],
        orders: recRes.data?.orders || [],
        hrRequests: recRes.data?.hrRequests || [],
        approvals: recRes.data?.approvals || [],
      });
      setAlerts(alertRes.data?.alerts || []);
    } catch (err) {
      setError(err.response?.data?.error || "Could not load CRM workflow records.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const updateRecordStatus = async (type, id, status) => {
    try {
      await axios.patch(`${API}/api/wa-flows/records/${type}/${id}`, { status });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Status update failed.");
    }
  };

  const updateAlertStatus = async (id, status) => {
    try {
      await axios.patch(`${API}/api/wa-flows/alerts/${id}`, { status });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Could not update alert.");
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setSavingProd(true);
    try {
      await axios.post(`${API}/api/wa-flows/records/catalog`, productDraft);
      setProductDraft({ sku: "", name: "", category: "general", price: "499", stock_qty: "25" });
      await loadData();
    } catch (err) {
      setError(err.response?.data?.error || "Could not save catalog item.");
    } finally {
      setSavingProd(false);
    }
  };

  const openAlertCount = alerts.filter((a) => a.status === "open").length;

  const tabs = [
    { id: "appointments", label: `Appointments (${records.appointments.length})`, icon: Calendar },
    { id: "tickets", label: `Support Tickets (${records.tickets.length})`, icon: LifeBuoy },
    { id: "commerce", label: `Catalog & Orders (${records.orders.length})`, icon: ShoppingBag },
    { id: "approvals", label: `HR & Approvals (${records.hrRequests.length + records.approvals.length})`, icon: Users },
    { id: "alerts", label: `Error Alerts (${openAlertCount} open)`, icon: ShieldAlert },
  ];

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSubTab(t.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                  subTab === t.id
                    ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-white"
                }`}
              >
                <Icon size={13} />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={loadData}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
          <span>Refresh</span>
        </button>
      </div>

      {error && <div role="alert" className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800">{error}</div>}

      {subTab === "appointments" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-[11px] uppercase text-slate-500">
              <tr>
                <th className="p-2.5">Ref</th>
                <th className="p-2.5">Customer</th>
                <th className="p-2.5">Service / Branch</th>
                <th className="p-2.5">Slot</th>
                <th className="p-2.5">Staff</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!records.appointments.length ? (
                <tr><td colSpan={7} className="p-6 text-center text-slate-400">No appointments booked yet via WhatsApp flows.</td></tr>
              ) : records.appointments.map((apt) => (
                <tr key={apt.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono font-bold text-emerald-700">{apt.reference_code}</td>
                  <td className="p-2.5 font-semibold">{apt.customer_name || "Customer"}<div className="text-[10px] text-slate-400 font-mono">+{apt.phone}</div></td>
                  <td className="p-2.5">{apt.service_name} <span className="text-slate-400">({apt.branch_name})</span></td>
                  <td className="p-2.5 font-mono">{apt.slot_date} {apt.slot_time}</td>
                  <td className="p-2.5">{apt.staff_name || "Unassigned"}</td>
                  <td className="p-2.5"><span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-[10px] uppercase">{apt.status}</span></td>
                  <td className="p-2.5 flex flex-wrap gap-1">
                    <button type="button" onClick={() => updateRecordStatus("appointment", apt.id, "confirmed")} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">Confirm</button>
                    <button type="button" onClick={() => updateRecordStatus("appointment", apt.id, "completed")} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">Complete</button>
                    <button type="button" onClick={() => updateRecordStatus("appointment", apt.id, "cancelled")} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-semibold">Cancel</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "tickets" && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b text-[11px] uppercase text-slate-500">
              <tr>
                <th className="p-2.5">Ticket #</th>
                <th className="p-2.5">Phone</th>
                <th className="p-2.5">Subject / Description</th>
                <th className="p-2.5">Priority</th>
                <th className="p-2.5">Status</th>
                <th className="p-2.5">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {!records.tickets.length ? (
                <tr><td colSpan={6} className="p-6 text-center text-slate-400">No support tickets created yet.</td></tr>
              ) : records.tickets.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="p-2.5 font-mono font-bold text-blue-700">{t.ticket_no}</td>
                  <td className="p-2.5 font-mono">+{t.phone}</td>
                  <td className="p-2.5"><strong>{t.subject}</strong><p className="text-[11px] text-slate-500 max-w-md truncate">{t.description}</p></td>
                  <td className="p-2.5 uppercase font-bold text-[10px]">{t.priority}</td>
                  <td className="p-2.5"><span className="px-2 py-0.5 rounded-full bg-slate-100 font-bold text-[10px] uppercase">{t.status}</span></td>
                  <td className="p-2.5 flex gap-1">
                    <button type="button" onClick={() => updateRecordStatus("ticket", t.id, "in_progress")} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">In Progress</button>
                    <button type="button" onClick={() => updateRecordStatus("ticket", t.id, "resolved")} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">Resolve</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {subTab === "commerce" && (
        <div className="space-y-4">
          <form onSubmit={handleSaveProduct} className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs items-end">
            <div>
              <label className="font-bold block mb-1">SKU</label>
              <input required value={productDraft.sku} onChange={(e) => setProductDraft({ ...productDraft, sku: e.target.value })} placeholder="SKU-101" className="w-full p-1.5 border rounded-lg bg-white" />
            </div>
            <div className="col-span-2">
              <label className="font-bold block mb-1">Product / Service / Menu Item</label>
              <input required value={productDraft.name} onChange={(e) => setProductDraft({ ...productDraft, name: e.target.value })} placeholder="AMC Annual Plan" className="w-full p-1.5 border rounded-lg bg-white" />
            </div>
            <div>
              <label className="font-bold block mb-1">Price</label>
              <input type="number" min="0" value={productDraft.price} onChange={(e) => setProductDraft({ ...productDraft, price: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white" />
            </div>
            <div>
              <label className="font-bold block mb-1">Stock</label>
              <input type="number" min="0" value={productDraft.stock_qty} onChange={(e) => setProductDraft({ ...productDraft, stock_qty: e.target.value })} className="w-full p-1.5 border rounded-lg bg-white" />
            </div>
            <button type="submit" disabled={savingProd} className="py-1.5 px-3 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-1">
              <Plus size={13} /> Add Item
            </button>
          </form>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
            <div className="border rounded-2xl p-3">
              <h4 className="font-bold mb-2">Catalog Inventory ({records.products.length})</h4>
              {!records.products.length ? <p className="text-slate-400">No catalog items yet. Add one above so E-Commerce / Menu workflows can quote &amp; order them.</p> : (
                <div className="space-y-1.5 max-h-60 overflow-y-auto">
                  {records.products.map((p) => (
                    <div key={p.id} className="flex justify-between items-center p-2 bg-slate-50 rounded-lg">
                      <div><strong className="text-slate-900">{p.name}</strong> <span className="font-mono text-[10px] text-slate-400">({p.sku})</span></div>
                      <div className="font-mono">{p.currency} {p.price} · Stock: <strong>{p.stock_qty}</strong></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="border rounded-2xl p-3">
              <h4 className="font-bold mb-2">WhatsApp Orders ({records.orders.length})</h4>
              {!records.orders.length ? <p className="text-slate-400">No orders placed yet via WhatsApp flows.</p> : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {records.orders.map((o) => (
                    <div key={o.id} className="p-2 bg-slate-50 rounded-lg flex items-center justify-between gap-2">
                      <div>
                        <strong className="font-mono text-emerald-700">{o.order_no}</strong> · +{o.phone}
                        <div className="text-[10px] text-slate-500">{o.currency} {o.total_amount} · Pay: {o.payment_status} · Ship: {o.fulfillment_status}</div>
                      </div>
                      <div className="flex gap-1">
                        <button type="button" onClick={() => updateRecordStatus("order", o.id, "dispatched")} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold">Dispatch</button>
                        <button type="button" onClick={() => updateRecordStatus("order", o.id, "delivered")} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-semibold">Delivered</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === "approvals" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
          <div className="border rounded-2xl p-3">
            <h4 className="font-bold mb-2">HR Requests ({records.hrRequests.length})</h4>
            {!records.hrRequests.length ? <p className="text-slate-400">No employee HR requests submitted yet.</p> : records.hrRequests.map((hr) => (
              <div key={hr.id} className="p-2.5 bg-slate-50 rounded-xl mb-2 flex items-center justify-between gap-2">
                <div>
                  <strong className="font-mono">{hr.request_no}</strong> ({hr.request_type}) — {hr.employee_name || hr.employee_phone}
                  <div className="text-[10px] text-slate-500">{hr.target_date || ""} · {hr.details} · Status: <strong>{hr.status}</strong></div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => updateRecordStatus("hr", hr.id, "approved")} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">Approve</button>
                  <button type="button" onClick={() => updateRecordStatus("hr", hr.id, "rejected")} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
          <div className="border rounded-2xl p-3">
            <h4 className="font-bold mb-2">Operations &amp; Quote Approvals ({records.approvals.length})</h4>
            {!records.approvals.length ? <p className="text-slate-400">No pending procurement, expense, or quote approvals.</p> : records.approvals.map((apr) => (
              <div key={apr.id} className="p-2.5 bg-slate-50 rounded-xl mb-2 flex items-center justify-between gap-2">
                <div>
                  <strong className="font-mono">{apr.approval_no}</strong> ({apr.request_type}) — {apr.item_name}
                  <div className="text-[10px] text-slate-500">Qty: {apr.quantity} · Amt: {apr.amount} · Status: <strong>{apr.status}</strong></div>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => updateRecordStatus("approval", apr.id, "approved")} className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded font-bold">Approve</button>
                  <button type="button" onClick={() => updateRecordStatus("approval", apr.id, "rejected")} className="px-2 py-0.5 bg-rose-50 text-rose-700 rounded font-bold">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {subTab === "alerts" && (
        <div className="space-y-2 text-xs">
          {!alerts.length ? (
            <div className="p-6 text-center text-slate-400 flex flex-col items-center gap-1">
              <CheckCircle2 size={20} className="text-emerald-500" />
              <span>Zero flow execution errors recorded.</span>
            </div>
          ) : alerts.map((a) => (
            <div key={a.id} className="p-3 rounded-2xl border border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className={a.status === "open" ? "text-rose-600" : "text-slate-400"} />
                  <strong className="text-slate-900">{a.flow_name || `Flow #${a.flow_id}`}</strong>
                  <span className="font-mono text-[10px] px-1.5 py-0.5 bg-white border rounded">{a.node_key}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${a.status === "open" ? "bg-rose-100 text-rose-800" : "bg-emerald-100 text-emerald-800"}`}>{a.status}</span>
                </div>
                <p className="text-rose-800 font-mono text-[11px]">{a.error_message}</p>
                <p className="text-[10px] text-slate-400">+{a.phone || "N/A"} · {new Date(a.created_at).toLocaleString()}</p>
              </div>
              {a.status !== "resolved" && (
                <button type="button" onClick={() => updateAlertStatus(a.id, "resolved")} className="px-3 py-1 bg-emerald-600 text-white rounded-xl font-bold">
                  Mark Resolved
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
