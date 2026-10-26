import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, HelpCircle, X } from "lucide-react";

const WORKSPACES = {
  contacts: { title: "Contacts", job: "Manage customer details, consent and branch ownership.", steps: ["Add a contact or import your customer file.", "Check consent and assign the correct branch.", "Open a conversation or add contacts to a group."], links: ["groups", "templates"] },
  templates: { title: "Templates", job: "Prepare reusable messages with customer and CRM fields.", steps: ["Choose a template or create a message.", "Review variables and the message preview.", "Save it for conversations and automations."], links: ["automations", "contacts"] },
  groups: { title: "Contact groups", job: "Build audiences and manage the contacts in each group.", steps: ["Create a group for a specific audience.", "Add existing contacts or import phone numbers.", "Review membership before starting a broadcast."], links: ["contacts", "templates"] },
  automations: { title: "Automations", job: "Connect CRM events to relevant customer messages.", steps: ["Choose the CRM event and conditions.", "Select a message and configure its variables.", "Test the rule, enable it and review the audit log."], links: ["templates", "flows"] },
  reminders: { title: "Reminders", job: "Chat-native reminders are created from the message composer.", steps: ["Open a conversation and press the bell, or type /remind tomorrow 10am follow up.", "Choose whether the customer gets a WhatsApp message or staff get a private alert.", "Reschedule or cancel any pending reminder from the bar above the composer."], links: ["automations", "contacts"] },
  flows: { title: "Conversation flows", job: "Design, test and publish automated customer conversations.", steps: ["Create a flow and choose its entry trigger.", "Connect steps and resolve validation issues.", "Preview the conversation, save a draft and publish when ready."], links: ["automations", "analytics"] },
  analytics: { title: "Analytics", job: "Review message delivery, conversations and automation results.", steps: ["Choose the reporting period.", "Compare delivery and response metrics.", "Investigate failures and export the report."], links: ["automations", "accounts"] },
  branches: { title: "Branches", job: "Manage office routing, operating hours and branch teams.", steps: ["Create a branch and set its business hours.", "Assign employees and WhatsApp numbers.", "Review routing before accepting customer conversations."], links: ["employees", "accounts"] },
  accounts: { title: "Accounts & settings", job: "Configure WhatsApp connections, senders and service settings.", steps: ["Connect a WhatsApp account or configure Meta Cloud API.", "Assign senders to the appropriate branch.", "Review connection status and service settings."], links: ["branches", "employees"] },
  employees: { title: "Employees", job: "Manage staff access, branch assignments and messaging permissions.", steps: ["Add an employee and assign their branch.", "Choose only the permissions their role needs.", "Share their access code and track activation."], links: ["branches", "accounts"] },
  enquiries: { title: "Enquiries", job: "Triage incoming leads by temperature and convert the ready ones into CRM clients.", steps: ["Log the enquiry with a name, phone and what they asked for.", "Rate it cold, warm or hot from the row dropdown.", "Convert hot leads into a CRM client with one click."], links: ["contacts", "analytics"] },
  "client-portal": { title: "Client portal", job: "Manage client access, shared documents and service requests.", steps: ["Select a CRM client and create an invitation.", "Verify document ownership before publishing.", "Review client responses and service requests."], links: ["contacts", "accounts"] },
};

export default function WAWorkspaceGuide({ section }) {
  const config = WORKSPACES[section];
  const [open, setOpen] = useState(false);
  const [headings, setHeadings] = useState([]);
  const root = useRef(null);
  useEffect(() => {
    const page = root.current?.parentElement;
    if (!page) return undefined;
    let timer;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const next = Array.from(page.querySelectorAll("h2"))
          .filter(el => !el.closest('[role="dialog"], .fixed, .wa-workspace-guide') && el.getClientRects().length)
          .slice(0, 12);
        setHeadings(prev => prev.length === next.length && prev.every((el, i) => el === next[i]) ? prev : next);
      }, 100);
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(page, { childList: true, subtree: true });
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [section]);
  if (!config) return null;
  return (
    <div className="wa-workspace-guide" ref={root}>
      <div className="wa-workspace-breadcrumb">
        <nav aria-label="Breadcrumb"><Link to="/whatsapp">Workspace</Link><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{config.title}</span></nav>
        <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}><HelpCircle size={15} />{open ? "Close guide" : "Quick guide"}</button>
      </div>
      {open && <section className="wa-workspace-help" aria-label={`${config.title} guide`}>
        <div><strong>{config.job}</strong><ol>{config.steps.map(step => <li key={step}>{step}</li>)}</ol></div>
        <div className="wa-workspace-related"><span>Continue your work</span>{config.links.map(key => <Link key={key} to={`/whatsapp/${key}`}>{WORKSPACES[key].title}<ChevronRight size={14} /></Link>)}</div>
        <button type="button" aria-label="Close guide" onClick={() => setOpen(false)}><X size={16} /></button>
      </section>}
      {headings.length > 2 && <nav className="wa-workspace-sections" aria-label="Page sections">{headings.map((heading, i) => <button type="button" key={i} onClick={() => { heading.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" }); heading.setAttribute("tabindex", "-1"); heading.focus({ preventScroll: true }); }}>{heading.textContent}</button>)}</nav>}
    </div>
  );
}
