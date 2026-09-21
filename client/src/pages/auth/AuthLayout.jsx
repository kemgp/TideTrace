import React, { useState } from "react";
import { Link } from "react-router-dom";

export function AuthLayout({ title, children, tab }) {
  return <div className="auth-wrap"><div className="auth-card">
    <div className="auth-brand">
      <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#203463" strokeWidth="1.8" aria-hidden="true"><path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /><path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" /></svg>
      <span>TideTrace</span>
    </div>
    <h1>{title}</h1>
    <p className="sub">Community-powered ecosystem conservation</p>
    {tab && <div className="auth-tabs">
      <Link to="/login" className={tab === "login" ? "auth-tab on" : "auth-tab"} aria-current={tab === "login" ? "page" : undefined}>Log in</Link>
      <Link to="/register" className={tab === "register" ? "auth-tab on" : "auth-tab"} aria-current={tab === "register" ? "page" : undefined}>Sign up</Link>
    </div>}
    {children}
    <div style={{ textAlign: "center", marginTop: 14 }}><Link className="btn ghost sm" to="/">← Back to home</Link></div>
  </div></div>;
}

export function PasswordField({ id, value, onChange, busy, newPassword = false }) {
  const [visible, setVisible] = useState(false);
  return <div className="fgroup">
    <label htmlFor={id}>Password</label>
    <div className="password-wrap">
      <input id={id} className="input" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"}
        placeholder={newPassword ? "At least 8 characters" : "Your password"} required minLength={newPassword ? 8 : undefined} maxLength={128}
        disabled={busy} value={value} onChange={onChange} />
      <button className="toggle-password" type="button" aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onClick={() => setVisible((previous) => !previous)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" />{!visible && <path d="M3 3l18 18" />}</svg>
      </button>
    </div>
  </div>;
}
