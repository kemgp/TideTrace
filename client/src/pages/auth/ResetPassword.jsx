import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { authRequest, loadRecoverySession } from "../../api/auth.js";
import { useApp } from "../../context/AppContext.jsx";
import { AuthLayout, PasswordField } from "./AuthLayout.jsx";

export default function ResetPassword({ session, onRestart }) {
  const { clearSession } = useApp();
  const [recovery, setRecovery] = useState(null);
  const [fatalError, setFatalError] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const operation = useRef(null);

  useEffect(() => {
    clearSession();
    let active = true;
    operation.current ||= loadRecoverySession(session);
    operation.current.then((data) => { if (active) setRecovery(data); })
      .catch((failure) => { if (active) setFatalError(failure.message); });
    return () => { active = false; };
  }, [session, clearSession]);

  useEffect(() => {
    if (!recovery || done) return undefined;
    const timer = window.setTimeout(() => {
      setRecovery(null);
      setPassword("");
      setConfirmation("");
      setFatalError("Your recovery session expired. Request a new email to continue.");
    }, Math.min(2147483647, Math.max(0, recovery.expiresAt * 1000 - Date.now())));
    return () => window.clearTimeout(timer);
  }, [recovery, done]);

  async function submit(event) {
    event.preventDefault();
    if (busy || !recovery) return;
    setError("");
    if (password !== confirmation) { setError("Passwords do not match."); return; }
    if (recovery.expiresAt <= Date.now() / 1000) {
      setFatalError("Your recovery session expired. Request a new email to continue.");
      return;
    }
    setBusy(true);
    try {
      await authRequest("password", { method: "PUT", token: recovery.accessToken, body: { password } });
      clearSession();
      setPassword("");
      setConfirmation("");
      setRecovery(null);
      setDone(true);
      // Updating the password succeeded even if a follow-up logout cannot complete.
      try { await authRequest("logout", { token: recovery.accessToken, method: "POST" }); } catch { /* JWT expires automatically. */ }
    } catch (failure) {
      if (failure.status === 401) {
        setRecovery(null);
        setPassword("");
        setConfirmation("");
        setFatalError("Your recovery session is invalid or expired. Request a new email.");
      } else { setError(failure.message); }
    } finally { setBusy(false); }
  }

  if (done) return <AuthLayout title="Password updated">
    <p className="sub" role="status">Your password has been changed. Sign in with your new password; your account and role are unchanged.</p>
    <Link className="btn blue" to="/login">Back to log in</Link>
  </AuthLayout>;

  return <AuthLayout title="Reset your password">
    {fatalError ? <><p className="auth-code-error" role="alert">{fatalError}</p><Link className="btn blue" to="/forgot-password" onClick={onRestart}>Request a new recovery email</Link></>
      : !recovery ? <p role="status">Checking your recovery session…</p>
        : <>
          <p className="sub">Choose a new password for {recovery.email}.</p>
          <form onSubmit={submit} aria-busy={busy}>
            {error && <p className="auth-code-error" role="alert">{error}</p>}
            <PasswordField id="reset-password" label="New password" newPassword value={password} busy={busy} onChange={(event) => setPassword(event.target.value)} />
            <PasswordField id="reset-confirmation" label="Confirm new password" newPassword value={confirmation} busy={busy} onChange={(event) => setConfirmation(event.target.value)} />
            <button className="btn blue" style={{ width: "100%" }} disabled={busy} type="submit">{busy ? "Updating password…" : "Update password"}</button>
          </form>
        </>}
  </AuthLayout>;
}
