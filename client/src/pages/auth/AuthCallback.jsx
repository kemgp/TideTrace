import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { readConfirmation, ROLE_HOME } from "../../api/auth.js";
import { AuthLayout } from "./AuthLayout.jsx";
import ResetPassword from "./ResetPassword.jsx";

export default function AuthCallback() {
  const { confirmSession } = useApp();
  const navigate = useNavigate();
  const [confirmation] = useState(() => readConfirmation(window.location));
  const [error, setError] = useState("");
  const operation = useRef(null);

  useEffect(() => {
    // Remove email-link tokens from the address bar without retaining them in history.
    window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    if (confirmation?.type === "recovery") return undefined;
    if (!confirmation?.session) {
      setError(confirmation?.error || "This link has no sign-in session. If your email is confirmed, log in to continue.");
      return undefined;
    }
    let active = true;
    // React StrictMode must not consume the same confirmation twice.
    operation.current ||= confirmSession(confirmation.session);
    operation.current.then((role) => { if (active) navigate(ROLE_HOME[role], { replace: true }); })
      .catch((failure) => { if (active) setError(failure.message); });
    return () => { active = false; };
  }, [confirmation, confirmSession, navigate]);

  if (confirmation?.type === "recovery") return <ResetPassword session={confirmation.session} />;

  if (error) return <AuthLayout title="This email link isn’t working" cardClassName="email-link-error-card"
    subtitle="Let’s help you get back into your account."
    footer={<div className="recovery-footer">
      <Link className="recovery-login" to="/login">← Back to log in</Link>
      <Link className="recovery-home" to="/">Back to home</Link>
    </div>}>
    <div className="email-link-notice" role="alert">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
      <p>{error}</p>
    </div>
    <Link className="btn blue email-link-retry" to="/forgot-password">Request a new recovery email</Link>
    <p className="recovery-help">Use the link in the newest email. Older links may no longer work.</p>
    <p className="email-link-signup-help">Confirming a new account? <Link to="/login">Log in to request another confirmation email.</Link></p>
  </AuthLayout>;

  return <AuthLayout title="Confirm your email">
    <p role="status">Checking your account…</p>
  </AuthLayout>;
}
