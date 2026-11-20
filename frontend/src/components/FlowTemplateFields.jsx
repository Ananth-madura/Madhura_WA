import React, { useEffect, useState, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { RefreshCw, ExternalLink, Plus, AlertCircle, CheckCircle2, FileText } from "lucide-react";
import { API } from "../config/api";

const QUICK_VARS = [
  "{{customer.name}}",
  "{{customer.phone}}",
  "{{customer.email}}",
  "{{service}}",
  "{{amount}}",
  "{{invoice_no}}",
  "{{due_date}}",
];

function extractPlaceholderIndexes(body = "") {
  const found = new Set();
  const re = /\{\{(\d+)\}\}/g;
  let m;
  while ((m = re.exec(String(body || "")))) {
    const idx = Number(m[1]);
    if (idx > 0 && idx <= 20) found.add(idx);
  }
  return Array.from(found).sort((a, b) => a - b);
}

export default function FlowTemplateFields({ config = {}, onChange }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("token");
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const { data } = await axios.get(`${API}/api/wa/templates`, { headers });
      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.templates)
        ? data.templates
        : [];
      setTemplates(list);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Templates could not be loaded from /whatsapp/templates. Retry or check your connection."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter(
      (t) =>
        String(t.name || "").toLowerCase().includes(q) ||
        String(t.body || "").toLowerCase().includes(q) ||
        String(t.category || "").toLowerCase().includes(q)
    );
  }, [templates, search]);

  const approvedTemplates = useMemo(
    () => filtered.filter((t) => String(t.meta_status || "").toUpperCase() === "APPROVED"),
    [filtered]
  );
  const otherTemplates = useMemo(
    () => filtered.filter((t) => String(t.meta_status || "").toUpperCase() !== "APPROVED"),
    [filtered]
  );

  const selectedTemplate = useMemo(
    () =>
      templates.find((t) => String(t.id) === String(config.template_id)) ||
      templates.find((t) => config.template_name && t.name === config.template_name) ||
      null,
    [templates, config.template_id, config.template_name]
  );

  const placeholderIndexes = useMemo(
    () => extractPlaceholderIndexes(selectedTemplate?.body || ""),
    [selectedTemplate]
  );

  const paramsList = Array.isArray(config.parameters) ? config.parameters : [];

  const handleSelectTemplate = (e) => {
    const val = e.target.value;
    if (!val) {
      onChange({
        template_id: null,
        template_name: "",
        template_language: "en",
        category: "",
        waba_id: null,
      });
      return;
    }
    const found = templates.find((t) => String(t.id) === String(val));
    if (!found) return;
    const expectedVars = extractPlaceholderIndexes(found.body || "");
    const nextParams =
      expectedVars.length > 0
        ? expectedVars.map((_, idx) => paramsList[idx] || "")
        : paramsList;
    onChange({
      template_id: Number(found.id),
      template_name: found.name || "",
      template_language: found.language || "en",
      category: found.category || "UTILITY",
      waba_id: found.waba_id || null,
      parameters: nextParams,
    });
  };

  const updateParamAt = (index, value) => {
    const maxLen = Math.max(placeholderIndexes.length, paramsList.length, index + 1);
    const next = Array.from({ length: maxLen }, (_, i) => (i === index ? value : paramsList[i] || ""));
    onChange({ parameters: next });
  };

  const renderedPreview = useMemo(() => {
    let body = String(selectedTemplate?.body || "");
    if (!body) return "";
    placeholderIndexes.forEach((varNum, idx) => {
      const val = paramsList[idx] || `{{${varNum}}}`;
      body = body.replaceAll(`{{${varNum}}}`, val);
    });
    return body;
  }, [selectedTemplate, placeholderIndexes, paramsList]);

  const isApproved = String(selectedTemplate?.meta_status || "").toUpperCase() === "APPROVED";

  return (
    <div className="space-y-3">
      {/* Header + Live Sync & Direct Links to /whatsapp/templates */}
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className="text-xs font-bold text-slate-800 inline-flex items-center gap-1">
          <FileText className="w-3.5 h-3.5 text-emerald-700" aria-hidden="true" />
          WhatsApp Template ({templates.length})
        </span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={fetchTemplates}
            disabled={loading}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-50 text-[11px] font-medium text-slate-700 cursor-pointer disabled:cursor-not-allowed"
            title="Reload templates from /whatsapp/templates"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            Sync
          </button>
          <Link
            to="/whatsapp/templates/create"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-[11px] font-semibold text-emerald-800 cursor-pointer"
          >
            <Plus className="w-3 h-3" /> New
          </Link>
          <Link
            to="/whatsapp/templates"
            className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-[11px] font-medium text-slate-800 cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" /> Library
          </Link>
        </div>
      </div>

      {/* Quick filter when tenant has many templates */}
      {templates.length > 6 && (
        <input
          type="text"
          aria-label="Filter templates"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search templates by name, category or text..."
          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900 placeholder:text-slate-500"
        />
      )}

      {/* Template Selector populated directly from /whatsapp/templates */}
      <div>
        <label htmlFor="flow-template-select" className="block text-xs font-semibold text-slate-700 mb-1">
          Choose template from /whatsapp/templates
        </label>
        <select
          id="flow-template-select"
          className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900 cursor-pointer"
          value={config.template_id || ""}
          onChange={handleSelectTemplate}
        >
          <option value="">
            {loading
              ? "Loading templates..."
              : templates.length === 0
              ? "No templates found yet (click New or Library)"
              : "Select a template"}
          </option>
          {approvedTemplates.length > 0 && (
            <optgroup label={`Meta Approved (${approvedTemplates.length})`}>
              {approvedTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.language || "en"} | {t.category || "UTILITY"})
                </option>
              ))}
            </optgroup>
          )}
          {otherTemplates.length > 0 && (
            <optgroup label={`Other Library Templates (${otherTemplates.length})`}>
              {otherTemplates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} [{t.meta_status || "LOCAL"}] ({t.category || "MARKETING"})
                </option>
              ))}
            </optgroup>
          )}
        </select>
      </div>

      {/* Selected Template Live Preview & Status */}
      {selectedTemplate && (
        <div className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[11px]">
            <span className="font-semibold text-slate-800">
              {selectedTemplate.category || "TEMPLATE"} | {selectedTemplate.language || "en"}
            </span>
            {isApproved ? (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-900 font-semibold">
                <CheckCircle2 className="w-3 h-3" /> Meta Approved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-semibold">
                <AlertCircle className="w-3 h-3" /> {selectedTemplate.meta_status || "Local Draft"}
              </span>
            )}
          </div>
          {selectedTemplate.header_value && (
            <div className="text-[11px] font-semibold text-slate-900">{selectedTemplate.header_value}</div>
          )}
          <div className="text-xs text-slate-800 whitespace-pre-wrap bg-white p-2 rounded border border-slate-200">
            {renderedPreview || selectedTemplate.body}
          </div>
          {selectedTemplate.footer && (
            <div className="text-[11px] text-slate-600">{selectedTemplate.footer}</div>
          )}
          {!isApproved && (
            <p className="text-[11px] text-amber-900">
              Meta Cloud API requires APPROVED status to deliver outside the 24-hour customer service window. Submit and sync approval in{" "}
              <Link to="/whatsapp/templates" className="underline font-semibold">
                Templates
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {/* Dynamic Parameter Mapping: individual fields when {{1}}..{{n}} detected, else multi-line editor */}
      {placeholderIndexes.length > 0 ? (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-slate-700">
            Template Variable Mapping ({placeholderIndexes.length} parameter{placeholderIndexes.length > 1 ? "s" : ""})
          </div>
          {placeholderIndexes.map((varNum, idx) => (
            <div key={varNum} className="space-y-1">
              <label htmlFor={`tpl-param-${varNum}`} className="block text-[11px] font-semibold text-slate-700">
                {`{{${varNum}}}`} value
              </label>
              <input
                id={`tpl-param-${varNum}`}
                type="text"
                value={paramsList[idx] || ""}
                onChange={(e) => updateParamAt(idx, e.target.value)}
                placeholder={`Value or variable for {{${varNum}}} (e.g. {{customer.name}})`}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg bg-white text-slate-900"
              />
              <div className="flex flex-wrap gap-1">
                {QUICK_VARS.slice(0, 5).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => updateParamAt(idx, tag)}
                    className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-emerald-50 text-[10px] font-mono text-slate-700 hover:text-emerald-800 cursor-pointer"
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div>
          <label htmlFor="flow-template-params" className="block text-xs font-semibold text-slate-700 mb-1">
            Body parameters (one per line, optional)
          </label>
          <textarea
            id="flow-template-params"
            rows={3}
            className="w-full border border-slate-300 rounded-lg p-2 text-xs bg-white text-slate-900"
            value={paramsList.join("\n")}
            onChange={(e) =>
              onChange({ parameters: e.target.value ? e.target.value.split("\n") : [] })
            }
            placeholder={"{{customer.name}}\n{{invoice_no}}"}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg p-2">
          {error}
        </p>
      )}
    </div>
  );
}
