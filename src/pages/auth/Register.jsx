import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import VerificationCode from "./VerificationCode.jsx";

export default function Register() {
  const { showToast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [barangay, setBarangay] = useState("Brgy. Lawis");
  const [verificationCode, setVerificationCode] = useState("");

  const sendVerificationCode = () => {
    const code = String(Math.floor(100000 + Math.random() * 900000));
    setVerificationCode(code);
    showToast(`Verification code sent to ${email}: ${code}`);
  };

  const submit = (e) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || password.length < 8) {
      showToast("Add your name, email, and a password of at least 8 characters");
      return;
    }
    sendVerificationCode();
  };

  if (verificationCode) {
    return (
      <div className="auth-wrap">
        <div className="auth-card">
          <VerificationCode
            email={email}
            code={verificationCode}
            onVerified={() => { showToast(`Account created for ${name || "you"} — please log in`); navigate("/login"); }}
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
        <h1>Join TideTrace</h1>
        <p className="sub">Community-powered ecosystem conservation</p>

        <div className="auth-tabs">
          <Link to="/login" style={{ flex: 1 }}>
            <button type="button" style={{ width: "100%" }}>Log in</button>
          </Link>
          <button type="button" className="on">Sign up</button>
        </div>

        <form onSubmit={submit}>
          <div className="fgroup">
            <label>Full name</label>
            <input className="input" placeholder="Ana Ramos" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="fgroup">
            <label>Email</label>
            <input className="input" type="email" placeholder="ana@tidetrace.app" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="fgroup">
            <label>Password</label>
            <div className="password-wrap">
              <input className="input" type={showPassword ? "text" : "password"} placeholder="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button
                className="toggle-password"
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? "◉" : "◌"}
              </button>
            </div>
          </div>
          <div className="fgroup">
            <label>Your barangay / community</label>
            <select className="input" value={barangay} onChange={(e) => setBarangay(e.target.value)}>
              <option>Brgy. Lawis</option>
              <option>Brgy. Punta</option>
              <option>Brgy. Candayas</option>
              <option>Other</option>
            </select>
          </div>
          <button className="btn blue" style={{ width: "100%" }} type="submit">Create account</button>
        </form>

        <div style={{ textAlign: "center", marginTop: 14 }}>
          <Link to="/"><button className="btn ghost sm" type="button">← Back to home</button></Link>
        </div>
      </div>
    </div>
  );
}
