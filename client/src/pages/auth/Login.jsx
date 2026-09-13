import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import VerificationCode from "./VerificationCode.jsx";

const ROLE_HOME = { user: "/user/dashboard", mod: "/moderator/dashboard", admin: "/admin/dashboard" };

export default function Login() {
  const { login, showToast } = useApp();
  const navigate = useNavigate();
  const [role, setRole] = useState("user");
  const [email, setEmail] = useState("ana@tidetrace.app");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");

  const sendVerificationCode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setVerificationCode(code);
    showToast(`Verification code sent to ${email}: ${code}`);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!password) {
      setError(true);
      return;
    }
    setError(false);
    sendVerificationCode();
  };

  if (verificationCode) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <VerificationCode
            email={email}
            code={verificationCode}
            onVerified={() => { login(role); showToast("Welcome back!"); navigate(ROLE_HOME[role]); }}
            onBack={() => setVerificationCode("")}
            onResend={sendVerificationCode}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-brand">
          <svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke="#203463" strokeWidth="1.8">
            <path d="M2 12c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
            <path d="M2 17c2-3 4-3 6 0s4 3 6 0 4-3 6 0" />
          </svg>
          <span>TideTrace</span>
        </div>
        <h1>Welcome to TideTrace</h1>
        <p className="sub">Community-powered ecosystem conservation</p>

        <div className="auth-tabs">
          <button type="button" className="on">Log in</button>
          <Link to="/register" style={{ flex: 1 }}>
            <button type="button" style={{ width: "100%" }}>Sign up</button>
          </Link>
        </div>

        <form onSubmit={submit}>
          <div className={`err ${error ? "show" : ""}`}>✕ Invalid credentials — please try again.</div>

          <div className="auth-tabs role-tabs">
            <button type="button" className={role === "user" ? "on" : ""} onClick={() => setRole("user")}>
              👤 Community<small>member</small>
            </button>
            <button type="button" className={role === "mod" ? "on" : ""} onClick={() => setRole("mod")}>
              🛡 Moderator<small>review &amp; verify</small>
            </button>
            <button type="button" className={role === "admin" ? "on" : ""} onClick={() => setRole("admin")}>
              ⚙ Admin<small>manage platform</small>
            </button>
          </div>

          <div className="fgroup">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="fgroup">
            <label>Password</label>
            <div className="password-wrap">
              <input
                className="input"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                className="toggle-password"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="2.5" /></svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l18 18" /><path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" /><path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 8 10 8a18.7 18.7 0 0 1-3.2 4.2" /><path d="M6.2 6.2C3.5 8 2 12 2 12s3.5 8 10 8c1.8 0 3.4-.4 4.8-1.1" /></svg>
                )}
              </button>
            </div>
          </div>
          <div className="auth-forgot"><Link to="/forgot-password">Forgot password?</Link></div>
          <button className="btn clay" style={{ width: "100%" }} type="submit">Log in</button>
        </form>

        <p className="auth-note">
          Wireframe demo — pick a role and log in with any password. Leave it blank to preview the error state.
        </p>
        <div style={{ textAlign: "center", marginTop: 8 }}>
          <Link to="/"><button className="btn ghost sm" type="button">← Back to home</button></Link>
        </div>
      </div>
    </div>
  );
}
