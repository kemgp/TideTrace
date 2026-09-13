import React, { useEffect, useRef, useState } from "react";

const RESEND_DELAY = 30;

export default function VerificationCode({ email, code, onVerified, onBack, onResend }) {
  const [digits, setDigits] = useState(Array(6).fill(""));
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(RESEND_DELAY);
  const inputRefs = useRef([]);
  const enteredCode = digits.join("");

  useEffect(() => {
    if (resendIn === 0) return undefined;
    const timer = window.setInterval(() => {
      setResendIn((seconds) => Math.max(0, seconds - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  const setDigit = (index, value) => {
    if (!/^\d?$/.test(value)) return;
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const verify = (event) => {
    event.preventDefault();
    if (enteredCode === code) {
      onVerified();
      return;
    }
    setError("That code is incorrect. Try again or request a new code.");
    setDigits(Array(6).fill(""));
    inputRefs.current[0]?.focus();
  };

  return (
    <div className="auth-verification fade-in">
      <h1>Verify your account</h1>
      <p className="sub">Enter the 6-digit code sent to {email}.</p>
      <form onSubmit={verify}>
        <div className="code-inputs" aria-label="6-digit verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(element) => { inputRefs.current[index] = element; }}
              className="code-input"
              inputMode="numeric"
              maxLength={1}
              type="text"
              value={digit}
              autoFocus={index === 0}
              aria-invalid={Boolean(error)}
              aria-label={`Verification digit ${index + 1}`}
              onChange={(event) => setDigit(index, event.target.value)}
              onKeyDown={(event) => handleKeyDown(index, event)}
            />
          ))}
        </div>
        {error && <p className="auth-code-error" role="alert">{error}</p>}
        <p className="auth-code-hint">Demo code: {code}</p>
        <button className="btn blue" style={{ width: "100%" }} type="submit" disabled={enteredCode.length !== 6}>
          Verify code
        </button>
      </form>
      <button
        className="btn ghost sm"
        type="button"
        disabled={resendIn > 0}
        onClick={() => {
          onResend();
          setDigits(Array(6).fill(""));
          setError("");
          setResendIn(RESEND_DELAY);
          inputRefs.current[0]?.focus();
        }}
      >
        {resendIn > 0 ? `Resend code in ${resendIn}s` : "Resend code"}
      </button>
      <button className="btn ghost sm" type="button" onClick={onBack}>Back</button>
    </div>
  );
}
