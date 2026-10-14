import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/* SPA route changes do not reset scroll position by default, so navigating from a
   long marketing page would leave the next page half-scrolled. Reset on path change
   but honour in-page anchors (`/legal/terms#liability`) by scrolling to them instead. */
export default function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (hash) {
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        return;
      }
    }
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [pathname, hash]);

  return null;
}
