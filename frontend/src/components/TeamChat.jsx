import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../config/axios";
import socket from "../socket/socket";
import { useEnterprise } from "../context/EnterpriseContext";
import { useAuth } from "../auth/AuthContext";
import TeamChatAvatar from "./TeamChatAvatar";
import {
  mergeMessages,
  isPastServerWindow,
  scopedChatStorage,
} from "../utils/teamChatIndexedDB";
import {
  ArrowLeft,
  Building2,
  Check,
  CheckCheck,
  Clock,
  Copy,
  Edit2,
  FileText,
  GitBranch,
  MessageSquare,
  MoreHorizontal,
  Paperclip,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Search,
  Send,
  Smile,
  Trash2,
  UserPlus,
  Users,
  X,
  PanelRight,
  Download,
  AlertCircle,
  ShieldCheck,
  BellOff,
} from "lucide-react";
import "../pages/team-chat.css";
import "../pages/whatsapp-employee.css";

const root = "/api/v2/team-chat";

const errorText = (error) =>
  error.response?.data?.message ||
  error.friendlyMessage ||
  (error.response
    ? "Team chat could not complete that action."
    : "The backend is unreachable. Check your connection; pending messages have not reached the server.");

const asDate = (value) => {
  if (!value) return null;
  const date = new Date(String(value).includes("T") ? value : String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
};

const timeLabel = (value) => {
  const date = asDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

const dayLabel = (value) => {
  const date = asDate(value);
  if (!date) return "";
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
};

const initials = (value) => {
  const words = String(value || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
};

const formatBytes = (bytes) => {
  if (!bytes || bytes <= 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
};

const newClientId = () =>
  `dev-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

const COMMON_EMOJIS = ["👍", "❤️", "😂", "🎉", "🔥", "🚀", "👏", "✅", "👀", "🙌"];

export default function TeamChat(props) {
  const { activeTenant } = useEnterprise();
  const { user } = useAuth();
  return <TeamChatWorkspace key={`${activeTenant?.id || 0}:${user?.id || 0}`} {...props} />;
}

function applyMessageUpdate(message, event, updates) {
  if (Number(message.id) !== Number(event.messageId) || Number(message.stateVersion || 0) > Number(event.stateVersion || message.stateVersion || 0)) return message;
  return { ...message, ...updates, stateVersion: event.stateVersion || message.stateVersion };
}

function TeamChatWorkspace({ branchId = null }) {
  const { activeTenant } = useEnterprise();
  const { user } = useAuth();
  const { applyDevicePolicy, readCachedMessages, writeCachedMessages, readOutbox, queueOutbox, removeOutbox, getCachedDraft, saveCachedDraft, reconcileAuthorizedChannels, updateCachedMessage, clearAllLocalDeviceData, getSyncState, setSyncState } = useMemo(() => scopedChatStorage(activeTenant?.id || 0, user?.id || 0), [activeTenant?.id, user?.id]);
  const [bootstrap, setBootstrap] = useState(null);
  const [channels, setChannels] = useState([]);
  const [members, setMembers] = useState([]);
  const [settings, setSettings] = useState({ crossBranchDm: false, retentionDays: 7, allowFileSharing: true });
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [visibleMessageLimit, setVisibleMessageLimit] = useState(200);
  const [text, setText] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, unread, direct, groups, branches
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [hasMore, setHasMore] = useState(false);
  const [beforeCursor, setBeforeCursor] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  // Modals & Panels
  const [showDetails, setShowDetails] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showBranchAdmin, setShowBranchAdmin] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showNotificationSettings, setShowNotificationSettings] = useState(false);
  const [notificationPreferences, setNotificationPreferences] = useState({ inApp: true, desktop: false, mentionsWhenMuted: false });
  const [notificationDraft, setNotificationDraft] = useState({ inApp: true, desktop: false, mentionsWhenMuted: false });
  const [devicePolicyDraft, setDevicePolicyDraft] = useState({ localCacheDays: 0, clearCacheOnLogout: false });
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingNotifications, setSavingNotifications] = useState(false);
  const [mentionSuppressed, setMentionSuppressed] = useState(false);

  // Forms & Interaction states
  const [peopleSearch, setPeopleSearch] = useState("");
  const [peopleResults, setPeopleResults] = useState([]);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [groupDesc, setGroupDesc] = useState("");
  const [selectedGroupMembers, setSelectedGroupMembers] = useState([]);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [branchPolicies, setBranchPolicies] = useState([]);
  const [policyOptions, setPolicyOptions] = useState({ teams: [], employees: [], roles: [] });
  const [savingPolicy, setSavingPolicy] = useState(null);
  const [orphanedGroups, setOrphanedGroups] = useState([]);
  const [replyTarget, setReplyTarget] = useState(null);
  const [editingTarget, setEditingTarget] = useState(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [failedUpload, setFailedUpload] = useState(null);
  const [attachmentPreview, setAttachmentPreview] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);
  const [messageActionsId, setMessageActionsId] = useState(null);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [channelMembersList, setChannelMembersList] = useState([]);
  const [typingUsers, setTypingUsers] = useState(new Map());
  const [newMessageCount, setNewMessageCount] = useState(0);
  const [messageSearch, setMessageSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [retentionCutoff, setRetentionCutoff] = useState(null);
  const [showAddMembers, setShowAddMembers] = useState(false);
  const [newMemberCandidateIds, setNewMemberCandidateIds] = useState([]);
  const [editingGroupInfo, setEditingGroupInfo] = useState(false);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupDesc, setEditGroupDesc] = useState("");

  const activeIdRef = useRef(null);
  const rootRef = useRef(null);
  const paneRef = useRef(null);
  const followRef = useRef(true);
  const fileInputRef = useRef(null);
  const groupAvatarInputRef = useRef(null);
  const composerRef = useRef(null);
  const draftBeforeEdit = useRef("");
  const typingTimerRef = useRef(null);
  const remoteTypingTimers = useRef(new Map());
  const aliveRef = useRef(true);
  const flushingRef = useRef(false);
  const retryDelay = useRef(1000);
  const allowedIdsRef = useRef(new Set());
  const channelsRef = useRef(channels);
  channelsRef.current = channels;
  const initialConversationOpened = useRef(false);
  useEffect(() => { aliveRef.current = true; return () => { aliveRef.current = false; activeIdRef.current = null; clearTimeout(typingTimerRef.current); }; }, []);
  useEffect(() => {
    const resize = () => {
      const root = rootRef.current;
      if (!root) return;
      const viewport = window.visualViewport;
      const height = (viewport?.height || window.innerHeight) + (viewport?.offsetTop || 0) - root.getBoundingClientRect().top - 16;
      root.style.setProperty("--tc-available-height", `${Math.max(160, height)}px`);
    };
    resize(); window.addEventListener("resize", resize); window.visualViewport?.addEventListener("resize", resize);
    return () => { window.removeEventListener("resize", resize); window.visualViewport?.removeEventListener("resize", resize); };
  }, []);
  useEffect(() => {
    const onStorageError = () => setNotice("Device storage is unavailable or full. Keep this tab open to preserve unsent work; history may not survive a refresh.");
    window.addEventListener("team_chat_storage_error", onStorageError);
    return () => window.removeEventListener("team_chat_storage_error", onStorageError);
  }, []);
  useEffect(() => {
    const onIdentityChanged = (event) => {
      if (event.key !== null && !["user", "token", "active_tenant_id"].includes(event.key)) return;
      allowedIdsRef.current.clear(); activeIdRef.current = null; setChannels([]); setMessages([]); setText("");
      window.location.reload();
    };
    window.addEventListener("storage", onIdentityChanged);
    return () => window.removeEventListener("storage", onIdentityChanged);
  }, []);

  const meId = Number(bootstrap?.me?.id) || 0;
  const retentionDays = settings.retentionDays || bootstrap?.retentionDays || 7;
  const hasBootstrap = Boolean(bootstrap);
  const peopleOptions = peopleSearch.trim() ? peopleResults : members;
  useEffect(() => {
    let cancelled = false;
    if (!peopleSearch.trim() || (!showNewDirect && !showCreateGroup && !showAddMembers)) { setPeopleLoading(false); return; }
    setPeopleLoading(true);
    const timer = setTimeout(async () => {
      try { const { data } = await api.get(`${root}/members`, { params: { q: peopleSearch } }); if (!cancelled) setPeopleResults(data.members || []); }
      catch (error) { if (!cancelled) { setPeopleResults([]); setError(errorText(error)); } }
      finally { if (!cancelled) setPeopleLoading(false); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [peopleSearch, showNewDirect, showCreateGroup, showAddMembers]);
  useEffect(() => {
    if (!hasBootstrap) return;
    const enforce = () => applyDevicePolicy(settings).catch(() => setNotice("Device history cleanup could not finish. Check browser storage."));
    const timer = setInterval(enforce, 60000);
    return () => clearInterval(timer);
  }, [hasBootstrap, settings, applyDevicePolicy]);
  useEffect(() => {
    const composer = composerRef.current;
    if (composer) { composer.style.height = "auto"; composer.style.height = `${Math.min(140, Math.max(38, composer.scrollHeight))}px`; }
  }, [text]);
  useEffect(() => {
    const close = (event) => {
      if (event.type === "keydown" && event.key !== "Escape") return;
      if (event.type === "pointerdown" && event.target.closest(".tc-emoji-control, .tc-message-actions-bar, .tc-message-more")) return;
      setShowEmojiPicker(false); setMessageActionsId(null);
      if (event.type === "keydown") setMentionSuppressed(true);
    };
    document.addEventListener("pointerdown", close); document.addEventListener("keydown", close);
    return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", close); };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try { const { data } = await api.get(`${root}/presence`); if (!cancelled) setOnlineUserIds(data.onlineUserIds || []); }
      catch (_) { if (!cancelled) setOnlineUserIds([]); }
    };
    if (online && hasBootstrap) refresh();
    const timer = setInterval(() => { if (online && hasBootstrap) refresh(); }, 15000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [online, hasBootstrap]);
  useEffect(() => {
    if (!showNewDirect && !showCreateGroup && !showBranchAdmin && !attachmentPreview && !showNotificationSettings) return;
    const previous = document.activeElement;
    const dialog = document.querySelector(".tc-modal");
    if (!dialog) return;
    dialog.setAttribute("role", "dialog"); dialog.setAttribute("aria-modal", "true");
    dialog.setAttribute("aria-label", dialog.querySelector("h3")?.textContent || "Team Inbox");
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea, select, a[href]')];
    (dialog.querySelector('input:not([type="checkbox"]), textarea') || focusable()[0])?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { setShowNewDirect(false); setShowCreateGroup(false); setShowBranchAdmin(false); setAttachmentPreview(null); setShowNotificationSettings(false); }
      if (event.key === "Tab") {
        const items = focusable(); const first = items[0]; const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    dialog.addEventListener("keydown", onKey);
    return () => { dialog.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [showNewDirect, showCreateGroup, showBranchAdmin, attachmentPreview, showNotificationSettings]);

  useEffect(() => {
    let cancelled = false;
    if (!activeId || !messageSearch.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const local = await readCachedMessages(activeId);
        const { data } = await api.get(`${root}/search`, { params: { q: messageSearch, channelId: activeId } });
        if (!cancelled && aliveRef.current) setSearchResults(mergeMessages(local.filter((message) => !message.isDeleted && message.body?.toLowerCase().includes(messageSearch.toLowerCase())), data.messages || []));
      } catch (error) { if (!cancelled) setError(errorText(error)); }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [messageSearch, activeId, readCachedMessages]);

  const downloadAttachment = async (attachment) => {
    try {
      const response = await api.get(attachment.fileUrl, { responseType: "blob" });
      if (!aliveRef.current) return;
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a"); link.href = url; link.download = attachment.fileName || "attachment"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { setError(errorText(error)); }
  };
  const previewAttachment = async (attachment) => {
    if (!attachment.mimeType?.startsWith("image/")) return downloadAttachment(attachment);
    try {
      const response = await api.get(attachment.fileUrl, { responseType: "blob" });
      if (!aliveRef.current) return;
      const url = URL.createObjectURL(response.data);
      setAttachmentPreview({ url, name: attachment.fileName });
    } catch (error) { setError(errorText(error)); }
  };
  useEffect(() => () => { if (attachmentPreview?.url) URL.revokeObjectURL(attachmentPreview.url); }, [attachmentPreview]);

  const activeChannel = useMemo(
    () => channels.find((c) => Number(c.id) === Number(activeId)) || null,
    [channels, activeId]
  );
  const groupRole = channelMembersList.find((member) => Number(member.id) === meId)?.groupRole;
  const canManageGroup = activeChannel?.kind === "group" && (bootstrap?.me?.isAdmin || ["owner", "admin"].includes(groupRole));
  const activePeer = activeChannel?.kind === "direct" ? activeChannel.participants?.find((person) => Number(person.id) !== meId) || channelMembersList.find((person) => Number(person.id) !== meId) : null;
  const peerDetails = members.find((person) => Number(person.id) === Number(activePeer?.id)) || activePeer;
  const mentionQuery = !editingTarget ? text.match(/@([^\s@]*)$/)?.[1] : undefined;
  const mentionCandidates = mentionQuery === undefined || mentionSuppressed ? [] : channelMembersList.filter((person) => Number(person.id) !== meId && person.name.toLowerCase().includes(mentionQuery.toLowerCase())).slice(0, 6);
  const chooseMention = (person) => { handleTextChange(text.replace(/@[^\s@]*$/, `@${person.name} `)); composerRef.current?.focus(); };

  /* ── Channel Filtering ─────────────────────────────────────────────────── */
  const filteredChannels = useMemo(() => {
    let list = [...channels].sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (asDate(b.lastMessage?.createdAt)?.getTime() || 0) - (asDate(a.lastMessage?.createdAt)?.getTime() || 0));
    if (filter === "archived") list = list.filter((c) => c.archived);
    else list = list.filter((c) => !c.archived);
    if (filter === "pinned") list = list.filter((c) => c.pinned);
    if (branchId) {
      list = list.filter((c) => !c.branchId || Number(c.branchId) === Number(branchId) || c.kind === "organization");
    }
    if (filter === "unread") list = list.filter((c) => Number(c.unread) > 0 || c.markedUnread);
    else if (filter === "direct") list = list.filter((c) => c.kind === "direct");
    else if (filter === "groups") list = list.filter((c) => c.kind === "group");
    else if (filter === "branches") list = list.filter((c) => c.kind === "branch" || c.kind === "organization");

    const term = search.trim().toLowerCase();
    if (!term) return list;

    return list.filter((c) => {
      const haystack = [
        c.name,
        c.branchName,
        c.lastMessage?.body,
        ...(c.participants || []).map((p) => p.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [channels, filter, search, branchId]);

  const grouped = useMemo(() => {
    const groups = { organization: [], branch: [], group: [], direct: [] };
    for (const c of filteredChannels) {
      (groups[c.kind] || groups.direct).push(c);
    }
    return groups;
  }, [filteredChannels]);

  /* ── Load Data ─────────────────────────────────────────────────────────── */
  const markRead = useCallback(async (channelId) => {
    try {
    await api.post(`${root}/channels/${channelId}/read`);
    if (!aliveRef.current) return;
    setChannels((prev) =>
      prev.map((c) => (Number(c.id) === Number(channelId) ? { ...c, unread: 0, markedUnread: false } : c))
    );
    } catch (error) { if (error.response && aliveRef.current) setError(errorText(error)); }
  }, []);

  const syncChannel = useCallback(async (channelId) => {
    const state = await getSyncState(channelId);
    let cursor = Number(state.cursor) || 0;
    let hasMore = true;
    while (hasMore && aliveRef.current && allowedIdsRef.current.has(Number(channelId))) {
      const { data } = await api.get(`${root}/channels/${channelId}/sync`, { params: { after: cursor }, timeout: 20000 });
      if (!aliveRef.current || !allowedIdsRef.current.has(Number(channelId))) return;
      await writeCachedMessages(channelId, data.messages || []);
      if (activeIdRef.current === Number(channelId)) {
        if (!followRef.current) setVisibleMessageLimit((limit) => limit + (data.messages || []).length);
        setMessages((previous) => mergeMessages(previous, data.messages || []).map((message) => ({ ...message, readBy: (data.readers || []).filter((reader) => Number(reader.userId) !== Number(message.senderId) && Number(reader.lastReadId) >= Number(message.id)).map((reader) => Number(reader.userId)) })));
        setRetentionCutoff(data.retentionCutoff);
      }
      cursor = Number(data.cursor) || cursor;
      await setSyncState(channelId, { cursor, retentionCutoff: data.retentionCutoff });
      hasMore = Boolean(data.hasMore);
    }
  }, [getSyncState, setSyncState, writeCachedMessages]);

  const loadBootstrap = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get(`${root}/bootstrap`, { timeout: 20000 });
      if (!aliveRef.current) return;
      const authorizedChannels = Array.isArray(data.channels) ? data.channels : [];
      allowedIdsRef.current = new Set(authorizedChannels.map((channel) => Number(channel.id)));
      if (activeIdRef.current && !allowedIdsRef.current.has(activeIdRef.current)) {
        activeIdRef.current = null;
        setActiveId(null); setMessages([]); setText(""); setShowDetails(false);
      }
      await applyDevicePolicy(data.settings || {});
      await reconcileAuthorizedChannels(authorizedChannels);
      if (!aliveRef.current) return;
      setBootstrap({
        me: data.me,
        tenantName: data.tenantName,
        canManageSettings: Boolean(data.canManageSettings),
        retentionDays: data.retentionDays || 7,
      });
      setChannels(authorizedChannels);
      setMembers(Array.isArray(data.members) ? data.members : []);
      setSettings(data.settings || { crossBranchDm: false, retentionDays: 7, allowFileSharing: true });
      setNotificationPreferences(data.notificationPreferences || { inApp: true, desktop: false, mentionsWhenMuted: false });
      setError("");
      return true;
    } catch (err) {
      if (!aliveRef.current) return;
      if ([401, 403].includes(err.response?.status)) { allowedIdsRef.current.clear(); setChannels([]); setMessages([]); setText(""); setActiveId(null); activeIdRef.current = null; }
      if (!silent) setError(errorText(err));
      return false;
    } finally {
      if (!silent) setLoading(false);
    }
  }, [reconcileAuthorizedChannels, applyDevicePolicy]);

  const loadChannelDetails = useCallback(async (channelId) => {
    try {
      const [membersRes, pinsRes] = await Promise.all([
        api.get(`${root}/channels/${channelId}/members`).catch(() => ({ data: { members: [] } })),
        api.get(`${root}/channels/${channelId}/pins`).catch(() => ({ data: { pins: [] } })),
      ]);
      if (!aliveRef.current || Number(channelId) !== activeIdRef.current) return;
      setChannelMembersList(membersRes.data?.members || []);
      setPinnedMessages(pinsRes.data?.pins || []);
    } catch (_) {}
  }, []);

  const openChannel = useCallback(
    async (channel) => {
      if (!channel) return;
      const id = Number(channel.id);
      if (!allowedIdsRef.current.has(id)) return;
      activeIdRef.current = id;
      setActiveId(id);
      setThreadLoading(true);
      setError("");
      setReplyTarget(null);
      setNewMessageCount(0);
      setVisibleMessageLimit(200);
      setEditingTarget(null);
      setMessages([]); setText(""); setTypingUsers(new Map());
      followRef.current = true;

      // 1. Instant load from IndexedDB
      const cached = await readCachedMessages(id);
      if (!aliveRef.current || activeIdRef.current !== id) return;
      setMessages(cached);

      // Restore unsent draft for this channel from IndexedDB
      const draft = await getCachedDraft(id);
      if (!aliveRef.current || activeIdRef.current !== id) return;
      setText(draft || "");

      loadChannelDetails(id);

      // 2. Network reconciliation
      try {
        const { data } = await api.get(`${root}/channels/${id}/messages`, {
          params: { limit: 50 },
          timeout: 20000,
        });
        if (activeIdRef.current !== id) return;
        const incoming = Array.isArray(data.messages) ? data.messages : [];
        const merged = mergeMessages(cached, incoming);
        setMessages(merged);
        setHasMore(Boolean(data.nextBefore));
        setBeforeCursor(data.nextBefore || null);
        await writeCachedMessages(id, merged);
        await syncChannel(id);
        if (incoming.length) markRead(id);
      } catch (err) {
        if (activeIdRef.current === id) {
          if ([401, 403, 404].includes(err.response?.status)) { setMessages([]); setText(""); allowedIdsRef.current.delete(id); await reconcileAuthorizedChannels([...allowedIdsRef.current].map((value) => ({ id: value }))); }
          setError(errorText(err));
          setHasMore(false);
        }
      } finally {
        if (activeIdRef.current === id) setThreadLoading(false);
      }
    },
    [loadChannelDetails, markRead, syncChannel, getCachedDraft, readCachedMessages, reconcileAuthorizedChannels, writeCachedMessages]
  );

  const loadEarlierMessages = async () => {
    const id = activeIdRef.current;
    if (!id || !beforeCursor || loadingMore) return;
    setLoadingMore(true);
    const pane = paneRef.current;
    const previousHeight = pane?.scrollHeight || 0;
    followRef.current = false;
    try {
      const { data } = await api.get(`${root}/channels/${id}/messages`, { params: { before: beforeCursor, limit: 50 } });
      if (!aliveRef.current || activeIdRef.current !== id) return;
      setMessages((previous) => mergeMessages(data.messages || [], previous));
      await writeCachedMessages(id, data.messages || []);
      setBeforeCursor(data.nextBefore || null); setHasMore(Boolean(data.nextBefore));
      requestAnimationFrame(() => { if (pane) pane.scrollTop += pane.scrollHeight - previousHeight; });
    } catch (error) { setError(errorText(error)); }
    finally { if (aliveRef.current) setLoadingMore(false); }
  };

  /* ── Outbox Offline Queue Sync ─────────────────────────────────────────── */
  const flushOutbox = useCallback(async () => {
    if (flushingRef.current || !aliveRef.current || (typeof navigator !== "undefined" && !navigator.onLine)) return;
    flushingRef.current = true;
    try {
    await loadBootstrap({ silent: true });
    if (!aliveRef.current) return;
    const entries = await readOutbox();
    if (!entries.length) return;
    for (const entry of entries) {
      if (!aliveRef.current || !allowedIdsRef.current.has(Number(entry.channelId))) continue;
      try {
        const { data } = await api.post(
          `${root}/channels/${entry.channelId}/messages`,
          { text: entry.text, clientId: entry.clientId, replyToId: entry.replyToId, clientCreatedAt: entry.createdAt, mentionIds: entry.mentionIds || [] },
          { timeout: 20000 }
        );
        await removeOutbox(entry.clientId);
        if (!aliveRef.current) return;
        await writeCachedMessages(entry.channelId, [data.message]);
        if (activeIdRef.current === Number(entry.channelId)) {
          setMessages((prev) => mergeMessages(prev, [data.message]));
        }
        retryDelay.current = 1000;
      } catch (err) {
        retryDelay.current = Math.min(30000, retryDelay.current * 2);
        setError(errorText(err));
        if ([400, 401, 403, 404, 409].includes(err.response?.status)) {
          await removeOutbox(entry.clientId);
          await updateCachedMessage(entry.channelId, entry.clientId, { pending: false, failed: true });
          if (activeIdRef.current === Number(entry.channelId)) setMessages((previous) => previous.map((message) => message.clientId === entry.clientId ? { ...message, pending: false, failed: true } : message));
        }
        break;
      }
    }
    } finally { flushingRef.current = false; }
  }, [loadBootstrap, readOutbox, removeOutbox, updateCachedMessage, writeCachedMessages]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    const attempt = async () => {
      if (cancelled || !aliveRef.current) return;
      try { if (online && (await readOutbox()).length) await flushOutbox(); }
      catch (_) { retryDelay.current = Math.min(30000, retryDelay.current * 2); }
      if (!cancelled) timer = setTimeout(attempt, Math.max(3000, retryDelay.current));
    };
    timer = setTimeout(attempt, 1000);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [online, readOutbox, flushOutbox]);

  /* ── Send / Edit / Delete / Reactions ───────────────────────────────────── */
  const handleTextChange = (val) => {
    setMentionSuppressed(false);
    setText(val);
    if (activeId) {
      saveCachedDraft(activeId, val).catch(() => {});
      // Emit typing indicator (debounced)
      if (socket.connected) {
        socket.emit("team_chat_typing", { tenantId: activeTenant?.id, channelId: activeId, isTyping: Boolean(val.trim()) });
        clearTimeout(typingTimerRef.current);
        typingTimerRef.current = setTimeout(() => {
          socket.emit("team_chat_typing", { tenantId: activeTenant?.id, channelId: activeId, isTyping: false });
        }, 2500);
      }
    }
  };

  const sendMessage = useCallback(async () => {
    const body = text.trim();
    if (!body || !activeChannel || sending) return;
    if (body.length > 4000) {
      setError("Keep team chat messages under 4000 characters.");
      return;
    }

    const channelId = Number(activeChannel.id);

    // If we're editing an existing message:
    if (editingTarget) {
      setSending(true);
      try {
        const { data } = await api.patch(
          `${root}/channels/${channelId}/messages/${editingTarget.id}`,
          { text: body }
        );
        setMessages((prev) =>
          prev.map((m) => (m.id === editingTarget.id ? data.message : m))
        );
        setEditingTarget(null);
        setText(draftBeforeEdit.current);
        saveCachedDraft(channelId, draftBeforeEdit.current).catch(() => {});
      } catch (err) {
        setError(errorText(err));
      } finally {
        setSending(false);
      }
      return;
    }

    const clientId = newClientId();
    followRef.current = true;
    const optimistic = {
      id: `local:${clientId}`,
      channelId,
      senderId: meId,
      senderName: bootstrap?.me?.name || "You",
      body,
      clientId,
      replyToId: replyTarget?.id || null,
      replyTo: replyTarget ? { id: replyTarget.id, senderName: replyTarget.senderName, body: replyTarget.body } : null,
      createdAt: new Date().toISOString(),
      pending: true,
      reactions: [],
      attachments: [],
      mentionIds: channelMembersList.filter((person) => Number(person.id) !== meId && body.includes(`@${person.name}`)).map((person) => Number(person.id)),
    };

    setSending(true);
    setText("");
    saveCachedDraft(channelId, "").catch(() => {});
    setReplyTarget(null);
    setError("");

    setMessages((prev) => mergeMessages(prev, [optimistic]));
    await writeCachedMessages(channelId, [optimistic]);
    await queueOutbox({ channelId, text: body, clientId, replyToId: optimistic.replyToId, createdAt: optimistic.createdAt, mentionIds: optimistic.mentionIds });
    setChannels((prev) =>
      prev.map((c) =>
        Number(c.id) === channelId ? { ...c, lastMessage: optimistic, unread: 0 } : c
      )
    );

    try {
      if (typeof navigator !== "undefined" && !navigator.onLine) throw new Error("offline");
      const { data } = await api.post(
        `${root}/channels/${channelId}/messages`,
        { text: body, clientId, replyToId: optimistic.replyToId, clientCreatedAt: optimistic.createdAt, mentionIds: optimistic.mentionIds },
        { timeout: 20000 }
      );
      if (!aliveRef.current) return;
      await removeOutbox(clientId);
      if (activeIdRef.current === channelId) {
        setMessages((prev) => mergeMessages(prev, [data.message]));
      }
      setChannels((prev) =>
        prev.map((c) =>
          Number(c.id) === channelId ? { ...c, lastMessage: data.message } : c
        )
      );
      await writeCachedMessages(channelId, [data.message]);
    } catch (err) {
      if (!err.response) {
        await queueOutbox({
          channelId,
          text: body,
          clientId,
          replyToId: optimistic.replyToId,
          mentionIds: optimistic.mentionIds,
          createdAt: new Date().toISOString(),
        });
        setNotice("Saved on this device. It will send when the backend reconnects.");
      } else {
        await removeOutbox(clientId);
        await updateCachedMessage(channelId, clientId, { pending: false, failed: true });
        setError(errorText(err));
        setMessages((prev) =>
          prev.map((m) => (m.clientId === clientId ? { ...m, pending: false, failed: true } : m))
        );
      }
    } finally {
      setSending(false);
    }
  }, [activeChannel, bootstrap, editingTarget, meId, replyTarget, sending, text, queueOutbox, removeOutbox, saveCachedDraft, updateCachedMessage, writeCachedMessages, channelMembersList]);

  const handleDeleteMessage = useCallback(async (msg) => {
    if (!window.confirm("Are you sure you want to delete this message?")) return;
    try {
      await api.delete(`${root}/channels/${msg.channelId}/messages/${msg.id}`);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === msg.id ? { ...m, isDeleted: true, body: "This message was deleted" } : m
        )
      );
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  const handleToggleReaction = useCallback(async (msg, emoji) => {
    try {
      const { data } = await api.post(
        `${root}/channels/${msg.channelId}/messages/${msg.id}/reactions`,
        { emoji }
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, reactions: data.reactions } : m))
      );
    } catch (err) {
      setError(errorText(err));
    }
  }, []);

  const handleTogglePin = useCallback(async (msg) => {
    try {
      const { data } = await api.post(
        `${root}/channels/${msg.channelId}/messages/${msg.id}/pin`
      );
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, isPinned: data.isPinned } : m))
      );
      loadChannelDetails(msg.channelId);
      setNotice(data.isPinned ? "Message pinned to channel." : "Message unpinned.");
    } catch (err) {
      setError(errorText(err));
    }
  }, [loadChannelDetails]);

  /* ── Attachments ────────────────────────────────────────────────────────── */
  const handleUploadAttachment = async (event, retry = null) => {
    const file = retry?.file || event.target.files?.[0];
    if (!file || !activeChannel) return;
    const channelId = Number(activeChannel.id);
    if (retry && retry.channelId !== channelId) return;
    const clientId = retry?.clientId || newClientId();
    let attachmentId = retry?.attachmentId;
    const maxMb = settings.maxFileSizeMb || 25;
    if (file.size > maxMb * 1024 * 1024) {
      setError(`File exceeds the ${maxMb} MB limit.`);
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    setUploadingFile(true);
    setUploadProgress(0); setFailedUpload(null);
    setError("");

    try {
      if (!attachmentId) {
      const { data } = await api.post(
        `${root}/channels/${activeChannel.id}/attachments`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress: (progress) => setUploadProgress(progress.total ? Math.round(progress.loaded * 100 / progress.total) : 0) }
      );
      attachmentId = data.attachment.id;
      }
      if (!aliveRef.current) return;
      // Immediately send message with attachment
      const { data: sent } = await api.post(`${root}/channels/${channelId}/messages`, {
        text: `Shared file: ${file.name}`,
        attachmentId, clientId,
      });
      if (!aliveRef.current) return;
      await writeCachedMessages(channelId, [sent.message]);
      if (activeIdRef.current === channelId) setMessages((previous) => mergeMessages(previous, [sent.message]));
    } catch (err) {
      setFailedUpload({ file, channelId, clientId, attachmentId });
      setError(errorText(err));
    } finally {
      setUploadingFile(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /* ── Custom Groups & Direct Messages ────────────────────────────────────── */
  const handleAddMembersToGroup = async () => {
    if (!activeChannel || !newMemberCandidateIds.length) return;
    try {
      const { data } = await api.post(`${root}/channels/${activeChannel.id}/members`, {
        userIds: newMemberCandidateIds,
      });
      if (data.members) setChannelMembersList(data.members);
      setShowAddMembers(false);
      setNewMemberCandidateIds([]);
      setNotice("Teammates added to group.");
    } catch (err) {
      setError(errorText(err));
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!activeChannel) return;
    if (!window.confirm("Remove this member from the group?")) return;
    try {
      const { data } = await api.delete(`${root}/channels/${activeChannel.id}/members/${userId}`);
      if (data.members) setChannelMembersList(data.members);
      setNotice("Member removed from group.");
    } catch (err) {
      setError(errorText(err));
    }
  };

  const handleLeaveGroup = async () => {
    if (!activeChannel) return;
    if (!window.confirm("Are you sure you want to leave this group?")) return;
    try {
      await api.post(`${root}/channels/${activeChannel.id}/leave`);
      setChannels((prev) => prev.filter((c) => Number(c.id) !== Number(activeChannel.id)));
      setActiveId(null);
      setShowDetails(false);
      setNotice("You left the group.");
    } catch (err) {
      setError(errorText(err));
    }
  };

  const handleSaveGroupInfo = async () => {
    if (!activeChannel || !editGroupName.trim()) return;
    try {
      const { data } = await api.patch(`${root}/channels/${activeChannel.id}`, {
        name: editGroupName.trim(),
        description: editGroupDesc.trim(),
      });
      setChannels((prev) =>
        prev.map((c) => (Number(c.id) === Number(activeChannel.id) ? { ...c, ...data.channel } : c))
      );
      setEditingGroupInfo(false);
      setNotice("Group information updated.");
    } catch (err) {
      setError(errorText(err));
    }
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (!groupName.trim() || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const { data } = await api.post(`${root}/channels/group`, {
        name: groupName.trim(),
        description: groupDesc.trim(),
        memberIds: selectedGroupMembers,
      });
      setShowCreateGroup(false);
      setGroupName("");
      setGroupDesc("");
      setSelectedGroupMembers([]);
      allowedIdsRef.current.add(Number(data.channel.id));
      setChannels((prev) => [data.channel, ...prev]);
      openChannel(data.channel);
      setNotice(`Group "${data.channel.name}" created successfully.`);
    } catch (err) {
      setError(errorText(err));
    } finally { setCreatingGroup(false); }
  };

  const handleStartDirect = async (member) => {
    try {
      setShowNewDirect(false);
      setPeopleSearch("");
      const { data } = await api.post(`${root}/direct`, { userId: member.id });
      allowedIdsRef.current.add(Number(data.channel.id));
      setChannels((prev) =>
        prev.some((c) => Number(c.id) === Number(data.channel.id))
          ? prev
          : [data.channel, ...prev]
      );
      openChannel(data.channel);
    } catch (err) {
      setError(errorText(err));
    }
  };

  /* ── Branch Administration Modal ────────────────────────────────────────── */
  const loadBranchPolicies = async () => {
    try {
      const [{ data }, recovery] = await Promise.all([api.get(`${root}/branch-policies`), api.get(`${root}/orphaned-groups`)]);
      setBranchPolicies(data.policies || []);
      setOrphanedGroups((recovery.data.groups || []).map((group) => ({ ...group, selectedId: group.members[0]?.id })));
      setPolicyOptions({ teams: data.teams || [], employees: data.employees || [], roles: data.roles || [] });
    } catch (error) { setError(errorText(error)); }
  };

  const handleUpdatePolicy = (policy, patch) => {
    setBranchPolicies((previous) => previous.map((pair) => pair.branchAId === policy.branchAId && pair.branchBId === policy.branchBId ? { ...pair, ...patch, dirty: true } : pair));
  };

  const saveBranchPolicy = async (policy) => {
    setSavingPolicy(`${policy.branchAId}:${policy.branchBId}`);
    try {
      const payload = {
        branchAId: policy.branchAId,
        branchBId: policy.branchBId,
        enabled: policy.enabled, allowDirect: policy.allowDirect, allowGroups: policy.allowGroups,
        allowDiscovery: policy.allowDiscovery, allowFiles: policy.allowFiles,
        constraints: policy.constraints || {}, version: policy.version,
      };
      const { data } = await api.put(`${root}/branch-policies`, payload);
      setBranchPolicies((prev) =>
        prev.map((p) =>
          p.branchAId === policy.branchAId && p.branchBId === policy.branchBId
            ? { ...p, ...data.policy, dirty: false }
            : p
        )
      );
      setNotice("Branch communication policy updated.");
    } catch (err) {
      setError(errorText(err));
    } finally { setSavingPolicy(null); }
  };

  /* ── Initial Load & Real-time Socket Event Subscription ─────────────────── */
  useEffect(() => {
    loadBootstrap();
    const timer = window.setInterval(() => loadBootstrap({ silent: true }), 30000);
    return () => window.clearInterval(timer);
  }, [activeTenant?.id, loadBootstrap]);

  useEffect(() => {
    if (activeId || !channels.length || initialConversationOpened.current) return;
    initialConversationOpened.current = true;
    if (window.matchMedia("(max-width: 900px)").matches) return;
    openChannel(channels[0]);
  }, [activeId, channels, openChannel]);

  useEffect(() => {
    const typingTimers = remoteTypingTimers.current;
    const onMessage = async (event) => {
      const channelId = Number(event.channelId);
      const msg = event.message;
      if (!msg) return;
      if (!allowedIdsRef.current.has(channelId)) await loadBootstrap({ silent: true });
      if (!aliveRef.current || !allowedIdsRef.current.has(channelId)) return;
      if (activeIdRef.current === channelId && !followRef.current) { setNewMessageCount((count) => count + 1); setVisibleMessageLimit((limit) => limit + 1); }
      writeCachedMessages(channelId, [msg]).catch(() => setError("Device history could not be saved. Check browser storage."));
      const viewing = activeIdRef.current === channelId && followRef.current && document.visibilityState === "visible";
      const conversation = channelsRef.current.find((channel) => Number(channel.id) === channelId);
      const mentioned = msg.mentionIds?.includes(meId);
      const notify = !viewing && Number(msg.senderId) !== meId && (!conversation?.muted || (mentioned && notificationPreferences.mentionsWhenMuted));
      if (notify && notificationPreferences.inApp) setNotice(`${mentioned ? "You were mentioned" : "New message"} in ${conversation?.name || "a team conversation"}.`);
      if (notify && notificationPreferences.desktop && typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification("Team Inbox", { body: mentioned ? "A teammate mentioned you. Open Team Inbox to read the message." : "You have a new team message. Open Team Inbox to read it.", tag: `team-${activeTenant?.id}-${channelId}` }); }
        catch (_) { setError("Desktop notifications are unavailable in this browser."); }
      }
      setChannels((previous) => previous.map((channel) => Number(channel.id) === channelId ? { ...channel, lastMessage: msg, unread: viewing ? 0 : Number(msg.senderId) === meId ? channel.unread : Number(channel.unread || 0) + 1 } : channel));

      if (activeIdRef.current === channelId) {
        setMessages((prev) => mergeMessages(prev, [msg]));
        writeCachedMessages(channelId, [msg]).catch(() => {});
        if (followRef.current && document.visibilityState === "visible") markRead(channelId);
      }
    };

    const onEdited = (event) => {
      writeCachedMessages(event.channelId, [event.message]).catch(() => {});
      if (Number(event.channelId) === activeIdRef.current) {
        setMessages((prev) => mergeMessages(prev, [event.message]));
      }
    };

    const onDeleted = (event) => {
      setChannels((previous) => previous.map((channel) => Number(channel.id) === Number(event.channelId) && Number(channel.lastMessage?.id) === Number(event.messageId) ? { ...channel, lastMessage: { ...channel.lastMessage, body: "This message was deleted", isDeleted: true, attachments: [], stateVersion: event.stateVersion } } : channel));
      updateCachedMessage(event.channelId, event.messageId, { isDeleted: true, body: "This message was deleted", attachments: [], reactions: [], replyTo: null, stateVersion: event.stateVersion }).catch(() => {});
      if (Number(event.channelId) === activeIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            applyMessageUpdate(m, event, { isDeleted: true, body: "This message was deleted", attachments: [], reactions: [], replyTo: null })
          )
        );
      }
    };

    const onReaction = (event) => {
      updateCachedMessage(event.channelId, event.messageId, { reactions: event.reactions, stateVersion: event.stateVersion }).catch(() => {});
      if (Number(event.channelId) === activeIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            applyMessageUpdate(m, event, { reactions: event.reactions })
          )
        );
      }
    };

    const onPin = (event) => {
      updateCachedMessage(event.channelId, event.messageId, { isPinned: event.isPinned, stateVersion: event.stateVersion }).catch(() => {});
      if (Number(event.channelId) === activeIdRef.current) {
        setMessages((prev) =>
          prev.map((m) =>
            applyMessageUpdate(m, event, { isPinned: event.isPinned })
          )
        );
        loadChannelDetails(event.channelId);
      }
    };

    const onTyping = (event) => {
      if (Number(event.channelId) === activeIdRef.current && event.userId !== meId) {
        clearTimeout(remoteTypingTimers.current.get(event.userId));
        if (event.isTyping) remoteTypingTimers.current.set(event.userId, setTimeout(() => setTypingUsers((previous) => { const next = new Map(previous); next.delete(event.userId); return next; }), 6000));
        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (event.isTyping) next.set(event.userId, event.userName);
          else next.delete(event.userId);
          return next;
        });
      }
    };

    const onChannelCreated = (event) => {
      loadBootstrap({ silent: true });
    };

    const onConnect = () => {
      flushOutbox();
      loadBootstrap({ silent: true });
      const channelId = activeIdRef.current;
      if (channelId) syncChannel(channelId).catch((error) => setError(errorText(error)));
      if (channelId) api.get(`${root}/channels/${channelId}/messages`, { params: { limit: 100 } }).then(({ data }) => {
        if (aliveRef.current && activeIdRef.current === channelId && allowedIdsRef.current.has(channelId)) {
          setMessages((prev) => mergeMessages(prev, data.messages || []));
          writeCachedMessages(channelId, data.messages || []);
        }
      }).catch(() => {});
    };
    const onDisconnect = () => {};
    const onOnline = () => {
      setOnline(true);
      flushOutbox();
    };
    const onOffline = () => setOnline(false);
    const onVisibility = () => { if (document.visibilityState === "visible" && activeIdRef.current && followRef.current) markRead(activeIdRef.current); };

    const scoped = (handler) => (event) => {
      if (aliveRef.current && Number(event?.tenantId) === Number(activeTenant?.id)) handler(event);
    };
    const onPermissions = scoped(async () => {
      activeIdRef.current = null; setActiveId(null); setChannels([]); setMessages([]); setText("");
      setNotice("Messaging permissions changed. Rechecking conversation access.");
      if (await loadBootstrap({ silent: true })) setNotice("Conversation access updated. Chats outside your allowed scope are hidden.");
    });
    const subscriptions = {
      team_chat_message: scoped(onMessage), team_chat_message_edited: scoped(onEdited),
      team_chat_message_deleted: scoped(onDeleted), team_chat_reaction: scoped(onReaction),
      team_chat_pin: scoped(onPin), team_chat_typing: scoped(onTyping),
      team_chat_channel_created: scoped(onChannelCreated),
      team_chat_channel_updated: scoped(() => { loadBootstrap({ silent: true }); if (activeIdRef.current) loadChannelDetails(activeIdRef.current); }),
      team_chat_policy_updated: onPermissions,
      team_chat_unread: scoped((event) => setChannels((previous) => previous.map((channel) => Number(channel.id) === Number(event.channelId) ? { ...channel, markedUnread: true } : channel))),
      team_chat_read: scoped((event) => {
        if (Number(event.channelId) === activeIdRef.current) setMessages((previous) => previous.map((message) => Number(message.senderId) !== Number(event.userId) && Number(message.id) <= Number(event.lastReadId) ? { ...message, readBy: [...new Set([...(message.readBy || []), Number(event.userId)])] } : message));
        if (Number(event.userId) === meId) setChannels((previous) => previous.map((channel) => Number(channel.id) === Number(event.channelId) ? { ...channel, unread: 0, markedUnread: false } : channel));
      }),
    };
    Object.entries(subscriptions).forEach(([name, handler]) => socket.on(name, handler));
    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      for (const timer of typingTimers.values()) clearTimeout(timer);
      Object.entries(subscriptions).forEach(([name, handler]) => socket.off(name, handler));
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushOutbox, loadBootstrap, loadChannelDetails, markRead, meId, activeTenant?.id, syncChannel, updateCachedMessage, writeCachedMessages, notificationPreferences]);

  /* Scroll preservation */
  useEffect(() => {
    const pane = paneRef.current;
    if (pane && followRef.current) pane.scrollTop = pane.scrollHeight;
  }, [messages]);

  let lastDay = "";

  return (
    <div className="tc-root" ref={rootRef}>

      {error && (
        <div className="emp-banner emp-banner-error" role="alert">
          <AlertCircle size={14} />
          <span>{error}</span>
          <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}

      {notice && (
        <div className="emp-banner emp-banner-info" role="status">
          <span>{notice}</span>
          <button type="button" className="emp-btn emp-btn-sm emp-btn-ghost" onClick={() => setNotice("")}>
            <X size={12} />
          </button>
        </div>
      )}

      {/* ── Main Workspace ────────────────────────────────────────────────── */}
      <div className={`tc-workspace ${activeChannel ? "tc-has-selection" : ""} ${showDetails ? "tc-has-details" : ""}`}>
        {/* ── Panel 1: Navigation & Channels ── */}
        <aside className="tc-sidebar" aria-label="Channels">
          <div className="tc-sidebar-head">
            <div className="tc-sidebar-title-row">
              <h2><MessageSquare size={16} /> Team Inbox</h2>
              <div className="tc-sidebar-actions">
                <button
                  type="button"
                  className="tc-icon-btn"
                  title="New Direct Message"
                  onClick={() => setShowNewDirect(true)}
                >
                  <Plus size={14} /><span className="tc-new-label">New message</span>
                </button>
                <button
                  type="button"
                  className="tc-icon-btn"
                  title="Create Group"
                  onClick={() => setShowCreateGroup(true)}
                >
                  <Users size={14} />
                </button>
              </div>
            </div>

            <div className="emp-search">
              <Search size={13} aria-hidden="true" />
              <input
                type="search"
                className="emp-field"
                placeholder="Search conversations…"
                aria-label="Search conversations"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="tc-filter-segmented">
              <select aria-label="Conversation view" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All conversations</option><option value="unread">Unread</option>
                <option value="pinned">Pinned</option><option value="archived">Archived</option>
                <option value="direct">Direct messages</option><option value="groups">Groups</option><option value="branches">Branches</option>
              </select>
            </div>
          </div>

          <div className="tc-channel-scroll">
            {loading && <p className="emp-list-state">Loading team chats...</p>}

            {/* Groups View */}
            {!loading && (filter === "groups" || ["all", "unread", "pinned", "archived"].includes(filter)) && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "4px 0 8px 0" }}>
                  <p className="tc-channel-group-title" style={{ margin: 0 }}>Team Groups ({grouped.group.length})</p>
                  <button
                    type="button"
                    className="emp-btn emp-btn-sm"
                    style={{ fontSize: "11px", padding: "2px 7px", height: "auto" }}
                    onClick={() => setShowCreateGroup(true)}
                  >
                    <Plus size={11} /> New Group
                  </button>
                </div>
                {grouped.group.map((c) => renderChannelItem(c))}
                {filter === "groups" && !grouped.group.length && (
                  <p className="emp-list-state">No group channels yet. Click "+ New Group" to create one.</p>
                )}
              </div>
            )}

            {/* Direct Messages View */}
            {!loading && (filter === "direct" || ["all", "unread", "pinned", "archived"].includes(filter)) && (
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "8px 0 6px 0" }}>
                  <p className="tc-channel-group-title" style={{ margin: 0 }}>Individual Chats ({grouped.direct.length})</p>
                  <button
                    type="button"
                    className="emp-btn emp-btn-sm"
                    style={{ fontSize: "11px", padding: "2px 7px", height: "auto" }}
                    onClick={() => setShowNewDirect(true)}
                  >
                    <Plus size={11} /> Start 1:1
                  </button>
                </div>
                {grouped.direct.map((c) => renderChannelItem(c))}

                {/* Teammates Directory for quick 1-click chat */}
                {(filter === "direct" || !grouped.direct.length) && <div className="tc-coworkers-directory">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, textTransform: "uppercase", color: "#64748b" }}>
                      Teammates ({members.length})
                    </span>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>Start a conversation</span>
                  </div>
                  {members.map((coworker) => {
                    const existingDm = channels.find(
                      (c) => c.kind === "direct" && c.dmKey && c.dmKey.split(":").map(Number).includes(coworker.id)
                    );
                    return (
                      <div key={coworker.id} className="tc-coworker-item">
                        <div className="tc-coworker-left">
                          <div className="tc-channel-avatar direct" style={{ width: 26, height: 26, fontSize: 10 }}>
                            {initials(coworker.name)}
                            {onlineUserIds.includes(Number(coworker.id)) && <span className="tc-online-dot" title="Online" />}
                          </div>
                          <div className="tc-coworker-meta">
                            <span className="tc-coworker-name">{coworker.name}</span>
                            <span className="tc-coworker-sub">
                              {coworker.role || "Employee"} {coworker.branchName ? `• ${coworker.branchName}` : ""}
                            </span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="tc-coworker-btn"
                          disabled={!coworker.canDirect}
                          title={coworker.canDirect ? "Chat directly" : "Cross-branch communication disabled"}
                          onClick={() => {
                            if (existingDm) openChannel(existingDm);
                            else handleStartDirect(coworker);
                          }}
                        >
                          <Send size={10} /> Chat
                        </button>
                      </div>
                    );
                  })}
                </div>}
              </div>
            )}

            {/* Company & Branches Channels View */}
            {!loading && (filter === "branches" || ["all", "unread", "pinned", "archived"].includes(filter)) && (
              <div>
                {grouped.organization.length > 0 && (
                  <div>
                    <p className="tc-channel-group-title">Company Wide</p>
                    {grouped.organization.map((c) => renderChannelItem(c))}
                  </div>
                )}
                {grouped.branch.length > 0 && (
                  <div>
                    <p className="tc-channel-group-title">Branch Channels</p>
                    {grouped.branch.map((c) => renderChannelItem(c))}
                  </div>
                )}
              </div>
            )}

            {!loading && !filteredChannels.length && (
              <p className="emp-list-state">No matching conversations found.</p>
            )}
          </div>
        </aside>

        {/* ── Panel 2: Center Active Chat ── */}
        <section className="tc-chat-main" aria-label="Conversation view">
          {activeChannel ? (
            <>
              {/* Header */}
              <header className="tc-chat-header">
                <div className="tc-header-left">
                  <button
                    type="button"
                    className="emp-btn crm-mobile-back"
                    onClick={() => { activeIdRef.current = null; setActiveId(null); setMessages([]); setShowDetails(false); }}
                    aria-label="Back to channels"
                  >
                    <ArrowLeft size={16} />
                  </button>

                  <div className={`tc-channel-avatar ${activeChannel.kind}`}>
                    {activeChannel.kind === "direct" ? (
                      initials(activeChannel.name)
                    ) : activeChannel.kind === "organization" ? (
                      <Building2 size={16} />
                    ) : activeChannel.kind === "group" ? (
                      <TeamChatAvatar url={activeChannel.avatarUrl} name={activeChannel.name} />
                    ) : (
                      <GitBranch size={16} />
                    )}
                  </div>

                  <div className="tc-header-title">
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <h3>{activeChannel.name}</h3>
                      {activeChannel.kind === "direct" ? (
                        <span style={{ background: "#e0f2fe", color: "#0369a1", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Direct
                        </span>
                      ) : activeChannel.kind === "group" ? (
                        <span style={{ background: "#fef3c7", color: "#92400e", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Team Group
                        </span>
                      ) : (
                        <span style={{ background: "#f1f5f9", color: "#475569", fontSize: "10px", padding: "1px 6px", borderRadius: "4px", fontWeight: 600 }}>
                          Channel
                        </span>
                      )}
                    </div>
                    <div className="tc-header-subtitle">
                      {activeChannel.kind === "direct" ? (
                        <span>{activeChannel.participants?.find((person) => Number(person.id) !== meId)?.email || "Private conversation"}</span>
                      ) : activeChannel.kind === "group" ? (
                        <span>{channelMembersList.length} teammates{activeChannel.description ? ` · ${activeChannel.description}` : ""}</span>
                      ) : activeChannel.kind === "branch" ? (
                        <span>{activeChannel.branchName || "Branch team"}</span>
                      ) : (
                        <span>Company wide</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="tc-header-actions">
                  {canManageGroup && (
                    <button
                      type="button"
                      className="emp-btn emp-btn-sm"
                      style={{ fontSize: "11px", padding: "3px 8px", height: "auto", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      onClick={() => {
                        setShowDetails(true);
                        setShowAddMembers(true);
                      }}
                    >
                      <UserPlus size={12} /> Add Teammate
                    </button>
                  )}
                  <button
                    type="button"
                    className="tc-icon-btn"
                    title="Toggle Details Panel"
                    onClick={() => setShowDetails((v) => !v)}
                  >
                    <PanelRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="tc-icon-btn"
                    title="Refresh"
                    onClick={() => openChannel(activeChannel)}
                    disabled={threadLoading}
                  >
                    <RefreshCw size={14} className={threadLoading ? "emp-spin" : ""} />
                  </button>
                </div>
              </header>

              {/* Pinned Messages Banner */}
              {pinnedMessages.length > 0 && (
                <div className="tc-pinned-banner">
                  <div className="tc-pinned-banner-content">
                    <Pin size={13} />
                    <strong>Pinned ({pinnedMessages.length}):</strong>
                    <span>{pinnedMessages[0]?.body?.slice(0, 80)}…</span>
                  </div>
                  <button
                    type="button"
                    className="emp-btn emp-btn-sm emp-btn-ghost"
                    onClick={() => setShowDetails(true)}
                  >
                    View all
                  </button>
                </div>
              )}

              {/* Timeline Messages */}
              <div className="tc-thread-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="Search this conversation" placeholder="Find a message in this conversation" value={messageSearch} onChange={(event) => setMessageSearch(event.target.value)} /></div>
              {messageSearch.trim() && <div className="tc-search-results" aria-label="Message search results">
                {!searchResults.length && <p>No matching messages.</p>}
                {searchResults.map((message) => <button type="button" key={message.id} onClick={() => {
                  setMessages((previous) => mergeMessages(previous, [message]));
                  setVisibleMessageLimit(messages.length + 1);
                  setMessageSearch("");
                  requestAnimationFrame(() => document.getElementById(`team-message-${message.id}`)?.scrollIntoView({ block: "center" }));
                }}><strong>{message.senderName}</strong> · {timeLabel(message.createdAt)}{isPastServerWindow(message) && " · Stored on this device"}<br />{message.body}</button>)}
              </div>}
              <div
                className="tc-timeline"
                ref={paneRef}
                onScroll={(e) => {
                  const p = e.currentTarget;
                  followRef.current = p.scrollHeight - p.scrollTop - p.clientHeight < 80;
                  if (followRef.current) setNewMessageCount(0);
                }}
              >
                {hasMore && <button type="button" className="tc-new-messages" disabled={loadingMore} onClick={loadEarlierMessages}>{loadingMore ? "Loading earlier messages…" : "Load earlier messages"}</button>}
                {threadLoading && !messages.length && <p className="emp-list-state">Loading message history…</p>}

                {!threadLoading && !messages.length && (
                  <div className="emp-list-state" style={{ margin: "auto", textAlign: "center" }}>
                    <MessageSquare size={32} style={{ margin: "0 auto 8px auto", opacity: 0.4 }} />
                    <strong style={{ display: "block" }}>No messages yet</strong>
                    <span>Start the conversation. It will synchronize with your teammates in real time.</span>
                  </div>
                )}

                {messages.length > visibleMessageLimit && <button type="button" className="tc-new-messages" onClick={() => {
                  const pane = paneRef.current; const height = pane?.scrollHeight || 0; followRef.current = false;
                  setVisibleMessageLimit((limit) => limit + 200);
                  requestAnimationFrame(() => { if (pane) pane.scrollTop += pane.scrollHeight - height; });
                }}>Show earlier history on this device ({messages.length - visibleMessageLimit})</button>}
                {messages.slice(-visibleMessageLimit).map((msg) => {
                  const isMine = Number(msg.senderId) === meId;
                  const day = dayLabel(msg.createdAt);
                  const showDay = day && day !== lastDay;
                  if (showDay) lastDay = day;
                  const isOldDeviceArchive = retentionCutoff ? asDate(msg.createdAt)?.getTime() < new Date(retentionCutoff).getTime() : isPastServerWindow(msg, retentionDays);

                  return (
                    <div key={msg.clientId || msg.id} className="tc-msg-container">
                      {showDay && (
                        <div className="tc-day-divider">
                          <span className="tc-day-label">{day}</span>
                        </div>
                      )}

                      <div id={`team-message-${msg.id}`} tabIndex={0} aria-label={`${isMine ? "Your message" : msg.senderName}, ${timeLabel(msg.createdAt)}`} className={`tc-message-row ${isMine ? "outgoing" : "incoming"}`} onContextMenu={(event) => { if (!msg.isDeleted && !isOldDeviceArchive) { event.preventDefault(); setMessageActionsId(msg.id); } }}>
                        {!msg.isDeleted && !isOldDeviceArchive && !msg.pending && !msg.failed && <button type="button" className="tc-message-more" aria-label="Message actions" aria-expanded={messageActionsId === msg.id} onClick={() => setMessageActionsId(messageActionsId === msg.id ? null : msg.id)}><MoreHorizontal size={16} /></button>}
                        {/* Sender Label */}
                        {!isMine && activeChannel.kind !== "direct" && (
                          <div className="tc-message-sender">
                            {msg.senderName}
                            {msg.senderBranchId ? ` · Branch ${msg.senderBranchId}` : ""}
                          </div>
                        )}

                        {/* Bubble */}
                        <div className="tc-bubble">
                          {/* Reply Context */}
                          {msg.replyTo && (
                            <div className="tc-reply-quote">
                              <div className="tc-reply-quote-sender">{msg.replyTo.senderName}</div>
                              <div>{msg.replyTo.body}</div>
                            </div>
                          )}

                          {/* Message Content */}
                          <div>{msg.body}</div>

                          {/* Attachments */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div>
                              {msg.attachments.map((att) => (
                                <div key={att.id} className="tc-attachment-card">
                                  <FileText size={20} />
                                  <div className="tc-attachment-meta">
                                    <strong>{att.fileName}</strong>
                                    <small>{formatBytes(att.fileSize)}</small>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => downloadAttachment(att)}
                                    className="tc-icon-btn"
                                    title="Download"
                                  >
                                    <Download size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Footer Info */}
                          <div className="tc-bubble-footer">
                            {msg.isPinned && <Pin size={10} title="Pinned message" />}
                            {msg.isEdited && <span className="tc-edited-tag">(edited)</span>}
                            <span>{timeLabel(msg.createdAt) || "Now"}</span>
                            {isMine && (
                              <span>
                                {msg.pending ? (
                                  <Clock size={10} title="Sending…" />
                                ) : msg.failed ? (
                                  <AlertCircle size={10} color="#dc2626" title="Send failed" />
                                ) : (
                                  msg.readBy?.length ? <CheckCheck size={12} title={`Read by ${msg.readBy.length} ${msg.readBy.length === 1 ? "teammate" : "teammates"}`} /> : <Check size={12} title="Accepted by server" />
                                )}
                              </span>
                            )}
                            {isMine && (msg.failed || msg.pending) && <button type="button" className="tc-action-btn" aria-label="Retry message" onClick={async () => {
                              await queueOutbox({ channelId: msg.channelId, text: msg.body, clientId: msg.clientId, replyToId: msg.replyToId, createdAt: msg.createdAt, mentionIds: msg.mentionIds || [] });
                              await flushOutbox();
                            }}><RefreshCw size={12} /> Retry</button>}
                            {isMine && msg.failed && <button type="button" className="tc-action-btn" onClick={() => { handleTextChange(msg.body); setReplyTarget(null); composerRef.current?.focus(); }}>Copy to composer</button>}
                            {isOldDeviceArchive && (
                              <span className="tc-device-tag" title="Kept on this device past 7-day retention">
                                Stored on this device
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Reactions Row */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="tc-reactions-row">
                            {msg.reactions.map((r) => {
                              const isMyReaction = r.userIds?.includes(meId);
                              return (
                                <button
                                  key={r.emoji}
                                  type="button"
                                  className={`tc-reaction-badge ${isMyReaction ? "my-reaction" : ""}`}
                                  title={`${r.users.join(", ")} reacted with ${r.emoji}`}
                                  onClick={() => handleToggleReaction(msg, r.emoji)}
                                >
                                  <span>{r.emoji}</span>
                                  <span>{r.count}</span>
                                </button>
                              );
                            })}
                          </div>
                        )}

                        {/* Hover Action Toolbar */}
                        {!msg.isDeleted && !isOldDeviceArchive && !msg.pending && !msg.failed && (
                          <div role="toolbar" aria-label="Message actions" className={`tc-message-actions-bar ${messageActionsId === msg.id ? "tc-actions-open" : ""}`}>
                            {COMMON_EMOJIS.slice(0, 3).map((emoji) => (
                              <button
                                key={emoji}
                                type="button"
                                className="tc-action-btn"
                                onClick={() => handleToggleReaction(msg, emoji)}
                              >
                                {emoji}
                              </button>
                            ))}
                            <button
                              type="button"
                              className="tc-action-btn"
                              title="Reply"
                              onClick={() => setReplyTarget(msg)}
                            >
                              <MessageSquare size={12} />
                            </button>
                            <button
                              type="button"
                              className="tc-action-btn"
                              title={msg.isPinned ? "Unpin" : "Pin"}
                              onClick={() => handleTogglePin(msg)}
                            >
                              {msg.isPinned ? <PinOff size={12} /> : <Pin size={12} />}
                            </button>
                            {isMine && (
                              <button
                                type="button"
                                className="tc-action-btn"
                                title="Edit"
                                onClick={() => {
                                  draftBeforeEdit.current = text;
                                  setEditingTarget(msg);
                                  setText(msg.body);
                                }}
                              >
                                <Edit2 size={12} />
                              </button>
                            )}
                            {(isMine || bootstrap?.me?.isAdmin) && (
                              <button
                                type="button"
                                className="tc-action-btn"
                                title="Delete"
                                onClick={() => handleDeleteMessage(msg)}
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                            <button
                              type="button"
                              className="tc-action-btn"
                              title="Copy text"
                              onClick={async () => { try { await navigator.clipboard.writeText(msg.body); setNotice("Message copied."); } catch (_) { setError("Clipboard access is unavailable in this browser."); } }}
                            >
                              <Copy size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Typing indicator */}
              {typingUsers.size > 0 && (
                <div className="tc-typing-bar">
                  <div className="tc-typing-dots">
                    <span />
                    <span />
                    <span />
                  </div>
                  <span>{[...typingUsers.values()].join(", ")} is typing…</span>
                </div>
              )}

              {/* Message Composer */}
              {newMessageCount > 0 && <button type="button" className="tc-new-messages" onClick={() => {
                followRef.current = true; setNewMessageCount(0);
                paneRef.current?.scrollTo({ top: paneRef.current.scrollHeight, behavior: "smooth" });
              }}>{newMessageCount} new {newMessageCount === 1 ? "message" : "messages"}</button>}
              <div className="tc-composer">
                {activeChannel.isArchived && <p className="tc-detail-empty" role="status">This group is archived. A group administrator can reopen it.</p>}
                {mentionCandidates.length > 0 && <div className="tc-mention-picker" role="listbox" aria-label="Mention a teammate">{mentionCandidates.map((person) => <button type="button" role="option" aria-selected="false" key={person.id} onClick={() => chooseMention(person)}><span className="tc-channel-avatar direct">{initials(person.name)}</span><span>{person.name}<small>{person.branchName || person.email || "Conversation participant"}</small></span></button>)}</div>}
                {uploadingFile && <div className="tc-upload-progress" role="status"><progress max="100" value={uploadProgress} /><span>{uploadProgress === 100 ? "Sharing attachment…" : `Uploading attachment ${uploadProgress}%`}</span></div>}
                {failedUpload?.channelId === Number(activeId) && <div className="tc-upload-progress"><span>Could not share {failedUpload.file.name}.</span><button type="button" className="emp-btn emp-btn-sm" onClick={() => handleUploadAttachment({ target: {} }, failedUpload)}>Retry upload</button><button type="button" className="tc-action-btn" aria-label="Discard failed upload" onClick={() => setFailedUpload(null)}><X size={14} /></button></div>}
                {replyTarget && (
                  <div className="tc-composer-active-state">
                    <span>
                      Replying to <strong>{replyTarget.senderName}</strong>: {replyTarget.body?.slice(0, 60)}…
                    </span>
                    <button type="button" className="tc-action-btn" onClick={() => setReplyTarget(null)}>
                      <X size={12} />
                    </button>
                  </div>
                )}

                {editingTarget && (
                  <div className="tc-composer-active-state">
                    <span>Editing message…</span>
                    <button
                      type="button"
                      className="tc-action-btn"
                      aria-label="Cancel editing"
                      onClick={() => { setEditingTarget(null); setText(draftBeforeEdit.current); }}
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                <div className="tc-composer-row">
                  <div className="tc-textarea-wrap">
                    <textarea
                      ref={composerRef}
                      aria-label="Message"
                      className="tc-textarea"
                      placeholder={`Message ${activeChannel.name}…`}
                      rows={1}
                      value={text}
                      disabled={Boolean(activeChannel.isArchived)}
                      onChange={(e) => handleTextChange(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Escape") { setMentionSuppressed(true); return; }
                        if (e.key === "ArrowDown" && mentionCandidates.length) { e.preventDefault(); document.querySelector(".tc-mention-picker button")?.focus(); return; }
                        if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                          e.preventDefault();
                          if (mentionCandidates.length) { chooseMention(mentionCandidates[0]); return; }
                          sendMessage();
                        }
                      }}
                    />
                  </div>

                  <div className="tc-composer-buttons">
                    <input
                      type="file"
                      ref={fileInputRef}
                      style={{ display: "none" }}
                      onChange={handleUploadAttachment}
                    />
                    <button
                      type="button"
                      className="tc-icon-btn"
                      title="Attach file"
                      disabled={uploadingFile || Boolean(activeChannel.isArchived)}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadingFile ? <RefreshCw size={14} className="emp-spin" /> : <Paperclip size={14} />}
                    </button>

                    <div className="tc-emoji-control" style={{ position: "relative" }}>
                      <button
                        type="button"
                        className="tc-icon-btn"
                        title="Add emoji"
                        onClick={() => setShowEmojiPicker((v) => !v)}
                      >
                        <Smile size={14} />
                      </button>
                      {showEmojiPicker && (
                        <div
                          style={{
                            position: "absolute",
                            bottom: "38px",
                            right: 0,
                            background: "#ffffff",
                            border: "1px solid #cbd5e1",
                            borderRadius: "8px",
                            padding: "6px",
                            display: "grid",
                            gridTemplateColumns: "repeat(5, 1fr)",
                            gap: "4px",
                            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
                            zIndex: 100,
                          }}
                        >
                          {COMMON_EMOJIS.map((em) => (
                            <button
                              key={em}
                              type="button"
                              style={{
                                background: "transparent",
                                border: 0,
                                fontSize: "18px",
                                cursor: "pointer",
                                padding: "4px",
                                borderRadius: "4px",
                              }}
                              onClick={() => {
                                handleTextChange(text + em);
                                setShowEmojiPicker(false);
                              }}
                            >
                              {em}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      className="tc-btn-send"
                      disabled={sending || !text.trim() || Boolean(activeChannel.isArchived)}
                      onClick={sendMessage}
                    >
                      <Send size={13} />
                      <span>{editingTarget ? "Save" : "Send"}</span>
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="emp-thread-empty">
              <MessageSquare size={36} style={{ margin: "0 auto 12px auto", opacity: 0.3 }} />
              <h2>Pick an internal conversation</h2>
              <span>Communicate directly with your teammates, branch teams, and project groups.</span>
            </div>
          )}
        </section>

        {/* ── Panel 3: Contextual Details (Collapsible) ───────────────── */}
        {showDetails && activeChannel && (
          <aside className="tc-details-pane" aria-label="Conversation details">
            <div className="tc-details-head">
              <h4>{activeChannel.kind === "direct" ? "Employee Profile" : "Group Information"}</h4>
              <button type="button" className="tc-action-btn" aria-label="Close conversation details" onClick={() => setShowDetails(false)}>
                <X size={14} />
              </button>
            </div>

            <div className="tc-details-section tc-conversation-options">
              <h5>Conversation preferences</h5>
              <button type="button" className="emp-btn emp-btn-sm" onClick={async () => { try { await api.post(`${root}/channels/${activeChannel.id}/unread`); setChannels((previous) => previous.map((channel) => channel.id === activeChannel.id ? { ...channel, markedUnread: true } : channel)); activeIdRef.current = null; setActiveId(null); setMessages([]); setShowDetails(false); } catch (error) { setError(errorText(error)); } }}>Mark unread</button>
              {[["pinned", "Pin conversation"], ["muted", "Mute notifications"], ["archived", "Archive conversation"]].map(([field, label]) => (
                <label key={field}><input type="checkbox" checked={Boolean(activeChannel[field])} onChange={async (event) => {
                  try {
                    const { data } = await api.patch(`${root}/channels/${activeChannel.id}/preferences`, { [field]: event.target.checked });
                    setChannels((previous) => previous.map((channel) => channel.id === activeChannel.id ? { ...channel, ...data.preferences } : channel));
                  } catch (error) { setError(errorText(error)); }
                }} />{label}</label>
              ))}
              <button type="button" className="emp-btn emp-btn-sm" onClick={async () => {
                if (!window.confirm("Clear this device's team history and drafts? Older server-expired messages cannot be recovered.")) return;
                try { await clearAllLocalDeviceData(); setMessages([]); setText(""); setNotice("Device history cleared."); }
                catch (error) { setError(error.message); }
              }}>Clear device history</button>
            </div>

            {/* Individual Chat Colleague Profile */}
            {activeChannel.kind === "direct" ? (
              <div className="tc-details-section">
                <h5>Colleague Details</h5>
                <div className="tc-profile-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                    <div className="tc-channel-avatar direct" style={{ width: 36, height: 36, fontSize: 13 }}>
                      {initials(activeChannel.name)}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "#0f172a" }}>{activeChannel.name}</div>
                      <div style={{ fontSize: "11px", color: "#64748b" }}>Internal Employee</div>
                    </div>
                  </div>

                  <div className="tc-profile-row">
                    <span className="tc-profile-label">Branch</span>
                    <span className="tc-profile-val">{peerDetails?.branchName || (peerDetails?.branchId ? `Branch ${peerDetails.branchId}` : "Not assigned")}</span>
                  </div>
                  <div className="tc-profile-row">
                    <span className="tc-profile-label">Chat Mode</span>
                    <span className="tc-profile-val" style={{ color: "#0284c7" }}>Private 1:1 Direct</span>
                  </div>
                  <div className="tc-profile-row">
                    <span className="tc-profile-label">Retention</span>
                    <span className="tc-profile-val">7 Days Rolling (Server)</span>
                  </div>
                </div>
              </div>
            ) : (
              /* Group Details & Member Management */
              <>
                <div className="tc-details-section">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <h5 style={{ margin: 0 }}>About Group</h5>
                    {canManageGroup && <>
                      <input ref={groupAvatarInputRef} className="tc-group-avatar-input" type="file" accept="image/png,image/jpeg,image/gif,image/webp" hidden onChange={async (event) => {
                        const file = event.target.files?.[0]; if (!file) return;
                        if (file.size > 2 * 1024 * 1024) { setError("Choose a group photo no larger than 2 MB."); return; }
                        setUploadingAvatar(true);
                        try { const form = new FormData(); form.append("avatar", file); await api.post(`${root}/channels/${activeChannel.id}/avatar`, form, { headers: { "Content-Type": "multipart/form-data" } }); await loadBootstrap({ silent: true }); setNotice("Group photo updated."); }
                        catch (error) { setError(errorText(error)); } finally { setUploadingAvatar(false); if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = ""; }
                      }} />
                      <button type="button" className="emp-btn emp-btn-sm" disabled={uploadingAvatar} onClick={() => groupAvatarInputRef.current?.click()}>{uploadingAvatar ? "Uploading photo…" : "Change group photo"}</button>
                      {activeChannel.avatarUrl && <button type="button" className="emp-btn emp-btn-sm" onClick={async () => { try { await api.delete(`${root}/channels/${activeChannel.id}/avatar`); await loadBootstrap({ silent: true }); setNotice("Group photo removed."); } catch (error) { setError(errorText(error)); } }}>Remove group photo</button>}
                    </>}
                    {canManageGroup && !editingGroupInfo && (
                      <button
                        type="button"
                        className="emp-btn emp-btn-sm emp-btn-ghost"
                        style={{ fontSize: "10.5px", padding: "1px 6px" }}
                        onClick={() => {
                          setEditGroupName(activeChannel.name);
                          setEditGroupDesc(activeChannel.description || "");
                          setEditingGroupInfo(true);
                        }}
                      >
                        <Edit2 size={10} /> Edit
                      </button>
                    )}
                  </div>

                  {editingGroupInfo ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <input
                        type="text"
                        className="emp-field"
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                        value={editGroupName}
                        onChange={(e) => setEditGroupName(e.target.value)}
                        placeholder="Group Name"
                      />
                      <textarea
                        className="emp-field"
                        rows={2}
                        style={{ fontSize: "12px", padding: "4px 8px" }}
                        value={editGroupDesc}
                        onChange={(e) => setEditGroupDesc(e.target.value)}
                        placeholder="Group Topic or Description"
                      />
                      <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="emp-btn emp-btn-sm emp-btn-ghost"
                          onClick={() => setEditingGroupInfo(false)}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="emp-btn emp-btn-sm emp-btn-primary"
                          onClick={handleSaveGroupInfo}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12.5px", color: "#334155", lineHeight: "1.5" }}>
                      <strong>{activeChannel.name}</strong>
                      {activeChannel.description && <p style={{ margin: "4px 0", color: "#475569" }}>{activeChannel.description}</p>}
                      <div style={{ marginTop: "6px", fontSize: "11.5px", color: "#64748b" }}>
                        Kind: {activeChannel.kind} {activeChannel.branchName ? `• ${activeChannel.branchName}` : ""}
                      </div>
                    </div>
                  )}
                </div>

                <div className="tc-details-section">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                    <h5 style={{ margin: 0 }}>Members ({channelMembersList.length || activeChannel.participants?.length || 0})</h5>
                    {canManageGroup && (
                      <button
                        type="button"
                        className="emp-btn emp-btn-sm emp-btn-ghost"
                        style={{ fontSize: "10.5px", padding: "1px 6px" }}
                        onClick={() => setShowAddMembers((v) => !v)}
                      >
                        <UserPlus size={10} /> {showAddMembers ? "Close" : "Add"}
                      </button>
                    )}
                  </div>

                  {/* Inline Add Members form */}
                  {showAddMembers && (
                    <div className="tc-add-member-box">
                      <input className="emp-field" aria-label="Search members to add" placeholder="Search teammates" value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} />
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#0f172a" }}>Select Teammates to Add:</span>
                      <div style={{ maxHeight: "120px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {peopleOptions
                          .filter((m) => !channelMembersList.some((cm) => cm.id === m.id))
                          .map((m) => {
                            const checked = newMemberCandidateIds.includes(m.id);
                            return (
                              <label key={m.id} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", cursor: m.canGroup ? "pointer" : "not-allowed", opacity: m.canGroup ? 1 : 0.5 }}>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={!m.canGroup}
                                  onChange={(e) => {
                                    if (e.target.checked) setNewMemberCandidateIds([...newMemberCandidateIds, m.id]);
                                    else setNewMemberCandidateIds(newMemberCandidateIds.filter((id) => id !== m.id));
                                  }}
                                />
                                <span>{m.name}</span>
                                {m.branchName && <small style={{ color: "#64748b" }}>({m.branchName})</small>}
                              </label>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        className="emp-btn emp-btn-sm emp-btn-primary"
                        disabled={!newMemberCandidateIds.length}
                        onClick={handleAddMembersToGroup}
                      >
                        Add Selected ({newMemberCandidateIds.length})
                      </button>
                    </div>
                  )}

                  <div className="tc-member-list">
                    {(channelMembersList.length ? channelMembersList : activeChannel.participants || []).map((m) => {
                      const isMe = Number(m.id) === meId;
                      return (
                        <div key={m.id} className="tc-member-item" style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div className="tc-member-details" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div className="tc-channel-avatar direct" style={{ width: 24, height: 24, fontSize: 10 }}>
                              {initials(m.name)}
                            </div>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: "12px", color: "#0f172a" }}>
                                {m.name} {isMe ? <small style={{ color: "#0284c7" }}>(You)</small> : ""}
                              </div>
                              <div style={{ fontSize: "10.5px", color: "#64748b" }}>
                                {m.groupRole ? m.groupRole.toUpperCase() : "MEMBER"} {m.branchName ? `• ${m.branchName}` : ""}
                              </div>
                            </div>
                          </div>
                          {canManageGroup && !isMe && (m.groupRole !== "owner" || bootstrap?.me?.isAdmin) && (
                            <button
                              type="button"
                              className="tc-member-remove-btn"
                              title="Remove from group"
                              onClick={() => handleRemoveMember(m.id)}
                            >
                              <Trash2 size={11} /> Remove
                            </button>
                          )}
                          {canManageGroup && !isMe && m.groupRole !== "owner" && (bootstrap?.me?.isAdmin || groupRole === "owner") && <button type="button" className="emp-btn emp-btn-sm" onClick={async () => {
                            try { const { data } = await api.patch(`${root}/channels/${activeChannel.id}/members/${m.id}`, { role: m.groupRole === "admin" ? "member" : "admin" }); setChannelMembersList(data.members || []); }
                            catch (error) { setError(errorText(error)); }
                          }}>{m.groupRole === "admin" ? "Remove admin role" : "Make admin"}</button>}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leave Group Action */}
                {activeChannel.kind === "group" && (
                  <div className="tc-details-section">
                    {canManageGroup && <button type="button" className="emp-btn" onClick={async () => {
                      try { await api.patch(`${root}/channels/${activeChannel.id}`, { isArchived: !activeChannel.isArchived }); await loadBootstrap({ silent: true }); }
                      catch (error) { setError(errorText(error)); }
                    }}>{activeChannel.isArchived ? "Reopen group" : "Archive group for everyone"}</button>}
                    <button
                      type="button"
                      className="tc-leave-btn"
                      onClick={handleLeaveGroup}
                    >
                      <X size={12} /> Leave Group
                    </button>
                  </div>
                )}
              </>
            )}

            {/* Pinned Messages Section */}
            <div className="tc-details-section">
              <h5>Shared files</h5>
              {messages.flatMap((message) => message.attachments || []).length === 0 && <p className="tc-detail-empty">No files in the loaded history.</p>}
              {messages.flatMap((message) => message.attachments || []).map((attachment) => <button key={attachment.id} type="button" className="tc-shared-file" onClick={() => previewAttachment(attachment)}><FileText size={16} /><span>{attachment.fileName}<small>{formatBytes(attachment.fileSize)}</small></span><Download size={14} /></button>)}
            </div>
            <div className="tc-details-section">
              <h5>Pinned Messages ({pinnedMessages.length})</h5>
              {!pinnedMessages.length ? (
                <div style={{ fontSize: "12px", color: "#64748b" }}>No pinned messages yet.</div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pinnedMessages.map((p) => (
                    <button type="button" onClick={() => { setMessages((previous) => mergeMessages(previous, [p])); setVisibleMessageLimit(messages.length + 1); setShowDetails(false); requestAnimationFrame(() => document.getElementById(`team-message-${p.id}`)?.scrollIntoView({ block: "center" })); }}
                      key={p.id}
                      style={{
                        padding: "6px",
                        background: "#ffffff",
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        fontSize: "11.5px",
                      }}
                    >
                      <strong>{p.senderName}:</strong> {p.body}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Modal: New Direct Message ──────────────────────────────────────── */}
      {showNotificationSettings && <div className="tc-modal-backdrop" onClick={() => setShowNotificationSettings(false)}><div className="tc-modal" onClick={(event) => event.stopPropagation()}>
        <div className="tc-modal-head"><h3>Notification preferences</h3><button type="button" className="tc-action-btn" aria-label="Close notification preferences" onClick={() => setShowNotificationSettings(false)}><X size={16} /></button></div>
        <div className="tc-modal-body tc-preference-form">
          <p>Choose how Team Inbox notifies you. Message contents stay out of desktop notifications.</p>
          {[["inApp", "In-app notifications"], ["desktop", "Desktop notifications"], ["mentionsWhenMuted", "Notify me about mentions in muted conversations"]].map(([field, label]) => <label key={field}><input type="checkbox" checked={notificationDraft[field]} onChange={(event) => setNotificationDraft({ ...notificationDraft, [field]: event.target.checked })} />{label}</label>)}
          {error && <p className="tc-form-error" role="alert">{error}</p>}
        </div>
        <div className="tc-modal-footer"><button type="button" className="emp-btn" onClick={() => setShowNotificationSettings(false)}>Cancel</button><button type="button" className="emp-btn emp-btn-primary" disabled={savingNotifications} onClick={async () => {
          setSavingNotifications(true);
          try {
            if (notificationDraft.desktop && (typeof Notification === "undefined" || await Notification.requestPermission() !== "granted")) throw new Error("Desktop notification permission was not granted. Disable desktop notifications or allow them in your browser settings.");
            const { data } = await api.patch(`${root}/notification-preferences`, notificationDraft); setNotificationPreferences(data.preferences); setShowNotificationSettings(false); setNotice("Notification preferences saved.");
          } catch (error) { setError(error.response ? errorText(error) : error.message); } finally { setSavingNotifications(false); }
        }}>{savingNotifications ? "Saving…" : "Save preferences"}</button></div>
      </div></div>}
      {showNewDirect && (
        <div className="tc-modal-backdrop" onClick={() => setShowNewDirect(false)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-head">
              <h3>Start Direct Message</h3>
              <button type="button" className="tc-action-btn" aria-label="Close new message" onClick={() => setShowNewDirect(false)}>
                <X size={15} />
              </button>
            </div>
            <div className="tc-modal-body">
              <div className="emp-search">
                <Search size={14} />
                <input
                  type="search"
                  className="emp-field"
                  placeholder="Search teammates by name or branch…"
                  value={peopleSearch}
                  onChange={(e) => setPeopleSearch(e.target.value)}
                  autoFocus
                />
              </div>

              <div style={{ maxHeight: "300px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                {peopleLoading && <p role="status">Searching permitted teammates…</p>}
                {peopleOptions
                  .filter((m) =>
                    [m.name, m.email, m.branchName]
                      .filter(Boolean)
                      .join(" ")
                      .toLowerCase()
                      .includes(peopleSearch.toLowerCase())
                  )
                  .map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      className="tc-person"
                      disabled={!m.canDirect}
                      onClick={() => handleStartDirect(m)}
                    >
                      <div className="tc-channel-avatar direct">{initials(m.name)}</div>
                      <div style={{ flex: 1, textAlign: "left" }}>
                        <div style={{ fontWeight: 650, fontSize: "13px" }}>{m.name}</div>
                        <div style={{ fontSize: "11.5px", color: "#64748b" }}>
                          {m.branchName || "No branch"} · {m.role}
                        </div>
                      </div>
                      {!m.canDirect && <span className="tc-pill">Branch blocked</span>}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Create Group ────────────────────────────────────────────── */}
      {showCreateGroup && (
        <div className="tc-modal-backdrop" onClick={() => setShowCreateGroup(false)}>
          <div className="tc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-head">
              <h3>Create Project Group</h3>
              <button type="button" className="tc-action-btn" aria-label="Close group creation" onClick={() => setShowCreateGroup(false)}>
                <X size={15} />
              </button>
            </div>
            <form onSubmit={handleCreateGroup}>
              <div className="tc-modal-body">
                {error && <p role="alert" className="tc-form-error">{error}</p>}
                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                    Group Name
                  </label>
                  <input
                    type="text"
                    className="emp-field"
                    placeholder="e.g. Q4 Growth Sprint"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                    Description (optional)
                  </label>
                  <textarea
                    className="emp-field"
                    rows={2}
                    placeholder="Briefly state the goal of this group"
                    value={groupDesc}
                    onChange={(e) => setGroupDesc(e.target.value)}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "12px", fontWeight: 650, marginBottom: "4px" }}>
                    Add Members ({selectedGroupMembers.length} selected)
                  </label>
                  <input className="emp-field" aria-label="Search group participants" placeholder="Search permitted teammates" value={peopleSearch} onChange={(event) => setPeopleSearch(event.target.value)} />
                  <div style={{ maxHeight: "160px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "6px", padding: "6px" }}>
                    {peopleOptions.map((m) => {
                      const checked = selectedGroupMembers.includes(m.id);
                      return (
                        <label
                          key={m.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "4px 6px",
                            fontSize: "12.5px",
                            cursor: m.canGroup ? "pointer" : "not-allowed",
                            opacity: m.canGroup ? 1 : 0.5,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={!m.canGroup}
                            onChange={(e) => {
                              if (e.target.checked) setSelectedGroupMembers([...selectedGroupMembers, m.id]);
                              else setSelectedGroupMembers(selectedGroupMembers.filter((id) => id !== m.id));
                            }}
                          />
                          <span>{m.name} ({m.branchName || "No branch"})</span>
                          {!m.canGroup && <small style={{ color: "#dc2626" }}>(Cross-branch blocked)</small>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
              <div className="tc-modal-footer">
                <button type="button" className="emp-btn" onClick={() => setShowCreateGroup(false)}>
                  Cancel
                </button>
                <button type="submit" className="emp-btn emp-btn-primary" disabled={!groupName.trim() || creatingGroup}>
                  {creatingGroup ? "Creating group…" : "Create Group"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal: Branch Communication Administration ─────────────────────── */}
      {attachmentPreview && <div className="tc-modal-backdrop" onClick={() => setAttachmentPreview(null)} onKeyDown={(event) => { if (event.key === "Escape") setAttachmentPreview(null); }}>
        <div className="tc-modal" role="dialog" aria-modal="true" aria-label={attachmentPreview.name} onClick={(event) => event.stopPropagation()}>
          <div className="tc-modal-head"><h3>{attachmentPreview.name}</h3><button autoFocus type="button" className="tc-action-btn" aria-label="Close attachment preview" onClick={() => setAttachmentPreview(null)}><X size={16} /></button></div>
          <div className="tc-modal-body"><img src={attachmentPreview.url} alt={attachmentPreview.name} style={{ maxWidth: "100%", maxHeight: "65dvh", objectFit: "contain" }} /></div>
        </div>
      </div>}
      {showBranchAdmin && (
        <div className="tc-modal-backdrop" onClick={() => setShowBranchAdmin(false)}>
          <div className="tc-modal" style={{ maxWidth: "680px" }} onClick={(e) => e.stopPropagation()}>
            <div className="tc-modal-head">
              <div>
                <h3 style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <ShieldCheck size={18} color="#0284c7" /> Branch Communication Administration
                </h3>
                <small style={{ color: "#64748b" }}>
                  Configure permitted communication policies between your organization’s branches.
                </small>
              </div>
              <button type="button" className="tc-action-btn" aria-label="Close team settings" onClick={() => setShowBranchAdmin(false)}>
                <X size={15} />
              </button>
            </div>

            <div className="tc-modal-body">
              <section className="tc-device-policy tc-preference-form"><h4>Device history</h4><p>The server always keeps seven calendar days. Configure how long authorized devices retain downloaded message history.</p>
                <label>Device history retention in days<input type="number" min="0" max="3650" value={devicePolicyDraft.localCacheDays} onChange={(event) => setDevicePolicyDraft({ ...devicePolicyDraft, localCacheDays: Number(event.target.value) })} /></label><small>0 keeps history until it is cleared on that device.</small>
                <label><input type="checkbox" checked={devicePolicyDraft.clearCacheOnLogout} onChange={(event) => setDevicePolicyDraft({ ...devicePolicyDraft, clearCacheOnLogout: event.target.checked })} />Clear device history when employees sign out</label>
                <button type="button" className="emp-btn emp-btn-primary" disabled={savingSettings} onClick={async () => { setSavingSettings(true); try { const { data } = await api.patch(`${root}/settings`, devicePolicyDraft); setSettings(data.settings); await applyDevicePolicy(data.settings); setNotice("Device history policy saved."); } catch (error) { setError(errorText(error)); } finally { setSavingSettings(false); } }}>{savingSettings ? "Saving…" : "Save device policy"}</button>
              </section>
              {orphanedGroups.length > 0 && <details className="tc-device-policy"><summary>Restore group administration</summary><p className="tc-detail-empty">These groups have no active administrator. Choose an existing member to manage the group. This does not give you access to its messages.</p>{orphanedGroups.map((group) => <div key={group.id} className="tc-preference-form"><strong>{group.name}</strong><select aria-label={`New administrator for ${group.name}`} value={group.selectedId || ""} onChange={(event) => setOrphanedGroups((previous) => previous.map((item) => item.id === group.id ? { ...item, selectedId: Number(event.target.value) } : item))}>{group.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select><button type="button" className="emp-btn" onClick={async () => { try { await api.post(`${root}/channels/${group.id}/recover-admin`, { userId: group.selectedId }); await loadBranchPolicies(); setNotice("A current group member was assigned as administrator."); } catch (error) { setError(errorText(error)); } }}>Assign group administrator</button></div>)}</details>}
              <h4>Branch communication</h4>
              {!branchPolicies.length && <p className="emp-list-state">No branch pairs to configure.</p>}

              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {branchPolicies.map((pair) => (
                  <fieldset disabled={savingPolicy !== null} key={`${pair.branchAId}:${pair.branchBId}`} className="tc-policy-card">
                    <div className="tc-policy-header">
                      <strong>
                        {pair.branchAName} ↔ {pair.branchBName}
                      </strong>
                      <label className="tc-switch">
                        <input
                          type="checkbox"
                          checked={Boolean(pair.enabled)}
                          onChange={(e) => handleUpdatePolicy(pair, { enabled: e.target.checked })}
                        />
                        <span>{pair.enabled ? "Communication Enabled" : "Blocked"}</span>
                      </label>
                    </div>

                    {pair.enabled && (
                      <div className="tc-policy-options">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(pair.allowDirect)}
                            onChange={(e) => handleUpdatePolicy(pair, { allowDirect: e.target.checked })}
                          />
                          Allow Direct Messages
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(pair.allowGroups)}
                            onChange={(e) => handleUpdatePolicy(pair, { allowGroups: e.target.checked })}
                          />
                          Allow Shared Groups
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(pair.allowDiscovery)}
                            onChange={(e) => handleUpdatePolicy(pair, { allowDiscovery: e.target.checked })}
                          />
                          Allow Employee Discovery
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(pair.allowFiles)}
                            onChange={(e) => handleUpdatePolicy(pair, { allowFiles: e.target.checked })}
                          />
                          Allow File Sharing
                        </label>
                      </div>
                    )}
                    {pair.enabled && <details className="tc-policy-advanced">
                      <summary>Limit who can communicate</summary>
                      <p>Leave a list empty to allow all permitted members. Selected lists apply to both people.</p>
                      {[["userIds", "Employees", policyOptions.employees], ["teamIds", "Teams", policyOptions.teams.filter((team) => [Number(pair.branchAId), Number(pair.branchBId)].includes(Number(team.branchId)))], ["roles", "Roles", policyOptions.roles.map((role) => ({ id: role, name: role.replaceAll("_", " ") }))]].map(([field, label, options]) => (
                        <label key={field}>{label}<select multiple aria-label={`Allowed ${label.toLowerCase()} for ${pair.branchAName} and ${pair.branchBName}`} value={(pair.constraints?.[field] || []).map(String)} onChange={(event) => handleUpdatePolicy(pair, { constraints: { ...pair.constraints, [field]: [...event.target.selectedOptions].map((option) => field === "roles" ? option.value : Number(option.value)) } })}>
                          {options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                        </select><button type="button" className="emp-btn emp-btn-sm" onClick={() => handleUpdatePolicy(pair, { constraints: { ...pair.constraints, [field]: [] } })}>Allow all {label.toLowerCase()}</button></label>
                      ))}
                      <label><input type="checkbox" checked={pair.constraints?.allowGroupCreation !== false} onChange={(event) => handleUpdatePolicy(pair, { constraints: { ...pair.constraints, allowGroupCreation: event.target.checked } })} />Allow creating shared groups</label>
                    </details>}
                    <div className="tc-policy-save"><small>{pair.dirty ? "Unsaved changes" : "Saved policy"}</small><button type="button" className="emp-btn emp-btn-primary" disabled={!pair.dirty || savingPolicy !== null} onClick={() => saveBranchPolicy(pair)}>{savingPolicy === `${pair.branchAId}:${pair.branchBId}` ? "Saving…" : "Save branch policy"}</button></div>
                  </fieldset>
                ))}
              </div>
            </div>

            <div className="tc-modal-footer">
              {error && <p role="alert" className="tc-form-error">{error}</p>}
              <button type="button" className="emp-btn emp-btn-primary" onClick={() => setShowBranchAdmin(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  /* Helper function to render a channel row item */
  function renderChannelItem(channel) {
    const isActive = Number(activeId) === Number(channel.id);
    const unread = Number(channel.unread) || 0;
    const Icon =
      channel.kind === "organization"
        ? Building2
        : channel.kind === "branch"
        ? GitBranch
        : channel.kind === "group"
        ? Users
        : MessageSquare;

    return (
      <button
        key={channel.id}
        type="button"
        className={`tc-channel-item ${isActive ? "active" : ""}`}
        aria-current={isActive ? "true" : undefined}
        onClick={() => openChannel(channel)}
      >
        <div className={`tc-channel-avatar ${channel.kind}`}>
          {channel.kind === "direct" ? initials(channel.name) : channel.kind === "group" ? <TeamChatAvatar url={channel.avatarUrl} name={channel.name} /> : <Icon size={14} />}
        </div>
        <div className="tc-channel-info">
          <div className="tc-channel-row-top">
            <span className="tc-channel-name">{channel.name}{channel.pinned && <Pin size={11} aria-label="Pinned conversation" />}{channel.muted && <BellOff size={11} aria-label="Muted conversation" />}</span>
            <span className="tc-channel-time">
              {channel.lastMessage ? timeLabel(channel.lastMessage.createdAt) : ""}
            </span>
          </div>
          <div className="tc-channel-row-bottom">
            <span className="tc-channel-snippet">
              {channel.lastMessage ? channel.lastMessage.body : "No messages yet"}
            </span>
            {unread > 0 && <span className="tc-badge-unread">{unread > 99 ? "99+" : unread}</span>}
            {!unread && channel.markedUnread && <span className="tc-manual-unread" aria-label="Marked unread" />}
          </div>
        </div>
      </button>
    );
  }
}
