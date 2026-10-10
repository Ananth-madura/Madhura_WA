import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  MessageCircle,
  QrCode,
  Send,
  Smartphone,
  Webhook,
  Zap,
} from "lucide-react";

/* Public marketing landing for the WhatsApp CRM workspace.
   Sits outside WALayout: no app chrome, no auth. Everything here is
   presentational and routes to /login or /signup.

   Every record, event name, button and engine named below is a real object in
   this product, not illustration:
     · tables, events and the 30s sweep  → backend/services/crmEventBus.js
     · the message body and its buttons  → the invoice_created listener
     · inbound actions                  → waConfirmationService callbacks
   Nothing here invents a customer, a logo or a metric the backend cannot
   return. */

/* WhatsApp renders *asterisks* as bold, so the message body is shown the way it
   is actually delivered rather than with the markdown left in. */
function waLine(text) {
  return text
    .split(/(\*[^*]+\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.startsWith("*") && part.endsWith("*") && part.length > 2 ? (
        <strong key={i}>{part.slice(1, -1)}</strong>
      ) : (
        <span key={i}>{part}</span>
      )
    );
}

/* ── The chain, as it actually runs ─────────────────────────────────── */

const CHAIN = [
  {
    step: "01",
    node: "clientinvoices",
    role: "Record",
    title: "Someone raises an invoice",
    detail: "₹48,500 · due 12 Mar · Madhura Technologies",
  },
  {
    step: "02",
    node: "invoice_created",
    role: "Event",
    title: "The sweep claims the row and fires the rules",
    detail: "Opt-out, block list and dedupe checked before anything is sent.",
  },
];

const MESSAGE = [
  "Hello *Ramesh Iyer*,",
  "Your invoice *INV-1042* has been generated.",
  "• *Amount Due:* ₹48,500",
  "• *Due Date:* 12 Mar",
  "Please select an option below:",
];

const BUTTONS = [
  {
    id: "confirm_payment",
    label: "Pay Now / UPI",
    note: "Payment link",
    result: "payment_claim_submitted",
    resultTitle: "Claim lands on the invoice",
    resultDetail: "UTR is captured against INV-1042 and queued for accounts.",
  },
  {
    id: "send_invoice_copy",
    label: "Send Invoice PDF",
    note: "Document",
    result: "send_invoice_copy",
    resultTitle: "PDF goes back from the record",
    resultDetail: "The stored invoice is attached — nobody re-uploads a copy.",
  },
  {
    id: "request_callback",
    label: "Talk to Accounts",
    note: "Callback",
    result: "request_callback",
    resultTitle: "A task is created on the client",
    resultDetail: "Callback task raised against the client record for the team.",
  },
];

/* ── Every event the CRM bus can emit ───────────────────────────────── */

const EVENTS = [
  { name: "invoice_created", does: "Invoice notice with pay, PDF and callback buttons" },
  { name: "quotation_created", does: "Quote sent, then watched for approval or changes" },
  { name: "payment_received", does: "Receipt confirmed back to the customer and the ledger" },
  { name: "new_lead", does: "A lead captured from a chat becomes a CRM record" },
  { name: "walkin_created", does: "Walk-in visit logged, follow-up sent on WhatsApp" },
  { name: "amc_created", does: "Annual maintenance contract acknowledged on WhatsApp" },
  { name: "service_visit_scheduled", does: "Visit confirmed with date and engineer" },
  { name: "ticket_closed", does: "Closure notice once a support ticket is resolved" },
  { name: "welcome_message", does: "First-contact greeting for a new client" },
  { name: "payment_claim_submitted", does: "Customer claims a payment and submits a UTR" },
];

/* Tables the sweep watches on its own — a row created in the CRM is picked up
   without anyone touching a rule. */
const SWEPT = ["clientinvoices", "quotations", "contracts", "walkins", "payments"];

/* ── Day-to-day surfaces, grouped by what you are doing ─────────────── */

const SURFACES = [
  {
    group: "Messaging",
    icon: MessageCircle,
    items: [
      { name: "Live Chats & QR", does: "Pair the number, then work the inbox from one screen." },
      { name: "Contacts", does: "Every conversation resolves to a client record." },
      { name: "Templates", does: "Reusable message templates the whole team sends from." },
      { name: "Contact Groups", does: "Segments reused across campaigns and automations." },
    ],
  },
  {
    group: "Outreach",
    icon: Send,
    items: [
      { name: "Bulk Campaigns", does: "Send to a group, watch failures land, stop all in one click." },
      { name: "Reminders", does: "Payment-due nudges with buttons instead of plain text." },
    ],
  },
  {
    group: "Automation",
    icon: Zap,
    items: [
      { name: "Automations", does: "Rules per CRM event, with delay, opt-out and dedupe." },
      { name: "Chatbot Flows", does: "Buttons, lists, delays and branches on a visual canvas." },
    ],
  },
  {
    group: "Insight",
    icon: BarChart3,
    items: [
      { name: "Analytics", does: "Sent, delivered and read — plus every send log, searchable." },
    ],
  },
];

/* ── How a number gets connected ────────────────────────────────────── */

const ENGINES = [
  {
    icon: QrCode,
    title: "Scan a QR",
    body: "Bring your own number on WhatsApp Web. The session stays yours; disconnect from the accounts page whenever you want.",
  },
  {
    icon: Smartphone,
    title: "Use a pairing code",
    body: "For a device with nothing to scan. Enter the phone and let the code do it — same session, same inbox.",
  },
  {
    icon: Webhook,
    title: "Connect Meta Cloud API",
    body: "Official business account on your own credentials. Messaging quota and quality rating stay visible.",
  },
];

const GUARANTEES = [
  "Sent from your own connected WhatsApp account",
  "Admin and employee roles see different controls",
  "Accounts are provisioned by an admin, never self-served",
];

/* Fades sections in the first time they reach the viewport. Fails open: with
   reduced motion requested nothing is ever hidden.
   This checks scroll position rather than using IntersectionObserver on
   purpose — an observer never fires for content an anchor jump or the skip
   link skipped straight over, which left whole sections stuck at opacity 0
   until the visitor scrolled back up through them. */
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }
    root.classList.add("lp-armed");
    const targets = Array.from(root.querySelectorAll("[data-reveal]"));
    let frame = 0;
    const show = () => {
      frame = 0;
      for (const el of targets) {
        if (el.classList.contains("is-in")) continue;
        if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add("is-in");
      }
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(show);
    };
    show();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);
  return ref;
}

