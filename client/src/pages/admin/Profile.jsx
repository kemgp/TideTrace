import React, { useState } from "react";
import { useApp } from "../../context/AppContext.jsx";

const EyeIcon = ({ visible }) => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
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

export default function AdminProfile() {
  const { profile } = useApp();

  const [activeTab, setActiveTab] = useState("account");

  const [name, setName] = useState(
    profile?.display_name || "Ryan Paul Magallanes"
  );

  const [email, setEmail] = useState(profile?.email || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [message, setMessage] = useState("");

  // Profile picture
  const [profilePhoto, setProfilePhoto] = useState(
    localStorage.getItem("adminProfilePhoto") || ""
  );

  const handleProfilePhoto = (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMessage("Please select an image file.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      const imageData = reader.result;

      setProfilePhoto(imageData);
      localStorage.setItem("adminProfilePhoto", imageData);
      setMessage("Profile picture updated successfully.");
    };

    reader.readAsDataURL(file);
  };

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
              className={`settings-menu ${
                activeTab === "account" ? "active" : ""
              }`}
              onClick={() => setActiveTab("account")}
            >
              <span>♟</span>
              Account
            </button>

            <button
              className={`settings-menu ${
                activeTab === "basic" ? "active" : ""
              }`}
              onClick={() => setActiveTab("basic")}
            >
              <span>👤</span>
              Basic information
            </button>

            <button
              className={`settings-menu ${
                activeTab === "security" ? "active" : ""
              }`}
              onClick={() => setActiveTab("security")}
            >
              <span>🔑</span>
              Security
            </button>

            <button
              className={`settings-menu ${
                activeTab === "activity" ? "active" : ""
              }`}
              onClick={() => setActiveTab("activity")}
            >
              <span>📊</span>
              Recent activity
            </button>

            <button
              className={`settings-menu ${
                activeTab === "actions" ? "active" : ""
              }`}
              onClick={() => setActiveTab("actions")}
            >
              <span>⚡</span>
              Quick actions
            </button>

          </aside>

          <section className="settings-content">

            {/* ==================== ACCOUNT ==================== */}

            {activeTab === "account" && (
              <div>

                <div className="settings-section-title">
                  <h2>Account</h2>
                  <p>
                    Account information and administrator permissions.
                  </p>
                </div>

                <div className="admin-account-grid">

                  {/* LEFT ACCOUNT CARD */}
                  <div className="admin-account-info">

                    {/* ADMIN PROFILE CARD */}
                    <div className="admin-profile-card">

                      <div className="admin-avatar">

                        {profilePhoto ? (
                          <img
                            src={profilePhoto}
                            alt="Admin profile"
                            className="admin-profile-image"
                          />
                        ) : (
                          <svg
                            width="92"
                            height="92"
                            viewBox="0 0 64 64"
                            fill="none"
                          >
                            <circle
                              cx="32"
                              cy="32"
                              r="32"
                              fill="#e8edf5"
                            />

                            <circle
                              cx="32"
                              cy="24"
                              r="10"
                              fill="#344054"
                            />

                            <path
                              d="M17 49c0-8 6.5-14 15-14s15 6 15 14"
                              fill="#344054"
                            />
                          </svg>
                        )}

                        {/* CAMERA BUTTON */}
                        <label
                          htmlFor="admin-profile-upload"
                          className="admin-camera-icon"
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
                            <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                            <circle cx="12" cy="13" r="4" />
                          </svg>
                        </label>

                        {/* HIDDEN FILE INPUT */}
                        <input
                          id="admin-profile-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleProfilePhoto}
                          hidden
                        />

                      </div>

                      <h2>
                        {name || "Admin Name"}
                      </h2>

                      <span className="admin-badge">
                        ADMIN
                      </span>

                      <p className="admin-email">
                        {email || "admin@tidetrace.com"}
                      </p>

                      <p className="admin-joined">
                        <span>▣</span>
                        Joined: August 18, 2026
                      </p>

                    </div>

                    {/* ==================== EXISTING ACCOUNT TYPE ==================== */}

                    <div className="account-detail">
                      <span>ACCOUNT TYPE</span>
                      <strong>Admin</strong>
                    </div>

                    <div className="account-detail">
                      <span>STATUS</span>
                      <strong className="status-active">
                        Active
                      </strong>
                    </div>

                    <div className="account-detail">
                      <span>LAST LOGIN</span>
                      <strong>
                        September 27, 2026
                      </strong>
                    </div>

                    <div className="account-detail">
                      <span>ACCOUNT CREATED</span>
                      <strong>
                        August 18, 2026
                      </strong>
                    </div>

                  </div>

                  {/* ==================== ROLE & PERMISSIONS ==================== */}

                  <div className="admin-permissions">

                    <h3>Role & permissions</h3>

                    <div className="permission-list">

                      <div className="permission-item">
                        <span>✓</span>
                        Full access
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Review user traces
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage users
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage moderator
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Manage Tides
                      </div>

                      <div className="permission-item">
                        <span>✓</span>
                        Trace Categories
                      </div>

                    </div>

                  </div>

                </div>

              </div>
            )}

            {/* ==================== BASIC INFORMATION ==================== */}

            {activeTab === "basic" && (
              <form onSubmit={saveInformation}>

                <div className="settings-section-title">
                  <h2>Basic information</h2>
                  <p>
                    Manage your administrator account information.
                  </p>
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
                      value="Admin"
                      readOnly
                    />
                  </div>

                </div>

                {message && (
                  <div className="settings-success">
                    {message}
                  </div>
                )}

                <button
                  className="settings-save"
                  type="submit"
                >
                  Save Changes
                </button>

              </form>
            )}

            {/* ==================== SECURITY ==================== */}

            {activeTab === "security" && (
              <form onSubmit={updatePassword}>

                <div className="settings-section-title">
                  <h2>Security</h2>
                  <p>
                    Update your password to keep your administrator account secure.
                  </p>
                </div>

                <div className="password-fields">

                  {/* CURRENT PASSWORD */}
                  <div className="settings-field">

                    <label>CURRENT PASSWORD</label>

                    <div className="password-input">

                      <input
                        type={showCurrent ? "text" : "password"}
                        value={currentPassword}
                        onChange={(e) =>
                          setCurrentPassword(e.target.value)
                        }
                        placeholder="Enter current password"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowCurrent(!showCurrent)
                        }
                      >
                        <EyeIcon visible={showCurrent} />
                      </button>

                    </div>

                  </div>

                  {/* NEW PASSWORD */}
                  <div className="settings-field">

                    <label>NEW PASSWORD</label>

                    <div className="password-input">

                      <input
                        type={showNew ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) =>
                          setNewPassword(e.target.value)
                        }
                        placeholder="Enter new password"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowNew(!showNew)
                        }
                      >
                        <EyeIcon visible={showNew} />
                      </button>

                    </div>

                  </div>

                  {/* CONFIRM PASSWORD */}
                  <div className="settings-field">

                    <label>CONFIRM PASSWORD</label>

                    <div className="password-input">

                      <input
                        type={showConfirm ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) =>
                          setConfirmPassword(e.target.value)
                        }
                        placeholder="Confirm new password"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setShowConfirm(!showConfirm)
                        }
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

                <button
                  className="settings-save"
                  type="submit"
                >
                  Update Password
                </button>

              </form>
            )}

            {/* ==================== RECENT ACTIVITY ==================== */}

            {activeTab === "activity" && (
              <div>

                <div className="settings-section-title">
                  <h2>Recent activity</h2>
                  <p>
                    Recent actions performed by the administrator.
                  </p>
                </div>

                <div className="activity-list">

                  <div className="activity-item">
                    <strong>
                      Reviewed a user trace
                    </strong>
                    <span>
                      Today · 9:15 AM
                    </span>
                  </div>

                  <div className="activity-item">
                    <strong>
                      Managed moderator accounts
                    </strong>
                    <span>
                      Today · 8:42 AM
                    </span>
                  </div>

                  <div className="activity-item">
                    <strong>
                      Updated trace categories
                    </strong>
                    <span>
                      Yesterday · 4:30 PM
                    </span>
                  </div>

                  <div className="activity-item">
                    <strong>
                      Viewed system logs
                    </strong>
                    <span>
                      Yesterday · 2:15 PM
                    </span>
                  </div>

                </div>

              </div>
            )}

            {/* ==================== QUICK ACTIONS ==================== */}

            {activeTab === "actions" && (
              <div>

                <div className="settings-section-title">
                  <h2>Quick actions</h2>
                  <p>
                    Quick access to important administrator tools.
                  </p>
                </div>

                <div className="quick-actions">

                  <button type="button">
                    <strong>
                      View system logs
                    </strong>

                    <span>
                      Check recent system activity and events.
                    </span>
                  </button>

                  <button type="button">
                    <strong>
                      Manage users
                    </strong>

                    <span>
                      View and manage registered users.
                    </span>
                  </button>

                  <button type="button">
                    <strong>
                      System settings
                    </strong>

                    <span>
                      Manage system-wide settings.
                    </span>
                  </button>

                </div>

              </div>
            )}

          </section>

        </div>

      </div>
    </main>
  );
}