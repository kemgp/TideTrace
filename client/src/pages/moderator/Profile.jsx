import React, { useState } from "react";
import ProfileNameForm from "../../components/ProfileNameForm.jsx";
import ProfileSecurity from "../../components/ProfileSecurity.jsx";
import { useApp } from "../../context/AppContext.jsx";

export default function ModeratorProfile() {
  const { profile } = useApp();
  const [activeTab, setActiveTab] = useState("account");
  const name = profile?.display_name || "";
  const email = profile?.email || "";
  const profilePhoto = "";

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
    title="Profile photo uploads are not available yet" aria-disabled="true"
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
    disabled aria-label="Profile photo upload unavailable"
    hidden
  />

</div>

      <h2>{name}</h2>
      <p className="hint">Profile photo uploads are not available yet.</p>

      <span className="moderator-badge">
        MODERATOR
      </span>

      <p className="moderator-email">
        {email || "Email unavailable"}
      </p>

      <p className="moderator-joined">
        <span>▣</span>
        Joined: {profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "Not available"}
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
            {activeTab === "basic" && <ProfileNameForm />}

            {/* SECURITY */}
            {activeTab === "security" && <ProfileSecurity />}

            {/* PREFERENCES */}
            {activeTab === "preferences" && <div><h2>Preferences</h2><p>Email notification preferences are not available yet. No changes are saved here.</p></div>}

          </section>

        </div>

      </div>
    </main>
  );
}