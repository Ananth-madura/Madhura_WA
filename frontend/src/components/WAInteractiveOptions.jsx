import React, { useState } from "react";
import { ChevronDown, CornerDownLeft, ExternalLink, List, Phone } from "lucide-react";
import { safeActionUrl } from "../utils/waInteractiveMessage";
import "./WAInteractiveOptions.css";

export default function WAInteractiveOptions({ menu, onReply, disabled = false, readOnly = false, dark = false }) {
  const [expanded, setExpanded] = useState(false);
  if (!menu) return null;
  const renderOption = (option, index) => {
    const href = option.type === "url" ? safeActionUrl(option.url) : option.type === "call" ? safeActionUrl(option.phone, "call") : null;
    const Icon = option.type === "url" ? ExternalLink : option.type === "call" ? Phone : CornerDownLeft;
    const contents = <><Icon size={15} aria-hidden="true" /><span><span className="wa-option-title">{option.title}</span>{option.description && <span className="wa-option-description">{option.description}</span>}</span></>;
    if (href) return <a key={`${option.id}-${index}`} className="wa-option" href={href} target={option.type === "url" ? "_blank" : undefined} rel="noopener noreferrer">{contents}</a>;
    return <button key={`${option.id}-${index}`} type="button" className="wa-option" disabled={disabled || readOnly || option.type !== "reply"} onClick={() => onReply?.(option.id, option.title)}>{contents}</button>;
  };
  return (
    <div className={`wa-interactive-options${dark ? " wa-interactive-dark" : ""}`}>
      {menu.kind === "list" && <button type="button" className="wa-options-toggle" aria-expanded={expanded} onClick={() => setExpanded((value) => !value)}><List size={16} /><span>{menu.buttonText}</span><span className="wa-option-count">{menu.options.length}</span><ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : undefined }} /></button>}
      {(menu.kind !== "list" || expanded) && <div className="wa-options-groups">{menu.groups.map((group, index) => <div key={`${group.title}-${index}`}>{group.title && <p className="wa-options-heading">{group.title}</p>}<div className="wa-options-list">{group.options.map(renderOption)}</div></div>)}</div>}
      {menu.footer && <p className="wa-options-footer">{menu.footer}</p>}
      {readOnly && menu.native === false && <p className="wa-options-footer">Sent as text · Customer can reply with an option number</p>}
      {readOnly && <p className="wa-options-footer">Customer choices · Test responses in Flowbot preview</p>}
    </div>
  );
}
