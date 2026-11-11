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
import { EnergyCard, QuizReadyCard } from "../../components/EnergyCards.jsx";
import { energyEnabled } from "../../api/energy.js";
import WhatsNew from "../../components/WhatsNew.jsx";
import PageHeader from "../../components/PageHeader.jsx";
import { attentionLine, attentionLink, statItems } from "../../api/dashboardText.js";
import "./dashboard.css";

const icon = (children) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">{children}</svg>;
const ICONS = {
  traces: icon(<><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></>),
  drafts: icon(<><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></>),
  needs_revision: icon(<><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8" /><path d="M21 3v5h-5" /><path d="M21 12a9 9 0 0 1-15.5 6.2L3 16" /><path d="M3 21v-5h5" /></>),
  pending: icon(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  approved: icon(<><circle cx="12" cy="12" r="9" /><path d="m8 12 3 3 5-6" /></>),
  rejected: icon(<><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>),
};

// The hero link jumps to the "Needs your attention" list and moves focus there.
function jumpToAttention(event) {
  const target = document.getElementById("needs-attention");
  if (!target) return;
  event.preventDefault();
  const calm = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView?.({ behavior: calm ? "auto" : "smooth", block: "start" });
  target.focus?.({ preventScroll: true });
}

export default function Dashboard() {
  const { profile } = useApp();
  const totals = useDashboard();
  const recentResult = useRemoteData("traces?limit=3&offset=0", {
    collection: true,
  });
  const recent = (recentResult.data || []).map(displayTrace);
  const fix = attentionLink(totals.data);
  // With Tide Energy on, a finished lesson whose quiz is waiting (or was just passed) takes the "Continue learning" slot.
  const energyOn = energyEnabled();
  const quizReady = useRemoteData(energyOn ? "energy/quiz-ready" : null, { object: true });
  const quizCard = ["ready", "done"].includes(quizReady.data?.state) ? quizReady.data : null;

  return (
    <>
      <PageHeader
        as="h1"
        className="page-hero--dash"
        eyebrow="Your dashboard"
        title={`Kumusta, ${profile?.display_name ?? ""}`}
        subtitle={<>{attentionLine(totals.data)}{fix && <> <a className="hero-link" href="#needs-attention" onClick={jumpToAttention}>{fix}</a></>}</>}
        actions={<Link className="btn clay" to="/user/traces/upload">New Trace</Link>}
      />
      <div className="page-body">
      <div className="dash-grid">
        <div className="dash-stats">
          <DashboardStats
            flush
            showMeta={false}
            result={totals}
            className="stat-row"
            items={statItems(totals.data).map(([key, label, to]) => [key, label, to, ICONS[key]])}
          />
          {totals.data && <p className="dash-meta dash-stats__meta">Updated {new Date(totals.data.as_of).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p>}
        </div>
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
        {recent.map((t, index) => (
          <TraceCard
            key={t.id}
            trace={t}
            priority={index === 0}
            to={`/user/traces/${t.id}`}
          />
        ))}
      </div>
          </section>
        </div>
        <div className="dash-side">
          {energyOn && <EnergyCard />}
          {quizCard && <QuizReadyCard card={quizCard} />}
          {!quizCard && !(energyOn && quizReady.loading) && <section className="dash-learning" aria-label="Continue learning"><NextLesson /></section>}
          <WhatsNew />
        </div>
      </div>

      </div>
    </>
  );
}
