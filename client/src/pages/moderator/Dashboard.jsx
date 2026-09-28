import useDashboard from "../../hooks/useDashboard.js";
import DashboardStats from "../../components/DashboardStats.jsx";
import React from "react";
import TraceMarker from "./TraceMarker.jsx";
import StaffIcon from "../../components/AdminIcon.jsx";
import { Link, useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { displayTrace } from "../../api/data.js";
import RemoteState from "../../components/RemoteState.jsx";
import Button from "../../components/Button.jsx";

export default function Dashboard() {
  const { profile } = useApp();
  const navigate = useNavigate();

  const result = useRemoteData("moderation/traces?status=pending&limit=4&offset=0", { collection: true });
  const pending = (result.data || []).map(displayTrace);
  const totals = useDashboard();
  const oldest = pending.slice(0, 4);

  return (
    <div className="wrap">
      <div className="banner mod">
        <div>
          <b>Magandang umaga, {profile?.display_name} — review queue</b>
          <div className="s">Review. Verify. Keep the community safe.</div>
        </div>
        <svg width={34} height={34} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="1.8">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="M9 12l2 2 4-4" />
        </svg>
      </div>

      <DashboardStats result={totals} items={[["pending", "Pending review"], ["flagged_comments", "Comments with open reports"], ["open_reports", "Open reports"], ["reviewed_today", "My reviews today (Manila)"]]} />

      <h3 className="sec-t">Quick actions</h3>
      <div className="g2">
        <Button variant="teal" onClick={() => navigate("/moderator/review")}>✓ Review pending traces</Button>
        <Button variant="outline" onClick={() => navigate("/moderator/reports")}><StaffIcon name="flag" size={16} /> Open reported content</Button>
      </div>

      <h3 className="sec-t">Oldest in the queue</h3>
      <RemoteState {...result} />
      <div className="card">
        {!result.loading && !result.error && (oldest.length ? oldest.map((t) => (
          <Link className="lrow click" key={t.id} to={`/moderator/review/${encodeURIComponent(t.id)}`}><TraceMarker category={t.category} />
            <div className="grow">
              <div className="t">{t.title}</div>
              <div className="m"><span>{t.author}</span> · <span>{t.location}</span></div>
            </div>
            <TraceStatusBadge status={t.status} />
          </Link>
        )) : <p className="hint">Queue clear — nothing pending right now.</p>)}
      </div>
    </div>
  );
}
