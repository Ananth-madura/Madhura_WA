import React, { useState } from "react";
import { Users, User, X } from "lucide-react";

// Deterministic token palette for unique contact avatars (Corporate sharp)
const AVATAR_GRADIENTS = [
  "bg-[var(--color-ink)] text-[var(--color-paper-2)]",
  "bg-[var(--color-shell)] text-[var(--color-paper-2)]",
  "bg-[var(--color-shell-2)] text-[var(--color-paper-2)]",
  "bg-[var(--color-accent)] text-[var(--color-accent-ink)]",
  "bg-[var(--color-ink-2)] text-[var(--color-paper-2)]",
  "bg-[var(--color-paper)] text-[var(--color-ink)] border border-[var(--color-rule)]",
  "bg-[var(--color-focus)] text-[var(--color-paper-2)]",
  "bg-[var(--color-shell-2)] text-[var(--color-accent)]",
  "bg-[var(--color-ink)] text-[var(--color-accent)]",
];

function getGradient(identifier = "") {
  let hash = 0;
  const str = String(identifier || "Unknown");
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_GRADIENTS.length;
  return AVATAR_GRADIENTS[index];
}

function getInitials(name = "") {
  if (!name || name === "Unknown" || name.startsWith("+")) {
    const digits = String(name || "").replace(/\D/g, "").slice(-4);
    return digits ? digits.slice(0, 2) : "WA";
  }
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const SIZE_MAP = {
  xs: { box: "w-6 h-6", text: "text-[9px]", icon: 12, dot: "w-1.5 h-1.5 bottom-0 right-0" },
  sm: { box: "w-8 h-8", text: "text-xs", icon: 14, dot: "w-2 h-2 bottom-0 right-0" },
  md: { box: "w-10 h-10", text: "text-sm", icon: 18, dot: "w-2.5 h-2.5 bottom-0 right-0" },
  lg: { box: "w-12 h-12", text: "text-base", icon: 22, dot: "w-3 h-3 bottom-0.5 right-0.5" },
  xl: { box: "w-16 h-16", text: "text-xl", icon: 28, dot: "w-3.5 h-3.5 bottom-0.5 right-0.5" },
  "2xl": { box: "w-20 h-20", text: "text-2xl", icon: 36, dot: "w-4 h-4 bottom-1 right-1" },
  "3xl": { box: "w-24 h-24", text: "text-3xl", icon: 44, dot: "w-5 h-5 bottom-1 right-1" },
};

export default function WAContactAvatar({
  src,
  name = "User",
  phone = "",
  isGroup = false,
  size = "md",
  isOnline = false,
  clickable = false,
  className = "",
}) {
  const [imgError, setImgError] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);

  const sz = SIZE_MAP[size] || SIZE_MAP.md;
  const gradient = getGradient(name || phone);
  const initials = getInitials(name || phone);
  const hasValidImage = Boolean(src && !imgError);

  const handleClick = (e) => {
    if (clickable && hasValidImage) {
      e.stopPropagation();
      setShowLightbox(true);
    }
  };

  return (
    <>
      <div
        onClick={handleClick}
        className={`relative rounded-full shrink-0 select-none ${sz.box} ${
          clickable && hasValidImage ? "cursor-pointer hover:opacity-90 transition" : ""
        } ${className}`}
      >
        {isGroup ? (
          <div className={`w-full h-full rounded-full bg-[var(--color-shell-2)] text-[var(--color-paper-2)] border border-[var(--color-rule)] flex items-center justify-center font-black shadow-sm font-[var(--font-display)] ${sz.text}`}>
            <Users size={sz.icon} />
          </div>
        ) : hasValidImage ? (
          <img
            src={src}
            alt={name || "Contact"}
            onError={() => setImgError(true)}
            className="w-full h-full rounded-full object-cover shadow-sm border border-[var(--color-rule)] bg-[var(--color-shell)]"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full rounded-full ${gradient} flex items-center justify-center font-extrabold shadow-sm font-[var(--font-display)] ${sz.text}`}>
            {initials}
          </div>
        )}

        {/* Online Pulse Dot */}
        {isOnline && (
          <span
            className={`absolute rounded-full bg-[var(--color-accent)] ring-2 ring-[var(--color-paper-2)] animate-pulse ${sz.dot}`}
            title="Online on WhatsApp"
          />
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 bg-[var(--color-shell)]/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowLightbox(false)}
        >
          <div className="hl-card relative max-w-sm w-full bg-[var(--color-paper-2)] rounded-3xl p-6 border border-[var(--color-rule)] shadow-2xl text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 p-1.5 text-[var(--color-ink-2)] hover:text-[var(--color-ink)] rounded-full bg-[var(--color-paper)] border border-[var(--color-rule)]"
            >
              <X size={18} />
            </button>

            <img
              src={src}
              alt={name}
              className="w-48 h-48 rounded-full mx-auto object-cover border-4 border-[var(--color-accent)] shadow-xl"
            />

            <div>
              <h3 className="hl-title text-lg font-bold text-[var(--color-ink)]">{name}</h3>
              {phone && <p className="hl-id text-xs mt-0.5 text-[var(--color-ink-2)]">+{phone.replace(/\D/g, "")}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
