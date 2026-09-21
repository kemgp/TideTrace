import React, { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import { ROLE_HOME } from "../../api/auth.js";
import { AuthLayout, PasswordField } from "./AuthLayout.jsx";
import VerificationCode from "./VerificationCode.jsx";

export default function Register() {
  const { role, register, verifySignup, resendConfirmation, showToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const nextRole = await register({ display_name: name.trim(), email: email.trim(), password });
      setPassword("");
      if (nextRole) {
        showToast("Welcome to TideTrace!");
        navigate(ROLE_HOME[nextRole], { replace: true });
      } else { setVerificationEmail(email.trim()); }
    } catch (failure) { setError(failure.message); }
    finally { setBusy(false); }
  }

  if (role) return <Navigate to={ROLE_HOME[role]} replace />;
  if (verificationEmail) return <div className="auth-wrap"><div className="auth-card">
    <VerificationCode email={verificationEmail}
      onVerify={async (token) => {
        const nextRole = await verifySignup(verificationEmail, token);
        showToast("Email verified. Welcome to TideTrace!");
        navigate(ROLE_HOME[nextRole], { replace: true });
      }}
      onBack={() => navigate("/login")}
      onResend={() => resendConfirmation(verificationEmail)} />
  </div></div>;

  return <AuthLayout title="Join TideTrace" tab="register">
    <form onSubmit={submit} aria-busy={busy}>
      {error && <div className="err show" role="alert">{error}</div>}
      <div className="fgroup">
        <label htmlFor="register-name">Full name</label>
        <input id="register-name" className="input" autoComplete="name" required maxLength={100} disabled={busy} placeholder="Your name" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <div className="fgroup">
        <label htmlFor="register-email">Email</label>
        <input id="register-email" className="input" type="email" autoComplete="email" required maxLength={254} disabled={busy} placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <PasswordField id="register-password" newPassword value={password} busy={busy} onChange={(event) => setPassword(event.target.value)} />
      <button className="btn blue" style={{ width: "100%" }} type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
    </form>
  </AuthLayout>;
}
