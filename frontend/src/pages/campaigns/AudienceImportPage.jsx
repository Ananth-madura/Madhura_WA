import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";
import { Upload, CheckCircle2, AlertCircle, Download, ArrowRight } from "lucide-react";
import CampaignSubNav from "./CampaignSubNav";
import { campaignApi } from "../../api/campaigns";

export default function AudienceImportPage() {
  const [rows, setRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [filename, setFilename] = useState("");
  const [mapping, setMapping] = useState({ phone: "", name: "", email: "", tags: "" });
  const [duplicatePolicy, setDuplicatePolicy] = useState("skip");
  const [consentEnabled, setConsentEnabled] = useState(false);
  const [consentWordingCol, setConsentWordingCol] = useState("");
  const [consentWordingStatic, setConsentWordingStatic] = useState("");
  const [segmentName, setSegmentName] = useState("");
  const [result, setResult] = useState(null);
  const [imports, setImports] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const loadImports = () => campaignApi.listImports().then((d) => setImports(Array.isArray(d) ? d : [])).catch(() => {});
  useEffect(() => { loadImports(); }, []);

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setFilename(file.name);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const parsed = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const cols = parsed.length ? Object.keys(parsed[0]) : [];
      setRows(parsed);
      setHeaders(cols);
      setMapping({
        phone: cols.find((c) => /phone|mobile|whatsapp/i.test(c)) || cols[0] || "",
        name: cols.find((c) => /name/i.test(c)) || "",
        email: cols.find((c) => /email/i.test(c)) || "",
        tags: cols.find((c) => /tag/i.test(c)) || "",
      });
    } catch (err) {
      setError(`Could not parse file: ${err.message}`);
    }
  };

  const handleImport = async () => {
    if (!rows.length || !mapping.phone) {
      setError("Upload a CSV/XLSX file and map the Phone column.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await campaignApi.importAudience({
        filename: filename || "upload.csv",
        fileType: filename.endsWith(".xlsx") ? "xlsx" : "csv",
        rows,
        columnMapping: mapping,
        duplicatePolicy,
        createStaticSegmentName: segmentName.trim() || null,
        consentMapping: consentEnabled
          ? {
              enabled: true,
              purpose: "marketing",
              wording_col: consentWordingCol || null,
              captured_wording: consentWordingStatic || null,
              source: `import:${filename}`,
            }
          : null,
      });
      setResult(res);
      loadImports();
    } catch (err) {
      setError(err.response?.data?.error || err.message);
    } finally {
      setBusy(false);
    }
  };

  const downloadErrors = async (importId) => {
    const report = await campaignApi.getImportReport(importId);
    const csvLines = ["row_number,status,error_code,error_message"];
    for (const r of report.error_rows || []) {
      csvLines.push(`${r.row_number},${r.status},${r.error_code || ""},${JSON.stringify(r.error_message || "")}`);
    }
    const blob = new Blob([csvLines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `import_${importId}_errors.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <CampaignSubNav />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">CSV &amp; XLSX Audience Import Center</h1>
          <p className="text-sm text-slate-600">International phone normalization, duplicate handling, and strict opt-out preservation (imports never silently re-enable revoked consent).</p>
        </div>

        {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2"><AlertCircle className="w-4 h-4" />{error}</div>}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-sm space-y-1">
            <div className="font-semibold flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Import #{result.id} Completed</div>
            <div className="text-xs">
              Total: {result.total_rows} · Created: {result.created_count} · Updated: {result.updated_count} · Skipped: {result.skipped_count} · Invalid: {result.invalid_count} · Duplicates: {result.duplicate_count} · Consent Rejected: {result.consent_failed_count}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              {result.segment_id && (
                <Link to={`/whatsapp/campaigns/create?segment_id=${result.segment_id}`} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold">
                  Launch Campaign with Imported Segment <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
              <Link to="/whatsapp/campaigns/consent" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white border border-emerald-300 text-emerald-800 text-xs font-semibold">
                Review Consent Records
              </Link>
            </div>
          </div>
        )}

        <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium cursor-pointer hover:bg-slate-800">
              <Upload className="w-4 h-4" /> Choose CSV / XLSX File
              <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            </label>
            {filename && <span className="text-xs text-slate-600">{filename} ({rows.length} rows detected)</span>}
          </div>

          {headers.length > 0 && (
            <div className="space-y-4 pt-3 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                {["phone", "name", "email", "tags"].map((field) => (
                  <div key={field}>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">{field} column {field === "phone" ? "*" : ""}</label>
                    <select value={mapping[field]} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                      <option value="">-- Unmapped --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Duplicate Policy</label>
                  <select value={duplicatePolicy} onChange={(e) => setDuplicatePolicy(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs bg-white">
                    <option value="skip">Skip existing duplicates</option>
                    <option value="update">Update existing contact fields</option>
                    <option value="merge">Merge tags &amp; custom fields</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Save Imported Contacts as Static Segment (Optional)</label>
                  <input value={segmentName} onChange={(e) => setSegmentName(e.target.value)} placeholder="e.g. Trade Show Leads Nov 2026" className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs" />
                </div>
              </div>

              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2">
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-800">
                  <input type="checkbox" checked={consentEnabled} onChange={(e) => setConsentEnabled(e.target.checked)} />
                  <span>Record Marketing Consent Evidence from Import (Requires real evidence; never overrides prior opt-outs)</span>
                </label>
                {consentEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <select value={consentWordingCol} onChange={(e) => setConsentWordingCol(e.target.value)} className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs bg-white">
                      <option value="">-- Evidence Wording Column --</option>
                      {headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <input value={consentWordingStatic} onChange={(e) => setConsentWordingStatic(e.target.value)} placeholder="Or captured form wording / URL reference" className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs" />
                  </div>
                )}
              </div>

              <button disabled={busy} onClick={handleImport} className="px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                {busy ? "Processing Import..." : `Confirm & Import ${rows.length} Rows`}
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 text-sm font-semibold text-slate-900">Import History</div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-left text-slate-600 uppercase">
              <tr><th className="px-4 py-2">File</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Imported / Total</th><th className="px-4 py-2">Invalid / Consent Fail</th><th className="px-4 py-2 text-right">Error Report</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {imports.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">No imports yet.</td></tr>
              ) : imports.map((imp) => (
                <tr key={imp.id}>
                  <td className="px-4 py-2.5 font-medium">{imp.filename}</td>
                  <td className="px-4 py-2.5">{imp.status}</td>
                  <td className="px-4 py-2.5">{imp.imported_count} / {imp.total_rows}</td>
                  <td className="px-4 py-2.5 text-rose-600">{imp.invalid_count} invalid · {imp.consent_failed_count} consent</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => downloadErrors(imp.id)} className="inline-flex items-center gap-1 text-slate-700 hover:text-emerald-700 font-medium">
                      <Download className="w-3.5 h-3.5" /> CSV
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
