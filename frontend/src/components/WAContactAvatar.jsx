import React, { useState } from "react";
import { Users, User, X } from "lucide-react";

// Deterministic color palette for unique contact avatars
const AVATAR_GRADIENTS = [
  "from-emerald-500 to-teal-700 text-white",
  "from-blue-500 to-indigo-700 text-white",
  "from-purple-500 to-violet-800 text-white",
  "from-rose-500 to-pink-700 text-white",
  "from-amber-500 to-orange-700 text-white",
  "from-cyan-500 to-blue-700 text-white",
  "from-indigo-500 to-purple-700 text-white",
  "from-teal-500 to-emerald-800 text-white",
  "from-fuchsia-500 to-pink-800 text-white",
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
          <div className={`w-full h-full rounded-full bg-purple-900/80 text-purple-200 border border-purple-700/50 flex items-center justify-center font-black shadow-sm ${sz.text}`}>
            <Users size={sz.icon} />
          </div>
        ) : hasValidImage ? (
          <img
            src={src}
            alt={name || "Contact"}
            onError={() => setImgError(true)}
            className="w-full h-full rounded-full object-cover shadow-sm border border-black/10 bg-[#202c33]"
            loading="lazy"
          />
        ) : (
          <div className={`w-full h-full rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center font-extrabold shadow-sm ${sz.text}`}>
            {initials}
          </div>
        )}

        {/* Online Pulse Dot */}
        {isOnline && (
          <span
            className={`absolute rounded-full bg-emerald-500 ring-2 ring-[#111b21] animate-pulse ${sz.dot}`}
            title="Online on WhatsApp"
          />
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {showLightbox && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn"
          onClick={() => setShowLightbox(false)}
        >
          <div className="relative max-w-sm w-full bg-[#111b21] rounded-3xl p-6 border border-white/10 shadow-2xl text-center space-y-4" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={() => setShowLightbox(false)}
              className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-white rounded-full bg-white/10"
            >
              <X size={18} />
            </button>

            <img
              src={src}
              alt={name}
              className="w-48 h-48 rounded-full mx-auto object-cover border-4 border-[#00a884] shadow-xl shadow-[#00a884]/20"
            />

            <div>
              <h3 className="text-lg font-bold text-white">{name}</h3>
              {phone && <p className="text-xs text-emerald-400 font-mono mt-0.5">+{phone.replace(/\D/g, "")}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
