import React, { useState } from "react";
import { useApp } from "../../../context/AppContext.jsx";
import ProfileNameForm from "../../../components/ProfileNameForm.jsx";
import ProfileSecurity from "../../../components/ProfileSecurity.jsx";
import Sidebar from "../../../components/Sidebar.jsx";

const PANES = [
  { key: "account", label: "Account", number: "👤" },
  { key: "privacy", label: "Privacy", number: "🔒" },
  { key: "app", label: "App settings", number: "📱" },
  { key: "security", label: "Security", number: "🔑" },
  { key: "usage", label: "Usage & activity", number: "📊" },
];

function Toggle() {
  return <button className="tgl off" disabled aria-label="Preference unavailable" />;
}

export default function Profile() {
  const { traces } = useApp();
  const [pane, setPane] = useState("account");
  const mine = traces.filter((t) => t.author === "Ana Ramos").length;

  return (
    <div className="wrap">
      <div className="vhead">
        <span className="eyebrow">Settings</span>
        <h2>Account &amp; preferences</h2>
      </div>
      <div className="sgrid">
        <Sidebar items={PANES} active={pane} onSelect={setPane} />
        <div>
          {pane === "account" && <div className="card"><ProfileNameForm /></div>}
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

          {pane === "usage" && (
            <div className="card">
              <div className="setrow"><div className="l">Your traces</div><span className="hint">{mine}</span></div>
              <div className="setrow"><div className="l">Comments posted</div><span className="hint">14</span></div>
              <div className="setrow"><div className="l">Learning minutes</div><span className="hint">46</span></div>
              <div className="setrow"><div className="l">Member since</div><span className="hint">January 2026</span></div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
