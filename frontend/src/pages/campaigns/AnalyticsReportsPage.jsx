import { useEffect, useState, useCallback } from "react";
import { Download, Plus, CheckCircle2, BarChart3, RefreshCw, AlertCircle } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi, formatMinorCurrency } from "../../api/campaigns";

export default function AnalyticsReportsPage() {
  const [overview, setOverview] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportName, setReportName] = useState("");
  const [convForm, setConvForm] = useState({ entity_type: "order", entity_id: "", phone: "", revenue_minor: "" });
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [ov, reps] = await Promise.all([
        campaignApi.getOverview(),
        campaignApi.listReports().catch(() => []),
      ]);
      setOverview(ov);
      setReports(Array.isArray(reps) ? reps : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveReport = async (e) => {
    e.preventDefault();
    if (!reportName.trim()) return;
    setError("");
    setNotice("");
    try {
      await campaignApi.createReport({
        name: reportName.trim(),
        metrics: ["submitted", "delivered", "read", "replies", "conversions", "revenue"],
        dimensions: ["campaign", "category"],
      });
      setReportName("");
      setNotice("Custom report definition saved.");
      load();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    }
  };

  const handleRecordConversion = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    try {
      const res = await campaignApi.recordConversion({
        ...convForm,
        revenue_minor: Number(convForm.revenue_minor || 0),
      });
      setNotice(res.attributed ? `Verified conversion attributed to campaign #${res.campaign_id}.` : `Not attributed: ${res.reason}`);
      setConvForm({ ...convForm, entity_id: "", phone: "", revenue_minor: "" });
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
  const byCategory = Array.isArray(overview?.breakdowns?.by_category) ? overview.breakdowns.by_category : [];

  return (
    <div className="hl-page p-4 sm:p-5 space-y-4">
      <CampaignSubNav />

      {/* Native /whatsapp Command Bar */}
      <div className="hl-commandbar hl-card flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0" style={{ background: "#202C52", color: "#FFFFFF" }}>
            <BarChart3 size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="hl-title m-0">Campaign Analytics, Attribution &amp; Reports</h1>
              <span className="hl-badge text-xs font-bold px-2.5 py-0.5" style={{ background: "#FFF4CC", color: "#202C52", border: "1px solid #FCBD16" }}>
                {ov.roi_percent || 0}% ROI
              </span>
            </div>
            <p className="hl-subtitle m-0 mt-1 text-xs sm:text-sm">
              Traceable Meta delivery rates, verified order/deal revenue attribution, custom reports, and CSV exports.
            </p>
          </div>
        </div>

        <div className="hl-actions flex flex-wrap items-center gap-2">
          <button type="button" onClick={exportCsv} className="hl-btn-primary inline-flex items-center gap-1.5 px-4 text-xs font-semibold cursor-pointer">
            <Download className="w-4 h-4" /> Export CSV Report
          </button>
          <button type="button" onClick={load} className="hl-btn-secondary inline-flex items-center gap-1.5 px-3 text-xs font-semibold cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#FEE4E2", border: "1px solid #FDA29B", color: "#B42318" }}>
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}
      {notice && (
        <div className="p-3 rounded-lg text-xs font-medium flex items-center gap-2" style={{ background: "#D1FADF", border: "1px solid #A6F4C5", color: "#16803C" }}>
          <CheckCircle2 className="w-4 h-4 shrink-0" /> {notice}
        </div>
      )}

      {/* KPI Strip */}
      <div className="hl-kpis">
        {[
          { label: "Delivered Rate", value: `${ov.delivered_rate || 0}%`, sub: defs.delivered_rate || "Delivered / (Delivered + Failed)" },
          { label: "Read Rate", value: `${ov.read_rate || 0}%`, sub: defs.read_rate || "Read / Delivered" },
          { label: "Reply Rate", value: `${ov.reply_rate || 0}%`, sub: defs.reply_rate || "Unique Replies / Delivered" },
          { label: "Conversion Rate", value: `${ov.conversion_rate || 0}%`, sub: `${ov.conversions || 0} verified conversions` },
          { label: "Attributed Revenue", value: formatMinorCurrency(ov.attributed_revenue_minor || 0), sub: `Est. Cost: ${formatMinorCurrency(ov.estimated_cost_minor || 0)}` },
        ].map((k) => (
          <div key={k.label} className="hl-kpi">
            <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "#667085" }}>{k.label}</div>
            <div className="text-xl font-bold mt-1" style={{ color: "#202C52", fontFamily: "var(--font-display)" }}>{k.value}</div>
            <div className="text-[11px] mt-1" style={{ color: "#667085" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Category Performance Chart + Table */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="hl-card p-5">
          <div className="text-xs font-bold uppercase mb-3" style={{ color: "#202C52" }}>Funnel Comparison by Category</div>
          {byCategory.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-xs" style={{ color: "#667085" }}>
              No campaign delivery data recorded yet.
            </div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byCategory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e7ed" />
                  <XAxis dataKey="category" tick={{ fontSize: 11, fill: "#202C52" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#667085" }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="submitted" name="Submitted" fill="#202C52" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="delivered" name="Delivered" fill="#16803C" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="conversions" name="Conversions" fill="#FCBD16" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="hl-card overflow-hidden">
          <div className="px-4 py-3 border-b text-xs font-bold uppercase" style={{ borderColor: "#E4E7ED", color: "#202C52" }}>
            Category Financial &amp; Delivery Breakdown
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead style={{ background: "#F7F8FA", borderBottom: "1px solid #E4E7ED", color: "#202C52" }} className="text-left uppercase font-bold">
                <tr>
                  <th className="px-4 py-2.5">Category</th>
                  <th className="px-4 py-2.5">Sub / Del</th>
                  <th className="px-4 py-2.5">Replies / Conv</th>
                  <th className="px-4 py-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "#F1F3F7" }}>
                {byCategory.length === 0 ? (
                  <tr><td colSpan={4} className="px-4 py-8 text-center" style={{ color: "#667085" }}>No category rows yet.</td></tr>
                ) : byCategory.map((r) => (
                  <tr key={r.category} className="hover:bg-[#FAFAFA]">
                    <td className="px-4 py-2.5 font-bold" style={{ color: "#202C52" }}>{r.category}</td>
                    <td className="px-4 py-2.5" style={{ color: "#202C52" }}>{r.submitted} / {r.delivered}</td>
                    <td className="px-4 py-2.5" style={{ color: "#202C52" }}>{r.replies} / {r.conversions}</td>
                    <td className="px-4 py-2.5 text-right font-bold" style={{ color: "#16803C" }}>{formatMinorCurrency(r.revenue_minor || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Custom Reports & Verified Attribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <form onSubmit={handleSaveReport} className="hl-card p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Custom Report Builder</h2>
          <div className="flex gap-2">
            <input
              value={reportName}
              onChange={(e) => setReportName(e.target.value)}
              placeholder="Report name (e.g. Monthly ROI by Sender)"
              className="hl-input flex-1 px-3 py-2"
            />
            <button type="submit" className="hl-btn-primary inline-flex items-center gap-1 px-4 font-semibold cursor-pointer">
              <Plus className="w-3.5 h-3.5" /> Save
            </button>
          </div>
          <div className="space-y-2 pt-1">
            {reports.length === 0 ? (
              <div style={{ color: "#667085" }}>No custom reports saved yet.</div>
            ) : reports.map((r) => (
              <div key={r.id} className="p-2.5 rounded-lg border flex justify-between" style={{ background: "#FAFAFA", borderColor: "#E4E7ED" }}>
                <span className="font-bold" style={{ color: "#202C52" }}>{r.name}</span>
                <span style={{ color: "#667085" }}>{(r.metrics || []).join(", ")}</span>
              </div>
            ))}
          </div>
        </form>

        <form onSubmit={handleRecordConversion} className="hl-card p-5 space-y-3 text-xs">
          <h2 className="text-sm font-bold m-0" style={{ color: "#202C52" }}>Record Verified Conversion (Attribution Check)</h2>
          <div className="grid grid-cols-2 gap-2.5">
            <select value={convForm.entity_type} onChange={(e) => setConvForm({ ...convForm, entity_type: e.target.value })} className="hl-select px-3 py-2 bg-white cursor-pointer">
              <option value="order">Verified Order</option>
              <option value="payment">Completed Payment</option>
              <option value="deal">Won Deal</option>
              <option value="appointment">Booked Appointment</option>
            </select>
            <input required value={convForm.entity_id} onChange={(e) => setConvForm({ ...convForm, entity_id: e.target.value })} placeholder="Reference ID (e.g. ORD-101)" className="hl-input px-3 py-2" />
            <input required value={convForm.phone} onChange={(e) => setConvForm({ ...convForm, phone: e.target.value })} placeholder="Customer Phone (+91...)" className="hl-input px-3 py-2" />
            <input type="number" value={convForm.revenue_minor} onChange={(e) => setConvForm({ ...convForm, revenue_minor: e.target.value })} placeholder="Revenue (minor units / paise)" className="hl-input px-3 py-2" />
          </div>
          <button type="submit" className="hl-btn-primary px-4 font-semibold cursor-pointer">
            Evaluate &amp; Attribute Conversion
          </button>
        </form>
      </div>
    </div>
  );
}
