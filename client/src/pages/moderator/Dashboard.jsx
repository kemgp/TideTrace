import React from "react";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceStatusBadge from "../../components/TraceStatusBadge.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { displayTrace } from "../../api/data.js";
import RemoteState from "../../components/RemoteState.jsx";
import Button from "../../components/Button.jsx";

export default function Dashboard() {
  const { profile, comments, reports } = useApp();
  const navigate = useNavigate();

  const result = useRemoteData("moderation/traces?status=pending&limit=4&offset=0", { collection: true });
  const pending = (result.data || []).map(displayTrace);
  const flagged = comments.filter((c) => c.status === "open").length;
  const openReports = reports.filter((r) => r.status === "open").length;
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

      <div className="g4" style={{ marginTop: 16 }}>
        <div className="stat"><b>{result.loading || result.error ? "—" : pending.length}</b><span>pending shown (up to 4)</span></div>
        <div className="stat"><b>{flagged}</b><span>flagged comments</span></div>
        <div className="stat"><b>{openReports}</b><span>open reports</span></div>
        <div className="stat"><b>6</b><span>reviewed today</span></div>
      </div>

      <h3 className="sec-t">Quick actions</h3>
      <div className="g2">
        <Button variant="teal" onClick={() => navigate("/moderator/review")}>✓ Review pending traces</Button>
        <Button variant="outline" onClick={() => navigate("/moderator/reports")}>🚩 Open reported content</Button>
      </div>

      <h3 className="sec-t">Oldest in the queue</h3>
      <RemoteState {...result} />
      <div className="card">
        {!result.loading && !result.error && (oldest.length ? oldest.map((t) => (
          <div className="lrow click" key={t.id} onClick={() => navigate(`/moderator/review/${encodeURIComponent(t.id)}`)}>
            <div className="grow">
              <div className="t">{t.title}</div>
              <div className="m"><span>{t.author}</span> · <span>{t.location}</span></div>
            </div>
            <TraceStatusBadge status={t.status} />
          </div>
        )) : <p className="hint">Queue clear — nothing pending right now.</p>)}
      </div>
    </div>
  );
}
