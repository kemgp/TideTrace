import UsageActivity from "../../../components/UsageActivity.jsx";
import React, { useState } from "react";
import { useApp } from "../../../context/AppContext.jsx";
import ProfileNameForm from "../../../components/ProfileNameForm.jsx";
import ProfileSecurity from "../../../components/ProfileSecurity.jsx";
import AdminIcon from "../../../components/AdminIcon.jsx";
import Sidebar from "../../../components/Sidebar.jsx";
import "./Profile.css";

const PANES = [
  {
    key: "account",
    label: "Account",
    number: <AdminIcon name="users" size={16} />
  },
  {
    key: "privacy",
    label: "Privacy",
    number: <AdminIcon name="shield" size={16} />
  },
  {
    key: "app",
    label: "App settings",
    number: <AdminIcon name="settings" size={16} />
  },
  {
    key: "security",
    label: "Security",
    number: <AdminIcon name="key" size={16} />
  },
  {
    key: "usage",
    label: "Usage & activity",
    number: <AdminIcon name="chart" size={16} />
  },
];

function Toggle() {
  return (
    <button
      className="tgl off"
      disabled
      aria-label="Preference unavailable"
    />
  );
}

export default function Profile() {
  const {
    profile,
    darkMode,
    setDarkMode
  } = useApp();

  const [pane, setPane] = useState("account");

  return (
    <div className="wrap user-settings">

      <div className="vhead">
        <span className="eyebrow">
          Settings
        </span>

        <h2>
          Account &amp; preferences
        </h2>
        <p>Manage your profile, appearance, security, and account activity.</p>
      </div>

      <div className="sgrid">

        <Sidebar
          items={PANES}
          active={pane}
          onSelect={setPane}
        />

        <div className="user-settings__body">

          {/* ACCOUNT */}
          {pane === "account" && (
            <div className="card">

              <div className="user-account-header">

                <span
                  className="avatar"
                  aria-hidden="true"
                >
                  {profile?.display_name
                    ?.trim()
                    .charAt(0)
                    .toUpperCase()}
                </span>

                <div><strong>
                  {profile?.display_name}
                </strong><p className="hint">Your community account</p></div>

              </div>

              <ProfileNameForm />

            </div>
          )}

          {/* PRIVACY */}
          {pane === "privacy" && (
            <div className="card">
              <header className="user-settings__panel-heading"><h3>Privacy preferences</h3><p>Profile and location visibility preferences.</p></header>
              <p className="user-settings__notice" role="status">These preferences are not available yet. No changes are saved here.</p>

              <div className="setrow">
                <div>
                  <div className="l">
                    Public profile
                  </div>

                  <div className="s">
                    Show my name on traces I post
                  </div>
                </div>

                <Toggle />
              </div>

              <div className="setrow">
                <div>
                  <div className="l">
                    Show my location
                  </div>

                  <div className="s">
                    Display my barangay on submissions
                  </div>
                </div>

                <Toggle />
              </div>

              <div className="setrow">
                <div>
                  <div className="l">
                    Searchable by community
                  </div>

                  <div className="s">
                    Neighbors can find my profile
                  </div>
                </div>

                <Toggle />
              </div>

            </div>
          )}

          {/* APP SETTINGS */}
          {pane === "app" && (
            <div className="card">
              <header className="user-settings__panel-heading"><h3>App settings</h3><p>Customize how TideTrace looks on this device.</p></header>
              <p className="user-settings__notice">Notification and data saver preferences are not available yet. You can change your appearance below.</p>

              <div className="setrow">
                <div>
                  <div className="l">
                    In-app notifications
                  </div>

                  <div className="s">
                    Status updates, comments, new Tides
                  </div>
                </div>

                <Toggle />
              </div>

              <div className="setrow">
                <div>
                  <div className="l">
                    Data saver
                  </div>

                  <div className="s">
                    Lower-quality media uploads on mobile data
                  </div>
                </div>

                <Toggle />
              </div>

              <div className="setrow">

                <div>
                  <div className="l">
                    Dark mode
                  </div>

                  <div className="s">
                    Switch between light and dark appearance
                  </div>
                </div>

                <button
                  type="button"
                  className={`tgl ${darkMode ? "" : "off"}`}
                  onClick={() => setDarkMode(!darkMode)}
                  aria-label={
                    darkMode
                      ? "Turn off dark mode"
                      : "Turn on dark mode"
                  }
                  aria-pressed={darkMode}
                />

              </div>

            </div>
          )}

          {/* SECURITY */}
          {pane === "security" && (
            <div className="card">
              <ProfileSecurity />
            </div>
          )}

          {/* USAGE */}
          {pane === "usage" && (
            <section className="card user-settings__usage"><header className="user-settings__panel-heading"><h3>Usage &amp; activity</h3><p>A summary of your contributions and learning progress.</p></header><UsageActivity /></section>
          )}

        </div>

      </div>

    </div>
  );
}
