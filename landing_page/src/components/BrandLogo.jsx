/* ─────────────────────────────────────────────────────────────────────────────
   MADHURA logo (WhatsApp icon + "madhura" + "WHATSAPP AUTOMATION")
   ───────────────────────────────────────────────────────────────────────────── */

export default function BrandLogo({
  variant = "on-light",
  className = "h-12 md:h-14",
  alt = "Madhura WhatsApp Automation",
}) {
  const src = variant === "on-dark" ? "/Group.png" : "/madhura-logo.png";
  return <img src={src} alt={alt} className={`w-auto shrink-0 object-contain ${className}`} />;
}
