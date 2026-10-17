import React, { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ROLE_HOME } from "../../api/auth.js";
import { AuthLayout, EmailField, PasswordField } from "./AuthLayout.jsx";
import VerificationCode from "./VerificationCode.jsx";

export default function Login() {
  const { role, login, verifySignup, resendConfirmation, showToast } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const nextRole = await login(email, password);
      setPassword("");
      showToast("Welcome back!");
      navigate(ROLE_HOME[nextRole], { replace: true });
    } catch (failure) {
      setError(failure.message);
      if (failure.code === "EMAIL_NOT_CONFIRMED") {
        setVerificationEmail(email.trim());
        setPassword("");
      }
    } finally { setBusy(false); }
  }

  if (role) return <Navigate to={ROLE_HOME[role]} replace />;
  if (verificationEmail) return <div className="auth-wrap"><div className="auth-card">
    <VerificationCode email={verificationEmail} initiallySent={false}
      onVerify={async (token) => {
        const nextRole = await verifySignup(verificationEmail, token);
        showToast("Email verified. Welcome!");
        navigate(ROLE_HOME[nextRole], { replace: true });
      }}
      onBack={() => { setVerificationEmail(""); setError(""); }}
      onResend={() => resendConfirmation(verificationEmail)} />
  </div></div>;

  return <AuthLayout title="Welcome to TideTrace" tab="login">
    <form onSubmit={submit} aria-busy={busy}>
      {error && <div className="err show" role="alert">{error}</div>}
      <EmailField id="login-email" value={email} busy={busy} placeholder="Email address" onChange={(event) => setEmail(event.target.value)} />
      <PasswordField id="login-password" value={password} busy={busy} placeholder="Password" onChange={(event) => setPassword(event.target.value)}/>
      <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
      <button className="btn clay" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Signing in…" : "Log in"}</button>
    </form>
    <p className="auth-note">Sign in with your TideTrace account. Your account determines which dashboard opens.</p>
  </AuthLayout>;
}
