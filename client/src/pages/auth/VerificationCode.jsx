import React, { useEffect, useState } from "react";

const RESEND_DELAY = 30;

export default function VerificationCode({ email, onVerify, onBack, onResend, initiallySent = true }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(initiallySent ? RESEND_DELAY : 0);

  useEffect(() => {
    if (resendIn === 0) return undefined;
    const timer = window.setTimeout(() => setResendIn((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendIn]);

  async function verify(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try { await onVerify(code); }
    catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  async function resend() {
    if (busy || resendIn > 0) return;
    setBusy(true);
    setError("");
    try {
      await onResend();
      setCode("");
      setNotice("If confirmation is required, a new email will arrive shortly. Check your spam folder too.");
      setResendIn(RESEND_DELAY);
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  return <div className="auth-verification fade-in">
    <h1>Confirm your email</h1>
    <p className="sub">Check {email} for a confirmation email. Follow its link, or enter the verification code if your email includes one.</p>
    <form onSubmit={verify} aria-busy={busy}>
      <div className="fgroup">
        <label htmlFor="signup-code">Verification code</label>
        <input id="signup-code" className="input verification-code" type="text" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]{6,10}" minLength={6} maxLength={10} required value={code} disabled={busy}
          onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, ""))} aria-invalid={Boolean(error)} />
      </div>
      {error && <p className="auth-code-error" role="alert">{error}</p>}
      {notice && <p className="auth-code-hint" role="status">{notice}</p>}
      <button className="btn blue" style={{ width: "100%" }} type="submit" disabled={busy || code.length < 6}>{busy ? "Please wait…" : "Verify email"}</button>
    </form>
    <button className="btn ghost sm" type="button" disabled={busy || resendIn > 0} onClick={resend}>{resendIn > 0 ? `Resend email in ${resendIn}s` : "Resend confirmation email"}</button>
    <button className="btn ghost sm" type="button" disabled={busy} onClick={onBack}>Back to log in</button>
  </div>;
}
