import React from "react";
import { Link } from "react-router-dom";
import { ShieldCheck, FileText, ChevronRight } from "lucide-react";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-12 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="mb-4">
              <Link to="/signup" className="inline-block focus:outline-none">
                <img src="/Group.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[54px] w-auto object-contain" />
              </Link>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-800 text-xs font-bold mb-3">
              <FileText className="w-3.5 h-3.5 text-slate-600" />
              <span>Legal Agreement</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Terms of Service
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              Last updated: January 2026 | Effective for all Madhura Enterprise Workspaces
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
            <h2 className="text-base font-bold text-slate-900">1. Acceptance of Terms</h2>
            <p>
              By accessing, registering for, or using the Madhura Enterprise WhatsApp CRM SaaS platform ("Service"), provided by Madhura Technologies ("Madhura", "we", "us", or "our"), you agree to be legally bound by these Terms of Service. If you are accepting these terms on behalf of an entity, company, or organization, you represent and warrant that you have full legal authority to bind such entity.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Meta Platform and WhatsApp Business Policy Compliance</h2>
            <p>
              Madhura integrates with the Meta WhatsApp Cloud API and Meta Business Platform. As a customer of Madhura, you explicitly agree to strictly abide by:
            </p>
            <ul className="list-disc list-inside space-y-1 pl-2 text-slate-600">
              <li>Meta Commercial Terms and WhatsApp Business Policy.</li>
              <li>WhatsApp Commerce Policy and messaging template guidelines.</li>
              <li>Prohibitions against spam, unsolicited automated bulk messaging, or transmission of prohibited goods.</li>
              <li>Obtaining prior verifiable opt-in consent from all recipients before initiating marketing or utility communications.</li>
            </ul>
            <p>
              Violation of Meta policies may result in immediate suspension of your WhatsApp Business Account by Meta or Madhura without liability.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Multi-Tenant Workspaces, Accounts & Security</h2>
            <p>
              You are responsible for maintaining the confidentiality of your account credentials, API access tokens, and two-step verification PINs. You agree to notify Madhura immediately of any unauthorized access or security incident affecting your workspace.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">4. Subscriptions, Fees & Cloud API Billing</h2>
            <p>
              Subscription fees for Madhura software features are billed in advance according to your selected billing cycle. Direct Meta WhatsApp conversation and template fees are billed either via your Meta Business Portfolio payment method or prepaid enterprise messaging wallet as configured.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">5. Limitation of Liability & Warranties</h2>
            <p>
              The Service is provided on an "as is" and "as available" basis. Madhura does not warrant uninterrupted availability or zero-latency delivery, as message delivery depends on telecommunications networks, mobile carriers, and Meta Cloud infrastructure.
            </p>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">6. Contact Information</h2>
            <p>
              For legal inquiries regarding these terms, contact our compliance team at{" "}
              <a href="mailto:compliance@madhuratech.in" className="text-emerald-700 font-semibold underline">
                compliance@madhuratech.in
              </a>.
            </p>
          </section>
        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link to="/privacy" className="hover:text-slate-800 underline">Privacy Policy</Link>
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
