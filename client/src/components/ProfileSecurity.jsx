import React from "react";
import { Link } from "react-router-dom";

export default function ProfileSecurity() {
  return <div className="settings-section-title security-card">
    <h2>Account security</h2>
    <p>Use an email recovery link to choose a new password for your account. Your password changes only after you complete the reset form.</p>
    <Link className="btn blue" to="/forgot-password">Reset password</Link>
  </div>;
}
