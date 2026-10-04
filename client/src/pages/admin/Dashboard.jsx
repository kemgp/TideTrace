
import useDashboard from "../../hooks/useDashboard.js";
import DashboardStats from "../../components/DashboardStats.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import React from "react";
import AdminIcon from "../../components/AdminIcon.jsx";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";

export default function Dashboard() {
  const { profile } = useApp();
  const navigate = useNavigate();
  const totals = useDashboard();
  const activity = useRemoteData("admin/audit-logs?limit=5&offset=0", { collection: true });
  const logs = activity.data || [];

  return (
    <div className="wrap">
      <div className="banner admin">
        <div>
          <b>Welcome, {profile?.display_name} — platform overview</b>
          <div className="s">Manage. Configure. Sustain the platform.</div>
        </div>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <circle cx={12} cy={12} r={3} />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.08a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.08a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.08a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </div>

      <DashboardStats result={totals} items={[["users", "Registered accounts"], ["active_users", "Active accounts"], ["moderators", "Active moderators"], ["published_traces", "Published Traces"], ["published_tides", "Published Tides"], ["pending", "Pending review"], ["open_reports", "Open reports"]]} />

      <h3 className="sec-t">Quick actions</h3>
      <div className="g4">
        <button className="btn blue" onClick={() => navigate("/admin/users")}><AdminIcon name="users" /> Manage users</button>
        <button className="btn outline" onClick={() => navigate("/admin/moderators?add=1")}><AdminIcon name="shield" /> Add moderator</button>
        <button className="btn outline" onClick={() => navigate("/admin/tides")}><AdminIcon name="book" /> Publish Tides</button>
        <button className="btn outline" onClick={() => navigate("/admin/review/history")}><AdminIcon name="history" /> Moderation history</button>
      </div>

      <h3 className="sec-t">Recent account administration</h3>
      <RemoteState compact {...activity} />
      {activity.data && !logs.length && <p>No account administration activity yet.</p>}
      <div className="card">
        {logs.map((l) => (
          <div className="lrow" key={l.id}>
            <span className="admin-log-icon"><AdminIcon name="log" size={16} /></span>
            <div className="grow">
              <div className="t">{l.action.replaceAll("_", " ")}: {l.reason}</div>
              <div className="m">{new Date(l.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}