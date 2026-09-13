
import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";

export default function Dashboard() {
  const { users, traces, moderators, logs } = useApp();
  const navigate = useNavigate();
  const pending = traces.filter((t) => t.status === "pending").length;

  return (
    <div className="wrap">
      <div className="banner admin">
        <div>
          <b>Welcome, Admin Doy — platform overview</b>
          <div className="s">Manage. Configure. Sustain the platform.</div>
        </div>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <circle cx={12} cy={12} r={3} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>

      <div className="g4" style={{ marginTop: 16 }}>
        <div className="stat"><b>{users.length}</b><span>total users</span></div>
        <div className="stat"><b>{traces.length}</b><span>total traces</span></div>
        <div className="stat"><b>{moderators.length}</b><span>moderators</span></div>
        <div className="stat"><b>{pending}</b><span>pending review</span></div>
      </div>

      <h3 className="sec-t">Quick actions</h3>
      <div className="g4">
        <button className="btn blue" onClick={() => navigate("/admin/users")}>👥 Manage users</button>
        <button className="btn outline" onClick={() => navigate("/admin/moderators")}>🛡 Add moderator</button>
        <button className="btn outline" onClick={() => navigate("/admin/tides")}>📚 Publish Tides</button>
        <button className="btn outline" onClick={() => navigate("/admin/categories")}>🏷 Manage categories</button>
      </div>

      <h3 className="sec-t">Recent system activity</h3>
      <div className="card">
        {logs.map((l) => (
          <div className="lrow" key={l.id}>
            <div className="grow">
              <div className="t">{l.text}</div>
              <div className="m">{l.when}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}