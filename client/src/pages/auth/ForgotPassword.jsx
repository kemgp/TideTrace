import React, { useState } from "react";
import { Link } from "react-router-dom";
import { AuthLayout, EmailField } from "./AuthLayout.jsx";
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
    <div className="recovery-verification-footer"><Link className="btn ghost sm" to="/login">← Back to log in</Link></div>
  </div></div>;

  return <AuthLayout title="Forgot your password?" cardClassName="recovery-card"
    subtitle="Enter the email you used to sign up. We’ll send you instructions to reset your password."
    footer={<div className="recovery-footer">
      <Link className="recovery-login" to="/login">← Back to log in</Link>
      <Link className="recovery-home" to="/">Back to home</Link>
    </div>}>
    <form onSubmit={submit} aria-busy={busy}>
      {error && <p className="auth-code-error" role="alert">{error}</p>}
      <EmailField id="recovery-email" placeholder="you@example.com" busy={busy}
        value={email} onChange={(event) => setEmail(event.target.value)} />
      <button className="btn blue" style={{ width: "100%" }} type="submit" disabled={busy}>
        {busy && <span className="button-spinner" aria-hidden="true" />}
        {busy ? "Sending email…" : "Send recovery email"}
      </button>
    </form>
    <p className="recovery-help">Next, check your inbox. If the email doesn’t arrive, check your spam folder.</p>
  </AuthLayout>;
}
