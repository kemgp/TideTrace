import React from "react";
import { Link } from "react-router-dom";
import useDashboard from "../../hooks/useDashboard.js";
import EmptyState from "../../components/EmptyState.jsx";
import DashboardStats from "../../components/DashboardStats.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import RemoteState from "../../components/RemoteState.jsx";
import TraceCard from "../../components/TraceCard.jsx";
import { useApp } from "../../context/AppContext.jsx";
import useRemoteData from "../../hooks/useRemoteData.js";
import { displayTrace } from "../../api/data.js";
import { QueueBadges } from "./modTools.jsx";

export default function Dashboard() {
  const { profile } = useApp();
  const result = useRemoteData("moderation/traces?status=pending&limit=3&offset=0", { collection: true });
  const totals = useDashboard();
  const queue = (result.data || []).map(displayTrace);
  return (
    <>
      <PageHeader
        eyebrow="Moderator"
        title={`Magandang umaga, ${profile?.display_name}`}
        subtitle="Review. Verify. Keep the community safe."
        actions={<>
          <Link className="btn banner-secondary" to="/moderator/review">Start reviewing</Link>
          <Link className="btn banner-secondary" to="/moderator/reports">Open reported content</Link>
        </>}
      />
      <div className="page-body mod-dashboard">
        <DashboardStats
          result={totals}
          items={[
            ["pending", "Pending review"],
            ["flagged_comments", "Comments with open reports"],
            ["open_reports", "Open reports"],
            ["reviewed_today", "My reviews today (Manila)"],
          ]}
        />
        <h3 className="sec-t">Next in the queue</h3>
        <RemoteState compact {...result} />
        {!result.loading && !result.error && (queue.length ? (
          <div className="g3 mod-cards">
            {queue.map((trace, index) => (
              <TraceCard key={trace.id} trace={trace} priority={index < 3} to={`/moderator/review/${encodeURIComponent(trace.id)}`} detailPath="moderation/traces" badges={<QueueBadges trace={trace} />} />
            ))}
          </div>
        ) : <EmptyState title="Queue clear. Nothing pending right now." />)}
      </div>
    </>
  );
}
