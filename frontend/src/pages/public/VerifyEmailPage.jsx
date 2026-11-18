import React, { useState, useEffect } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { ShieldCheck, Mail, ArrowRight, RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";
import { API } from "../../config";
import { useAuth } from "../../auth/AuthContext";

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshProfile } = useAuth();

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const qEmail = searchParams.get("email") || localStorage.getItem("pending_signup_email") || "";
    if (qEmail) setEmail(qEmail);
  }, [searchParams]);

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    const cleanCode = code.replace(/\D/g, "");
    if (cleanCode.length !== 6) {
      setError("Please enter a valid 6-digit verification code");
      return;
    }
    if (!email) {
      setError("Please provide your business email address");
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {
      const res = await axios.post(`${API}/api/auth/verify-email`, {
        email: email.trim(),
        code: cleanCode
      });

      if (res.data?.success && res.data?.token) {
        localStorage.setItem("token", res.data.token);
        if (res.data.user) {
          localStorage.setItem("user", JSON.stringify(res.data.user));
        }
        localStorage.removeItem("pending_signup_email");
        if (refreshProfile) {
          try {
            await refreshProfile();
          } catch (_) {}
        }
        setNotice("Email verified successfully! Opening company workspace setup...");
        setTimeout(() => {
          navigate("/onboarding/company");
        }, 800);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Invalid or expired verification code. Please request a new one.");
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;
    setResending(true);
    setError("");
    setNotice("");
    try {
      const res = await axios.post(`${API}/api/auth/resend-verification`, {
        email: email.trim()
      });
      if (res.data?.success) {
        setNotice("A new 6-digit verification code has been sent to your email.");
        setCooldown(60);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resend code. Please try again in a moment.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-center mx-auto text-emerald-600">
            <Mail className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Verify Your Email
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed max-w-xs mx-auto">
            We sent a 6-digit confirmation code to your business email. Enter it below to activate your account.
          </p>
        </div>

        {error && (
          <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span className="flex-1">{error}</span>
          </div>
        )}

        {notice && (
          <div role="alert" className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="flex-1">{notice}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Business Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              6-Digit Verification Code
            </label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              placeholder="123456"
              className="w-full text-center tracking-widest text-2xl font-bold font-mono px-3.5 py-3 rounded-xl border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
            />
          </div>

          <button
            type="submit"
            disabled={loading || code.length !== 6}
            className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-sm transition flex items-center justify-center gap-2"
          >
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{loading ? "Verifying Code..." : "Verify & Continue"}</span>
          </button>
        </form>

        <div className="pt-2 text-center text-xs text-slate-500 space-y-2">
          <p>
            Didn't receive the email?{" "}
            <button
              type="button"
              onClick={handleResend}
              disabled={cooldown > 0 || resending}
              className="font-bold text-emerald-600 hover:text-emerald-700 disabled:text-slate-400"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : resending ? "Sending..." : "Resend code"}
            </button>
          </p>
          <div>
            <Link to="/login" className="text-slate-400 hover:text-slate-600 underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
