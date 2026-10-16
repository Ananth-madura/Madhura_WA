/* ─────────────────────────────────────────────────────────────────────────────
   MADHURA brand tile — the blue squircle "M" (LEGACY).

   Superseded by src/components/BrandLogo.jsx, which renders the real
   "madhura Technologies" wordmark (madhura-logo.png on light surfaces,
   Group.png on dark). Kept in case the tile is needed again.
   ───────────────────────────────────────────────────────────────────────────── */

export default function LogoMark({ className = "h-9 w-9" }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-[26%] bg-[linear-gradient(145deg,#4d95ff_0%,#2563eb_52%,#1a44c4_100%)] shadow-[0_6px_16px_rgba(37,99,235,0.32)] ${className}`}
    >
      <svg
        viewBox="0 0 24 24"
        className="h-[54%] w-[54%]"
        fill="none"
        stroke="#ffffff"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 18V6l7 7 7-7v12" />
      </svg>
    </span>
  );
}
