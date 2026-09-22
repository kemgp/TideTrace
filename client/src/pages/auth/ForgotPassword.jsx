import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout } from "./AuthLayout.jsx";
import { ApiError, authRequest } from "../../api/auth.js";
import VerificationCode from "./VerificationCode.jsx";
import ResetPassword from "./ResetPassword.jsx";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [sentEmail, setSentEmail] = useState("");
  const [session, setSession] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const sendEmail = (address) => authRequest("forgot-password", { body: { email: address } });

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      await sendEmail(email.trim());
      setSentEmail(email.trim());
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  if (session) return <ResetPassword session={session} onRestart={() => { setSession(null); setSentEmail(""); setError(""); }} />;
  if (sentEmail) return <div className="auth-wrap"><div className="auth-card">
    <VerificationCode recovery email={sentEmail}
      onVerify={async (token) => {
        const data = await authRequest("verify", { body: { email: sentEmail, token, type: "recovery" } });
        if (!data.session) throw new ApiError("No recovery session was returned. Request a new email.", "MISSING_SESSION");
        setSession(data.session);
      }}
      onResend={() => sendEmail(sentEmail)}
      onBack={() => { setSentEmail(""); setError(""); }} />
    <Link className="btn ghost sm" to="/login">Back to log in</Link>
  </div></div>;

  return <AuthLayout title="Password recovery">
    <p className="sub">Enter your account email and we’ll send instructions to reset your password.</p>
    <form onSubmit={submit} aria-busy={busy}>
      {error && <p className="auth-code-error" role="alert">{error}</p>}
      <div className="fgroup">
        <label htmlFor="recovery-email">Email</label>
        <input id="recovery-email" className="input" type="email" autoComplete="email" required maxLength={254} disabled={busy}
          value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <button className="btn blue" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Sending…" : "Send recovery email"}</button>
    </form>
    <Link className="btn ghost sm" to="/login">Back to log in</Link>
  </AuthLayout>;
}
