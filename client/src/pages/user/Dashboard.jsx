import useDashboard from "../../hooks/useDashboard.js";
import EmptyState from "../../components/EmptyState.jsx";
import DashboardStats from "../../components/DashboardStats.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import RemoteState from "../../components/RemoteState.jsx";
import { displayTrace } from "../../api/data.js";
import React from "react";
import { Link } from "react-router-dom";
import { useApp } from "../../context/AppContext.jsx";
import TraceCard from "../../components/TraceCard.jsx";
import NeedsAttention from "../../components/NeedsAttention.jsx";
import NextLesson from "../../components/NextLesson.jsx";
import WhatsNew from "../../components/WhatsNew.jsx";
import { attentionLine, STAT_LINKS } from "../../api/dashboardText.js";
import "./dashboard.css";

export default function Dashboard() {
  throw new Error("test crash");
  const { profile } = useApp();
  const totals = useDashboard();
  const recentResult = useRemoteData("traces?limit=3&offset=0", {
    collection: true,
  });
  const recent = (recentResult.data || []).map(displayTrace);

  return (
    <div className="wrap">
      <div className="banner">
        <div>
          <h1 className="banner-title">Kumusta, {profile?.display_name}</h1>
          <div className="s">{attentionLine(totals.data)}</div>
        </div>
        <Link className="banner-action" to="/user/traces/upload">Upload trace</Link>
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          {totals.data && <NeedsAttention key={`${totals.data.needs_revision}:${totals.data.drafts}`} revisions={totals.data.needs_revision} drafts={totals.data.drafts} />}
          <div className="dash-learning">
            <div className="dash-head"><h2 className="sec-t">Continue learning</h2></div>
            <NextLesson />
          </div>
        </div>
        <div className="dash-side">
          <div className="dash-activity">
            <div className="dash-head">
              <h2 className="sec-t">Your activity</h2>
              {totals.data && <span className="dash-meta">Updated {new Date(totals.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>}
            </div>
            <DashboardStats
              flush
              showMeta={false}
              result={totals}
              items={[
                ["traces", "Your Traces", STAT_LINKS.traces],
                ["approved", "Approved", STAT_LINKS.approved],
                ["pending", "In review", STAT_LINKS.pending],
              ]}
            />
          </div>
          <WhatsNew />
        </div>
      </div>

      <div className="sec-row">
        <h2 className="sec-t">Recent from the community</h2>
        <Link className="sec-link" to="/user/traces">See all traces</Link>
      </div>

      <RemoteState compact {...recentResult} />

      {recentResult.data && !recent.length && (
        <EmptyState title="No published Traces yet." hint="Approved traces from the community will appear here." action={{ to: "/user/traces/upload", label: "Submit a trace" }} />
      )}

      <div className="g3">
        {recent.map((t) => (
          <TraceCard
            key={t.id}
            trace={t}
            to={`/user/traces/${t.id}`}
          />
        ))}
      </div>
    </div>
  );
}
