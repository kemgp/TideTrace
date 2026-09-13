import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../../context/AppContext.jsx";
import Sidebar from "../../../components/Sidebar.jsx";

const PANES = [
  { key: "account", label: "Account", number: "👤" },
  { key: "privacy", label: "Privacy", number: "🔒" },
  { key: "personal", label: "Personalization", number: "🌐" },
  { key: "app", label: "App settings", number: "📱" },
  { key: "security", label: "Security", number: "🔑" },
  { key: "usage", label: "Usage & activity", number: "📊" },
];

function Toggle({ on, onClick }) {
  return <button className={`tgl ${on ? "" : "off"}`} onClick={onClick} />;
}

export default function Profile() {
  const { traces, logout, showToast } = useApp();
  const navigate = useNavigate();
  const [pane, setPane] = useState("account");
  const [name, setName] = useState("Ana Ramos");
  const [email, setEmail] = useState("ana@tidetrace.app");
  const [barangay, setBarangay] = useState("Brgy. Lawis");
  const [profilePhoto, setProfilePhoto] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [toggles, setToggles] = useState({
    publicProfile: true, showLocation: false, searchable: true,
    localNames: true, inAppNotifs: true, dataSaver: false,
  });
  const [lang, setLang] = useState("Cebuano");

  const flip = (key) => setToggles((t) => ({ ...t, [key]: !t[key] }));
  const mine = traces.filter((t) => t.author === "Ana Ramos").length;
  const passwordRules = [
    { label: "At least 8 characters", valid: newPassword.length >= 8 },
    { label: "Contains a letter", valid: /[a-zA-Z]/.test(newPassword) },
    { label: "Contains a number", valid: /\d/.test(newPassword) },
  ];
  const passwordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
  const canChangePassword = currentPassword.length > 0 && passwordRules.every((rule) => rule.valid) && confirmPassword === newPassword;

  const changeProfilePhoto = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setProfilePhoto(URL.createObjectURL(file));
    showToast("Profile photo updated");
  };

  return (
    <div className="wrap">
      <div className="vhead">
        <span className="eyebrow">Settings</span>
        <h2>Account &amp; preferences</h2>
      </div>
      <div className="sgrid">
        <Sidebar items={PANES} active={pane} onSelect={setPane} />
        <div>
          {pane === "account" && (
            <div className="card">
              <div className="row" style={{ marginBottom: 16 }}>
                <label className="profile-photo-picker" title="Change profile photo">
                  {profilePhoto ? <img src={profilePhoto} alt="Profile" /> : <span>A</span>}
                  <input type="file" accept="image/*" onChange={changeProfilePhoto} />
                </label>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{name}</div>
                  <label className="profile-photo-link">
                    Change profile photo
                    <input type="file" accept="image/*" onChange={changeProfilePhoto} />
                  </label>
                </div>
              </div>
              <div className="g2">
                <div>
                  <span className="lbl">Full name</span>
                  <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <span className="lbl">Email</span>
                  <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <span className="lbl">Barangay / community</span>
                <input className="input" value={barangay} onChange={(e) => setBarangay(e.target.value)} />
              </div>
              <button className="btn blue sm" style={{ marginTop: 16 }} onClick={() => showToast("Changes saved")}>
                Save changes
              </button>
            </div>
          )}

          {pane === "privacy" && (
            <div className="card">
              <div className="setrow">
                <div><div className="l">Public profile</div><div className="s">Show my name on traces I post</div></div>
                <Toggle on={toggles.publicProfile} onClick={() => flip("publicProfile")} />
              </div>
              <div className="setrow">
                <div><div className="l">Show my location</div><div className="s">Display my barangay on submissions</div></div>
                <Toggle on={toggles.showLocation} onClick={() => flip("showLocation")} />
              </div>
              <div className="setrow">
                <div><div className="l">Searchable by community</div><div className="s">Neighbors can find my profile</div></div>
                <Toggle on={toggles.searchable} onClick={() => flip("searchable")} />
              </div>
            </div>
          )}

          {pane === "personal" && (
            <div className="card">
              <span className="lbl">Language</span>
              <div className="chiprow">
                {["Filipino", "English", "Cebuano"].map((l) => (
                  <button key={l} className={`chip ${lang === l ? "on" : ""}`} onClick={() => setLang(l)}>{l}</button>
                ))}
              </div>
              <div className="setrow" style={{ marginTop: 8 }}>
                <div><div className="l">Local names first</div><div className="s">Show local species names before scientific ones</div></div>
                <Toggle on={toggles.localNames} onClick={() => flip("localNames")} />
              </div>
            </div>
          )}

          {pane === "app" && (
            <div className="card">
              <div className="setrow">
                <div><div className="l">In-app notifications</div><div className="s">Status updates, comments, new Tides</div></div>
                <Toggle on={toggles.inAppNotifs} onClick={() => flip("inAppNotifs")} />
              </div>
              <div className="setrow">
                <div><div className="l">Data saver</div><div className="s">Lower-quality media uploads on mobile data</div></div>
                <Toggle on={toggles.dataSaver} onClick={() => flip("dataSaver")} />
              </div>
            </div>
          )}

          {pane === "security" && (
            <div className="card security-card">
              <div className="security-heading">
                <div className="security-icon" aria-hidden="true">🔒</div>
                <div>
                  <h3>Change password</h3>
                  <p>Keep your account secure with a strong, unique password.</p>
                </div>
              </div>
              <div className="security-divider" />
              <div className="fgroup">
                <label htmlFor="current-password">Current password</label>
                <div className="password-wrap"><input id="current-password" className="input" type={showCurrentPassword ? "text" : "password"} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /><button type="button" className="toggle-password" aria-label="Toggle current password visibility" onClick={() => setShowCurrentPassword((visible) => !visible)}>{showCurrentPassword ? "◉" : "◌"}</button></div>
              </div>
              <div className="fgroup">
                <label htmlFor="new-password">New password</label>
                <div className="password-wrap"><input id="new-password" className="input" type={showNewPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button type="button" className="toggle-password" aria-label="Toggle new password visibility" onClick={() => setShowNewPassword((visible) => !visible)}>{showNewPassword ? "◉" : "◌"}</button></div>
              </div>
              <div className="fgroup">
                <label htmlFor="confirm-password">Confirm new password</label>
                <div className="password-wrap"><input id="confirm-password" className="input" type={showConfirmPassword ? "text" : "password"} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} /><button type="button" className="toggle-password" aria-label="Toggle confirm password visibility" onClick={() => setShowConfirmPassword((visible) => !visible)}>{showConfirmPassword ? "◉" : "◌"}</button></div>
                {passwordMismatch && <p className="password-feedback">Passwords do not match.</p>}
              </div>
              <ul className="password-rules" aria-label="Password requirements">
                {passwordRules.map((rule) => <li key={rule.label} className={rule.valid ? "valid" : ""}>{rule.valid ? "✓" : "○"} {rule.label}</li>)}
              </ul>
              <div className="security-actions">
                <span className="security-status">{canChangePassword ? "Ready to update" : "Complete all fields to continue"}</span>
                <button
                  className="btn blue sm"
                  disabled={!canChangePassword}
                  onClick={() => {
                  if (!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword) {
                    showToast("Enter a valid matching password of at least 8 characters");
                    return;
                  }
                  setCurrentPassword("");
                  setNewPassword("");
                  setConfirmPassword("");
                  showToast("Password changed successfully");
                  }}
                >
                  Update password
                </button>
              </div>
            </div>
          )}

          {pane === "usage" && (
            <div className="card">
              <div className="setrow"><div className="l">Your traces</div><span className="hint">{mine}</span></div>
              <div className="setrow"><div className="l">Comments posted</div><span className="hint">14</span></div>
              <div className="setrow"><div className="l">Learning minutes</div><span className="hint">46</span></div>
              <div className="setrow"><div className="l">Member since</div><span className="hint">January 2026</span></div>
              <button
                className="btn outline sm"
                style={{ marginTop: 16, color: "var(--clay)", borderColor: "var(--clay)" }}
                onClick={() => { logout(); navigate("/"); }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
