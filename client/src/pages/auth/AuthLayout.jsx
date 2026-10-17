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

export function EmailField({ id, value, onChange, busy, placeholder }) {
  const [invalid, setInvalid] = useState(false);
  return <div className="fgroup">
    <label htmlFor={id}>Email</label>
    <input id={id} className="input" type="email" autoComplete="email"
      placeholder={placeholder} required maxLength={254} disabled={busy} value={value}
      aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
      onInvalid={(event) => {
        event.preventDefault();
        setInvalid(true);
        event.currentTarget.focus();
      }}
      onChange={(event) => {
        if (invalid) setInvalid(!event.currentTarget.validity.valid);
        onChange(event);
      }} />
    {invalid && <p id={`${id}-error`} className="auth-email-error" role="alert">enter a valid email address</p>}
  </div>;
}

export function PasswordField({ id, value, onChange, busy, newPassword = false, label = "Password" }) {
  const [visible, setVisible] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const isInvalid = (text) => !text || (newPassword && text.length < 8) || text.length > 128;
  const errorMessage = !value ? "Enter your password" : value.length > 128 ? "Use no more than 128 characters" : "Use at least 8 characters";
  return <div className="fgroup">
    <label htmlFor={id}>{label}</label>
    <div className="password-wrap">
      <input id={id} className="input" type={visible ? "text" : "password"} autoComplete={newPassword ? "new-password" : "current-password"}
        placeholder={newPassword ? "At least 8 characters" : "Password"} required minLength={newPassword ? 8 : undefined} maxLength={128}
        disabled={busy} value={value}
        aria-invalid={invalid || undefined} aria-describedby={invalid ? `${id}-error` : undefined}
        onInvalid={(event) => {
          event.preventDefault();
          setInvalid(true);
          event.currentTarget.focus();
        }}
        onBlur={(event) => {
          if (event.currentTarget.value) setInvalid(isInvalid(event.currentTarget.value));
        }}
        onChange={(event) => {
          if (invalid) setInvalid(isInvalid(event.currentTarget.value));
          onChange(event);
        }} />
      <button className="toggle-password" type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} onClick={() => setVisible((previous) => !previous)}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" />{!visible && <path d="M3 3l18 18" />}</svg>
      </button>
    </div>
    {invalid && <p id={`${id}-error`} className="auth-password-error" role="alert">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v6m0 3v1" /></svg>
      {errorMessage}
    </p>}
  </div>;
}
