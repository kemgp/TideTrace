import React, { useState } from "react";
import DataSaverPreference from "../../components/DataSaverPreference.jsx";
import NotificationPreferences from "../../components/NotificationPreferences.jsx";
import ProfilePhoto from "../../components/ProfilePhoto.jsx";
import ProfileNameForm from "../../components/ProfileNameForm.jsx";
import ProfileSecurity from "../../components/ProfileSecurity.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import Sidebar from "../../components/Sidebar.jsx";
import AdminIcon from "../../components/AdminIcon.jsx";
import { useApp } from "../../context/AppContext.jsx";
import "../user/profile/Profile.css";

const PANES = [
  { key: "account", label: "Account", number: <AdminIcon name="users" size={16} /> },
  { key: "app", label: "App settings", number: <AdminIcon name="settings" size={16} /> },
  { key: "security", label: "Security", number: <AdminIcon name="key" size={16} /> },
];

const PERMISSIONS = ["Review pending Traces", "Decide on reports and flagged comments", "View moderation analytics"];

export default function ModeratorProfile() {
  const { profile, darkMode, setDarkMode } = useApp();
  const [pane, setPane] = useState("account");
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : "";
  return <>
    <PageHeader eyebrow="Settings" title="Account &amp; preferences" subtitle="Manage your profile, appearance and notifications." />
    <div className="page-body user-settings mod-settings">
      <div className="sgrid">
        <Sidebar items={PANES} active={pane} onSelect={setPane} />
        <div className="user-settings__body">
          {pane === "account" && <>
            <div className="card mod-account-hero">
              <ProfilePhoto />
              <div className="mod-account-hero__who">
                <strong>{profile?.display_name}</strong>
                <span>{profile?.email || "Email unavailable"}</span>
                <span className="pill mod-role-pill">Moderator · Active</span>
                {joined && <span className="hint">Joined {joined}</span>}
              </div>
            </div>
            <div className="mod-account-cards">
              <div className="card"><ProfileNameForm /></div>
              <div className="card mod-permissions">
                <header className="user-settings__panel-heading"><h3>What you can do</h3></header>
                <ul>{PERMISSIONS.map((item) => <li key={item}>{item}</li>)}</ul>
                <p className="hint">Only an admin can change roles or see moderation history for all staff.</p>
              </div>
            </div>
          </>}
          {pane === "app" && <div className="card">
            <header className="user-settings__panel-heading"><h3>App settings</h3><p>Manage your notifications and appearance.</p></header>
            <NotificationPreferences />
            <DataSaverPreference />
            <div className="setrow">
              <div><div className="l">Dark mode</div><div className="s">Switch between light and dark appearance</div></div>
              <button type="button" className={`tgl ${darkMode ? "" : "off"}`} onClick={() => setDarkMode(!darkMode)} aria-label={darkMode ? "Turn off dark mode" : "Turn on dark mode"} aria-pressed={darkMode} />
            </div>
          </div>}
          {pane === "security" && <div className="card"><ProfileSecurity /></div>}
        </div>
      </div>
    </div>
  </>;
}
