import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { CheckCircle2, ArrowLeft } from "lucide-react";
import { API } from "../config/api";

/* Request-access page. Accounts in this workspace are provisioned by an admin,
   so this does not create a login: it records the request and tells the user to
   wait for approval. Contract: POST {API}/api/auth/request-access
   {first_name, email, emp_id} -> {message} */
export default function Signup() {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [empId, setEmpId] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e?.preventDefault?.();
    if (!firstName.trim()) return setError("Please enter your full name");
    if (!email.trim()) return setError("Please enter your email");
    if (!empId.trim()) return setError("Please enter your employee ID");
    setLoading(true);
    setError("");
    try {
      const { data } = await axios.post(`${API}/api/auth/request-access`, {
        first_name: firstName.trim(),
        email: email.trim().toLowerCase(),
        emp_id: empId.trim(),
      });
      setDone(data?.message || "Access request received.");
    } catch (err) {
      setError(err.response?.data?.message || "Could not submit the request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="lp-auth">
      <div className="lp-auth-panel">
        <Link to="/" className="lp-auth-back">
          <ArrowLeft size={15} />
          Back to home
        </Link>

        <div className="hl-wordmark" style={{ color: "var(--color-ink)", marginBottom: 10 }}>
          <span className="hl-wordmark-mark" aria-hidden="true"></span>
          Madhura&nbsp;<em>WhatsApp CRM</em>
        </div>

        {done ? (
          <>
            <h1 className="hl-title" style={{ marginBottom: 6 }}>Request received</h1>
            <div
              role="status"
              className="lp-auth-note"
              style={{ background: "#ECFDF3", borderColor: "#ABEFC6", color: "#067647", marginBottom: 20 }}
            >
              <CheckCircle2 size={18} style={{ flex: "none" }} />
              <span>{done}</span>
            </div>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", lineHeight: 1.6, marginBottom: 22 }}>
              An admin creates the account for you. Once it is approved you can sign in with
              your email or employee ID — no password is needed until then.
            </p>
            <Link to="/login" className="hl-btn-primary" style={{ width: "100%" }}>
              Go to sign in
            </Link>
          </>
        ) : (
          <>
            <h1 className="hl-title" style={{ marginBottom: 4 }}>Request access</h1>
            <p style={{ fontSize: 13, color: "var(--color-ink-2)", marginBottom: 22 }}>
              Tell us who you are. An admin creates your account and approves it.
            </p>

            {error && (
              <div role="alert" className="lp-auth-error">{error}</div>
            )}

            <form onSubmit={submit} noValidate>
              <label htmlFor="lp-name" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                Full Name
              </label>
              <input
                id="lp-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                autoComplete="name"
                className="hl-input"
                style={{ width: "100%", marginBottom: 16 }}
                placeholder="Your name"
              />

              <label htmlFor="lp-email" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                Work Email
              </label>
              <input
                id="lp-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="hl-input"
                style={{ width: "100%", marginBottom: 16 }}
                placeholder="name@madhuratech.com"
              />

              <label htmlFor="lp-emp" className="hl-section-label" style={{ display: "block", marginBottom: 6 }}>
                Employee ID
              </label>
              <input
                id="lp-emp"
                type="text"
                value={empId}
                onChange={(e) => setEmpId(e.target.value)}
                autoComplete="off"
                className="hl-input"
                style={{ width: "100%", marginBottom: 22 }}
                placeholder="e.g. EMP-1042"
              />

              <button type="submit" disabled={loading} className="hl-btn-primary" style={{ width: "100%" }}>
                {loading ? "Sending…" : "Request access"}
              </button>
            </form>

            <p style={{ fontSize: 12, color: "var(--color-ink-2)", marginTop: 18, textAlign: "center" }}>
              Already have access?{" "}
              <Link to="/login" style={{ color: "var(--color-primary)", fontWeight: 600 }}>
                Sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
