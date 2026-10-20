import { useEffect, useRef } from "react";

export default function useWADialog(active, onClose, busy = false) {
  const dialogRef = useRef(null);
  const latest = useRef({ onClose, busy });
  latest.current = { onClose, busy };
  useEffect(() => {
    if (!active) return undefined;
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    if (!dialog) return undefined;
    const controls = () => Array.from(dialog.querySelectorAll('button, a[href], input, textarea, select, [tabindex="0"]'))
      .filter(element => !element.disabled && element.getClientRects().length);
    const firstInput = dialog.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
    (firstInput || controls()[0] || dialog).focus();
    const handleKey = event => {
      if (event.key === "Escape") {
        event.stopPropagation();
        if (!latest.current.busy) latest.current.onClose();
      }
      if (event.key !== "Tab") return;
      const elements = controls();
      if (!elements.length) { event.preventDefault(); return; }
      const first = elements[0], last = elements[elements.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      if (previous?.isConnected) previous.focus();
    };
  }, [active]);
  return dialogRef;
}
