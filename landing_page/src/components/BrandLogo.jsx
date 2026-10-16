/* ─────────────────────────────────────────────────────────────────────────────
   MADHURA wordmark (yellow badge + "madhura" + Technologies Pvt. Ltd.)

   Two raster variants ship in /public:
     • madhura-logo.png — dark navy text → use on LIGHT surfaces (white header/footer/cards)
     • Group.png        — white text      → use on DARK surfaces (app mockup rails, dark bars)

   Height drives the size (h-6 / h-8 / h-9 …); width scales automatically
   (the mark is roughly 4:1). Never pass a fixed width.
   ───────────────────────────────────────────────────────────────────────────── */

export default function BrandLogo({
  variant = "on-light",
  className = "h-9",
  alt = "MADHURA Technologies Pvt. Ltd.",
}) {
  const src = variant === "on-dark" ? "/Group.png" : "/madhura-logo.png";
  return <img src={src} alt={alt} className={`w-auto shrink-0 object-contain ${className}`} />;
}
