import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

const EyeIcon = ({ visible }) => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    {visible ? (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ) : (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <path d="M4 4l16 16" />
      </>
    )}
  </svg>
);

export default function ModeratorProfile() {
  const [profilePhoto, setProfilePhoto] = useState(
  localStorage.getItem("moderatorProfilePhoto") || ""
);

const handleProfilePhoto = (e) => {
  const file = e.target.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image file.");
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    setProfilePhoto(reader.result);
    localStorage.setItem("moderatorProfilePhoto", reader.result);
  };

  reader.readAsDataURL(file);
};
  const { profile } = useApp();

  const [activeTab, setActiveTab] = useState("account");

  const [name, setName] = useState(profile?.display_name || "Keith");
  const [email, setEmail] = useState(profile?.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");

  const saveInformation = (e) => {
    e.preventDefault();
    setMessage("Changes saved successfully.");
  };

  const updatePassword = (e) => {
    e.preventDefault();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setMessage("Please complete all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("New password and confirm password do not match.");
      return;
    }

    setMessage("Password updated successfully.");

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return (
    <main className="settings-page">
      <div className="settings-container">

        <div className="settings-title">
          <span>SETTINGS</span>
          <h1>Account & preferences</h1>
        </div>

        <div className="settings-layout">

          <aside className="settings-sidebar">

            <button
              className={`settings-menu ${activeTab === "account" ? "active" : ""}`}
              onClick={() => setActiveTab("account")}
            >
              <span>♟</span>
              Account
            </button>

            <button
              className={`settings-menu ${activeTab === "basic" ? "active" : ""}`}
              onClick={() => setActiveTab("basic")}
            >
              <span>👤</span>
              Basic information
            </button>

            <button
              className={`settings-menu ${activeTab === "security" ? "active" : ""}`}
              onClick={() => setActiveTab("security")}
            >
              <span>🔑</span>
              Security
            </button>

            <button
              className={`settings-menu ${activeTab === "preferences" ? "active" : ""}`}
              onClick={() => setActiveTab("preferences")}
            >
              <span>⚙</span>
              Preferences
            </button>

          </aside>

          <section className="settings-content">

            {/* ACCOUNT */}
            {activeTab === "account" && (
  <div>

    <div className="moderator-profile-card">

      <div className="moderator-avatar">

  {profilePhoto ? (
    <img
      src={profilePhoto}
      alt="Moderator profile"
      className="moderator-profile-image"
    />
  ) : (
    <svg width="92" height="92" viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="32" fill="#e8edf5"/>
      <circle cx="32" cy="24" r="10" fill="#344054"/>
      <path
        d="M17 49c0-8 6.5-14 15-14s15 6 15 14"
        fill="#344054"
      />
    </svg>
  )}

  <label
    htmlFor="moderator-profile-upload"
    className="camera-icon"
    title="Change profile picture"
  >
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  </label>

  <input
    id="moderator-profile-upload"
    type="file"
    accept="image/*"
    onChange={handleProfilePhoto}
    hidden
  />

</div>

      <h2>Kieth</h2>

      <span className="moderator-badge">
        MODERATOR
      </span>

      <p className="moderator-email">
        kgpatino@up.edu.ph
      </p>

      <p className="moderator-joined">
        <span>▣</span>
        Joined: Aug 12, 2025
      </p>

    </div>

    <div className="settings-section-title moderator-permission-title">
      <h2>Role & permissions</h2>
      <p>Access available to your moderator account.</p>
    </div>

    <div className="permission-list">

      <div className="permission-item">
        <span>✓</span>
        View and manage comments
      </div>

      <div className="permission-item">
        <span>✓</span>
        Access user reports
      </div>

      <div className="permission-item">
        <span>✓</span>
        Moderate flagged comments
      </div>

      <div className="permission-item">
        <span>✓</span>
        Review Traces
      </div>

    </div>

  </div>
)}

            {/* BASIC INFORMATION */}
            {activeTab === "basic" && (
              <form onSubmit={saveInformation}>

                <div className="settings-section-title">
                  <h2>Basic information</h2>
                  <p>Manage your moderator account information.</p>
                </div>

                <div className="settings-form-grid">

                  <div className="settings-field full">
                    <label>FULL NAME</label>

                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label>EMAIL ADDRESS</label>

                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="settings-field">
                    <label>ROLE</label>

                    <input
                      type="text"
                      value="Moderator"
                      readOnly
                    />
                  </div>

                </div>

                {message && (
                  <div className="settings-success">
                    {message}
                  </div>
                )}

                <button className="settings-save" type="submit">
                  Save Changes
                </button>

              </form>
            )}

            {/* SECURITY */}
            {activeTab === "security" && (
              <form onSubmit={updatePassword}>

                <div className="settings-section-title">
                  <h2>Security</h2>
                  <p>Update your password to keep your account secure.</p>
                </div>

                <div className="password-fields">

                  <div className="settings-field">
                    <label>CURRENT PASSWORD</label>

                    <div className="password-input">
                      <input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="Enter current password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowCurrent(!showCurrent)}
                      >
                        <EyeIcon visible={showCurrent} />
                      </button>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>NEW PASSWORD</label>

                    <div className="password-input">
                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowNew(!showNew)}
                      >
                        <EyeIcon visible={showNew} />
                      </button>
                    </div>
                  </div>

                  <div className="settings-field">
                    <label>CONFIRM PASSWORD</label>

                    <div className="password-input">
                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                      />

                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                      >
                        <EyeIcon visible={showConfirm} />
                      </button>
                    </div>
                  </div>

                </div>

                {message && (
                  <div className="settings-success">
                    {message}
                  </div>
                )}

                <button className="settings-save" type="submit">
                  Update Password
                </button>

              </form>
            )}

            {/* PREFERENCES */}
            {activeTab === "preferences" && (
              <form onSubmit={saveInformation}>

                <div className="settings-section-title">
                  <h2>Preferences</h2>
                </div>

                <div className="preference-box">

                  <div>
                    <strong>Email Notifications</strong>
                    <p>Get notified about new reports and flagged comments</p>
                  </div>

                  <label className="toggle">
                    <input type="checkbox" defaultChecked />
                    <span></span>
                  </label>

                </div>

                {message && (
                  <div className="settings-success">
                    {message}
                  </div>
                )}

                <button className="settings-save" type="submit">
                  Save Changes
                </button>

              </form>
            )}

          </section>

        </div>

      </div>
    </main>
  );
}