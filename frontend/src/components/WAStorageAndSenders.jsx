import { waUiStorage } from "../utils/waUiStorage";
import React, { useEffect, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { API } from "../config/api";
import { clearLocalCache } from "../utils/waLocalCache";
export default function WAStorageAndSenders({ settings = false, compact = false }) {
  const [capabilities, setCapabilities] = useState(null);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    axios.get(`${API}/api/whatsapp/interactive-capabilities`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } })
      .then(({ data }) => setCapabilities(data)).catch(() => setNotice("Sender capabilities could not be checked. Refresh after connecting your account."));
  }, []);
  return <div className="hl-card p-3 text-sm space-y-2" role="status">
    <p>{compact ? "Chat history stays in this browser. Contacts are shared across your workspace." : "Chat history and received attachments stay in this browser. Contacts are saved for use across your WhatsApp workspace."}</p>
    {capabilities && <p>{capabilities.nativeButtons ? "A Cloud API sender is configured for native customer buttons." : "QR/Web sends numbered text menus. Configure Cloud API for native customer buttons."} <Link to="/whatsapp/accounts" className="underline font-semibold">Manage senders</Link></p>}
    {capabilities?.serverChatStorage && <p>Server conversation storage is enabled by your deployment configuration.</p>}
    {settings && <button type="button" className="hl-btn-secondary px-3 py-2" onClick={async () => {
      if (!window.confirm("Clear chat and attachment history stored in this browser? Shared contacts will remain.")) return;
      await clearLocalCache();
      const keys = Array.from({ length: waUiStorage.length }, (_, i) => waUiStorage.key(i));
      for (const key of keys) if (key?.startsWith("wa_chat_messages_") || key === "wa_active_chat") waUiStorage.removeItem(key);
      setNotice("Local chat and attachment cache cleared.");
    }}>Clear local history</button>}
    {notice && <p>{notice}</p>}
  </div>;
}
