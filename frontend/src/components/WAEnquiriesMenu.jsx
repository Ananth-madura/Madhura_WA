import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Inbox, ChevronDown, CircleDot, Snowflake, Sun, Flame, Users } from "lucide-react";
import { getEnquirySummary } from "../api/enquiries";

const OPTIONS = [
  { id: "all", label: "All enquiries", icon: Users, color: "var(--color-ink)" },
  { id: "new", label: "New / unrated", icon: CircleDot, color: "#64748b" },
  { id: "cold", label: "Cold leads", icon: Snowflake, color: "#2563eb" },
  { id: "warm", label: "Warm leads", icon: Sun, color: "#d97706" },
  { id: "hot", label: "Hot leads", icon: Flame, color: "#dc2626" },
];

/**
 * Compact "Enquiries" entry point that sits in the conversations heading.
 * The dropdown shows the lead pipeline split by temperature; picking one
 * opens the Enquiries page already filtered to that temperature.
 */
export default function WAEnquiriesMenu() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState({ total: 0, new: 0, cold: 0, warm: 0, hot: 0 });
  const rootRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const data = await getEnquirySummary();
      setSummary(data || {});
    } catch {
      // Sidebar must stay usable even when the enquiries API is down.
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    load();
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, load]);

  const go = (temp) => {
    setOpen(false);
    navigate(temp === "all" ? "/whatsapp/enquiries" : `/whatsapp/enquiries?temp=${temp}`);
  };

  return (
    <div ref={rootRef} className="relative" style={{ flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Enquiries and lead temperature"
        title="Enquiries — cold, warm & hot leads"
        className="wa-enquiries-btn"
        style={{ width: 104, height: 24 }}
      >
        <Inbox size={12} />
        <span>Enquiries</span>
        {!!summary.total && <em>{summary.total}</em>}
        <ChevronDown size={11} />
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Filter enquiries by temperature"
          className="hl-card absolute right-0 top-full mt-1.5 z-30 w-56 overflow-hidden shadow-xl"
          style={{ padding: 4 }}
        >
          <div
            className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider"
            style={{ color: "var(--color-ink-2)" }}
          >
            Enquiry pipeline
          </div>

          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            const count =
              opt.id === "all" ? Number(summary.total || 0) : Number(summary[opt.id] || 0);
            return (
              <button
                key={opt.id}
                type="button"
                role="menuitem"
                onClick={() => go(opt.id)}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-medium transition hover:bg-[var(--color-paper-2)]"
                style={{ color: "var(--color-ink)" }}
              >
                <Icon size={13} style={{ color: opt.color, flexShrink: 0 }} />
                <span className="flex-1 truncate">{opt.label}</span>
                <span
                  className="hl-badge"
                  style={{ fontSize: 10, minWidth: 22, textAlign: "center" }}
                >
                  {count}
                </span>
              </button>
            );
          })}

          <button
            type="button"
            role="menuitem"
            onClick={() => go("all")}
            className="w-full mt-1 px-2.5 py-2 rounded-lg text-[11px] font-semibold text-center transition hover:bg-[var(--color-paper-2)]"
            style={{ color: "#059669", borderTop: "1px solid var(--color-rule)" }}
          >
            Open full enquiry pipeline →
          </button>
        </div>
      )}
    </div>
  );
}
