import UsageActivity from "../../../components/UsageActivity.jsx";
import React, { useState } from "react";
import { useApp } from "../../../context/AppContext.jsx";
import ProfileNameForm from "../../../components/ProfileNameForm.jsx";
import ProfileSecurity from "../../../components/ProfileSecurity.jsx";
import AdminIcon from "../../../components/AdminIcon.jsx";
import Sidebar from "../../../components/Sidebar.jsx";

const PANES = [
  { key: "account", label: "Account", number: <AdminIcon name="users" size={16} /> },
  { key: "privacy", label: "Privacy", number: <AdminIcon name="shield" size={16} /> },
  { key: "app", label: "App settings", number: <AdminIcon name="settings" size={16} /> },
  { key: "security", label: "Security", number: <AdminIcon name="key" size={16} /> },
  { key: "usage", label: "Usage & activity", number: <AdminIcon name="chart" size={16} /> },
];

function Toggle() {
  return <button className="tgl off" disabled aria-label="Preference unavailable" />;
}

export default function Profile() {
  const { profile } = useApp();
  const [pane, setPane] = useState("account");

  return (
    <div className="wrap user-settings">
      <div className="vhead">
        <span className="eyebrow">Settings</span>
        <h2>Account &amp; preferences</h2>
      </div>
      <div className="sgrid">
        <Sidebar items={PANES} active={pane} onSelect={setPane} />
        <div>
          {pane === "account" && <div className="card"><div className="user-account-header"><span className="avatar" aria-hidden="true">{profile?.display_name?.trim().charAt(0).toUpperCase()}</span><strong>{profile?.display_name}</strong></div><ProfileNameForm /></div>}
          {["privacy", "app"].includes(pane) && <p role="status">These preferences are not available yet. No changes are saved here.</p>}

          {pane === "privacy" && (
            <div className="card">
              <div className="setrow">
                <div><div className="l">Public profile</div><div className="s">Show my name on traces I post</div></div>
                <Toggle />
              </div>
              <div className="setrow">
                <div><div className="l">Show my location</div><div className="s">Display my barangay on submissions</div></div>
                <Toggle />
              </div>
              <div className="setrow">
                <div><div className="l">Searchable by community</div><div className="s">Neighbors can find my profile</div></div>
                <Toggle />
              </div>
            </div>
          )}

          {pane === "app" && (
            <div className="card">
              <div className="setrow">
                <div><div className="l">In-app notifications</div><div className="s">Status updates, comments, new Tides</div></div>
                <Toggle />
              </div>
              <div className="setrow">
                <div><div className="l">Data saver</div><div className="s">Lower-quality media uploads on mobile data</div></div>
                <Toggle />
              </div>
            </div>
          )}

          {pane === "security" && <div className="card"><ProfileSecurity /></div>}

          {pane === "usage" && <UsageActivity />}
        </div>
      </div>
    </div>
  );
}