export default function Landing() {
  const armedRef = useReveal();
  const [pressed, setPressed] = useState(null);
  const chosen = BUTTONS.find((b) => b.id === pressed);

  return (
    <div className="lp-root" ref={armedRef}>
      <a href="#lp-loop" className="lp-skip">
        Skip to how it works
      </a>

      {/* ── Header ─────────────────────────────────────────────── */}
      <header className="lp-header">
        <div className="lp-shell lp-header-row">
          <span className="hl-wordmark" style={{ color: "var(--color-paper-2)" }}>
            <span className="hl-wordmark-mark" aria-hidden="true"></span>
            <span>
              Madhura&nbsp;<em>WhatsApp CRM</em>
            </span>
          </span>
          <nav className="lp-header-links" aria-label="Sections">
            <a href="#lp-loop">How it works</a>
            <a href="#lp-events">Events</a>
            <a href="#lp-surfaces">Surfaces</a>
            <a href="#lp-accounts">Connecting</a>
          </nav>
          <nav className="lp-header-actions" aria-label="Account">
            <Link to="/portal" className="hl-btn-secondary lp-btn-outline-dark">Client portal</Link>
            <Link to="/login" className="hl-btn-secondary lp-btn-outline-dark">
              Sign in
            </Link>
            <Link to="/signup" className="hl-btn-primary lp-btn-accent">
              Get Started & Plans
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="lp-hero lp-invert">
        <div className="lp-shell lp-hero-grid">
          <div className="lp-hero-copy">
            <span className="lp-loop-label">
              <span className="lp-loop-dot" aria-hidden="true" />
              crm_event → whatsapp → crm_action
            </span>
            <h1 className="lp-h1">
              Your CRM sends the message. WhatsApp{" "}
              <span className="lp-accent">writes the CRM back.</span>
            </h1>
            <p className="lp-lede">
              An invoice, quotation, AMC contract or walk-in is raised in the CRM and
              reaches the customer on WhatsApp with buttons attached. When they tap one,
              the reply becomes a CRM record — no re-typing, no second system.
            </p>
            <div className="lp-cta-row">
              <Link to="/login" className="hl-btn-primary lp-btn-accent lp-btn-lg">
                Sign in to your workspace
                <ArrowRight size={16} />
              </Link>
              <Link to="/signup" className="hl-btn-secondary lp-btn-outline-dark lp-btn-lg">
                Get Started & Plans
              </Link>
            </div>
            <p className="lp-hero-note">
              Works with the CRM you already run. WhatsApp Web and Meta Cloud API both
              supported.
            </p>
          </div>

          {/* The chain is a working demonstration, not a picture: pressing a
              button runs the inbound half and resolves the final stage. */}
          <div className="lp-chain" aria-label="How an invoice becomes a WhatsApp message and a CRM update">
            {CHAIN.map((stage, i) => (
              <div
                key={stage.node}
                className={`lp-chain-stage${i === 1 ? " is-claimed" : ""}`}
                data-reveal
                style={{ "--reveal-delay": `${i * 70}ms` }}
              >
                <span className="lp-chain-step">{stage.step}</span>
                <span className="lp-chain-body">
                  <code className="lp-node">{stage.node}</code>
                  <strong>{stage.title}</strong>
                  <span className="lp-chain-detail">{stage.detail}</span>
                </span>
                {i === 1 && (
                  <span className="lp-chain-flag">
                    <span className="lp-pulse" aria-hidden="true" />
                    claimed
                  </span>
                )}
              </div>
            ))}

            <div className="lp-chain-stage" data-reveal style={{ "--reveal-delay": "140ms" }}>
              <span className="lp-chain-step">03</span>
              <span className="lp-chain-body">
                <span className="lp-node lp-node-wa">
                  <span className="lp-dot" aria-hidden="true" />
                  whatsapp
                </span>
                <span className="lp-msg">
                  {MESSAGE.map((line) => (
                    <span className="lp-msg-line" key={line}>
                      {waLine(line)}
                    </span>
                  ))}
                </span>
                <span className="lp-replies" role="group" aria-label="Reply buttons sent to the customer">
                  {BUTTONS.map((btn) => (
                    <button
                      key={btn.id}
                      type="button"
                      className={`lp-reply-btn${pressed === btn.id ? " is-on" : ""}`}
                      aria-pressed={pressed === btn.id}
                      onClick={() => setPressed(pressed === btn.id ? null : btn.id)}
                    >
                      {btn.label}
                      <span className="lp-reply-action">{btn.note}</span>
                    </button>
                  ))}
                </span>
                <span className="lp-chain-hint">
                  {chosen
                    ? "Customer tapped one — the CRM moves."
                    : "Press a button to run the reply half."}
                </span>
              </span>
            </div>

            <div
              className={`lp-chain-stage lp-chain-result${chosen ? " is-live" : ""}`}
              data-reveal
              style={{ "--reveal-delay": "210ms" }}
            >
              <span className="lp-chain-step">04</span>
              <span className="lp-chain-body">
                {chosen ? (
                  <>
                    <code className="lp-node is-on">{chosen.result}</code>
                    <strong>{chosen.resultTitle}</strong>
                    <span className="lp-chain-detail">{chosen.resultDetail}</span>
                  </>
                ) : (
                  <>
                    <code className="lp-node is-idle">awaiting_reply</code>
                    <strong>Nothing is written until the customer answers</strong>
                    <span className="lp-chain-detail">
                      Tap, list reply and free text all resolve back to the record that
                      started this.
                    </span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ── The loop, both directions ──────────────────────────── */}
      <section className="lp-section lp-loop" id="lp-loop">
        <div className="lp-shell">
          <span className="hl-section-label">How it works</span>
          <h2 className="lp-h2">One loop, run in both directions</h2>
          <div className="lp-directions">
            <article className="lp-direction" data-reveal>
              <span className="lp-direction-tag">Outbound</span>
              <h3>A record change becomes a message</h3>
              <p>
                The bus watches the CRM tables directly, so a row saved by anyone — a
                salesperson, the accounts desk, an import — is picked up on the next
                sweep. Matched rules run only after the contact has not opted out and
                the same message has not already gone out.
              </p>
            </article>
            <article className="lp-direction" data-reveal style={{ "--reveal-delay": "60ms" }}>
              <span className="lp-direction-tag">Inbound</span>
              <h3>A reply becomes a record change</h3>
              <p>
                Buttons, list replies and typed messages all resolve to an action the
                CRM understands: mark paid, send the PDF, raise a callback, approve a
                quote, or capture a UTR against an invoice.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ── Event ledger ───────────────────────────────────────── */}
      <section className="lp-section lp-ledger-band lp-invert" id="lp-events">
        <div className="lp-shell">
          <span className="hl-section-label">The event bus</span>
          <h2 className="lp-h2">Every trigger this workspace can fire</h2>
          <p className="lp-sub">
            Rules bind to any of these. Switch one on per event, set the delay, and
            point it at a message, a chatbot flow, or both.
          </p>

          <ul className="lp-events" data-reveal>
            {EVENTS.map((ev) => (
              <li key={ev.name} className="lp-event">
                <code>{ev.name}</code>
                <span>{ev.does}</span>
              </li>
            ))}
          </ul>

          <div className="lp-swept" data-reveal>
            <span className="lp-swept-label">
              <span className="lp-pulse" aria-hidden="true" />
              Swept every 30s
            </span>
            <span className="lp-swept-body">
              A row created in any of these tables fires on its own — no rule edit
              needed.
            </span>
            <ul className="lp-swept-tables">
              {SWEPT.map((t) => (
                <li key={t}>
                  <code>{t}</code>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Surfaces ───────────────────────────────────────────── */}
      <section className="lp-section" id="lp-surfaces">
        <div className="lp-shell">
          <span className="hl-section-label">Day to day</span>
          <h2 className="lp-h2">Where your team actually works</h2>
          <div className="lp-surfaces">
            {SURFACES.map((group, gi) => (
              <article
                key={group.group}
                className="lp-surface-group"
                data-reveal
                style={{ "--reveal-delay": `${gi * 60}ms` }}
              >
                <h3 className="lp-surface-group-title">
                  <group.icon size={16} />
                  {group.group}
                </h3>
                <dl className="lp-surface-list">
                  {group.items.map((item) => (
                    <div key={item.name} className="lp-surface-item">
                      <dt>{item.name}</dt>
                      <dd>{item.does}</dd>
                    </div>
                  ))}
                </dl>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Connecting a number ────────────────────────────────── */}
      <section className="lp-section lp-engines lp-invert" id="lp-accounts">
        <div className="lp-shell">
          <span className="hl-section-label">Connecting a number</span>
          <h2 className="lp-h2">Whichever way you connect it</h2>
          <p className="lp-sub">
            All three land in the same inbox, the same contact records and the same
            send log.
          </p>
          <div className="lp-engines-grid">
            {ENGINES.map((engine, i) => (
              <article
                key={engine.title}
                className="lp-engine"
                data-reveal
                style={{ "--reveal-delay": `${i * 60}ms` }}
              >
                <engine.icon size={18} />
                <h3>{engine.title}</h3>
                <p>{engine.body}</p>
              </article>
            ))}
          </div>
          <ul className="lp-guarantees">
            {GUARANTEES.map((g) => (
              <li key={g}>
                <CheckCircle2 size={15} />
                {g}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ── Closing ────────────────────────────────────────────── */}
      <section className="lp-section lp-close">
        <div className="lp-shell lp-close-row">
          <div>
            <h2 className="lp-h2">Already running it?</h2>
            <p className="lp-sub">
              Sign in and you land in the inbox. New here — an admin provisions the
              account so your number, roles and templates stay yours.
            </p>
          </div>
          <div className="lp-cta-row lp-cta-row-end">
            <Link to="/login" className="hl-btn-primary lp-btn-lg">
              Sign in
              <ArrowRight size={16} />
            </Link>
            <Link to="/signup" className="hl-btn-secondary lp-btn-lg">
              Get Started & Plans
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────── */}
      <footer className="lp-footer">
        <div className="lp-shell lp-footer-row">
          <span className="hl-wordmark" style={{ color: "var(--color-paper-2)", fontSize: "0.95rem" }}>
            <span className="hl-wordmark-mark" aria-hidden="true"></span>
            <span>
              Madhura&nbsp;<em>WhatsApp CRM</em>
            </span>
          </span>
          <nav className="lp-footer-links" aria-label="Footer">
            <Link to="/login">Sign in</Link>
            <Link to="/signup">Get Started & Plans</Link>
            <a href="https://crm.madhuratech.com">CRM Dashboard</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
