import { waUiStorage } from "../utils/waUiStorage";
import { X, HardDrive, Download, Trash2, Database, ShieldCheck, RefreshCw } from "lucide-react";
import React, { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API } from "../config/api";
import { clearLocalCache } from "../utils/waLocalCache";
import {
  getLocalStorageUsage,
  clearLocalChatStorage,
  exportLocalChatData
} from "../services/whatsappLocalMessageStore";

export const WA_STATUS_TEMPLATE = {
  historyDefault: "Chat messages & attachments stay in this device's IndexedDB. Operational CRM data is securely synced with your cloud database.",
  historyCompact: "Chat history stays in this device's local database. CRM records are synced with cloud.",
  cloudApiSender: "A Cloud API sender is configured for native customer buttons.",
  qrWebSender: "QR/Web sends numbered text menus. Configure Cloud API for native customer buttons.",
  manageSenders: "Manage senders",
  serverStorage: "Server conversation storage is enabled by your deployment configuration.",
  clearHistoryLabel: "Clear Device Cache",
  clearHistoryConfirm: "Clear all local WhatsApp messages and media stored in this browser? CRM contacts, statuses, and tags in the cloud will remain intact.",
  clearedNotice: "Device chat and attachment cache cleared successfully.",
  capabilitiesError: "Sender capabilities could not be checked. Refresh after connecting your account.",
  dismissLabel: "Dismiss",
};

const DISMISS_KEY = "wa_status_notice_dismissed";

export default function WAStorageAndSenders({ settings = false, compact = false, template = {} }) {
  const T = { ...WA_STATUS_TEMPLATE, ...template };
  const [capabilities, setCapabilities] = useState(null);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState(() => waUiStorage.getItem(DISMISS_KEY) === "1");
  const [usage, setUsage] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const loadUsage = useCallback(async () => {
    try {
      const stats = await getLocalStorageUsage();
      setUsage(stats);
    } catch (_) { }
  }, []);

  useEffect(() => {
    loadUsage();
    axios
      .get(`${API}/api/whatsapp/interactive-capabilities`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      })
      .then(({ data }) => setCapabilities(data))
      .catch(() => setNotice(T.capabilitiesError));
  }, [loadUsage, T.capabilitiesError]);

  useEffect(() => {
    if (!notice) return;
    setDismissed(false);
    waUiStorage.removeItem(DISMISS_KEY);
  }, [notice]);

  const dismiss = () => {
    setDismissed(true);
    waUiStorage.setItem(DISMISS_KEY, "1");
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const blob = await exportLocalChatData();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `socia-whatsapp-local-history-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (err) {
      alert("Failed to export chat data: " + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm(T.clearHistoryConfirm)) return;
    try {
      setIsClearing(true);
      await clearLocalChatStorage();
      await clearLocalCache();
      const keys = Array.from({ length: waUiStorage.length }, (_, i) => waUiStorage.key(i));
      for (const key of keys) {
        if (key?.startsWith("wa_chat_messages_") || key === "wa_active_chat") {
          waUiStorage.removeItem(key);
        }
      }
      setNotice(T.clearedNotice);
      await loadUsage();
    } catch (err) {
      setNotice("Failed to clear local cache: " + err.message);
    } finally {
      setIsClearing(false);
    }
  };

  if (dismissed && !settings) return null;

  return (
    <div className="hl-card relative p-3 text-xs space-y-2.5 max-w-sm rounded-xl shadow-lg border border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)]" role="status">
      {!settings && (
        <button
          type="button"
          aria-label={T.dismissLabel}
          onClick={dismiss}
          className="absolute top-2 right-2 p-1 rounded-md text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-colors"
        >
          <X size={14} />
        </button>
      )}

      <div className="flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400">
        <ShieldCheck size={16} />
        <span>Local-First Device Chat Storage</span>
      </div>

      <p className="text-[11px] text-[var(--color-ink-2)] leading-relaxed">
        {compact ? T.historyCompact : T.historyDefault}
      </p>

      {usage && (
        <div className="bg-[var(--color-paper-2)] p-2 rounded-lg space-y-1 font-mono text-[10px] text-[var(--color-ink-2)]">
          <div className="flex justify-between items-center">
            <span>Stored Messages:</span>
            <span className="font-bold text-[var(--color-ink)]">{usage.messageCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Cached Media:</span>
            <span className="font-bold text-[var(--color-ink)]">{usage.mediaCount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between items-center">
            <span>Storage Usage:</span>
            <span className="font-bold text-[var(--color-ink)]">{usage.usageMB} MB ({usage.percentUsed}%)</span>
          </div>
        </div>
      )}

      {capabilities && (
        <p className="text-[11px] text-[var(--color-ink-2)]">
          {capabilities.nativeButtons ? T.cloudApiSender : T.qrWebSender}{" "}
          <Link to="/whatsapp/accounts" className="underline font-semibold text-emerald-600 hover:text-emerald-700">
            {T.manageSenders}
          </Link>
        </p>
      )}

      {capabilities?.serverChatStorage && (
        <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">{T.serverStorage}</p>
      )}

      <div className="flex items-center gap-2 pt-1 border-t border-[var(--color-rule)]">
        <button
          type="button"
          onClick={handleExport}
          disabled={isExporting}
          className="flex-1 py-1 px-2 rounded-lg bg-[var(--color-paper-2)] hover:bg-[var(--color-paper-3)] border border-[var(--color-rule)] text-[11px] font-semibold flex items-center justify-center gap-1 transition"
          title="Export chat history as JSON"
        >
          <Download size={12} />
          <span>{isExporting ? "Exporting..." : "Export"}</span>
        </button>

        <button
          type="button"
          onClick={handleClear}
          disabled={isClearing}
          className="flex-1 py-1 px-2 rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-[11px] font-semibold flex items-center justify-center gap-1 transition"
          title="Clear device IndexedDB cache"
        >
          <Trash2 size={12} />
          <span>{isClearing ? "Clearing..." : "Clear"}</span>
        </button>
      </div>

      {notice && (
        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">{notice}</p>
      )}
    </div>
  );
}
