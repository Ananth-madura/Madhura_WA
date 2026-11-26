import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, Lock, ChevronRight } from "lucide-react";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-12 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="mb-4">
              <Link to="/signup" className="inline-block focus:outline-none">
                <img src="/madhura-logo.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[54px] w-auto object-contain" />
              </Link>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 text-xs font-bold border border-emerald-200 mb-3">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Data Protection & Privacy</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Privacy Policy
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Last updated: January 2026 | Compliant with GDPR, DPDP Act 2023, and Meta Tech Provider Guidelines
            </p>
          </div>

          <Link
            to="/signup"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow-sm shrink-0"
          >
            <span>Create Account</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Legal Body */}
        <div className="prose prose-slate prose-sm max-w-none space-y-6 text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Information We Collect</h2>
            <p>
              Madhura processes information strictly to provide multi-tenant WhatsApp CRM services:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li><strong>Account Information:</strong> Name, business email, hashed credentials, company legal details, and tax identifiers (e.g. GSTIN).</li>
              <li><strong>Meta Business Platform Data:</strong> System User Access Tokens, WhatsApp Business Account (WABA) IDs, Phone Number IDs, and verified display names authorized via Meta Embedded Signup.</li>
              <li><strong>Message Logs & CRM Data:</strong> Inbound and outbound WhatsApp messages, timestamps, contact phone numbers, delivery status receipts (sent, delivered, read), and customer conversation tags.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. How We Use and Process Data</h2>
            <p>
              We process data solely for delivering CRM services, routing conversations to assigned team members, executing automated workflows, and providing analytics. We never sell customer or end-user personal data to third parties.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Multi-Tenant Data Isolation & Encryption</h2>
            <p>
              All customer tenant data is logically isolated using database-level workspace boundaries. Sensitive credentials such as Meta System User Access Tokens and app secrets are encrypted at rest using AES-256-GCM. All communication across the internet utilizes TLS 1.3 encryption.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Data Subject Rights & Deletion</h2>
            <p>
              Customers and their end-users possess rights to access, rectify, and delete their stored personal data. For instructions on executing automated or manual data erasure, please see our dedicated{" "}
              <Link to="/data-deletion" className="text-emerald-700 font-semibold underline">
                Data Deletion Policy
              </Link>.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">5. Privacy Officer Contact</h2>
            <p>
              For data protection questions, please contact our Data Protection Officer at{" "}
              <a href="mailto:privacy@madhuratech.in" className="text-emerald-700 font-semibold underline">
                privacy@madhuratech.in
              </a>.
            </p>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-slate-800 underline">Terms of Service</Link>
            <Link to="/data-deletion" className="hover:text-slate-800 underline">Data Deletion Policy</Link>
          </div>
          <Link to="/login" className="font-bold text-emerald-600 hover:text-emerald-700">
            Sign In to Madhura
          </Link>
        </div>
      </div>
    </div>
  );
}
