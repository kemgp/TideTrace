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

  return <AuthLayout title="Confirm your email">
    {error ? <><p className="auth-code-error" role="alert">{error}</p><Link className="btn blue" to="/login">Back to log in</Link><Link className="btn ghost sm" to="/forgot-password">Request a new recovery email</Link></>
      : <p role="status">Checking your account…</p>}
  </AuthLayout>;
}
