import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./forgot-password.css";

function WaveMark() {
  return <svg className="fp-logo-mark" viewBox="0 0 64 40" fill="none" aria-hidden="true"><path d="M2 22c5-9 11-9 16 0s11 9 16 0 11-9 16 0" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" /><path d="M2 31c5-9 11-9 16 0s11 9 16 0 11-9 16 0" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" opacity="0.45" /></svg>;
}

function BackgroundWaves() {
  return <svg className="fp-bg-waves" viewBox="0 0 1440 320" preserveAspectRatio="none" aria-hidden="true"><path className="fp-wave fp-wave-1" d="M0,224 C240,280 480,168 720,192 C960,216 1200,288 1440,240 L1440,320 L0,320 Z" /><path className="fp-wave fp-wave-2" d="M0,256 C240,192 480,272 720,240 C960,208 1200,160 1440,208 L1440,320 L0,320 Z" /><path className="fp-wave fp-wave-3" d="M0,288 C240,248 480,304 720,272 C960,240 1200,296 1440,272 L1440,320 L0,320 Z" /></svg>;
}

function EyeIcon({ open }) {
  return open ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" stroke="currentColor" strokeWidth="1.6" /><circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg> : <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M3 3l18 18M10.6 10.7a3.2 3.2 0 0 0 4.5 4.5M6.6 6.9C4 8.5 2 12 2 12s3.6 7 10 7c1.8 0 3.3-.4 4.6-1.1M9.9 5.2A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a15.6 15.6 0 0 1-2.9 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>;
}

function RuleCheckIcon({ met }) {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none">{met ? <><circle cx="12" cy="12" r="10" fill="currentColor" opacity="0.15" /><path d="M7.5 12.5l3 3 6-6.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></> : <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" opacity="0.5" />}</svg>;
}

function BigCheckIcon() {
  return <svg width="30" height="30" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10.5" stroke="currentColor" strokeWidth="1.7" /><path d="M7.5 12.4l3 3 6.2-6.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function StepProgress({ step }) {
  return <div className="fp-progress" aria-hidden="true">{[0, 1, 2].map((i) => <span key={i} className={`fp-dot ${i <= step ? "fp-dot-active" : ""}`} />)}</div>;
}

function RequestStep({ onContinue, onBackToLogin }) {
  return <><StepProgress step={0} /><h2>Forgot your password?</h2><p className="fp-desc">Enter the email or phone number on your account and we&apos;ll send you a code to reset it.</p><div className="fp-field"><label htmlFor="fp-identifier">Email or phone</label><input id="fp-identifier" className="fp-input" type="text" placeholder="you@example.com" /></div><button type="button" className="fp-primary-btn" onClick={onContinue}>Send reset code</button><button type="button" className="fp-link-btn" onClick={onBackToLogin}>Back to log in</button></>;
}

function VerifyStep({ onContinue, onBack }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const inputRefs = useRef([]);
  const setDigit = (i, val) => { if (!/^[0-9]?$/.test(val)) return; const next = [...digits]; next[i] = val; setDigits(next); if (val && i < 5) inputRefs.current[i + 1]?.focus(); };
  const onKeyDown = (i, e) => { if (e.key === "Backspace" && !digits[i] && i > 0) inputRefs.current[i - 1]?.focus(); };
  const complete = digits.every((d) => d !== "");
  return <><StepProgress step={1} /><h2>Verify your account</h2><p className="fp-desc">We sent a 6-digit code to your email. Enter it below to continue.</p><div className="fp-code-row">{digits.map((d, i) => <input key={i} ref={(el) => (inputRefs.current[i] = el)} className="fp-code-input" type="text" inputMode="numeric" maxLength={1} value={d} onChange={(e) => setDigit(i, e.target.value)} onKeyDown={(e) => onKeyDown(i, e)} />)}</div><button type="button" className="fp-primary-btn" disabled={!complete} onClick={onContinue}>Verify code</button><button type="button" className="fp-link-btn">Didn&apos;t get a code? Resend</button><button type="button" className="fp-back-btn" onClick={onBack}>← Back</button></>;
}

function NewPasswordStep({ onContinue, onBack }) {
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const rules = [{ label: "At least 8 characters", met: pw.length >= 8 }, { label: "A letter and a number", met: /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw) }];
  const mismatch = confirm.length > 0 && confirm !== pw;
  const canContinue = rules.every((r) => r.met) && confirm.length > 0 && !mismatch;
  return <><StepProgress step={2} /><h2>Create a new password</h2><p className="fp-desc">Make it something you haven&apos;t used before.</p><div className="fp-field"><label htmlFor="fp-new-password">New password</label><div className="fp-input-wrap"><input id="fp-new-password" className="fp-input" type={showPw ? "text" : "password"} placeholder="Enter new password" value={pw} onChange={(e) => setPw(e.target.value)} /><button type="button" className="fp-toggle-eye" onClick={() => setShowPw(!showPw)} aria-label="Toggle password visibility"><EyeIcon open={showPw} /></button></div></div><div className="fp-field"><label htmlFor="fp-confirm-password">Confirm password</label><div className="fp-input-wrap"><input id="fp-confirm-password" className="fp-input" type={showConfirm ? "text" : "password"} placeholder="Re-enter new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} /><button type="button" className="fp-toggle-eye" onClick={() => setShowConfirm(!showConfirm)} aria-label="Toggle password visibility"><EyeIcon open={showConfirm} /></button></div>{mismatch && <p className="fp-error">Passwords don&apos;t match</p>}</div><ul className="fp-rules">{rules.map((r) => <li key={r.label} className={r.met ? "fp-rule-met" : ""}><RuleCheckIcon met={r.met} />{r.label}</li>)}</ul><button type="button" className="fp-primary-btn" disabled={!canContinue} onClick={onContinue}>Reset password</button><button type="button" className="fp-back-btn" onClick={onBack}>← Back</button></>;
}

function SuccessStep({ onDone }) {
  return <><div className="fp-success-icon"><BigCheckIcon /></div><h2>Password updated</h2><p className="fp-desc">Your password has been reset. You can now log in with your new password.</p><button type="button" className="fp-primary-btn" onClick={onDone}>Back to log in</button></>;
}

function ForgotPasswordFlow({ onDone }) {
  const [step, setStep] = useState("request");
  return <div className="fp-shell"><BackgroundWaves /><div className="fp-logo"><WaveMark /><h1>TideTrace</h1></div><div className="fp-card">{step === "request" && <RequestStep onContinue={() => setStep("code")} onBackToLogin={onDone} />}{step === "code" && <VerifyStep onContinue={() => setStep("new-password")} onBack={() => setStep("request")} />}{step === "new-password" && <NewPasswordStep onContinue={() => setStep("success")} onBack={() => setStep("code")} />}{step === "success" && <SuccessStep onDone={onDone} />}</div></div>;
}

export default function ForgotPassword() {
  const navigate = useNavigate();
  return <ForgotPasswordFlow onDone={() => navigate("/login")} />;
}
