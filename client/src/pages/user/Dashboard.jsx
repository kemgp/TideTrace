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
import PageHeader from "../../components/PageHeader.jsx";
import { attentionLine, STAT_LINKS } from "../../api/dashboardText.js";
import "./dashboard.css";

const icon = (children) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">{children}</svg>;
const ICONS = {
  traces: icon(<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  approved: icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  pending: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
};

export default function Dashboard() {
  const { profile } = useApp();
  const totals = useDashboard();
  const recentResult = useRemoteData("traces?limit=3&offset=0", {
    collection: true,
  });
  const recent = (recentResult.data || []).map(displayTrace);

  return (
    <>
      <PageHeader
        as="h1"
        eyebrow="Your dashboard"
        title={`Kumusta, ${profile?.display_name ?? ""}`}
        subtitle={attentionLine(totals.data)}
        actions={<Link className="banner-action" to="/user/traces/upload">Upload trace</Link>}
      />
      <div className="page-body">
      <div className="dash-stats">
        <DashboardStats
          flush
          showMeta={false}
          result={totals}
          items={[
            ["traces", "Your Traces", STAT_LINKS.traces, ICONS.traces],
            ["approved", "Approved", STAT_LINKS.approved, ICONS.approved],
            ["pending", "In review", STAT_LINKS.pending, ICONS.pending],
          ]}
        />
        {totals.data && <p className="dash-meta dash-stats__meta">Updated {new Date(totals.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
      </div>

      <div className="dash-grid">
        <div className="dash-main">
          {totals.data && <NeedsAttention key={`${totals.data.needs_revision}:${totals.data.drafts}`} revisions={totals.data.needs_revision} drafts={totals.data.drafts} />}
          <section className="dash-community" aria-labelledby="community-title">
      <div className="sec-row">
        <h2 className="sec-t" id="community-title">Recent from the community</h2>
        <Link className="sec-link" to="/user/traces">See all traces</Link>
      </div>

      <RemoteState compact {...recentResult} />

      {recentResult.data && !recent.length && (
        <EmptyState title="No published Traces yet." hint="Approved traces from the community will appear here." action={{ to: "/user/traces/upload", label: "Submit a trace" }} />
      )}

      <div className="g3 community-grid">
        {recent.map((t) => (
          <TraceCard
            key={t.id}
            trace={t}
            to={`/user/traces/${t.id}`}
          />
        ))}
      </div>
          </section>
        </div>
        <div className="dash-side">
          <section className="dash-learning" aria-label="Continue learning"><NextLesson /></section>
          <WhatsNew />
        </div>
      </div>

      </div>
    </>
  );
}
