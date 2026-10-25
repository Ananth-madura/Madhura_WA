import { useEffect, useState } from "react";
import axios from "axios";
import socket from "../socket/socket";
import { API } from "../config/api";
import { localCacheOwner, writeLocalMessages, readLocalMedia, writeLocalMedia } from "../utils/waLocalCache";

// Keep device history while the user is on any workspace page, including Contacts/Accounts.
export default function useWALocalInbox() {
  const [warning, setWarning] = useState("");
  useEffect(() => {
    const active = new Map();
    const report = () => setWarning("Local chat storage is unavailable or full. Free device space or clear local history in Accounts.");
    const receive = (event) => {
      const owner = localCacheOwner(), message = event?.message;
      if (!message?.id || (event.sessionKey && String(event.sessionKey) !== String(JSON.parse(localStorage.getItem("user") || "null")?.id))) return;
      const chatId = event.chatId || `${event.phone}@c.us`;
      writeLocalMessages(chatId, [message], owner).catch(report);
      if (localStorage.getItem("wa_auto_cache_media") !== "1" || message.isMe || !message.hasMedia) return;
      const key = `${chatId}:${message.id}`;
      if (active.has(key)) return;
      const task = (async () => {
        if ((await readLocalMedia(key, owner))?.data) return;
        const query = new URLSearchParams({ ...(message.serializedId ? { serializedId: message.serializedId } : {}), ...(message.cloudMediaId ? { cloudMediaId: message.cloudMediaId } : {}) });
        const { data } = await axios.get(`${API}/api/whatsapp/chat/${encodeURIComponent(chatId)}/media/${encodeURIComponent(message.id)}?${query}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
        if (data?.data) await writeLocalMedia(key, data, owner);
      })().catch((error) => setWarning(error.response?.data?.error || "An attachment could not be cached locally. Reconnect your sender or retry it in the chat.")).finally(() => active.delete(key));
      active.set(key, task);
    };
    socket.on("wa_message_received", receive);
    socket.on("wa_message_sent", receive);
    return () => { socket.off("wa_message_received", receive); socket.off("wa_message_sent", receive); };
  }, []);
  return warning;
}
