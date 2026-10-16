import { waUiStorage } from "../utils/waUiStorage";
import { X } from "lucide-react";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API } from "../config/api";
import { clearLocalCache } from "../utils/waLocalCache";

// Edit any copy here (or pass a `template` prop to override per page).
export const WA_STATUS_TEMPLATE = {
  historyDefault: "Chat history and received attachments stay in this browser. Contacts are saved for use across your WhatsApp workspace.",
  historyCompact: "Chat history stays in this browser. Contacts are shared across your workspace.",
  cloudApiSender: "A Cloud API sender is configured for native customer buttons.",
  qrWebSender: "QR/Web sends numbered text menus. Configure Cloud API for native customer buttons.",
  manageSenders: "Manage senders",
  serverStorage: "Server conversation storage is enabled by your deployment configuration.",
  clearHistoryLabel: "Clear local history",
  clearHistoryConfirm: "Clear chat and attachment history stored in this browser? Shared contacts will remain.",
  clearedNotice: "Local chat and attachment cache cleared.",
  capabilitiesError: "Sender capabilities could not be checked. Refresh after connecting your account.",
  dismissLabel: "Dismiss",
};

const DISMISS_KEY = "wa_status_notice_dismissed";

export default function WAStorageAndSenders({ settings = false, compact = false, template = {} }) {
  const T = { ...WA_STATUS_TEMPLATE, ...template };
  const [capabilities, setCapabilities] = useState(null);
  const [notice, setNotice] = useState("");
  const [dismissed, setDismissed] = useState(() => waUiStorage.getItem(DISMISS_KEY) === "1");
  useEffect(() => {
    axios.get(`${API}/api/whatsapp/interactive-capabilities`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(({ data }) => setCapabilities(data)).catch(() => setNotice(T.capabilitiesError));
  }, []);
  useEffect(() => {
    if (!notice) return;
    setDismissed(false);
    waUiStorage.removeItem(DISMISS_KEY);
  }, [notice]);
  const dismiss = () => {
    setDismissed(true);
    waUiStorage.setItem(DISMISS_KEY, "1");
  };
  if (dismissed) return null;
  return <div className="hl-card relative p-3 pr-9 text-sm space-y-2" role="status">
    <button type="button" aria-label={T.dismissLabel} onClick={dismiss} className="absolute top-2 right-2 p-1 rounded-md text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[var(--color-paper-2)] transition-colors">
      <X size={16} />
    </button>
    <p>{compact ? T.historyCompact : T.historyDefault}</p>
    {capabilities && <p>{capabilities.nativeButtons ? T.cloudApiSender : T.qrWebSender} <Link to="/whatsapp/accounts" className="underline font-semibold">{T.manageSenders}</Link></p>}
    {capabilities?.serverChatStorage && <p>{T.serverStorage}</p>}
    {settings && <button type="button" className="hl-btn-secondary px-3 py-2" onClick={async () => {
      if (!window.confirm(T.clearHistoryConfirm)) return;
      await clearLocalCache();
      const keys = Array.from({ length: waUiStorage.length }, (_, i) => waUiStorage.key(i));
      for (const key of keys) if (key?.startsWith("wa_chat_messages_") || key === "wa_active_chat") waUiStorage.removeItem(key);
      setNotice(T.clearedNotice);
    }}>{T.clearHistoryLabel}</button>}
    {notice && <p>{notice}</p>}
  </div>;
}
