import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Trash2, ShieldCheck, CheckCircle2, AlertCircle, ChevronRight, Mail } from "lucide-react";

export default function DataDeletionPage() {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [details, setDetails] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-3xl p-6 sm:p-12 shadow-sm space-y-8">
        {/* Header */}
        <div className="border-b border-slate-200 pb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="mb-4">
              <Link to="/login" className="inline-block focus:outline-none">
                <img src="/madhura-logo.png" alt="Madhura WhatsApp Automation" className="h-14 sm:h-[54px] w-auto object-contain" />
              </Link>
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 text-rose-800 text-xs font-bold border border-rose-200 mb-3">
              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
              <span>User Rights & Compliance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Data Deletion Instructions & Request Form
            </h1>
            <p className="text-xs text-slate-500 mt-1">
              In accordance with Meta Platform Policy and GDPR / DPDP regulations
            </p>
          </div>

          <Link
            to="/login"
            className="text-xs font-bold text-slate-600 hover:text-slate-900 transition"
          >
            Sign In to Madhura
          </Link>
        </div>

        {/* Instructions Body */}
        <div className="prose prose-slate prose-sm max-w-none space-y-6 text-slate-700 leading-relaxed">
          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">1. Deleting Data via Your Workspace Settings</h2>
            <p>
              If you have an active Madhura account, you can manage or purge your data directly:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-600">
              <li>Log in to your Madhura dashboard at <code className="text-slate-800 font-mono">live.wa.madhuratech.in</code>.</li>
              <li>Navigate to <strong>Settings → Account & Workspace</strong>.</li>
              <li>Under <strong>Connected Meta WhatsApp Accounts</strong>, click <em>Disconnect Number</em> or <em>Revoke WABA Access</em> to remove Meta access tokens.</li>
              <li>To delete your entire company workspace, contacts, and message history, click <strong>Delete Workspace</strong>.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">2. Disconnecting Madhura from Facebook / Meta</h2>
            <p>
              You can revoke Madhura's authorization directly from your Facebook account at any time:
            </p>
            <ol className="list-decimal list-inside space-y-1 pl-2 text-slate-600">
              <li>Open your Facebook profile settings and go to <strong>Settings & Privacy → Settings</strong>.</li>
              <li>Select <strong>Business Integrations</strong>.</li>
              <li>Locate <strong>Madhura WhatsApp CRM</strong> and click <strong>Remove</strong>.</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="text-base font-bold text-slate-900">3. Submit a Manual Data Erasure Request</h2>
            <p>
              If you do not have account access or wish to request immediate permanent erasure of all associated data, submit the form below or email{" "}
              <a href="mailto:privacy@madhuratech.in" className="text-emerald-700 font-semibold underline">
                privacy@madhuratech.in
              </a>.
            </p>
          </section>
        </div>

        {/* Deletion Form */}
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-slate-700" />
            <h3 className="text-sm font-bold text-slate-900">
              Direct Data Deletion Request
            </h3>
          </div>

          {submitted ? (
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-emerald-950 mb-0.5">Request Received</span>
                We have registered your deletion request. Our privacy operations team will verify your identity and process data erasure within 7 business days. A confirmation receipt will be emailed to {email}.
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Registered Business Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Company / Organization Name
                  </label>
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Your Company Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Specific Details or Phone Numbers to Purge
                </label>
                <textarea
                  rows={3}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  placeholder="Optional details, e.g. purge phone number +91... and all associated message history"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition shadow-sm"
                >
                  Submit Deletion Request
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Footer Navigation */}
        <div className="pt-6 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-4">
            <Link to="/terms" className="hover:text-slate-800 underline">Terms of Service</Link>
            <Link to="/privacy" className="hover:text-slate-800 underline">Privacy Policy</Link>
          </div>
          <Link to="/signup" className="font-bold text-emerald-600 hover:text-emerald-700">
            Create Account
          </Link>
        </div>
      </div>
    </div>
  );
}
