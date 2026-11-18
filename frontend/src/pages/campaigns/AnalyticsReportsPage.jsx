import { useEffect, useState, useCallback } from "react";
import { Download, Plus, CheckCircle2 } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function AnalyticsReportsPage() {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportName, setReportName] = useState("");
  const [convForm, setConvForm] = useState({ entity_type: "order", entity_id: "", phone: "", revenue_minor: "" });
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const [ov, reps] = await Promise.all([
        campaignApi.getOverview(),
        campaignApi.listReports().catch(() => []),
      ]);
      setOverview(ov);
      setReports(Array.isArray(reps) ? reps : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!reportName.trim()) return;
    await campaignApi.createReport({ name: reportName.trim(), metrics: ["submitted", "delivered", "read", "replies", "conversions", "revenue"], dimensions: ["campaign", "category"] });
    setReportName("");
    setNotice("Custom report saved.");
    load();
  };

  const handleRecordConversion = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const res = await campaignApi.recordConversion({
        ...convForm,
        revenue_minor: Number(convForm.revenue_minor || 0),
      });
      setNotice(res.attributed ? `Attributed to campaign #${res.campaign_id}` : `Not attributed: ${res.reason}`);
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const exportCsv = () => {
    const rows = overview?.breakdowns?.by_category || [];
    const lines = ["category,campaigns,submitted,delivered,read,replies,conversions,revenue_minor,estimated_cost_minor"];
    for (const r of rows) {
      lines.push(`${r.category},${r.campaigns},${r.submitted},${r.delivered},${r.read_count},${r.replies},${r.conversions},${r.revenue_minor},${r.estimated_cost_minor}`);
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "madhura_campaign_analytics.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const ov = overview?.overview || {};
  const defs = overview?.metric_definitions || {};

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Enterprise Campaign Analytics, Attribution &amp; Reports</h1>
            <p className="text-sm text-slate-600">Traceable funnel rates, verified order/deal revenue attribution, and permissioned CSV exports.</p>
          </div>
          <button onClick={exportCsv} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">{error}</div>}
        {notice && <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2"><CheckCircle2 className="w-4 h-4" />{notice}</div>}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ["Delivered Rate", `${ov.delivered_rate || 0}%`, defs.delivered_rate],
            ["Read Rate", `${ov.read_rate || 0}%`, defs.read_rate],
            ["Reply Rate", `${ov.reply_rate || 0}%`, defs.reply_rate],
            ["Verified ROI", `${ov.roi_percent || 0}%`, `Revenue ${formatMinorCurrency(ov.attributed_revenue_minor || 0)}`],
          ].map(([k, v, formula]) => (
            <div key={k} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500">{k}</div>
              <div className="text-2xl font-bold text-slate-900 mt-1">{v}</div>
              <div className="text-[10px] text-slate-400 mt-1">{formula}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <form onSubmit={handleSaveReport} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-900">Custom Report Builder</h2>
            <div className="flex gap-2">
              <input value={reportName} onChange={(e) => setReportName(e.target.value)} placeholder="Report name (e.g. Monthly ROI by Sender)" className="flex-1 px-3 py-2 border border-slate-300 rounded-lg" />
              <button type="submit" className="inline-flex items-center gap-1 px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold"><Plus className="w-3.5 h-3.5" /> Save</button>
            </div>
            <div className="space-y-2 pt-2">
              {reports.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border flex justify-between">
                  <span className="font-medium text-slate-800">{r.name}</span>
                  <span className="text-slate-500">{(r.metrics || []).join(", ")}</span>
                </div>
              ))}
            </div>
          </form>

          <form onSubmit={handleRecordConversion} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3 text-xs">
            <h2 className="text-sm font-semibold text-slate-900">Record Verified Conversion (Attribution Check)</h2>
            <div className="grid grid-cols-2 gap-2">
              <select value={convForm.entity_type} onChange={(e) => setConvForm({ ...convForm, entity_type: e.target.value })} className="px-3 py-2 border border-slate-300 rounded-lg bg-white">
                <option value="order">Verified Order</option>
                <option value="payment">Completed Payment</option>
                <option value="deal">Won Deal</option>
                <option value="appointment">Booked Appointment</option>
              </select>
              <input required value={convForm.entity_id} onChange={(e) => setConvForm({ ...convForm, entity_id: e.target.value })} placeholder="Source Reference ID (e.g. ORD-101)" className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input required value={convForm.phone} onChange={(e) => setConvForm({ ...convForm, phone: e.target.value })} placeholder="Customer Phone (+91...)" className="px-3 py-2 border border-slate-300 rounded-lg" />
              <input type="number" value={convForm.revenue_minor} onChange={(e) => setConvForm({ ...convForm, revenue_minor: e.target.value })} placeholder="Revenue (minor units / paise)" className="px-3 py-2 border border-slate-300 rounded-lg" />
            </div>
            <button type="submit" className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold">Evaluate &amp; Attribute Conversion</button>
          </form>
        </div>
      </div>
    </div>
  );
}
